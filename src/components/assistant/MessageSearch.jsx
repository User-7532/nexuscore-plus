import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const stampOf = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 「C++」「O(n)」などの記号を、正規表現ではなく文字そのものとして探す
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function MessageSearch({ onPick }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setHits(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    // 打つたびに問い合わせないよう、少し待ってから検索する
    const timer = setTimeout(() => {
      base44.entities.AssistantMessage.filter({ content: { $regex: escapeRegex(text) } }, { sort: '-created_date', limit: 8 })
        .then((page) => setHits(page.items || []))
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="border-b border-border/60 bg-background/60 px-3 py-2.5">
      <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.6} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={60}
          placeholder="これまでの会話を探す"
          className="w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/70"
        />
        {busy && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {hits && (
        <div className="mt-2 max-h-44 space-y-0.5 overflow-y-auto">
          {hits.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">見つかりませんでした。</p>
          ) : (
            hits.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m)}
                className="block w-full rounded-2xl px-3 py-2 text-left transition-colors hover:bg-secondary/70"
              >
                <span className="text-[10px] text-muted-foreground">
                  {m.role === 'user' ? '自分' : '伴走者'} ・ {stampOf(m.created_date)}
                </span>
                <span className="mt-0.5 block truncate text-[12px]">{m.content}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
