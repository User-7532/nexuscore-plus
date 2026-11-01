import { Lightbulb, Loader2 } from 'lucide-react';

export default function HintBox({ hints, loading, onReveal, disabled }) {
  const canAsk = hints.length < 3;

  return (
    <div className="rounded-[20px] border border-border/70 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-primary" strokeWidth={1.7} />
          ヒント（{hints.length} / 3）
        </span>
        {canAsk ? (
          <button
            type="button"
            onClick={onReveal}
            disabled={loading || disabled}
            className="flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {hints.length === 0 ? 'ヒントを見る' : 'もう少しヒント'}
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">ここから先は自分の力で</span>
        )}
      </div>

      {hints.length === 0 ? (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          まずは自分で手を動かしてみる。詰まったときだけ、1段階ずつ開いてください。
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {hints.map((h, i) => (
            <li key={i} className="rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-[12px] leading-[1.85]">
              <span className="mr-1.5 text-[10px] text-primary">ヒント {i + 1}</span>
              <span className="whitespace-pre-wrap">{h}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
