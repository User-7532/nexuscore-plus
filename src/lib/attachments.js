import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// 画像の添付。画像は本人だけが見られる保存先に置き、表示やAIに渡すときだけ期限つきのURLを発行する
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const cache = new Map();

export async function uploadImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('画像ファイルだけ添付できます');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('画像が大きすぎます（1枚10MBまで）');
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return file_uri;
}

// 期限つきのURL（1時間）。少し早めに作り直す
export async function signedUrl(uri) {
  const hit = cache.get(uri);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 3600 });
  cache.set(uri, { url: signed_url, expires: Date.now() + 50 * 60 * 1000 });
  return signed_url;
}

export const signedUrls = (uris) => Promise.all((uris || []).map(signedUrl));

// 貼り付け（Ctrl+V）された画像を取り出す
export function imagesFromClipboard(event) {
  const items = Array.from(event.clipboardData?.items || []);
  return items
    .filter((item) => item.kind === 'file' && String(item.type).startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

// 入力欄に添付する画像の状態。選んだ時点でアップロードを始める
export function useImageAttachments() {
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const countRef = useRef(0);

  const add = (files) => {
    setError('');
    const list = Array.from(files || []).filter((f) => String(f.type || '').startsWith('image/'));
    if (!list.length) return;
    const room = MAX_IMAGES - countRef.current;
    if (room <= 0) {
      setError(`画像は${MAX_IMAGES}枚までです`);
      return;
    }
    if (list.length > room) setError(`画像は${MAX_IMAGES}枚までです。${list.length - room}枚は添付していません`);
    list.slice(0, room).forEach((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const entry = { id, preview: URL.createObjectURL(file), uri: '', uploading: true, failed: false };
      countRef.current += 1;
      setImages((prev) => [...prev, entry]);
      uploadImage(file)
        .then((uri) => setImages((prev) => prev.map((x) => (x.id === id ? { ...x, uri, uploading: false } : x))))
        .catch((e) => {
          setError(e.message || '画像をアップロードできませんでした');
          setImages((prev) => prev.map((x) => (x.id === id ? { ...x, uploading: false, failed: true } : x)));
        });
    });
  };

  const remove = (id) => {
    setImages((prev) => {
      const hit = prev.find((x) => x.id === id);
      if (hit) countRef.current -= 1;
      return prev.filter((x) => x.id !== id);
    });
  };

  // 送ったあとに入力欄から外す（プレビューは送った吹き出しで使い続けるので解放しない）
  const clear = () => {
    countRef.current = 0;
    setImages([]);
    setError('');
  };

  const ready = images.filter((x) => x.uri);
  return {
    images,
    error,
    add,
    remove,
    clear,
    ready,
    uploading: images.some((x) => x.uploading),
  };
}
