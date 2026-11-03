// 答えを出す前の画面に、答えそのものが見えてしまわないようにするための小さな道具

const normalize = (s) =>
  String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・･\-‐_()（）「」]/g, '');

// 見出しやラベルが、問題の答えを含んでいる（または答えに含まれている）か
export function revealsAnswer(label, question) {
  const l = normalize(label);
  if (l.length < 2 || !question) return false;
  return String(question.answer || '')
    .normalize('NFKC')
    .split(/[、,，/／]/)
    .map(normalize)
    .filter((a) => a.length >= 2)
    .some((a) => l.includes(a) || a.includes(l));
}
