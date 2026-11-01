import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Sun, MessagesSquare, Layers, Hammer, Repeat, Code2, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import AssistantChat from '@/components/assistant/AssistantChat';
import SelectionAsk from '@/components/assistant/SelectionAsk';

// short はスマートフォンの下部ナビ用の短い名前
const navItems = [
  { to: '/', label: '今日', short: '今日', icon: Sun, end: true },
  { to: '/tutor', label: '学びの対話', short: '対話', icon: MessagesSquare },
  { to: '/cards', label: '知識カード', short: 'カード', icon: Layers },
  { to: '/practice', label: '練習と復習', short: '練習', icon: Repeat },
  { to: '/code', label: 'コーディング', short: 'コード', icon: Code2 },
  { to: '/projects', label: 'プロジェクト', short: '制作', icon: Hammer },
  { to: '/settings', label: '設定', short: '設定', icon: SettingsIcon },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span className="font-display text-[15px]">A</span>
      </span>
      <div className="leading-tight">
        <p className="font-display text-[17px] text-foreground">Attractor</p>
        <p className="text-[11px] text-muted-foreground tracking-wide">あなたの静かな道場</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px]">
        <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col justify-between border-r border-border/60 bg-sidebar/60 px-4 py-7 md:flex">
          <div className="space-y-8">
            <Brand />
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] transition-colors duration-300',
                      isActive
                        ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(58,52,44,0.06)]'
                        : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-[17px] w-[17px]" strokeWidth={1.6} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/80">
            急がなくて大丈夫。
            <br />
            小さく往復するだけ。
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-5 pb-28 pt-8 md:px-10 md:pb-16 md:pt-10">
            <div
              key={location.pathname}
              className={cn(
                'mx-auto w-full animate-in fade-in duration-500',
                // コードを書く画面は、問題文とエディタを並べるので広めにする
                location.pathname.startsWith('/code/') ? 'max-w-[1240px]' : 'max-w-[980px]'
              )}
            >
              <Outlet />
            </div>
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border/60 bg-background/90 px-2 py-2 backdrop-blur md:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[10px] transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                {item.short}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <AssistantChat />
      <SelectionAsk />
    </div>
  );
}