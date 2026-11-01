import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toISO } from '@/lib/srs';
import PracticeTabs from '@/components/practice/PracticeTabs';
import { FIELDS, fieldLabel, subfieldLabel } from '@/lib/taxonomy';

const DAYS = 14;
const UNDERSTANDING = ['これから', 'まだ曖昧', 'だいたいわかる', '人に話せる'];

export default function PracticeStats() {
  const [attempts, setAttempts] = useState(null);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    base44.entities.PracticeAttempt.list({ sort: '-created_date', limit: 1000 })
      .then((page) => setAttempts(page.items || []))
      .catch(() => setAttempts([]));
    base44.entities.KnowledgeCard.list({ limit: 500 })
      .then((page) => setCards(page.items || []))
      .catch(() => {});
  }, []);

  // 大分野ごとに、下位分野の言えた割合をまとめる。分類のない解答は「未分類」に入れる
  const byDomain = useMemo(() => {
    const acc = {};
    (attempts || []).forEach((a) => {
      const f = a.field || 'none';
      const s = a.field ? a.subfield || '' : a.domain || '';
      acc[f] = acc[f] || { total: 0, ok: 0, subs: {} };
      acc[f].total += 1;
      if (a.correct) acc[f].ok += 1;
      acc[f].subs[s] = acc[f].subs[s] || { total: 0, ok: 0 };
      acc[f].subs[s].total += 1;
      if (a.correct) acc[f].subs[s].ok += 1;
    });
    const order = [...FIELDS.map((f) => f.id), 'none'];
    return order
      .filter((id) => acc[id])
      .map((id) => ({
        id,
        name: id === 'none' ? '未分類' : fieldLabel(id),
        total: acc[id].total,
        rate: Math.round((acc[id].ok / acc[id].total) * 100),
        subs: Object.entries(acc[id].subs)
          .map(([sid, v]) => ({
            name: id === 'none' ? sid || '分野なし' : subfieldLabel(id, sid) || 'その他',
            total: v.total,
            rate: Math.round((v.ok / v.total) * 100),
          }))
          .sort((a, b) => a.rate - b.rate),
      }));
  }, [attempts]);

  // 直近14日の解答数と、言えた割合
  const daily = useMemo(() => {
    const days = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: toISO(d), label: `${d.getMonth() + 1}/${d.getDate()}`, total: 0, ok: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    (attempts || []).forEach((a) => {
      const day = byKey.get(toISO(new Date(a.created_date)));
      if (!day) return;
      day.total += 1;
      if (a.correct) day.ok += 1;
    });
    return days.map((d) => ({ label: d.label, 解答数: d.total, 言えた割合: d.total ? Math.round((d.ok / d.total) * 100) : null }));
  }, [attempts]);

  // 自分でつけた「いまの理解」の分布
  const levels = useMemo(() => {
    const counts = [0, 0, 0, 0];
    cards.forEach((c) => {
      counts[Math.max(0, Math.min(3, Number(c.understanding) || 0))] += 1;
    });
    return counts;
  }, [cards]);

  if (attempts === null) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
      </div>
    );
  }

  const total = attempts.length;
  const ok = attempts.filter((a) => a.correct).length;
  const practiced = new Set(attempts.map((a) => a.card_id)).size;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-relaxed">学習の統計</h1>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">どの分野が手になじんできて、どこにまだ揺らぎがあるかを眺めます。</p>
        </div>
        <PracticeTabs />
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['解いた問題', `${total}`],
          ['言えた割合', total ? `${Math.round((ok / total) * 100)}%` : '—'],
          ['練習したカード', `${practiced} / ${cards.length}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-border/60 bg-card p-5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="mt-1.5 font-display text-[24px]">{value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-[22px] border border-border/70 bg-card p-6">
        <h2 className="text-[15px]">分野ごとの言えた割合</h2>
        {byDomain.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">練習を始めると、ここに分野ごとの様子が並びます。</p>
        ) : (
          <div className="space-y-3">
            {byDomain.map((d) => (
              <div key={d.name} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span>{d.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {d.rate}% ・ {d.total}問
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${d.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-[22px] border border-border/70 bg-card p-6">
        <h2 className="text-[15px]">直近{DAYS}日</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 14,
                  fontSize: 11,
                }}
              />
              <Line yAxisId="left" type="monotone" dataKey="解答数" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="言えた割合" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls unit="%" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3 rounded-[22px] border border-border/70 bg-card p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px]">いまの理解（自分でつけた目安）</h2>
          <Link to="/cards" className="text-[11.5px] text-primary hover:opacity-70">
            カードで更新する
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {UNDERSTANDING.map((label, i) => (
            <div key={label} className="rounded-2xl bg-secondary/60 px-3 py-3 text-center">
              <p className="font-display text-[20px]">{levels[i]}</p>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
