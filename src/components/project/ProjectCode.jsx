import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function ProjectCode({ project, onUpdated }) {
  const initial = project.files?.length ? project.files : [{ path: 'main.py', content: '' }];
  const [files, setFiles] = useState(initial);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  const current = files[activeIndex] || { path: '', content: '' };

  const updateCurrent = (patch) => {
    setFiles((prev) => prev.map((file, index) => (index === activeIndex ? { ...file, ...patch } : file)));
  };

  const addFile = () => {
    setFiles((prev) => [...prev, { path: `file${prev.length + 1}.py`, content: '' }]);
    setActiveIndex(files.length);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.Project.update(project.id, { files });
      onUpdated(updated);
      setSavedAt(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        あなたが書く場所です。AIは「コーチ」タブで、隣でヒントを出すだけにしています。
      </p>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {files.map((file, index) => (
          <button
            key={`${file.path}-${index}`}
            onClick={() => setActiveIndex(index)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[11px] transition-colors',
              index === activeIndex ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {file.path || 'untitled'}
          </button>
        ))}
        <button onClick={addFile} className="shrink-0 rounded-full px-2 py-1.5 text-muted-foreground hover:text-foreground">
          <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>

      <Input
        value={current.path}
        onChange={(e) => updateCurrent({ path: e.target.value })}
        className="rounded-xl border-border/70 bg-card font-mono text-[11.5px]"
      />

      <textarea
        value={current.content}
        onChange={(e) => updateCurrent({ content: e.target.value })}
        spellCheck={false}
        rows={16}
        placeholder="# まずは1行から"
        className="w-full resize-y rounded-[18px] border border-border/70 bg-card p-4 font-mono text-[12.5px] leading-[1.8] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="rounded-full px-5 text-[12.5px]">
          {saving ? '保存しています' : '保存する'}
        </Button>
        {savedAt && <span className="text-[11px] text-muted-foreground">{savedAt} に保存</span>}
      </div>
    </div>
  );
}