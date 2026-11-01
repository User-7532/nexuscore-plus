import { Check, Gauge, X } from 'lucide-react';
import { VerdictBadge } from '@/components/code/Badges';

export default function GradeResult({ result }) {
  if (!result) return null;

  return (
    <div className="rounded-[20px] border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <VerdictBadge verdict={result.verdict} />
        <span className="font-display text-[20px] leading-none">
          {result.score}
          <span className="ml-0.5 text-[11px] text-muted-foreground">点</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Gauge className="h-3 w-3" strokeWidth={1.7} />
          時間 {result.time_complexity || '-'} / メモリ {result.space_complexity || '-'}
        </span>
      </div>

      {(result.test_results || []).length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {result.test_results.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px]">
              <span className={t.passed ? 'mt-0.5 text-primary' : 'mt-0.5 text-destructive'}>
                {t.passed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="break-all font-mono">{t.case}</span>
                {t.reason && <span className="ml-1.5 text-muted-foreground">{t.reason}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.explanation && (
        <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-secondary/60 px-4 py-3 text-[12.5px] leading-[1.9]">{result.explanation}</p>
      )}

      {(result.issues || []).length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground">直すと良くなる点</p>
          <ul className="mt-1.5 space-y-1">
            {result.issues.map((s, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-muted-foreground">
                ・{s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
