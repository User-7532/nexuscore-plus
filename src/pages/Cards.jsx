import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Link2, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import EmptyNote from '@/components/EmptyNote';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const UNDERSTANDING = [
  { value: 0, label: 'これから' },
  { value: 1, label: 'まだ曖昧' },
  { value: 2, label: 'だいたいわかる' },
  { value: 3, label: '人に話せる' },
];

export default function Cards() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const filter = query.trim()
        ? { $or: [{ title: { $regex: query.trim() } }, { summary: { $regex: query.trim() } }] }
        : {};
      base44.entities.KnowledgeCard.filter(filter, { sort: '-created_date', limit: 60 })
        .then((page) => setCards(page.items || []))
        .catch(() => setCards([]))
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const openCard = async (card) => {
    setSelected(card);
    setRelated([]);
    const ids = card.related_card_ids || [];
    if (ids.length) {
      const page = await base44.entities.KnowledgeCard.filter({ id: { $in: ids } }, { limit: 12 });
      setRelated(page.items || []);
    }
    base44.entities.KnowledgeCard.update(card.id, {
      visit_count: (card.visit_count || 0) + 1,
      last_visited_at: new Date().toISOString(),
    }).catch(() => {});
  };

  const setUnderstanding = async (value) => {
    const updated = await base44.entities.KnowledgeCard.update(selected.id, { understanding: value });
    setSelected({ ...selected, understanding: value });
    setCards((prev) => prev.map((c) => (c.id === selected.id ? { ...c, understanding: value } : c)));
    toast({ title: '理解の度合いを記録しました', description: UNDERSTANDING[value]?.label });
    return updated;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-[22px] leading-relaxed">知識カード</h1>
        <p className="text-[12.5px] text-muted-foreground">
          対話から自動で生まれた概念たち。共通する概念どうしが、ひとりでにつながっています。
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="概念や言葉で探す"
          className="h-11 rounded-full border-border/70 bg-card pl-11 text-[13px]"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
        </div>
      ) : cards.length === 0 ? (
        <EmptyNote
          title={query ? '見つかりませんでした' : 'まだカードがありません'}
          action={
            <Link to="/tutor" className="rounded-full bg-primary px-5 py-2 text-[12.5px] text-primary-foreground">
              対話をはじめる
            </Link>
          }
        >
          {query
            ? '別の言葉で探してみてください。表記が少し違うだけかもしれません。'
            : 'AIとの対話を3往復ほど続けると、その中から概念がカードとして自動で生まれます。'}
        </EmptyNote>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => openCard(card)}
              className="group rounded-[20px] border border-border/60 bg-card/70 p-5 text-left transition-all duration-500 hover:-translate-y-0.5 hover:border-border hover:bg-card"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10.5px] tracking-wide text-primary/80">{card.domain || '概念'}</p>
                {(card.related_card_ids || []).length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Link2 className="h-3 w-3" strokeWidth={1.8} />
                    {card.related_card_ids.length}
                  </span>
                )}
              </div>
              <p className="mt-3 text-[14px] leading-relaxed">{card.title}</p>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.85] text-muted-foreground">{card.summary}</p>
              {(card.key_concepts || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {card.key_concepts.slice(0, 3).map((concept) => (
                    <span key={concept} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {concept}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-border bg-background sm:max-w-[520px]">
          {selected && (
            <>
              <SheetHeader className="space-y-2 pb-4 text-left">
                <p className="text-[10.5px] tracking-wide text-primary/80">{selected.domain || '概念'}</p>
                <SheetTitle className="text-[20px] leading-relaxed">{selected.title}</SheetTitle>
              </SheetHeader>

              <div className="space-y-7 pb-10">
                <p className="whitespace-pre-wrap text-[13px] leading-[2] text-foreground">{selected.summary}</p>

                {(selected.key_concepts || []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">共通する概念</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.key_concepts.map((concept) => (
                        <span key={concept} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.open_question && (
                  <div className="rounded-[18px] bg-secondary/60 px-4 py-3.5">
                    <p className="text-[10.5px] text-muted-foreground">次の小さな問い</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed">{selected.open_question}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">いまの理解</p>
                  <div className="flex flex-wrap gap-1.5">
                    {UNDERSTANDING.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => setUnderstanding(level.value)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
                          (selected.understanding || 0) === level.value
                            ? 'border-primary/30 bg-primary/10 text-foreground'
                            : 'border-border/70 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                {related.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">つながっているカード</p>
                    <div className="space-y-2">
                      {related.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => openCard(card)}
                          className="w-full rounded-2xl border border-border/70 bg-card px-3.5 py-3 text-left transition-colors hover:bg-secondary/50"
                        >
                          <p className="text-[12.5px]">{card.title}</p>
                          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{card.summary}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selected.source_conversation_id && (
                  <Link
                    to={`/tutor?c=${selected.source_conversation_id}`}
                    className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:opacity-70"
                  >
                    この考えが生まれた対話をひらく
                  </Link>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}