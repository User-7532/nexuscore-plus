import { DifficultyBadge } from '@/components/code/Badges';
import { fieldLabel } from '@/lib/taxonomy';

export default function ProblemBrief({ problem }) {
  if (!problem) return null;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.field && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{fieldLabel(problem.field)}</span>
          )}
          {(problem.topics || []).map((t) => (
            <span key={t} className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
              {t}
            </span>
          ))}
          {problem.time_limit_minutes ? (
            <span className="text-[10px] text-muted-foreground">目安 {problem.time_limit_minutes}分</span>
          ) : null}
        </div>
        <h1 className="mt-3 text-[19px] leading-relaxed">{problem.title}</h1>
        {problem.theme && <p className="mt-1 text-[11px] text-muted-foreground">題材: {problem.theme}</p>}
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.95] text-foreground/90">{problem.statement}</p>
      </div>

      {problem.constraints && (
        <div>
          <p className="text-[11px] text-muted-foreground">制約</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed">{problem.constraints}</p>
        </div>
      )}

      {(problem.test_cases || []).length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground">想定テストケース</p>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border/60">
            <table className="w-full text-[11.5px]">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 text-left font-normal">入力</th>
                  <th className="px-3 py-1.5 text-left font-normal">期待する出力</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono">
                {problem.test_cases.map((t, i) => (
                  <tr key={i} className="align-top">
                    <td className="break-all px-3 py-1.5">{t.input || '-'}</td>
                    <td className="break-all px-3 py-1.5 text-primary">{t.expected || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {problem.expected_complexity && (
        <p className="text-[11px] text-muted-foreground">
          想定の計算量：<span className="font-mono text-foreground/80">{problem.expected_complexity}</span>
        </p>
      )}
    </div>
  );
}
