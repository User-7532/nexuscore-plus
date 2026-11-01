import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { findSubfield, INTERPRET_RULES } from '../../shared/taxonomy.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['cloze', 'written'] },
          text: { type: 'string' },
          answer: { type: 'string' },
          model_answer: { type: 'string' },
          // 解答者が自分で答えるべき語句。問題文に出ていないかの確認に使う（保存はしない）
          target_terms: { type: 'array', items: { type: 'string' } },
          // 解釈が中心の記述で、押さえるべき観点
          rubric: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' },
        },
        required: ['kind', 'text', 'answer', 'target_terms', 'explanation'],
      },
    },
  },
  required: ['questions'],
};

const normalize = (s) =>
  String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・･\-‐_]/g, '');

// 答えの語句（名前・略称・その一部）が問題文に出ていないかを確かめる
function leaksAnswer(text, q) {
  const sources = [...(q.kind === 'cloze' ? [q.answer] : []), ...(Array.isArray(q.target_terms) ? q.target_terms : [])];
  const terms = [];
  sources.forEach((value) => {
    String(value || '')
      .normalize('NFKC')
      .split(/[()、,，/]/)
      .forEach((part) => {
        const t = normalize(part);
        if (t) terms.push(t);
      });
  });
  const body = normalize(String(text).replace(/___/g, ' '));
  return terms.filter((t) => t.length >= 2 && !/^[0-9.]+$/.test(t)).some((t) => body.includes(t));
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const cardId = String(body.card_id || '');
    if (!cardId) return Response.json({ error: 'card_id が必要です' }, { status: 400 });

    // 本人のカードだけを読む（アクセス制限により他人のカードは見つからない）
    const card = await base44.entities.KnowledgeCard.get(cardId).catch(() => null);
    if (!card) return Response.json({ error: 'カードが見つかりません' }, { status: 404 });

    const existingPage = await base44.entities.PracticeQuestion.filter({ card_id: cardId }, { limit: 20 });
    const existing = (existingPage.items || []).map((q) => String(q.text || '').slice(0, 60));

    const place = findSubfield(String(card.field || ''), String(card.subfield || ''));
    const interpret = place?.sub.mode === 'interpret';

    // 解釈が中心の分野では、穴埋めは確かめられる事実だけを問い、記述は観点で判定する
    const interpretBlock = interpret
      ? `
[この分野の扱い]
- cloze は「確かめられること」に書かれた事実だけを空所にする。解釈を空所にしない。
- written は、一つの正解がない問いにしてよい。rubric に、よい解答が押さえるべき観点を3〜4個書く。観点には「事実と解釈を分けて述べている」を必ず含める。特定の結論を観点にしない。
- model_answer は解答の一例として書き、「確かめられること」と「解釈」を分ける。
${INTERPRET_RULES}`
      : '\n- rubric は空の配列にする。';

    const prompt = `あなたは学習者の知識カードから、理解を確かめる練習問題を作る出題者です。

[知識カード]
概念: ${card.title}
分野: ${card.domain || '未設定'}
要約: ${card.summary}
${card.verifiable ? `確かめられること: ${card.verifiable}\n` : ''}${card.interpretation ? `解釈・仮説: ${card.interpretation}\n` : ''}共通する概念: ${(card.key_concepts || []).join(' / ') || 'なし'}
次の問い: ${card.open_question || 'なし'}

[作るもの]
2問つくる。1問目は cloze（空所補充）、2問目は written（記述）。
- cloze: 1〜2文で、空所を ___（半角アンダースコア3つ）で1か所だけ表す。answer には空所の語句を短く入れる。カードの中心となる用語か、その用語を支える重要な語を空所にする。
- written: 仕組み・理由・ほかの概念とのつながりを自分の言葉で説明させる問い。model_answer に2〜4文の模範解答、answer に要点を10〜20字で入れる。
- 問題文に答えを書かない。空所の語句、答えさせたい名前・略称・正式名称、その一部や英語表記・括弧書きの補足も、問題文には入れない。
- target_terms には、解答者が自分で答えるべき語句をすべて入れる。説明させる問いで、主題として問題文に出てよい語は入れない。
- カードに書かれている内容と、その分野で確立している事実だけを使う。カードにない主張を作らない。
- 専門用語は正確な標準用語で書き、比喩や曖昧な言い換えで中身を薄めない。日本語で、短く。
- explanation は1〜2文で、なぜそうなるかを説明する。
${interpretBlock}
${existing.length ? `\n[既にある問題（同じ内容は作らない）]\n- ${existing.join('\n- ')}` : ''}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA });
    const raw = Array.isArray(result?.questions) ? result.questions.slice(0, 3) : [];

    const records = [];
    raw.forEach((q) => {
      const text = String(q?.text || '').trim();
      const kind = q?.kind === 'written' ? 'written' : 'cloze';
      if (text.length < 10) return;
      if (kind === 'cloze' && !text.includes('___')) return;
      if (leaksAnswer(text, { ...q, kind })) return;
      const rubric = interpret && kind === 'written' ? (Array.isArray(q?.rubric) ? q.rubric : []).map((r) => String(r).slice(0, 120)).slice(0, 5) : [];
      records.push({
        card_id: card.id,
        domain: card.domain || '',
        field: card.field || '',
        subfield: card.subfield || '',
        assessment: rubric.length ? 'rubric' : 'exact',
        rubric,
        kind,
        text,
        answer: String(q?.answer || '').slice(0, 200),
        model_answer: kind === 'written' ? String(q?.model_answer || '').slice(0, 800) : '',
        explanation: String(q?.explanation || '').slice(0, 600),
      });
    });

    if (!records.length) return Response.json({ questions: [], reason: '問題を作れませんでした。もう一度お試しください。' });

    const created = await base44.entities.PracticeQuestion.bulkCreate(records);
    return Response.json({ questions: Array.isArray(created) ? created : created?.items || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
