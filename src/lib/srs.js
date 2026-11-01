import { base44 } from '@/api/base44Client';

// 正解が続くごとに復習の間隔を伸ばす（日数）。間違えたら翌日からやり直す
const STEPS = [1, 3, 7, 14, 30, 60];

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = () => toISO(new Date());

export const addDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
};

export function nextSchedule(existing, correct) {
  const streak = existing?.streak || 0;
  if (!correct) {
    return { streak: 0, interval_days: 1, due_date: addDaysISO(1), last_result: 'wrong' };
  }
  const nextStreak = streak + 1;
  const interval = STEPS[Math.min(nextStreak - 1, STEPS.length - 1)];
  return { streak: nextStreak, interval_days: interval, due_date: addDaysISO(interval), last_result: 'correct' };
}

// 知識カード1枚ごとに、次に出し直す日を決める
export async function recordReview({ card, correct }) {
  const { items } = await base44.entities.ReviewItem.filter({ card_id: card.id }, { limit: 1 });
  const existing = items[0];
  const next = nextSchedule(existing, correct);
  const meta = { title: card.title, domain: card.domain || '' };
  if (existing) return base44.entities.ReviewItem.update(existing.id, { ...next, ...meta });
  return base44.entities.ReviewItem.create({ card_id: card.id, ...meta, ...next });
}
