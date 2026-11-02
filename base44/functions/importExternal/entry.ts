import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { CARD_SCHEMA, cardFieldsInstruction, saveTalkCards } from '../../shared/cardsFromTalk.ts';
import { FIELDS } from '../../shared/taxonomy.ts';
import { loadMemory } from '../../shared/memory.ts';

// ほかのAIとの会話の記録を取り込み、知識カード・AIの記憶・今日の復習に反映する。
// コーディング問題にできる題材も返す（問題そのものは generateCodingProblem で作る）
const SUMMARY_MAX = 1500;

const DIGEST_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    coding: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          request: { type: 'string' },
          difficulty: { type: 'string', enum: ['basic', 'intermediate', 'advanced'] },
        },
        required: ['field', 'request', 'difficulty'],
      },
    },
  },
  required: ['summary', 'coding'],
};

const pad = (n) => String(n).padStart(2, '0');
// 日本時間の今日の日付（復習の予定日に使う）
const todayJst = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || '').trim().slice(0, 60000);
    if (text.length < 40) return Response.json({ error: '貼り付けた文章が短すぎます。対話をそのまま貼り付けてください。' }, { status: 400 });

    // 長い記録ほど話題が多いので、カードの数も少しずつ増やす
    const maxCards = Math.min(16, Math.max(6, Math.ceil(text.length / 3000)));
    const memory = await loadMemory(base44);
    const fieldIds = FIELDS.map((f) => `${f.id}（${f.label}）`).join(' / ');

    const [cardsOut, digest] = await Promise.all([
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `あなたは学習者の会話から知識の構造を取り出す編集者です。
次は、利用者がほかのAIと交わした対話の記録です。

[対話の記録]
${text}

[タスク]
この対話に出てきた正しい知識を、知識カードにしてください。最大${maxCards}枚。
- 学びになる話題（用語、仕組み、理由、比較、判断基準、注意点）を漏らさず拾い、1枚に1つの概念にする。話題が多いときは枚数を増やす。
- 挨拶や進行の確認だけの部分はカードにしない。
${cardFieldsInstruction()}`,
        response_json_schema: CARD_SCHEMA,
      }),
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `次は、利用者がほかのAIと交わした対話の記録です。この記録を、学習アプリ全体に活かすための情報に変えます。

[これまでに残している要点]
${memory?.summary || '（まだありません）'}

[やること]
1. summary: これまでの要点に、この対話から分かったことを統合して書き直す。
- 残すのは、本人の学習の目標、関心のある分野、理解できたこと、つまずいたこと・誤解していたこと、説明の好み、継続中の話題、決めたこと。
- 本人が実際に言ったこと・示したことだけを残す。AIの説明そのものや一般論は残さない。推測で人物像を作らない。
- これまでの要点と食い違うときは新しい内容で置き換え、同じ内容を重ねない。箇条書きの記号は使わず、短い文を並べる。${SUMMARY_MAX}文字以内。
2. coding: 対話の内容を、プログラムを書いて確かめられる問題にできる題材を0〜3件。
- field は次のどれかのIDを入れる: ${fieldIds}
- request には、その題材で問題を作るための依頼文を1〜2文で書く（例: 「対話で扱ったKLダイバージェンスを、2つの離散分布から計算する問題」）。
- プログラムで確かめられる題材がなければ空の配列にする。無理に作らない。
- difficulty は対話での本人の理解度に合わせる。

[対話の記録]
${text}`,
        response_json_schema: DIGEST_SCHEMA,
      }),
    ]);

    const cards = await saveTalkCards(
      base44,
      Array.isArray(cardsOut?.cards) ? cardsOut.cards : [],
      { source: 'import' },
      '',
      maxCards
    );

    // 取り込んだカードは、解く前から今日の復習に並べる
    let scheduled = 0;
    if (cards.length) {
      const due = todayJst();
      await base44.entities.ReviewItem.bulkCreate(
        cards.map((c) => ({ card_id: c.id, title: c.title, domain: c.domain || '', due_date: due, interval_days: 0, streak: 0 }))
      );
      scheduled = cards.length;
    }

    const summary = String(digest?.summary || '').trim().slice(0, SUMMARY_MAX);
    let memoryUpdated = false;
    if (summary) {
      if (memory) await base44.entities.AssistantMemory.update(memory.id, { summary, updated_from: 'import' });
      else await base44.entities.AssistantMemory.create({ summary, updated_from: 'import' });
      memoryUpdated = true;
    }

    const validFields = new Set(FIELDS.map((f) => f.id));
    const coding = (Array.isArray(digest?.coding) ? digest.coding : [])
      .filter((c) => String(c?.request || '').trim())
      .slice(0, 3)
      .map((c) => ({
        field: validFields.has(c.field) ? c.field : '',
        request: String(c.request || '').slice(0, 400),
        difficulty: ['basic', 'intermediate', 'advanced'].includes(c.difficulty) ? c.difficulty : 'basic',
      }));

    return Response.json({ cards, scheduled, memoryUpdated, coding });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
