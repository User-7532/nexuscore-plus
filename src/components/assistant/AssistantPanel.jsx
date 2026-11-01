import { useEffect, useRef, useState } from 'react';
import { GripHorizontal, Loader2, Maximize2, Minimize2, Search, Send, X } from 'lucide-react';
import MessageSearch from '@/components/assistant/MessageSearch';

const CHIPS = [
  'この画面の内容を、もう少し噛みくだいて',
  'いまの記録から、次の一歩を一つだけ',
  'ここで出てきた概念を、別の分野とつなげて',
  'まだ曖昧なカードを一緒に整理したい',
];

export default function AssistantPanel({
  messages,
  busy,
  onSend,
  onClose,
  onLoadFrom,
  expanded,
  onToggleExpand,
  dragProps,
  dragging,
}) {
  const [draft, setDraft] = useState('');
  const [searching, setSearching] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const msgRefs = useRef({});
  // 読み込みを待ってから移動する発言のID
  const pendingJump = useRef(null);

  const scrollToMessage = (id) => {
    const el = msgRefs.current[id];
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  };

  useEffect(() => {
    // 検索から移動する途中なら、最下部ではなくその発言へ移動する
    if (pendingJump.current) {
      scrollToMessage(pendingJump.current);
      pendingJump.current = null;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
  }, []);

  // 検索候補を閉じてから、選んだ発言の位置までスクロールする（目印は付けない）
  const jumpTo = (m) => {
    setSearching(false);
    if (msgRefs.current[m.id]) {
      setTimeout(() => scrollToMessage(m.id), 0);
      return;
    }
    if (!onLoadFrom || !m.created_date) return;
    pendingJump.current = m.id;
    onLoadFrom(m.created_date);
  };

  const submit = () => {
    if (!draft.trim() || busy) return;
    onSend(draft);
    setDraft('');
  };

  // サジェストは送らずに入力欄へ入れ、手を加えてから送れるようにする
  const fill = (text) => {
    setDraft(text);
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    requestAnimationFrame(() => el.setSelectionRange(text.length, text.length));
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-[0_18px_50px_-20px_rgba(40,34,28,0.45)]">
      <div
        {...dragProps}
        className={`flex touch-none select-none items-center justify-between border-b border-border/60 px-4 py-3 ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        title="ドラッグで移動できます"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-display text-[11px] text-primary">A</span>
          <p className="text-[12.5px]">伴走者に聞く</p>
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.6} />
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSearching((v) => !v)}
            onPointerDown={stop}
            className={`rounded-full p-1.5 transition-colors hover:bg-secondary ${searching ? 'text-primary' : 'text-muted-foreground'}`}
            title="これまでの会話を探す"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            onPointerDown={stop}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={expanded ? '小さくする' : '広げる'}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.7} /> : <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.7} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={stop}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="閉じる"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
        </div>
      </div>

      {searching && <MessageSearch onPick={jumpTo} />}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages === null ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
          </div>
        ) : messages.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] leading-[1.9] text-muted-foreground">
            いま開いている画面と、これまでの記録を踏まえて答えます。
            <br />
            どの画面からでも、思いついたときに。
            <br />
            3往復ごとに、会話から知識カードが育ちます。
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              ref={(el) => {
                msgRefs.current[m.id] = el;
              }}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-[18px] px-3.5 py-2.5 text-[12.5px] leading-[1.9] ${
                  m.role === 'user' ? 'bg-primary/10' : 'bg-secondary/60'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex items-center gap-1.5 px-1 text-[11.5px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> 考えています
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/60 px-3 py-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => fill(c)}
              disabled={busy}
              className="shrink-0 rounded-full border border-border/70 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // 変換中のEnterは送信せず、確定に使う
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              submit();
            }}
            rows={expanded ? 2 : 1}
            maxLength={1500}
            placeholder="何でも話しかけてください"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-border/70 bg-background px-3.5 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-primary/40"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !draft.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            title="送る"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}
