import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export default function ProjectCoach({ project, onReviewed }) {
  const { toast } = useToast();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState(project.last_review || '');
  const bottomRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const page = await base44.entities.Conversation.filter(
        { project_id: project.id, mode: 'coach' },
        { sort: '-last_message_at', limit: 1 }
      );
      let found = (page.items || [])[0];
      if (!found) {
        found = await base44.entities.Conversation.create({
          title: project.title,
          mode: 'coach',
          project_id: project.id,
          message_count: 0,
        });
      }
      if (!alive) return;
      setConversation(found);
      const history = await base44.entities.Message.filter(
        { conversation_id: found.id },
        { sort: 'created_date', limit: 200 }
      );
      if (alive) setMessages(history.items || []);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [project.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !conversation) return;
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { id: 'temp', role: 'user', content: text }]);
    try {
      await base44.functions.invoke('tutorChat', { conversationId: conversation.id, content: text });
      const page = await base44.entities.Message.filter(
        { conversation_id: conversation.id },
        { sort: 'created_date', limit: 200 }
      );
      setMessages(page.items || []);
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== 'temp'));
      setInput(text);
      toast({ title: 'うまく届きませんでした', description: 'もう一度だけ試してみてください。', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const runReview = async () => {
    setReviewing(true);
    try {
      const res = await base44.functions.invoke('reviewProjectCode', { projectId: project.id });
      setReview(res.data.review);
      onReviewed?.(res.data.review);
    } catch (error) {
      toast({
        title: '振り返りができませんでした',
        description: error?.response?.data?.error || 'コードを1つ保存してから試してみてください。',
        variant: 'destructive',
      });
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-[18px] bg-secondary/60 px-4 py-3">
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          コーチは答えのコードを書きません。詰まったところを一緒に見て、次の一歩だけ渡します。
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={runReview}
          disabled={reviewing}
          className="shrink-0 gap-1.5 rounded-full border-border bg-card text-[11.5px]"
        >
          {reviewing ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.8} /> : <Sparkles className="h-3 w-3" strokeWidth={1.8} />}
          コードを振り返る
        </Button>
      </div>

      {review && (
        <div className="rounded-[20px] border border-border/70 bg-card px-4 py-4">
          <p className="text-[10.5px] text-muted-foreground">前回の振り返り</p>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-[1.95]">{review}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-[22px] border border-border/70 bg-secondary/30">
        <div className="h-[40vh] min-h-[260px] space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="mx-auto mt-6 max-w-sm text-center text-[12px] leading-relaxed text-muted-foreground">
              いま詰まっていることを書いてみてください。「動かない」「次に何をすればいいかわからない」で十分です。
            </p>
          )}
          {messages.map((message) => (
            <div key={message.id} className={cn('flex w-full', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[88%] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[12.5px] leading-[1.95]',
                  message.role === 'user'
                    ? 'bg-primary/10'
                    : 'bg-card shadow-[0_1px_2px_rgba(58,52,44,0.05)]'
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 pl-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.6} />
              考えています
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex items-end gap-2 border-t border-border/60 bg-card/70 px-3 py-3">
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
            placeholder="どこで止まっていますか"
            className="min-h-[46px] resize-none rounded-[16px] border-border/70 bg-background text-[12.5px] leading-relaxed"
          />
          <Button onClick={send} disabled={sending || !input.trim()} className="h-[46px] w-[46px] shrink-0 rounded-[16px] p-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <Send className="h-4 w-4" strokeWidth={1.8} />}
          </Button>
        </div>
      </div>
    </div>
  );
}