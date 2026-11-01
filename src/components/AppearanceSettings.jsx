import { useState } from 'react';
import { Check } from 'lucide-react';
import { ACCENTS, DEFAULT_APPEARANCE, FONTS, TONES, applyAppearance, loadAppearance, saveAppearance } from '@/lib/appearance';
import { cn } from '@/lib/utils';

export default function AppearanceSettings() {
  const [value, setValue] = useState(loadAppearance);

  const update = (patch) => {
    const next = { ...value, ...patch };
    setValue(next);
    applyAppearance(next);
    saveAppearance(next);
  };

  const Swatch = ({ active, color, label, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
        active ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border/70 text-muted-foreground hover:text-foreground'
      )}
    >
      <span className="h-3.5 w-3.5 rounded-full border border-border" style={{ background: color }} />
      {label}
      {active && <Check className="h-3 w-3" strokeWidth={2} />}
    </button>
  );

  return (
    <section className="space-y-5 rounded-[22px] border border-border/70 bg-card p-6">
      <div className="space-y-1.5">
        <h2 className="text-[15px]">見た目</h2>
        <p className="text-[12px] leading-relaxed text-muted-foreground">選ぶとすぐに変わります。設定はこのブラウザにだけ保存されます。</p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">背景のトーン</p>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <Swatch key={t.id} active={value.tone === t.id} color={t.swatch} label={t.label} onClick={() => update({ tone: t.id })} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">アクセントの色</p>
        <div className="flex flex-wrap gap-1.5">
          {ACCENTS.map((a) => (
            <Swatch key={a.id} active={value.accent === a.id} color={a.swatch} label={a.label} onClick={() => update({ accent: a.id })} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">書体</p>
        <div className="flex flex-wrap gap-1.5">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => update({ font: f.id })}
              style={{ fontFamily: f.body }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
                value.font === f.id ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border/70 text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => update(DEFAULT_APPEARANCE)}
        className="text-[11.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        はじめの見た目に戻す
      </button>
    </section>
  );
}
