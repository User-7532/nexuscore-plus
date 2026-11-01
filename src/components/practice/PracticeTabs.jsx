import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/practice', label: '練習', end: true },
  { to: '/practice/review', label: '復習' },
  { to: '/practice/stats', label: '学習の統計' },
];

export default function PracticeTabs() {
  return (
    <div className="flex gap-1.5">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              'rounded-full border px-3.5 py-1.5 text-[12px] transition-colors',
              isActive ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/70 text-muted-foreground hover:text-foreground'
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
