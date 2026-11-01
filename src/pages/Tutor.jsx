import { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

function Bubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[88%] whitespace-pre-wrap rounded-[20px] px-4 py-3 text-[13px] leading-[1.95] md:max-w-[76%]',
          isUser ? 'bg-primary/10 text-foreground' : 'bg-card text-foreground shadow-[0_1px_2px_rgba(58,52,44,0.05)]'
        )}
      >
        {content}
      </div>
    </div>
  );
}

export default function Tutor() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [stacks, setStacks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  const loadConversations = async () => {
    const page = await base44.entities.Conversation.filter({}, { sort: '-last_message_at', limit: 30 });
    const items = page.items || [];
    setConversations(items);
    return items;
  };

  useEffect(() => {
    (async () => {
      const stackPage = await base44.entities.LearningStack.list({ sort: 'sort_order', limit: 20 });
      setStacks((stackPage.items || []).filter((s) => s.enabled !== false));
      const items = await loadConversations();
      const requested = searchParams.get('c');
      setActiveId(requested && items.some((c) => c.id === requested) ? requested : items[0]?.id || '');
    })()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let alive = true;
    base44.entities.Message.filter({ conversation_id: activeId }, { sort: 'created_date', limit: 200 })
      .then((page) => {
        if (alive) setMessages(page.items || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const startConversation = async (stack) => {
    const conversation = await base44.entities.Conversation.create({
      title: '新しい対話',
      mode: 'learn',
      stack_id: stack?.id || '',
      stack_name: stack?.name || '',
      message_count: 0,
    });
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    setMessages([]);
  };

  const changeStack = async (value) => {
    const stack = stacks.find((s) => s.id === value) || null;
    await base44.entities.Conversation.update(activeId, {
      stack_id: stack?.id || '',
      stack_name: stack?.name || '',
    });
    await loadConversations();
  };

  // 会話に出てきた知識を、その都度カードにする。返事は待たせない
  const cardJob = useRef({ running: false, again: false });
  const makeCards = async (conversationId) => {
    if (cardJob.current.running) {
      cardJob.current.again = true;
      return;
    }
    cardJob.current.running = true;
    try {
      const cardRes = await base44.functions.invoke('generateKnowledgeCards', { conversationId });
      const count = cardRes.data?.created?.length || 0;
      if (count) {
        toast({
          title: `知識カードを${count}枚 育てました`,
          description: '「知識カード」から、つながりと一緒に見られます。',
        });
      }
    } catch {
      // カードづくりに失敗しても対話は続けられるので、知らせない
    } finally {
      cardJob.current.running = false;
      if (cardJob.current.again) {
        cardJob.current.again = false;
        makeCards(conversationId);
      }
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !activeId) return;
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { id: 'temp', role: 'user', content: text }]);
    try {
      const res = await base44.functions.invoke('tutorChat', { conversationId: activeId, content: text });
      const page = await base44.entities.Message.filter(
        { conversation_id: activeId },
        { sort: 'created_date', limit: 200 }
      );
      setMessages(page.items || []);
      await loadConversations();

      if (res.data?.suggestCards) makeCards(activeId);
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== 'temp'));
      setInput(text);
      toast({
        title: 'うまく届きませんでした',
        description: '少し時間をおいて、もう一度だけ試してみてください。',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-relaxed">学びの対話</h1>
          <p className="text-[12.5px] text-muted-foreground">
            考えていることをそのまま置いていってください。対話に出てきた知識は、その都度カードになります。
          </p>
        </div>
        <Button
          variant="outline"
          className="h-9 gap-1.5 rounded-full border-border bg-card text-[12.5px]"
          onClick={() => startConversation(stacks[0] || null)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          新しい対話
        </Button>
      </header>

      {conversations.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setActiveId(conversation.id)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[11.5px] transition-colors duration-300',
                conversation.id === activeId
                  ? 'border-primary/30 bg-primary/10 text-foreground'
                  : 'border-border/70 bg-card/60 text-muted-foreground hover:text-foreground'
              )}
            >
              {conversation.title || '新しい対話'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
        </div>
      ) : !activeId ? (
        <div className="rounded-[24px] border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <p className="text-[15px]">何から考えたいですか</p>
          <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
            分野をひとつ選ぶと、その土台に沿って対話が始まります。うまく言葉にできなくても大丈夫です。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {(stacks.length ? stacks : [{ id: '', name: '自由に話す' }]).map((stack) => (
              <button
                key={stack.id || 'free'}
                onClick={() => startConversation(stack)}
                className="group flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-2 text-[12px] transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                {stack.name}
                <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-border/70 bg-secondary/30">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-4 py-2.5">
            <span className="truncate text-[11.5px] text-muted-foreground">
              {active?.title || '新しい対話'}
            </span>
            <select
              value={active?.stack_id || 'none'}
              onChange={(e) => changeStack(e.target.value)}
              className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] text-muted-foreground outline-none"
            >
              <option value="none">分野を選ばない</option>
              {stacks.map((stack) => (
                <option key={stack.id} value={stack.id}>
                  {stack.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-[54vh] min-h-[340px] space-y-4 overflow-y-auto px-4 py-5 md:px-6">
            {messages.length === 0 && (
              <p className="mx-auto mt-8 max-w-sm text-center text-[12.5px] leading-relaxed text-muted-foreground">
                いま頭にあることを、整えずにそのまま書いてみてください。
              </p>
            )}
            {messages.map((message) => (
              <Bubble key={message.id} role={message.role} content={message.content} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 pl-1 text-[11.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
                考えています
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border/60 bg-card/70 px-4 py-3 md:px-6">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="考えていること、わからないことを、そのまま"
                className="min-h-[52px] resize-none rounded-[18px] border-border/70 bg-background text-[13px] leading-relaxed"
              />
              <Button
                onClick={send}
                disabled={sending || !input.trim()}
                className="h-[52px] w-[52px] shrink-0 rounded-[18px] p-0"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={1.8} />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}