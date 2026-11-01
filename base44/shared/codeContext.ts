// コーディング練習の関数で共通に使う言語の前提
export const LANGUAGES = ['python', 'cpp', 'c'];

export const LANG_LABEL = { python: 'Python', c: 'C', cpp: 'C++' };

export const LANG_NOTES = {
  python: 'Python 3。リスト、辞書、内包表記、スライスなどの標準的な書き方を使う。外部ライブラリ（numpy など）は使わない。',
  c: 'C言語（C99以降）。C++専用の機能は使わない。<stdio.h>・<stdlib.h>・<string.h>・<math.h> と malloc/free で書く。',
  cpp: 'C++17。std::vector、std::string、std::sort などの標準ライブラリを使ってよい。',
};

export const LANG_FENCE = { python: 'python', c: 'c', cpp: 'cpp' };

export const pickLanguage = (value) => (LANGUAGES.includes(value) ? value : 'python');

// 問題を本人のデータから読む。アクセス制限により、他人の問題は見つからない
export async function loadProblem(base44, id) {
  if (!id) return null;
  return base44.entities.Problem.get(id).catch(() => null);
}
