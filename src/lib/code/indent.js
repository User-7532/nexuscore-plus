const UNIT = '    ';
const OPENERS = '([{';
const CLOSERS = ')]}';

const leading = (line) => (line.match(/^[ \t]*/) || [''])[0];

// 改行時に、直前の行と構文から次の行の字下げを決める
export function autoIndent({ value, start, end, language }) {
  const isPython = language === 'python';
  const before = value.slice(0, start);
  const after = value.slice(end);

  const lineStart = before.lastIndexOf('\n') + 1;
  const earlierLines = before.slice(0, lineStart).split('\n');
  const prevLine = before.slice(lineStart);

  let base = leading(prevLine);
  let source = prevLine.trim();

  // 空行なら、その上で最後に文字があった行の字下げを引き継ぐ
  if (!source) {
    for (let i = earlierLines.length - 1; i >= 0; i -= 1) {
      if (earlierLines[i].trim()) {
        base = leading(earlierLines[i]);
        source = earlierLines[i].trim();
        break;
      }
    }
  }

  let indent = base;
  if (source) {
    const last = source.slice(-1);
    const opensBlock = isPython ? last === ':' : OPENERS.includes(last);
    if (opensBlock) indent = base + UNIT;
  }

  const nextChar = after[0] || '';
  const opensHere = !isPython && source && OPENERS.includes(source.slice(-1));

  // C系で開き括弧の直後に閉じ括弧が来る場合は、閉じ括弧を次の行に分ける
  if (opensHere && CLOSERS.includes(nextChar)) {
    return { value: `${before}\n${indent}\n${base}${after}`, caret: before.length + 1 + indent.length };
  }

  return { value: `${before}\n${indent}${after}`, caret: before.length + 1 + indent.length };
}
