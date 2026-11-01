// 会話から知識カードを作る共通部分。学びの対話（generateKnowledgeCards）と
// 全画面共通のAIチャット（generateAssistantCards）の両方で使う
import { findSubfield, taxonomyList, INTERPRET_RULES } from './taxonomy.ts';

export const CARD_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          key_concepts: { type: 'array', items: { type: 'string' } },
          open_question: { type: 'string' },
          domain: { type: 'string' },
          field: { type: 'string' },
          subfield: { type: 'string' },
          verifiable: { type: 'string' },
          interpretation: { type: 'string' },
        },
        required: ['title', 'summary', 'key_concepts'],
      },
    },
  },
  required: ['cards'],
};

// カード1枚ぶんの書き方。どちらの会話から作るときも同じ指示を使う
export function cardFieldsInstruction() {
  return `- title: 概念の名前（12文字前後。原語がある場合は括弧で併記）
- summary: 相手の言葉づかいに寄せた2〜3文の要約（120字程度）
- key_concepts: 他のカードとつながるための共通概念タグを2〜4個（短い名詞。日本語）
- open_question: 次に考えたい小さな問いを1つ
- field / subfield: 次の分類から最も近いものをIDで選ぶ。どれにも当てはまらなければ両方とも空文字。
${taxonomyList()}
- domain: subfield を選んだときはその日本語名。選ばなかったときは最も近い分野名
- subfield が neuro-case / thought-neuro / hidden-suffering のときは、verifiable に確かめられること、interpretation に解釈・仮説を分けて書く。それ以外は両方とも空文字。
${INTERPRET_RULES}
会話に実際に出てきた内容だけを使う。教科書的な一般論の要約にはしない。
日本語で。`;
}

function normalizedConcepts(card) {
  return new Set(
    (card.key_concepts || []).map((c) => String(c).trim().toLowerCase()).filter(Boolean)
  );
}

function sharesConcept(a, b) {
  for (const concept of a) {
    if (b.has(concept)) return true;
  }
  return false;
}

// AIが返したカードを、重複を除いて保存し、既存のカードと共通概念でつなぐ
// extra: どの会話から生まれたか（source, source_conversation_id, stack_id など）
export async function saveTalkCards(base44, rawCards, extra = {}, fallbackDomain = '') {
  const existingPage = await base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 200 });
  const existing = existingPage.items || [];
  const existingTitles = new Set(existing.map((c) => String(c.title || '').trim().toLowerCase()));
  const existingConcepts = existing.map((c) => ({ id: c.id, concepts: normalizedConcepts(c) }));

  const fresh = (rawCards || []).slice(0, 4).filter((card) => {
    const key = String(card.title || '').trim().toLowerCase();
    if (!key || existingTitles.has(key)) return false;
    existingTitles.add(key);
    return true;
  });
  if (!fresh.length) return [];

  const payloads = fresh.map((card) => {
    const concepts = normalizedConcepts(card);
    const related = existingConcepts
      .filter((item) => sharesConcept(concepts, item.concepts))
      .slice(0, 4)
      .map((item) => item.id);
    // 存在しない分類IDが返ってきたときは未分類にする
    const place = findSubfield(String(card.field || ''), String(card.subfield || ''));
    const interpret = place?.sub.mode === 'interpret';
    return {
      title: card.title,
      summary: card.summary,
      key_concepts: card.key_concepts || [],
      open_question: card.open_question || '',
      domain: place ? place.sub.label : card.domain || fallbackDomain,
      field: place ? place.field.id : '',
      subfield: place ? place.sub.id : '',
      verifiable: interpret ? String(card.verifiable || '') : '',
      interpretation: interpret ? String(card.interpretation || '') : '',
      related_card_ids: related,
      understanding: 0,
      visit_count: 0,
      ...extra,
    };
  });

  const created = await base44.entities.KnowledgeCard.bulkCreate(payloads);

  const createdConcepts = created.map((card) => ({ id: card.id, concepts: normalizedConcepts(card) }));
  const updates = [];

  created.forEach((card, index) => {
    const peers = createdConcepts
      .filter((item, i) => i !== index && sharesConcept(createdConcepts[index].concepts, item.concepts))
      .map((item) => item.id);
    const merged = Array.from(new Set([...(card.related_card_ids || []), ...peers]));
    if (merged.length !== (card.related_card_ids || []).length) {
      updates.push({ id: card.id, related_card_ids: merged });
    }
  });

  existing.forEach((card) => {
    const concepts = normalizedConcepts(card);
    const linked = createdConcepts
      .filter((item) => sharesConcept(concepts, item.concepts))
      .map((item) => item.id);
    if (!linked.length) return;
    const merged = Array.from(new Set([...(card.related_card_ids || []), ...linked]));
    if (merged.length !== (card.related_card_ids || []).length) {
      updates.push({ id: card.id, related_card_ids: merged });
    }
  });

  if (updates.length) {
    await base44.entities.KnowledgeCard.bulkUpdate(updates.slice(0, 100));
  }
  return created;
}
