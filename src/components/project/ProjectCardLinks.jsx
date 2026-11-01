import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function ProjectCardLinks({ project, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState([]);
  const [linked, setLinked] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const relatedIds = project.related_card_ids || [];

  useEffect(() => {
    if (!relatedIds.length) {
      setLinked([]);
      return;
    }
    base44.entities.KnowledgeCard.filter({ id: { $in: relatedIds } }, { limit: 20 })
      .then((page) => setLinked(page.items || []))
      .catch(() => {});
  }, [relatedIds.join(',')]);

  const openPicker = async () => {
    const page = await base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 60 });
    setCards(page.items || []);
    setSelected(relatedIds);
    setOpen(true);
  };

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.Project.update(project.id, { related_card_ids: selected });
      onUpdated(updated);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">この実装の土台になっている知識</p>
        <button onClick={openPicker} className="inline-flex items-center gap-1 text-[11px] text-primary hover:opacity-70">
          <Plus className="h-3 w-3" strokeWidth={2} />
          選ぶ
        </button>
      </div>

      {linked.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground/80">まだ結びついていません。つないでおくと、あとで理由を思い出せます。</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {linked.map((card) => (
            <span key={card.id} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
              {card.title}
            </span>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[24px] border-border bg-background sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-[17px] leading-relaxed">土台にする知識を選ぶ</DialogTitle>
          </DialogHeader>
          <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
            {cards.length === 0 && <p className="text-[12px] text-muted-foreground">まだ知識カードがありません。</p>}
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => toggle(card.id)}
                className={cn(
                  'w-full rounded-2xl border px-3.5 py-2.5 text-left transition-colors',
                  selected.includes(card.id)
                    ? 'border-primary/30 bg-primary/10'
                    : 'border-border/60 bg-card hover:bg-secondary/50'
                )}
              >
                <p className="text-[12.5px]">{card.title}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{card.summary}</p>
              </button>
            ))}
          </div>
          <Button onClick={save} disabled={saving} className="w-full rounded-2xl text-[12.5px]">
            決定する
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}