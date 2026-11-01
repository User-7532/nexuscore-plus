import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { buildStackBlock, buildTranscript } from '../../shared/tutorContext.ts';
import { findSubfield, taxonomyList, INTERPRET_RULES } from '../../shared/taxonomy.ts';

const CARD_SCHEMA = {
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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (!body.conversationId) {
      return Response.json({ error: 'conversationId が必要です' }, { status: 400 });
    }

    const conversation = await base44.entities.Conversation.get(body.conversationId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!conversation) {
      return Response.json({ error: '対話が見つかりません' }, { status: 404 });
    }

    const stack = conversation.stack_id
      ? await base44.entities.LearningStack.get(conversation.stack_id).catch((e) =>
          e.status === 404 ? null : Promise.reject(e)
        )
      : null;

    const historyPage = await base44.entities.Message.filter(
      { conversation_id: conversation.id },
      { sort: 'created_date', limit: 40 }
    );
    const history = historyPage.items || [];
    if (history.length < 2) {
      return Response.json({ created: [], reason: '対話がまだ短すぎます' });
    }

    const prompt = [
      'あなたは学習者の対話から知識の構造を取り出す編集者です。',
      buildStackBlock(stack),
      `[対話]\n${buildTranscript(history)}`,
      `[タスク]
この対話から、相手が実際に手に入れた概念を1〜4枚の知識カードにしてください。
- title: 概念の名前（12文字前後。原語がある場合は括弧で併記）
- summary: 相手の言葉づかいに寄せた2〜3文の要約（120字程度）
- key_concepts: 他のカードとつながるための共通概念タグを2〜4個（短い名詞。日本語）
- open_question: 次に考えたい小さな問いを1つ
- field / subfield: 次の分類から最も近いものをIDで選ぶ。どれにも当てはまらなければ両方とも空文字。
${taxonomyList()}
- domain: subfield を選んだときはその日本語名。選ばなかったときは最も近い分野名
- subfield が neuro-case / thought-neuro / hidden-suffering のときは、verifiable に確かめられること、interpretation に解釈・仮説を分けて書く。それ以外は両方とも空文字。
${INTERPRET_RULES}
対話に実際に出てきた内容だけを使う。教科書的な一般論の要約にはしない。
日本語で。`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: CARD_SCHEMA,
    });

    const rawCards = Array.isArray(result?.cards) ? result.cards.slice(0, 4) : [];

    const existingPage = await base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 200 });
    const existing = existingPage.items || [];
    const existingTitles = new Set(existing.map((c) => String(c.title || '').trim().toLowerCase()));
    const existingConcepts = existing.map((c) => ({ id: c.id, concepts: normalizedConcepts(c) }));

    const fresh = rawCards.filter((card) => {
      const key = String(card.title || '').trim().toLowerCase();
      if (!key || existingTitles.has(key)) return false;
      existingTitles.add(key);
      return true;
    });

    if (!fresh.length) {
      return Response.json({ created: [], reason: '新しい概念は見つかりませんでした' });
    }

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
        domain: place ? place.sub.label : card.domain || (stack ? stack.name : ''),
        field: place ? place.field.id : '',
        subfield: place ? place.sub.id : '',
        verifiable: interpret ? String(card.verifiable || '') : '',
        interpretation: interpret ? String(card.interpretation || '') : '',
        source: 'dialogue',
        stack_id: conversation.stack_id || '',
        source_conversation_id: conversation.id,
        related_card_ids: related,
        understanding: 0,
        visit_count: 0,
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

    await base44.entities.Conversation.update(conversation.id, {
      cards_generated_at: new Date().toISOString(),
    });

    return Response.json({ created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}