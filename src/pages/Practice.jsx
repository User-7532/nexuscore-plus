import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { pickQuestion, questionsFor, recordPractice, refineOldQuestionsInBackground, shuffle } from '@/lib/practice';
import { cn } from '@/lib/utils';
import EmptyNote from '@/components/EmptyNote';
import PracticeTabs from '@/components/practice/PracticeTabs';
import PracticeQuestion from '@/components/practice/PracticeQuestion';
import FieldPicker, { countByField, matchField } from '@/components/FieldPicker';

const Chip = ({ active, onClick, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      'rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
      active ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/70 text-muted-foreground hover:text-foreground'
    )}
  >
    {children}
  </button>
);

export default function Practice() {
  const [params, setParams] = useSearchParams();
  const focusId = params.get('card');

  const [cards, setCards] = useState(null);
  const [wrongIds, setWrongIds] = useState(new Set());
  const [place, setPlace] = useState({ field: 'all', subfield: '' });
  const [light, setLight] = useState(false);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [note, setNote] = useState('');
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });

  useEffect(() => {
    refineOldQuestionsInBackground();
    base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 300 })
      .then((page) => setCards(page.items || []))
      .catch(() => setCards([]));
    base44.entities.PracticeAttempt.list({ sort: '-created_date', limit: 500 })
      .then((page) => {
        // カードごとに一番新しい解答だけを見て、出てこなかったままのカードを集める
        const latest = new Map();
        (page.items || []).forEach((a) => {
          if (!latest.has(a.card_id)) latest.set(a.card_id, a.correct === true);
        });
        setWrongIds(new Set([...latest].filter(([, ok]) => !ok).map(([id]) => id)));
      })
      .catch(() => {});
  }, []);

  const counts = useMemo(() => countByField(cards), [cards]);

  // 条件が変わったら山札を作り直す。カードから来たときは、その1枚を先頭にする
  useEffect(() => {
    if (cards === null) return;
    const pool = cards.filter(
      (c) => matchField(c, place.field, place.subfield) && (!wrongOnly || wrongIds.has(c.id))
    );
    const focus = focusId ? cards.find((c) => c.id === focusId) : null;
    const rest = shuffle(pool.filter((c) => c.id !== focusId)).slice(0, focus ? 9 : 10);
    setDeck(focus ? [focus, ...rest] : rest);
    setIdx(0);
    setNote('');
  }, [cards === null, place.field, place.subfield, wrongOnly, focusId]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = deck[idx] || null;

  // 次のカードの問題を用意する
  useEffect(() => {
    if (!card) {
      setQuestion(null);
      return;
    }
    let active = true;
    setLoadingQ(true);
    setQuestion(null);
    setNote('');
    questionsFor(card.id)
      .then((list) => {
        if (!active) return;
        const q = pickQuestion(list, { light });
        if (q) setQuestion(q);
        else setNote(light ? 'このカードには穴埋めの問題がありません。' : '問題を作れませんでした。');
      })
      .catch((e) => active && setNote(e.message || '問題を用意できませんでした。'))
      .finally(() => active && setLoadingQ(false));
    return () => {
      active = false;
    };
  }, [card?.id, light]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (focusId) {
      const p = new URLSearchParams(params);
      p.delete('card');
      setParams(p, { replace: true });
    }
    setIdx((i) => i + 1);
  };

  const onResult = (correct, q) => {
    recordPractice({ question: q, card, correct });
    setTally((t) => ({ correct: t.correct + (correct ? 1 : 0), wrong: t.wrong + (correct ? 0 : 1) }));
    setWrongIds((prev) => {
      const s = new Set(prev);
      if (correct) s.delete(card.id);
      else s.add(card.id);
      return s;
    });
    setIdx((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-relaxed">練習</h1>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            知識カードの概念を、穴埋めと記述で確かめます。出てこなかったカードは、間を空けて復習に戻ってきます。
          </p>
        </div>
        <PracticeTabs />
      </header>

      {cards === null ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
        </div>
      ) : cards.length === 0 ? (
        <EmptyNote
          title="まだカードがありません"
          action={
            <Link to="/tutor" className="rounded-full bg-primary px-5 py-2 text-[12.5px] text-primary-foreground">
              対話をはじめる
            </Link>
          }
        >
          練習問題は知識カードから作られます。対話を続けてカードが生まれたら、ここで確かめられます。
        </EmptyNote>
      ) : (
        <>
          <div className="space-y-2">
            <FieldPicker
              field={place.field}
              subfield={place.subfield}
              counts={counts}
              onChange={(field, subfield) => setPlace({ field, subfield })}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={light} onClick={() => setLight((v) => !v)} title="急ぐときは記述を外して穴埋めだけにします">
                記述を外す
              </Chip>
              <Chip active={wrongOnly} onClick={() => setWrongOnly((v) => !v)} title="最後に出てこなかったカードだけで練習します">
                出てこなかったカードだけ
              </Chip>
              <span className="ml-auto text-[11px] text-muted-foreground">
                言えた {tally.correct} ・ 出てこなかった {tally.wrong}
              </span>
            </div>
          </div>

          {card ? (
            loadingQ ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-[22px] border border-border/60 bg-card/60 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
                <p className="text-[12px]">問題を用意しています</p>
              </div>
            ) : question ? (
              <>
                <PracticeQuestion key={question.id} question={question} card={card} onResult={onResult} onSkip={next} />
                <p className="text-right text-[11px] text-muted-foreground">
                  {idx + 1} / {deck.length}
                </p>
              </>
            ) : (
              <div className="space-y-3 rounded-[22px] border border-border/60 bg-card/60 p-6 text-center">
                <p className="text-[12.5px] text-muted-foreground">{note}</p>
                <button
                  type="button"
                  onClick={next}
                  className="rounded-full border border-border/70 px-4 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  次のカードへ
                </button>
              </div>
            )
          ) : (
            <EmptyNote
              title={deck.length ? 'ひと回りしました' : '練習するカードがありません'}
              action={
                deck.length > 0 && !wrongOnly ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeck((d) => shuffle(d));
                      setIdx(0);
                    }}
                    className="rounded-full border border-border/70 px-4 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    もう一周する
                  </button>
                ) : null
              }
            >
              {wrongOnly
                ? '出てこなかったままのカードはありません。'
                : deck.length
                  ? '今日の分はここまでで十分です。続けるなら、もう一度山札を作ります。'
                  : '条件を変えてみてください。'}
            </EmptyNote>
          )}
        </>
      )}
    </div>
  );
}
