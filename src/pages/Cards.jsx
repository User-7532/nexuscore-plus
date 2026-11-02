import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { Link2, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import FieldPicker, { countByField, matchField } from '@/components/FieldPicker';
import { cardPlace, fieldLabel, subfieldOf } from '@/lib/taxonomy';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import EmptyNote from '@/components/EmptyNote';
import ExternalImport from '@/components/ExternalImport';
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
  const [params, setParams] = useSearchParams();
  const field = params.get('field') || 'all';
  const subfield = params.get('sub') || '';
  const [query, setQuery] = useState('');
  const [allCards, setAllCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [related, setRelated] = useState([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 500 })
      .then((page) => setAllCards(page.items || []))
      .catch(() => setAllCards([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => countByField(allCards), [allCards]);

  // 分野と言葉で絞り込む（記号もそのままの文字として探す）
  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCards.filter(
      (c) =>
        matchField(c, field, subfield) &&
        (!q || `${c.title} ${c.summary} ${(c.key_concepts || []).join(' ')}`.toLowerCase().includes(q))
    );
  }, [allCards, field, subfield, query]);

  const chooseField = (f, s) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('field');
    else next.set('field', f);
    if (s) next.set('sub', s);
    else next.delete('sub');
    setParams(next, { replace: true });
  };

  const sub = subfieldOf(field, subfield);

  const generate = async () => {
    if (!sub || generating) return;
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateFieldCards', { field, subfield, count: 3 });
      if (res.data?.error) throw new Error(res.data.error);
      const created = res.data?.created || [];
      if (!created.length) {
        toast({ title: '新しいカードは生まれませんでした', description: res.data?.reason });
        return;
      }
      setAllCards((prev) => [...created, ...prev]);
      toast({ title: `${created.length}枚のカードを作りました`, description: sub.label });
    } catch (e) {
      toast({ title: 'カードを作れませんでした', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

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
    setAllCards((prev) => prev.map((c) => (c.id === selected.id ? { ...c, understanding: value } : c)));
    toast({ title: '理解の度合いを記録しました', description: UNDERSTANDING[value]?.label });
    return updated;
  };

  // カードを消す。そのカードから作った練習問題と復習の予定も消し、ほかのカードやプロジェクトからのつながりも外す
  const deleteCard = async () => {
    if (!selected || deleting) return;
    const id = selected.id;
    setDeleting(true);
    try {
      const [questions, reviews, projects] = await Promise.all([
        base44.entities.PracticeQuestion.filter({ card_id: id }, { limit: 200 }),
        base44.entities.ReviewItem.filter({ card_id: id }, { limit: 50 }),
        base44.entities.Project.list({ limit: 200 }),
      ]);
      await Promise.all([
        ...(questions.items || []).map((q) => base44.entities.PracticeQuestion.delete(q.id)),
        ...(reviews.items || []).map((r) => base44.entities.ReviewItem.delete(r.id)),
      ]);
      const linkedCards = allCards
        .filter((c) => c.id !== id && (c.related_card_ids || []).includes(id))
        .map((c) => ({ id: c.id, related_card_ids: c.related_card_ids.filter((x) => x !== id) }));
      if (linkedCards.length) await base44.entities.KnowledgeCard.bulkUpdate(linkedCards);
      const linkedProjects = (projects.items || []).filter((p) => (p.related_card_ids || []).includes(id));
      await Promise.all(
        linkedProjects.map((p) =>
          base44.entities.Project.update(p.id, { related_card_ids: p.related_card_ids.filter((x) => x !== id) })
        )
      );
      await base44.entities.KnowledgeCard.delete(id);

      setAllCards((prev) =>
        prev
          .filter((c) => c.id !== id)
          .map((c) =>
            (c.related_card_ids || []).includes(id)
              ? { ...c, related_card_ids: c.related_card_ids.filter((x) => x !== id) }
              : c
          )
      );
      setSelected(null);
      toast({ title: 'カードを削除しました', description: selected.title });
    } catch (e) {
      toast({ title: '削除できませんでした', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-[22px] leading-relaxed">知識カード</h1>
        <p className="text-[12.5px] text-muted-foreground">
          対話から生まれた概念と、分野を選んでAIが作った概念。共通する概念どうしが、ひとりでにつながっています。
        </p>
      </header>

      <ExternalImport
        onDone={(result) => {
          // 取り込んだカードを一覧の先頭に足す
          setAllCards((prev) => [...result.cards, ...prev.filter((c) => !result.cards.some((n) => n.id === c.id))]);
          const extra = [
            `今日の復習に${result.scheduled}枚`,
            result.problems.length ? `コーディング問題${result.problems.length}問` : '',
            result.memoryUpdated ? 'AIの記憶を更新' : '',
          ].filter(Boolean);
          toast({
            title: `知識カードを${result.cards.length}枚作りました`,
            description: `${extra.join('・')}${result.errors.length ? `（うまくいかなかったもの: ${result.errors.join('、')}）` : ''}`,
          });
        }}
      />

      <FieldPicker field={field} subfield={subfield} onChange={chooseField} counts={counts} />

      {sub && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-dashed border-border bg-card/50 px-5 py-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {fieldLabel(field)} / {sub.label}
            {sub.mode === 'interpret' && '。解釈が中心の分野なので、確かめられることと解釈を分けて書きます'}
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />}
            {generating ? '作っています' : 'この分野のカードをAIで作る'}
          </button>
        </div>
      )}

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
            !query && !sub ? (
              <Link to="/tutor" className="rounded-full bg-primary px-5 py-2 text-[12.5px] text-primary-foreground">
                対話をはじめる
              </Link>
            ) : null
          }
        >
          {query
            ? '別の言葉で探してみてください。表記が少し違うだけかもしれません。'
            : sub
              ? '上のボタンで、この分野の入口になる概念をAIが作ります。'
              : 'AIとの対話を3往復ほど続けるか、上で下位分野を選ぶと、カードが生まれます。'}
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
                <p className="text-[10.5px] tracking-wide text-primary/80">{cardPlace(card)}</p>
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
                <p className="text-[10.5px] tracking-wide text-primary/80">{cardPlace(selected)}</p>
                <SheetTitle className="text-[20px] leading-relaxed">{selected.title}</SheetTitle>
              </SheetHeader>

              <div className="space-y-7 pb-10">
                <p className="whitespace-pre-wrap text-[13px] leading-[2] text-foreground">{selected.summary}</p>

                {(selected.verifiable || selected.interpretation) && (
                  <div className="space-y-2">
                    {selected.verifiable && (
                      <div className="rounded-[18px] border border-border/70 px-4 py-3.5">
                        <p className="text-[10.5px] text-muted-foreground">確かめられること</p>
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.9]">{selected.verifiable}</p>
                      </div>
                    )}
                    {selected.interpretation && (
                      <div className="rounded-[18px] border border-dashed border-border px-4 py-3.5">
                        <p className="text-[10.5px] text-muted-foreground">解釈・仮説</p>
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.9]">{selected.interpretation}</p>
                      </div>
                    )}
                  </div>
                )}

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

                <Link
                  to={`/practice?card=${selected.id}`}
                  className="flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-[12.5px] text-primary-foreground transition-opacity hover:opacity-90"
                >
                  この概念を問題で確かめる
                </Link>

                {selected.source === 'assistant' && (
                  <p className="text-[12px] text-muted-foreground">AIチャットでの会話から生まれたカードです。</p>
                )}

                {selected.source_conversation_id && (
                  <Link
                    to={`/tutor?c=${selected.source_conversation_id}`}
                    className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:opacity-70"
                  >
                    この考えが生まれた対話をひらく
                  </Link>
                )}

                <div className="border-t border-border/60 pt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={deleting}
                        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />}
                        このカードを削除
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>「{selected.title}」を削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          このカードから作った練習問題と復習の予定も一緒に消えます。これまでの解答の記録（統計）は残ります。削除したカードはアプリからは戻せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>やめる</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={deleteCard}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          削除する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}