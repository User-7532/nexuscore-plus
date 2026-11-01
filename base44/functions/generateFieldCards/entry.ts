import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { findSubfield, INTERPRET_RULES } from '../../shared/taxonomy.ts';

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
          verifiable: { type: 'string' },
          interpretation: { type: 'string' },
        },
        required: ['title', 'summary', 'key_concepts', 'open_question'],
      },
    },
  },
  required: ['cards'],
};

const conceptSet = (card) => new Set((card.key_concepts || []).map((c) => String(c).trim().toLowerCase()).filter(Boolean));
const shares = (a, b) => [...a].some((c) => b.has(c));

// 選んだ下位分野の概念カードをAIが作る。共通する概念で既存のカードと自動でつなぐ
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const found = findSubfield(String(body.field || ''), String(body.subfield || ''));
    if (!found) return Response.json({ error: '分野が見つかりません' }, { status: 400 });
    const { field, sub } = found;
    const count = Math.max(2, Math.min(5, Number(body.count) || 3));
    const interpret = sub.mode === 'interpret';

    const [samePage, allPage, profilePage] = await Promise.all([
      base44.entities.KnowledgeCard.filter({ field: field.id, subfield: sub.id }, { sort: '-created_date', limit: 60 }),
      base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 200 }),
      base44.entities.Profile.list({ limit: 1 }),
    ]);
    const same = samePage.items || [];
    const all = allPage.items || [];
    const profile = (profilePage.items || [])[0];

    // 理解度の平均で、次に出す概念の深さを決める
    const avg = same.length ? same.reduce((s, c) => s + (Number(c.understanding) || 0), 0) / same.length : 0;
    const depth =
      same.length < 3
        ? 'この分野の入口になる、基礎的で重要な概念から選ぶ。'
        : avg >= 2
          ? 'すでに基礎は押さえている。一段深い概念や、ほかの概念同士をつなぐ概念を選ぶ。'
          : '基礎の概念を固める。既存のカードの前提になっている概念や、つまずきやすい概念を選ぶ。';

    const prompt = `あなたは、学習者のための知識カードを作る編集者です。「${field.label} / ${sub.label}」の概念カードを${count}枚作ってください。

[この分野で扱う範囲]
${sub.scope}

[学習者]
${profile?.ultimate_goal ? `目的: ${profile.ultimate_goal}` : '目的は未設定'}
${profile?.current_focus ? `いまの焦点: ${profile.current_focus}` : ''}

[選び方]
${depth}

[カードの書き方]
- title: 概念の名前（12文字前後。原語がある場合は括弧で併記）
- summary: 2〜3文の要約（120字程度）。定義と、なぜ重要かを書く。
- key_concepts: ほかのカードとつながるための共通概念タグを2〜4個（短い名詞。日本語）
- open_question: 次に考えたい小さな問いを1つ
- 専門用語は正確な標準用語で書き、比喩や曖昧な言い換えで中身を薄めない。確立していない説は「〜という説」と明記する。日本語で。
${interpret ? `- verifiable: 確かめられることだけを1〜3文で書く。\n- interpretation: 解釈・仮説としてまとめられることを1〜3文で書く。\n- summary には両方を混ぜずに、何についてのカードかを書く。\n\n${INTERPRET_RULES}` : '- verifiable と interpretation は空文字にする。'}

[既にあるカード（同じ概念は作らない）]
${same.map((c) => `- ${c.title}`).join('\n') || 'なし'}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: CARD_SCHEMA });
    const raw = Array.isArray(result?.cards) ? result.cards.slice(0, count) : [];

    const titles = new Set(all.map((c) => String(c.title || '').trim().toLowerCase()));
    const existingConcepts = all.map((c) => ({ id: c.id, concepts: conceptSet(c) }));

    const payloads = raw
      .filter((c) => {
        const key = String(c.title || '').trim().toLowerCase();
        if (!key || titles.has(key) || !String(c.summary || '').trim()) return false;
        titles.add(key);
        return true;
      })
      .map((c) => {
        const concepts = conceptSet(c);
        return {
          title: String(c.title).slice(0, 60),
          summary: String(c.summary).slice(0, 600),
          key_concepts: (c.key_concepts || []).slice(0, 4),
          open_question: String(c.open_question || '').slice(0, 300),
          verifiable: interpret ? String(c.verifiable || '').slice(0, 600) : '',
          interpretation: interpret ? String(c.interpretation || '').slice(0, 600) : '',
          field: field.id,
          subfield: sub.id,
          domain: sub.label,
          source: 'field',
          related_card_ids: existingConcepts.filter((x) => shares(concepts, x.concepts)).slice(0, 4).map((x) => x.id),
          understanding: 0,
          visit_count: 0,
        };
      });

    if (!payloads.length) return Response.json({ created: [], reason: '新しい概念が見つかりませんでした。もう一度お試しください。' });

    const createdRaw = await base44.entities.KnowledgeCard.bulkCreate(payloads);
    const created = Array.isArray(createdRaw) ? createdRaw : createdRaw?.items || [];

    // 既存のカードからも、新しいカードへのつながりを張る
    const updates = [];
    all.forEach((card) => {
      const concepts = conceptSet(card);
      const linked = created.filter((n) => shares(concepts, conceptSet(n))).map((n) => n.id);
      if (!linked.length) return;
      const merged = Array.from(new Set([...(card.related_card_ids || []), ...linked]));
      if (merged.length !== (card.related_card_ids || []).length) updates.push({ id: card.id, related_card_ids: merged });
    });
    if (updates.length) await base44.entities.KnowledgeCard.bulkUpdate(updates.slice(0, 100));

    return Response.json({ created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
