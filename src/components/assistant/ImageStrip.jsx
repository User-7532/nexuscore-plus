import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { signedUrl } from '@/lib/attachments';

// 入力欄の上に並べる、添付中の画像
export function ImageStrip({ images, onRemove }) {
  if (!images.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {images.map((img) => (
        <div
          key={img.id}
          className={`relative h-14 w-14 overflow-hidden rounded-lg border ${img.failed ? 'border-destructive/60' : 'border-border'}`}
        >
          <img src={img.preview} alt="添付した画像" className="h-full w-full object-cover" />
          {img.uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(img.id)}
            className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            title="この画像を外す"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// 吹き出しの中に出す、送った画像。保存先から期限つきのURLを作って表示する
export function MessageImages({ uris = [], previews = [] }) {
  const [urls, setUrls] = useState(previews);

  useEffect(() => {
    if (previews.length || !uris.length) return;
    let alive = true;
    Promise.all(uris.map((u) => signedUrl(u).catch(() => '')))
      .then((list) => alive && setUrls(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uris.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!uris.length && !previews.length) return null;
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {(urls.length ? urls : uris.map(() => '')).map((url, i) =>
        url ? (
          <a key={i} href={url} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-border">
            <img src={url} alt="送った画像" className="h-full w-full object-cover" />
          </a>
        ) : (
          <div key={i} className="flex h-20 w-20 items-center justify-center rounded-lg border border-border text-[10px] text-muted-foreground">
            画像
          </div>
        )
      )}
    </div>
  );
}
