import { base44 } from '@/api/base44Client';

export const IMPORT_MAX = 60000;
export const IMPORT_MIN = 40;

// ほかのAIとの会話を取り込み、知識カード・今日の復習・AIの記憶・コーディング問題に反映する
export async function importExternal(raw) {
  const text = String(raw || '').trim().slice(0, IMPORT_MAX);
  if (text.length < IMPORT_MIN) throw new Error('貼り付けた文章が短すぎます。対話をそのまま貼り付けてください。');

  const [mainRes, lastSub] = await Promise.allSettled([
    base44.functions.invoke('importExternal', { text }),
    base44.entities.Submission.list({ sort: '-created_date', limit: 1 }),
  ]);
  if (mainRes.status === 'rejected') throw mainRes.reason;
  const main = mainRes.value.data || {};
  if (main.error) throw new Error(main.error);

  // コーディング問題は、いつも使っている言語で作る
  const language = (lastSub.status === 'fulfilled' && lastSub.value.items?.[0]?.language) || 'python';
  const made = await Promise.allSettled(
    (main.coding || []).map((c) =>
      base44.functions.invoke('generateCodingProblem', {
        field: c.field,
        difficulty: c.difficulty,
        language,
        request: c.request,
      })
    )
  );
  const problems = made
    .filter((r) => r.status === 'fulfilled' && r.value.data?.problem)
    .map((r) => r.value.data.problem);
  const errors = [];
  if (made.some((r) => r.status === 'rejected' || !r.value?.data?.problem)) errors.push('コーディング問題の一部');

  return {
    cards: main.cards || [],
    problems,
    scheduled: main.scheduled || 0,
    memoryUpdated: !!main.memoryUpdated,
    errors,
  };
}

// 取り込んだ結果を、短い報告文にする
export function importReport(result) {
  const lines = ['取り込みました。'];
  lines.push(`・知識カード: ${result.cards.length}枚（「知識カード」で見られます）`);
  lines.push(`・今日の復習に${result.scheduled}枚追加しました`);
  if (result.problems.length) {
    lines.push(`・コーディング問題: ${result.problems.length}問（${result.problems.map((p) => `「${p.title}」`).join('')}。「コーディング」の一覧にあります）`);
  } else {
    lines.push('・コーディング問題: プログラムで確かめられる題材がなかったので、作っていません');
  }
  if (result.memoryUpdated) lines.push('・会話の要点を覚えました。これからの返答に反映します');
  if (result.errors.length) lines.push(`うまくいかなかったもの: ${result.errors.join('、')}`);
  return lines.join('\n');
}
