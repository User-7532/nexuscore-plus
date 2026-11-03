import { useRef, useState } from 'react';
import { ImagePlus, ClipboardPaste, Loader2 } from 'lucide-react';
import { IMPORT_MAX, IMPORT_MIN, importExternal } from '@/lib/external-import';
import { MAX_IMAGES, imagesFromClipboard, useImageAttachments } from '@/lib/attachments';
import { ImageStrip } from '@/components/assistant/ImageStrip';

// ほかのAIとのやり取りを貼り付けて、アプリ全体に取り込む窓口
export default function ExternalImport({ onDone }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  // 会話のスクリーンショット（画像）も一緒に、または画像だけでも取り込める
  const att = useImageAttachments();
  const fileRef = useRef(null);
  const ready = !att.uploading && (text.trim().length >= IMPORT_MIN || att.ready.length > 0);

  const run = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setNote('');
    try {
      const result = await importExternal(text, att.ready.map((i) => i.uri));
      if (result.cards.length === 0 && result.problems.length === 0 && !result.memoryUpdated) {
        setNote('取り込めるものが見つかりませんでした。少し待ってからもう一度お試しください。');
        return;
      }
      setText('');
      att.clear();
      setOpen(false);
      onDone(result);
    } catch (e) {
      setNote(e.message || '取り込めませんでした。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors ${
          open ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground hover:text-foreground'
        }`}
        title="ほかのAIとの対話を貼り付けて、知識カードや問題を作ります"
      >
        <ClipboardPaste className="h-3.5 w-3.5" strokeWidth={1.7} />
        他AIの会話を取り込む
      </button>

      {open && (
        <div className="mt-2 rounded-[20px] border border-border/70 bg-card p-4">
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            ほかのAIとのやり取りをそのまま貼り付けてください。出てきた知識を知識カードにして今日の復習に入れ、プログラムで確かめられる題材があればコーディング問題も作ります。会話の要点はAIが覚えて、これからの返答に使います。
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const files = imagesFromClipboard(e);
              if (files.length) att.add(files);
            }}
            rows={8}
            maxLength={IMPORT_MAX}
            placeholder="（例）AIとの対話をコピーして貼り付け"
            className="mt-2 w-full resize-y rounded-2xl border border-border/70 bg-background px-3.5 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-primary/40"
          />
          <div className="mt-2">
            <ImageStrip images={att.images} onRemove={att.remove} />
            {att.error && <p className="mb-1.5 text-[10px] text-destructive">{att.error}</p>}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                att.add(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || att.images.length >= MAX_IMAGES}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <ImagePlus className="h-3 w-3" />
              会話のスクリーンショットを添付（{MAX_IMAGES}枚まで・貼り付けも可）
            </button>
          </div>
          {note && <p className="mt-1.5 text-[11px] text-destructive">{note}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={busy || !ready}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-[12px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {busy ? '対話を読み取っています（1〜2分かかることがあります）…' : 'この対話を取り込む'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNote('');
              }}
              className="shrink-0 rounded-full border border-border/70 px-4 py-2.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              閉じる
            </button>
          </div>
          <p className="mt-1.5 text-right text-[10.5px] tabular-nums text-muted-foreground/70">
            {text.trim().length.toLocaleString()} / {IMPORT_MAX.toLocaleString()}字
          </p>
        </div>
      )}
    </div>
  );
}
