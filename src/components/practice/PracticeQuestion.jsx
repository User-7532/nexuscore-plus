import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cardPlace } from '@/lib/taxonomy';

// 練習問題1問。穴埋めは自己採点、記述はAIが判定する。
// 穴埋めの空所には、隠しているあいだ答えの文字を置かない（切り替え時に一瞬見えるのを防ぐ）
export default function PracticeQuestion({ question, card, onResult, onSkip }) {
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState('');

  const written = question.kind === 'written';
  // 解釈が中心の問いは、一つの正解ではなく観点で判定する
  const rubric = question.assessment === 'rubric' ? question.rubric || [] : [];
  const parts = String(question.text || '').split('___');

  const judge = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('judgePractice', { question_id: question.id, answer_text: draft.trim() });
      if (res.data?.error) throw new Error(res.data.error);
      setVerdict({ correct: res.data.correct === true, feedback: res.data.feedback || '' });
    } catch (e) {
      setError(e.message || '判定できませんでした');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-border/70 bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10.5px] tracking-wide text-primary/80">
            {cardPlace(card)} ・ {card.title}
          </p>
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] text-muted-foreground">
            {written ? (rubric.length ? '記述・観点で判定' : '記述') : '穴埋め'}
          </span>
        </div>

        {written ? (
          <>
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-[2]">{question.text}</p>
            {rubric.length > 0 && !verdict && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                一つの正解はありません。確かめられることと、あなたの解釈を分けて書くと伝わりやすくなります。
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-[14px] leading-[2.1]">
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setRevealed((v) => !v)}
                    aria-label={revealed ? undefined : '空所を開く'}
                    className={
                      revealed
                        ? 'mx-0.5 rounded-md bg-primary/10 px-1.5 text-primary'
                        : 'mx-0.5 rounded-md bg-secondary px-7 shadow-[inset_0_-1.5px_0_hsl(var(--primary)/0.45)]'
                    }
                  >
                    {revealed ? question.answer : '\u00a0'}
                  </button>
                )}
              </span>
            ))}
          </p>
        )}

        {!written && revealed && question.explanation && (
          <div className="mt-5 rounded-[18px] bg-secondary/60 px-4 py-3.5">
            <p className="text-[12px] leading-[1.9] text-muted-foreground">{question.explanation}</p>
          </div>
        )}

        {written && verdict && (
          <div className="mt-5 space-y-3">
            <p className={`flex items-center gap-1.5 text-[12.5px] ${verdict.correct ? 'text-primary' : 'text-destructive'}`}>
              {verdict.correct ? <Check className="h-4 w-4" strokeWidth={1.8} /> : <X className="h-4 w-4" strokeWidth={1.8} />}
              {rubric.length
                ? verdict.correct
                  ? '観点を押さえられています'
                  : '足りない観点があります'
                : verdict.correct
                  ? '伝わっています'
                  : 'もう一歩です'}
            </p>
            <p className="text-[12.5px] leading-[1.9]">{verdict.feedback}</p>
            {rubric.length > 0 && (
              <div className="rounded-[18px] border border-border/60 px-4 py-3.5">
                <p className="text-[10.5px] text-muted-foreground">見ていた観点</p>
                <ul className="mt-1.5 space-y-1">
                  {rubric.map((r) => (
                    <li key={r} className="text-[12px] leading-[1.8]">・{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-[18px] bg-secondary/60 px-4 py-3.5">
              <p className="text-[10.5px] text-muted-foreground">{rubric.length ? '解答の一例' : '模範解答'}</p>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.9]">{question.model_answer || question.answer}</p>
              {question.explanation && (
                <p className="mt-2 text-[11.5px] leading-[1.9] text-muted-foreground">{question.explanation}</p>
              )}
            </div>
          </div>
        )}

        {written && !verdict && (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // 変換中のEnterは送信せず、確定に使う
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                judge();
              }}
              rows={4}
              maxLength={2000}
              placeholder="自分の言葉で、分かる範囲で書いてみてください"
              className="mt-5 w-full resize-y rounded-2xl border border-border/70 bg-background px-4 py-3 text-[13px] leading-relaxed outline-none focus:border-primary/40"
            />
            {error && <p className="mt-2 text-[11.5px] text-destructive">{error}</p>}
            <p className="mt-2 text-[10.5px] text-muted-foreground/80">Enterで送信、Shift+Enterで改行します。</p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {written ? (
          verdict ? (
            <button
              type="button"
              onClick={() => onResult(verdict.correct, question)}
              className="h-11 flex-1 rounded-full bg-primary text-[12.5px] text-primary-foreground transition-opacity hover:opacity-90"
            >
              次へ
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={judge}
                disabled={busy || !draft.trim()}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-[12.5px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {busy ? '読んでいます' : '見てもらう'}
              </button>
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="h-11 rounded-full border border-border/70 px-5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  飛ばす
                </button>
              )}
            </>
          )
        ) : revealed ? (
          <>
            <button
              type="button"
              onClick={() => onResult(false, question)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border/70 bg-card text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.8} /> 出てこなかった
            </button>
            <button
              type="button"
              onClick={() => onResult(true, question)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-[12.5px] text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={1.8} /> 言えた
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="h-11 flex-1 rounded-full border border-border/70 bg-card text-[12.5px] transition-colors hover:bg-secondary/60"
            >
              答えを見る
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="h-11 rounded-full border border-border/70 px-5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                飛ばす
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
