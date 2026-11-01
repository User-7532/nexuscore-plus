import { useRef, useState } from 'react';
import { ArrowUp, ChevronDown, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// 解いている画面の中で使う小さな対話欄。文法・語彙の質問窓口と、採点後のメンターで共通に使う
export default function MiniChat({
  fn,
  payload,
  title,
  note,
  icon: Icon,
  suggestions = [],
  placeholder,
  intro,
  monoReply = false,
  collapsible = false,
  defaultOpen = true,
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await base44.functions.invoke(fn, { ...payload, messages: next });
      if (res.data?.error) throw new Error(res.data.error);
      setMessages([...next, { role: 'assistant', content: res.data.reply }]);
    } catch (e) {
      toast({ title: '返事を受け取れませんでした', description: e.message, variant: 'destructive' });
      setMessages(messages);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    }
  };

  const header = (
    <>
      {Icon && <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.7} />}
      <span className="text-[12.5px]">{title}</span>
      {note && <span className="ml-1 hidden text-[10.5px] text-muted-foreground sm:inline">{note}</span>}
    </>
  );

  return (
    <div className="rounded-[20px] border border-border/70 bg-card">
      {collapsible ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-5 py-3.5 text-left">
          {header}
          <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">{header}</div>
      )}

      {open && (
        <div className={collapsible ? 'border-t border-border/60' : ''}>
          <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <div className="space-y-2.5">
                {intro && <p className="text-[11.5px] leading-relaxed text-muted-foreground">{intro}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-border/70 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <p
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-[16px] bg-primary/10 px-3.5 py-2 text-[12px] leading-relaxed'
                        : `max-w-[94%] whitespace-pre-wrap rounded-[16px] bg-secondary/60 px-3.5 py-2 text-[12px] leading-[1.85] ${monoReply ? 'font-mono text-[11.5px]' : ''}`
                    }
                  >
                    {m.content}
                  </p>
                </div>
              ))
            )}
            {busy && (
              <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> 考えています
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent text-[12px] placeholder:text-muted-foreground/70 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
              title="送る"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
