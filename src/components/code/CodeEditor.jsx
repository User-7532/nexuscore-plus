import { useMemo } from 'react';
import { highlight } from '@/lib/code/highlight';
import { languageFilename } from '@/lib/code/languages';
import { autoIndent } from '@/lib/code/indent';

// 透明な textarea の下に色分けした pre を重ねた、軽いコードエディタ。
// 背景は見た目の設定にかかわらず暗色に固定し、コードを読みやすくする
export default function CodeEditor({ value = '', onChange, language = 'python', minRows = 16 }) {
  const html = useMemo(() => highlight(value, language), [value, language]);
  const lineCount = Math.max(1, value.split('\n').length);
  const rows = Math.max(minRows, lineCount + 1);

  const handleKeyDown = (e) => {
    const el = e.target;

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      const { value: next, caret } = autoIndent({ value, start: el.selectionStart, end: el.selectionEnd, language });
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = caret;
      });
      return;
    }

    if (e.key !== 'Tab') return;
    e.preventDefault();
    const start = el.selectionStart;
    onChange(`${value.slice(0, start)}    ${value.slice(el.selectionEnd)}`);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 4;
    });
  };

  return (
    <div className="code-surface overflow-hidden rounded-[18px] border">
      <div className="code-bar flex items-center gap-2 border-b px-3.5 py-2">
        <span className="h-2 w-2 rounded-full bg-[#c2603f]" />
        <span className="font-mono text-[11px] opacity-80">{languageFilename(language)}</span>
      </div>
      <div className="flex max-h-[62vh] overflow-y-auto">
        <div aria-hidden className="code-gutter select-none border-r px-2.5 py-3 text-right font-mono text-[12px] leading-6">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <pre
            aria-hidden
            className="pointer-events-none absolute inset-0 whitespace-pre-wrap px-3 py-3 font-mono text-[13px] leading-6 [overflow-wrap:anywhere]"
            dangerouslySetInnerHTML={{ __html: `${html}\n` }}
          />
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={rows}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="コード"
            className="relative w-full resize-none whitespace-pre-wrap bg-transparent px-3 py-3 font-mono text-[13px] leading-6 text-transparent caret-[#f1b6a2] outline-none [overflow-wrap:anywhere]"
          />
        </div>
      </div>
    </div>
  );
}
