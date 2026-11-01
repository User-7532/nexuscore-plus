import { cn } from '@/lib/utils';

// 見た目の設定（夜のトーンなど）でも読めるよう、色はテーマの変数から作る
const DIFFICULTY = {
  basic: { label: '基礎', cls: 'border-border text-muted-foreground' },
  intermediate: { label: '中級', cls: 'border-primary/30 text-primary' },
  advanced: { label: '上級', cls: 'border-destructive/40 text-destructive' },
};

const VERDICT = {
  correct: { label: '正解', cls: 'border-primary/40 bg-primary/10 text-primary' },
  partial: { label: 'あと一歩', cls: 'border-border bg-secondary text-foreground' },
  wrong: { label: '不正解', cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
};

export function DifficultyBadge({ difficulty, className }) {
  const item = DIFFICULTY[difficulty] || DIFFICULTY.basic;
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px]', item.cls, className)}>{item.label}</span>;
}

export function VerdictBadge({ verdict, className }) {
  const item = VERDICT[verdict] || VERDICT.wrong;
  return <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11px]', item.cls, className)}>{item.label}</span>;
}
