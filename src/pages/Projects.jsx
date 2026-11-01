import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmptyNote from '@/components/EmptyNote';
import { STAGE_LABELS, STAGE_STYLES } from '@/components/project/stages';
import { cn } from '@/lib/utils';

const emptyDraft = { title: '', one_liner: '', motivation: '', stage: 'family', next_step: '' };

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const page = await base44.entities.Project.filter({}, { sort: '-updated_date', limit: 50 });
    setProjects(page.items || []);
  };

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    if (!draft.title.trim() || saving) return;
    setSaving(true);
    try {
      const project = await base44.entities.Project.create({
        ...draft,
        title: draft.title.trim(),
        status: 'idea',
        steps: [],
        files: [],
        related_card_ids: [],
      });
      setProjects((prev) => [project, ...prev]);
      setDraft(emptyDraft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-relaxed">プロジェクト</h1>
          <p className="text-[12.5px] text-muted-foreground">
            学んだことを、小さく手で動かす場所。家族の課題から、最後は社会実装まで。
          </p>
        </div>
        <Button className="h-9 gap-1.5 rounded-full text-[12.5px]" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          つくる
        </Button>
      </header>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
        </div>
      ) : projects.length === 0 ? (
        <EmptyNote
          title="まだ何もない、まっさらな状態です"
          action={
            <Button className="rounded-full text-[12.5px]" onClick={() => setOpen(true)}>
              最初のひとつをつくる
            </Button>
          }
        >
          うまく形になるかは、あとで考えて大丈夫。身近な困りごとをひとつ選ぶところから始まります。
        </EmptyNote>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => {
            const steps = project.steps || [];
            const done = steps.filter((s) => s.done).length;
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group flex flex-col justify-between rounded-[22px] border border-border/60 bg-card/70 p-5 transition-all duration-500 hover:-translate-y-0.5 hover:border-border hover:bg-card"
              >
                <div className="space-y-2.5">
                  <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px]', STAGE_STYLES[project.stage] || STAGE_STYLES.family)}>
                    {STAGE_LABELS[project.stage] || STAGE_LABELS.family}
                  </span>
                  <p className="text-[15px] leading-relaxed">{project.title}</p>
                  {project.one_liner && (
                    <p className="line-clamp-2 text-[12px] leading-[1.85] text-muted-foreground">{project.one_liner}</p>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {steps.length ? `${done} / ${steps.length} ステップ` : 'ステップはこれから'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[24px] border-border bg-background sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-[18px] leading-relaxed">つくるものを決める</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[11.5px] text-muted-foreground">タイトル</p>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="例：家族の服薬リマインダー"
                className="rounded-2xl border-border/70 bg-card text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11.5px] text-muted-foreground">ひとことで言うと</p>
              <Input
                value={draft.one_liner}
                onChange={(e) => setDraft({ ...draft, one_liner: e.target.value })}
                placeholder="例：飲み忘れを、家族の声かけなしで減らす"
                className="rounded-2xl border-border/70 bg-card text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11.5px] text-muted-foreground">なぜ作るのか（誰のどんな痛みに向かうか）</p>
              <Textarea
                value={draft.motivation}
                onChange={(e) => setDraft({ ...draft, motivation: e.target.value })}
                rows={3}
                className="resize-none rounded-2xl border-border/70 bg-card text-[13px] leading-relaxed"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11.5px] text-muted-foreground">位置づけ</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(STAGE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setDraft({ ...draft, stage: value })}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
                      draft.stage === value
                        ? 'border-primary/30 bg-primary/10 text-foreground'
                        : 'border-border/70 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11.5px] text-muted-foreground">次の小さな一歩</p>
              <Input
                value={draft.next_step}
                onChange={(e) => setDraft({ ...draft, next_step: e.target.value })}
                placeholder="例：1画面だけ動くものを作る"
                className="rounded-2xl border-border/70 bg-card text-[13px]"
              />
            </div>
            <Button onClick={create} disabled={saving || !draft.title.trim()} className="w-full rounded-2xl text-[13px]">
              {saving ? 'つくっています' : 'はじめる'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}