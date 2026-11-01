import { base44 } from '@/api/base44Client';
import { recordReview } from '@/lib/srs';

// カード1枚ぶんの練習問題を取り出す。まだなければAIに作ってもらう
export async function questionsFor(cardId) {
  const page = await base44.entities.PracticeQuestion.filter({ card_id: cardId }, { limit: 20 });
  const items = page.items || [];
  if (items.length) return items;
  const res = await base44.functions.invoke('generatePractice', { card_id: cardId });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.questions || [];
}

// 記述を外す設定のときは穴埋めだけ。それ以外は種類を交互にしつつランダムに選ぶ
export function pickQuestion(list, { light = false } = {}) {
  const pool = (list || []).filter((q) => !light || q.kind !== 'written');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function recordPractice({ question, card, correct, mode = 'practice' }) {
  base44.entities.PracticeAttempt.create({
    question_id: question?.id || '',
    card_id: card.id,
    domain: card.domain || '',
    field: card.field || '',
    subfield: card.subfield || '',
    kind: question?.kind || 'cloze',
    correct,
    mode,
  }).catch(() => {});
  recordReview({ card, correct }).catch(() => {});
  base44.entities.KnowledgeCard.update(card.id, {
    visit_count: (card.visit_count || 0) + 1,
    last_visited_at: new Date().toISOString(),
  }).catch(() => {});
}

export const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
