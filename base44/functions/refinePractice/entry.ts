import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// 記述の練習問題の聞き方を見直す。答え方が何通りもある問い（「どのような〜があるか」など）を、
// 観点・数・条件を指定して答えの範囲が定まる問いに書き直し、模範解答と採点の観点もそれに合わせる
const BATCH = 12;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ambiguous: { type: 'boolean' },
          text: { type: 'string' },
          model_answer: { type: 'string' },
          answer: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
          target_terms: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'ambiguous', 'text', 'model_answer', 'answer', 'points', 'target_terms'],
      },
    },
  },
  required: ['items'],
};

const normalize = (s) =>
  String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・･\-‐_]/g, '');

// 書き直した問題文に、答えさせたい語句が出ていないか
function leaks(text, terms) {
  const body = normalize(text);
  return (terms || [])
    .map(normalize)
    .filter((t) => t.length >= 2 && !/^[0-9.]+$/.test(t))
    .some((t) => body.includes(t));
}

const FACT_POINT = '事実と解釈を分けて述べている';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean).slice(0, BATCH) : [];

    // 指定がなければ、まだ見直していない記述問題を古い順に少しずつ
    const page = ids.length
      ? await base44.entities.PracticeQuestion.filter({ id: { $in: ids } }, { limit: BATCH })
      : await base44.entities.PracticeQuestion.filter({ kind: 'written' }, { sort: 'created_date', limit: 500 });
    const pending = (page.items || []).filter((q) => q.kind === 'written' && q.refined !== true);
    const batch = pending.slice(0, BATCH);
    if (!batch.length) return Response.json({ refined: 0, changed: 0, remaining: 0, questions: [] });

    const list = batch
      .map((q) => {
        const isRubric = q.assessment === 'rubric';
        const points = isRubric ? q.rubric || [] : q.expected_points || [];
        return `id: ${q.id}\n判定の方式: ${isRubric ? '観点方式（一つの正解がない解釈の問い）' : '正誤方式'}\n問題: ${q.text}\n模範解答: ${q.model_answer || ''}\n要点: ${q.answer || ''}\n採点の観点: ${points.join(' / ') || '（なし）'}\n解説: ${q.explanation || ''}`;
      })
      .join('\n\n');

    const out = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `あなたは記述問題を点検する編集者です。次の記述問題が、解答者にとって「何を答えれば正解になるか」が分かる聞き方になっているかを1問ずつ確かめてください。

あいまいな問いの例:
- 「〜にはどのようなものがあるか」「〜について説明せよ」のように、正しい答えが何通りもあり、どれを求めているのか分からない。
- 求める観点・数・場面が書かれておらず、模範解答とは別の正しい答えを書いても不正解にされかねない。

やること（1問ごと）:
- ambiguous: あいまいなら true、答えの範囲が定まっているなら false。
- あいまいな問いは、模範解答の内容が正解になるように、問題文に観点・数・条件を足して書き直す。例:「目標性能を満たすための施策を、ソフトウェア面とハードウェア面から1つずつ挙げよ。」
- 書き直すときも、答えさせたい語句そのものは問題文に書かない。答えを示唆しすぎない。
- model_answer は書き直した問いにぴったり答える2〜4文、answer はその要点を10〜20字にする。
- points は、書き直した問いが求めている要素を、問いの観点・数に合わせて1〜4個、問いの条件として書く（例:「ソフトウェア面の施策を1つ」）。
- 判定の方式が観点方式の問いは、一つの正解を作らない。問いには「どの観点から論じるか」を書き、points はよい解答が押さえるべき観点にする。points には「${FACT_POINT}」を必ず含め、特定の結論を観点にしない。
- あいまいでない問いは、text・model_answer・answer・points を元のまま返す（採点の観点がない問いは、問いの条件から書き起こす）。
- target_terms には、解答者が自分で答えるべき語句を入れる。
- 日本語で、専門用語は正確な標準用語を使う。問いの主題や難しさは変えない。

[記述問題]
${list}`,
      response_json_schema: SCHEMA,
    });

    const byId = new Map((Array.isArray(out?.items) ? out.items : []).map((x) => [String(x.id), x]));
    let changed = 0;
    const updated = [];
    for (const q of batch) {
      const fix = byId.get(q.id);
      const patch = { refined: true };
      const text = String(fix?.text || '').trim();
      // 書き直しがあいまいさを解消していて、答えを漏らしていないときだけ置き換える
      if (fix?.ambiguous && text && text !== q.text && !leaks(text, fix.target_terms)) {
        patch.text = text.slice(0, 600);
        if (String(fix.model_answer || '').trim()) patch.model_answer = String(fix.model_answer).trim().slice(0, 800);
        if (String(fix.answer || '').trim()) patch.answer = String(fix.answer).trim().slice(0, 200);
        changed += 1;
      }
      const points = (Array.isArray(fix?.points) ? fix.points : []).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 5);
      if (points.length) {
        if (q.assessment === 'rubric') {
          if (patch.text || !(q.rubric || []).length) {
            patch.rubric = points.some((p) => p.includes('事実と解釈')) ? points : [...points.slice(0, 4), FACT_POINT];
          }
        } else if (patch.text || !(q.expected_points || []).length) {
          patch.expected_points = points.slice(0, 4);
        }
      }
      await base44.entities.PracticeQuestion.update(q.id, patch);
      updated.push({ ...q, ...patch });
    }

    return Response.json({
      refined: batch.length,
      changed,
      remaining: ids.length ? 0 : Math.max(0, pending.length - batch.length),
      questions: updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
