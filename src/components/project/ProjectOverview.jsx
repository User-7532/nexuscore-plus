import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { STAGE_LABELS, STAGE_STYLES } from '@/components/project/stages';
import { cn } from '@/lib/utils';

export default function ProjectOverview({ project, onUpdated }) {
  const [draft, setDraft] = useState({
    one_liner: project.one_liner || '',
    motivation: project.motivation || '',
    next_step: project.next_step || '',
    stage: project.stage || 'family',
  });
  const [steps, setSteps] = useState(project.steps || []);
  const [newStep, setNewStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  const save = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.Project.update(project.id, { ...draft, steps });
      onUpdated(updated);
      setSavedAt(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSaving(false);
    }
  };

  const toggleStep = (index) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, done: !step.done } : step)));
  };

  const addStep = () => {
    const label = newStep.trim();
    if (!label) return;
    setSteps((prev) => [...prev, { label, done: false }]);
    setNewStep('');
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">位置づけ</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(STAGE_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setDraft({ ...draft, stage: value })}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11.5px] transition-all',
                draft.stage === value ? STAGE_STYLES[value] : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">ひとことで言うと</p>
        <Input
          value={draft.one_liner}
          onChange={(e) => setDraft({ ...draft, one_liner: e.target.value })}
          className="rounded-2xl border-border/70 bg-card text-[13px]"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">なぜ作るのか</p>
        <Textarea
          value={draft.motivation}
          onChange={(e) => setDraft({ ...draft, motivation: e.target.value })}
          rows={4}
          className="resize-none rounded-2xl border-border/70 bg-card text-[13px] leading-relaxed"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">次の小さな一歩</p>
        <Input
          value={draft.next_step}
          onChange={(e) => setDraft({ ...draft, next_step: e.target.value })}
          className="rounded-2xl border-border/70 bg-card text-[13px]"
        />
      </div>

      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground">ステップ</p>
        <div className="space-y-1.5">
          {steps.map((step, index) => (
            <button
              key={`${step.label}-${index}`}
              onClick={() => toggleStep(index)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5 text-left transition-colors hover:bg-card"
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  step.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                )}
              >
                {step.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span className={cn('text-[12.5px] leading-relaxed', step.done && 'text-muted-foreground line-through')}>
                {step.label}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStep()}
            placeholder="ステップを足す"
            className="rounded-2xl border-border/70 bg-card text-[12.5px]"
          />
          <Button variant="outline" onClick={addStep} className="h-10 w-10 shrink-0 rounded-2xl border-border bg-card p-0">
            <Plus className="h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="rounded-full px-5 text-[12.5px]">
          {saving ? '保存しています' : '保存する'}
        </Button>
        {savedAt && <span className="text-[11px] text-muted-foreground">{savedAt} に保存</span>}
      </div>
    </div>
  );
}