import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { todayISO } from '@/lib/srs';
import { pickQuestion, questionsFor, recordPractice } from '@/lib/practice';
import EmptyNote from '@/components/EmptyNote';
import PracticeTabs from '@/components/practice/PracticeTabs';
import PracticeQuestion from '@/components/practice/PracticeQuestion';

const dayLabel = (iso) => {
  const [, m, d] = String(iso).split('-');
  return `${Number(m)}/${Number(d)}`;
};

export default function PracticeReview() {
  const [items, setItems] = useState(null);
  const [cardsById, setCardsById] = useState(new Map());
  const [session, setSession] = useState(null);
  const [idx, setIdx] = useState(0);
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState({ correct: 0, wrong: 0 });

  useEffect(() => {
    base44.entities.ReviewItem.list({ sort: 'due_date', limit: 300 })
      .then(async (page) => {
        const list = page.items || [];
        setItems(list);
        const ids = list.map((r) => r.card_id);
        if (ids.length) {
          const cards = await base44.entities.KnowledgeCard.filter({ id: { $in: ids } }, { limit: 300 });
          setCardsById(new Map((cards.items || []).map((c) => [c.id, c])));
        }
      })
      .catch(() => setItems([]));
  }, []);

  const today = todayISO();
  const due = useMemo(() => (items || []).filter((r) => r.due_date <= today && cardsById.has(r.card_id)), [items, cardsById, today]);
  const upcoming = useMemo(() => (items || []).filter((r) => r.due_date > today).slice(0, 8), [items, today]);

  const card = session && idx < session.length ? session[idx] : null;

  useEffect(() => {
    if (!card) return;
    let active = true;
    setLoadingQ(true);
    setQuestion(null);
    setNote('');
    questionsFor(card.id)
      .then((list) => {
        if (!active) return;
        const q = pickQuestion(list);
        if (q) setQuestion(q);
        else setNote('問題を作れませんでした。');
      })
      .catch((e) => active && setNote(e.message || '問題を用意できませんでした。'))
      .finally(() => active && setLoadingQ(false));
    return () => {
      active = false;
    };
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onResult = (correct, q) => {
    recordPractice({ question: q, card, correct, mode: 'review' });
    setDone((d) => ({ correct: d.correct + (correct ? 1 : 0), wrong: d.wrong + (correct ? 0 : 1) }));
    // 済んだカードは今日の一覧から外す
    setItems((prev) => (prev || []).map((r) => (r.card_id === card.id ? { ...r, due_date: '9999-12-31' } : r)));
    setIdx((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-relaxed">復習</h1>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            忘れかけたころに、もう一度。言えたら次までの間が 1日・3日・7日…と伸び、出てこなければ翌日に戻ります。
          </p>
        </div>
        <PracticeTabs />
      </header>

      {items === null ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
        </div>
      ) : session ? (
        card ? (
          <div className="space-y-3">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                {idx + 1} / {session.length}
              </span>
              <span>
                言えた {done.correct} ・ 出てこなかった {done.wrong}
              </span>
            </div>
            {loadingQ ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-[22px] border border-border/60 bg-card/60 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
                <p className="text-[12px]">「{card.title}」の問題を用意しています</p>
              </div>
            ) : question ? (
              <PracticeQuestion key={question.id} question={question} card={card} onResult={onResult} />
            ) : (
              <div className="space-y-3 rounded-[22px] border border-border/60 bg-card/60 p-6 text-center">
                <p className="text-[12.5px] text-muted-foreground">{note}</p>
                <button
                  type="button"
                  onClick={() => setIdx((i) => i + 1)}
                  className="rounded-full border border-border/70 px-4 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  次のカードへ
                </button>
              </div>
            )}
          </div>
        ) : (
          <EmptyNote
            title="今日の復習はおしまいです"
            action={
              <button
                type="button"
                onClick={() => setSession(null)}
                className="rounded-full border border-border/70 px-4 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
              >
                一覧に戻る
              </button>
            }
          >
            言えた {done.correct} 枚 ・ 出てこなかった {done.wrong} 枚。出てこなかったカードは明日また戻ってきます。
          </EmptyNote>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-border/70 bg-card p-6">
            <div>
              <p className="text-[11px] text-muted-foreground">今日の復習</p>
              <p className="mt-1 font-display text-[28px]">{due.length}<span className="ml-1 text-[13px] text-muted-foreground">枚</span></p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSession(due.map((r) => cardsById.get(r.card_id)));
                setIdx(0);
                setDone({ correct: 0, wrong: 0 });
              }}
              disabled={due.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-[12.5px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} /> まとめて進める
            </button>
          </div>

          {items.length === 0 && (
            <EmptyNote title="まだ復習の予定はありません">練習でカードを確かめると、ここに次の予定がたまっていきます。</EmptyNote>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">これからの予定</p>
              <div className="divide-y divide-border/60 overflow-hidden rounded-[20px] border border-border/60 bg-card/70">
                {upcoming.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 truncate text-[12.5px]">{r.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{dayLabel(r.due_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
