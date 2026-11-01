import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

export default function Settings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStack, setNewStack] = useState({ name: '', description: '' });

  useEffect(() => {
    (async () => {
      const [profilePage, stackPage] = await Promise.all([
        base44.entities.Profile.list({ limit: 1 }),
        base44.entities.LearningStack.list({ sort: 'sort_order', limit: 30 }),
      ]);
      setProfile(
        (profilePage.items || [])[0] || { ultimate_goal: '', current_focus: '', tone: '', daily_minutes: 30, owner_label: '' }
      );
      setStacks(stackPage.items || []);
    })()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      if (profile.id) {
        const updated = await base44.entities.Profile.update(profile.id, profile);
        setProfile(updated);
      } else {
        const created = await base44.entities.Profile.create(profile);
        setProfile(created);
      }
      toast({ title: '保存しました' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStack = async (stack, enabled) => {
    setStacks((prev) => prev.map((s) => (s.id === stack.id ? { ...s, enabled } : s)));
    await base44.entities.LearningStack.update(stack.id, { enabled });
  };

  const addStack = async () => {
    if (!newStack.name.trim()) return;
    const created = await base44.entities.LearningStack.create({
      name: newStack.name.trim(),
      description: newStack.description.trim(),
      focus_concepts: [],
      sort_order: stacks.length + 1,
      enabled: true,
    });
    setStacks((prev) => [...prev, created]);
    setNewStack({ name: '', description: '' });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-1.5">
        <h1 className="text-[22px] leading-relaxed">設定</h1>
        <p className="text-[12.5px] text-muted-foreground">この場所を、あなたのいまに合わせて調整します。</p>
      </header>

      <section className="space-y-4 rounded-[22px] border border-border/70 bg-card p-6">
        <h2 className="text-[15px]">目的と、いまの焦点</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">最終的にたどり着きたいこと</p>
            <Textarea
              value={profile.ultimate_goal || ''}
              onChange={(e) => setProfile({ ...profile, ultimate_goal: e.target.value })}
              rows={3}
              className="resize-none rounded-2xl border-border/70 bg-background text-[12.5px] leading-relaxed"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">いま集中したいこと</p>
            <Textarea
              value={profile.current_focus || ''}
              onChange={(e) => setProfile({ ...profile, current_focus: e.target.value })}
              rows={2}
              className="resize-none rounded-2xl border-border/70 bg-background text-[12.5px] leading-relaxed"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">AIに望む語り口</p>
              <Input
                value={profile.tone || ''}
                onChange={(e) => setProfile({ ...profile, tone: e.target.value })}
                className="rounded-2xl border-border/70 bg-background text-[12.5px]"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">1日に使えたらいい時間（分）</p>
              <Input
                type="number"
                value={profile.daily_minutes ?? 30}
                onChange={(e) => setProfile({ ...profile, daily_minutes: Number(e.target.value) })}
                className="rounded-2xl border-border/70 bg-background text-[12.5px]"
              />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving} className="rounded-full px-5 text-[12.5px]">
            {saving ? '保存しています' : '保存する'}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-[15px]">知識スタック</h2>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            対話の土台になる分野です。使わないものは、そっと閉じておけます。
          </p>
        </div>
        <div className="space-y-2">
          {stacks.map((stack) => (
            <div key={stack.id} className="flex items-start justify-between gap-4 rounded-[20px] border border-border/60 bg-card/70 px-4 py-3.5">
              <div className="space-y-1">
                <p className="text-[13px]">{stack.name}</p>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">{stack.description}</p>
              </div>
              <Switch checked={stack.enabled !== false} onCheckedChange={(checked) => toggleStack(stack, checked)} />
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-[20px] border border-dashed border-border bg-card/40 p-4">
          <p className="text-[11px] text-muted-foreground">分野を足す</p>
          <Input
            value={newStack.name}
            onChange={(e) => setNewStack({ ...newStack, name: e.target.value })}
            placeholder="分野の名前"
            className="rounded-2xl border-border/70 bg-background text-[12.5px]"
          />
          <Textarea
            value={newStack.description}
            onChange={(e) => setNewStack({ ...newStack, description: e.target.value })}
            rows={2}
            placeholder="なぜこれを学びたいのか（ひとことで）"
            className="resize-none rounded-2xl border-border/70 bg-background text-[12.5px]"
          />
          <Button variant="outline" onClick={addStack} className="gap-1.5 rounded-full border-border bg-card text-[12px]">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            追加する
          </Button>
        </div>
      </section>
    </div>
  );
}