import { FIELDS } from '@/lib/taxonomy';
import { cn } from '@/lib/utils';

const Chip = ({ active, onClick, children, count, small }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border transition-colors',
      small ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-[12px]',
      active ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border/70 text-muted-foreground hover:text-foreground'
    )}
  >
    {children}
    {count !== undefined && <span className="text-[10px] text-muted-foreground/80">{count}</span>}
  </button>
);

// 大分野と下位分野を選ぶ。field='all' はすべて、'none' は未分類
export default function FieldPicker({ field, subfield, onChange, counts, showUnclassified = true }) {
  const current = FIELDS.find((f) => f.id === field);
  const countOf = (key) => (counts ? counts[key] || 0 : undefined);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Chip active={field === 'all'} onClick={() => onChange('all', '')} count={countOf('all')}>
          すべて
        </Chip>
        {FIELDS.map((f) => (
          <Chip key={f.id} active={field === f.id} onClick={() => onChange(f.id, '')} count={countOf(f.id)}>
            {f.label}
          </Chip>
        ))}
        {showUnclassified && (countOf('none') ?? 0) > 0 && (
          <Chip active={field === 'none'} onClick={() => onChange('none', '')} count={countOf('none')}>
            未分類
          </Chip>
        )}
      </div>

      {current && (
        <div className="flex flex-wrap gap-1.5 rounded-[18px] bg-secondary/40 p-2">
          <Chip small active={!subfield} onClick={() => onChange(current.id, '')} count={countOf(current.id)}>
            {current.label}のすべて
          </Chip>
          {current.subfields.map((s) => (
            <Chip
              key={s.id}
              small
              active={subfield === s.id}
              onClick={() => onChange(current.id, s.id)}
              count={countOf(`${current.id}/${s.id}`)}
            >
              {s.label}
              {s.mode === 'interpret' && <span className="text-[9.5px] text-primary/80">解釈</span>}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

// カードの一覧から、分野ごとの枚数を数える
export function countByField(cards) {
  const counts = { all: 0, none: 0 };
  (cards || []).forEach((c) => {
    counts.all += 1;
    if (!c.field) {
      counts.none += 1;
      return;
    }
    counts[c.field] = (counts[c.field] || 0) + 1;
    const key = `${c.field}/${c.subfield}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

export function matchField(card, field, subfield) {
  if (field === 'all') return true;
  if (field === 'none') return !card.field;
  if (card.field !== field) return false;
  return !subfield || card.subfield === subfield;
}
