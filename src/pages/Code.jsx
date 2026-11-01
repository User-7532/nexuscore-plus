import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { FIELDS, fieldLabel } from '@/lib/taxonomy';
import { LANGUAGES } from '@/lib/code/languages';
import { DifficultyBadge, VerdictBadge } from '@/components/code/Badges';
import EmptyNote from '@/components/EmptyNote';
import { cn } from '@/lib/utils';

const DIFFICULTIES = [
  { id: 'basic', label: '基礎' },
  { id: 'intermediate', label: '中級' },
  { id: 'advanced', label: '上級' },
];

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
      active ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/70 text-muted-foreground hover:text-foreground'
    )}
  >
    {children}
  </button>
);

export default function Code() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [problems, setProblems] = useState(null);
  const [subs, setSubs] = useState([]);
  const [field, setField] = useState('');
  const [difficulty, setDifficulty] = useState('basic');
  const [language, setLanguage] = useState('python');
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    base44.entities.Problem.list({ sort: '-created_date', limit: 100 })
      .then((page) => setProblems(page.items || []))
      .catch(() => setProblems([]));
    base44.entities.Submission.list({ sort: '-created_date', limit: 300 })
      .then((page) => setSubs(page.items || []))
      .catch(() => {});
  }, []);

  // 問題ごとの一番よい判定（正解 > あと一歩 > 不正解）
  const best = useMemo(() => {
    const rank = { correct: 3, partial: 2, wrong: 1 };
    const map = new Map();
    subs.forEach((s) => {
      const prev = map.get(s.problem_id);
      if (!prev || rank[s.verdict] > rank[prev]) map.set(s.problem_id, s.verdict);
    });
    return map;
  }, [subs]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('generateCodingProblem', { field, difficulty, language, request });
      if (res.data?.error) throw new Error(res.data.error);
      const p = res.data.problem;
      navigate(`/code/${p.id}?lang=${language}`);
    } catch (e) {
      toast({ title: '問題を作れませんでした', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const solved = [...best.values()].filter((v) => v === 'correct').length;

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-[22px] leading-relaxed">コーディング練習</h1>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          段階的なヒントと、文法・語彙を聞ける窓口つきで解きます。題材を5つの分野から選ぶと、学んでいる概念をコードで確かめる問題になります。
        </p>
      </header>

      <section className="space-y-5 rounded-[24px] border border-border/70 bg-card p-6">
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">題材</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={field === ''} onClick={() => setField('')}>
              一般的なアルゴリズム
            </Chip>
            {FIELDS.map((f) => (
              <Chip key={f.id} active={field === f.id} onClick={() => setField(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">難しさ</p>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => (
                <Chip key={d.id} active={difficulty === d.id} onClick={() => setDifficulty(d.id)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">使う言語</p>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => (
                <Chip key={l.id} active={language === l.id} onClick={() => setLanguage(l.id)}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">要望（なくても大丈夫）</p>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={2}
            maxLength={800}
            placeholder="例：ライフゲームで、端を周期境界にしたものを書いてみたい"
            className="w-full resize-none rounded-2xl border border-border/70 bg-background px-4 py-3 text-[12.5px] leading-relaxed outline-none focus:border-primary/40"
          />
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[12.5px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />}
          {busy ? 'AIが問題を作っています' : '問題を作って解きはじめる'}
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px]">これまでの問題</h2>
          {problems && problems.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              正解 {solved} / {problems.length}問
            </span>
          )}
        </div>
        {problems === null ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
          </div>
        ) : problems.length === 0 ? (
          <EmptyNote title="まだ問題がありません">上で題材と難しさを選ぶと、AIが1問作ります。</EmptyNote>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-[22px] border border-border/60 bg-card/70">
            {problems.map((p) => (
              <Link
                key={p.id}
                to={`/code/${p.id}`}
                className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 space-y-1.5">
                  <p className="truncate text-[13.5px]">{p.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DifficultyBadge difficulty={p.difficulty} />
                    {p.field && <span className="text-[10.5px] text-primary/80">{fieldLabel(p.field)}</span>}
                    {p.theme && <span className="text-[10.5px] text-muted-foreground">{p.theme}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {best.has(p.id) && <VerdictBadge verdict={best.get(p.id)} />}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
