import { useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AssistantPanel from '@/components/assistant/AssistantPanel';
import useDragPosition from '@/hooks/use-drag-position';
import { onAskSelection } from '@/lib/selection-ask';
import { importExternal, importReport } from '@/lib/external-import';
import { signedUrls } from '@/lib/attachments';

const PAGE_LABEL = {
  '/': '今日',
  '/tutor': '学びの対話',
  '/cards': '知識カード',
  '/practice': '練習',
  '/practice/review': '復習',
  '/practice/stats': '学習の統計',
  '/code': 'コーディング練習',
  '/projects': 'プロジェクト',
  '/settings': '設定',
};

const pageLabelOf = (pathname) => {
  if (pathname.startsWith('/projects/')) return 'プロジェクトの詳細';
  if (pathname.startsWith('/code/')) return 'コーディング問題を解く画面';
  return PAGE_LABEL[pathname] || pathname;
};

// いま画面に出ている文字だけを軽く取り出して、会話の文脈にする
const visibleContext = () => {
  const main = document.querySelector('main');
  const text = (main?.innerText || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, 1700);
};

const toMessage = (m) => ({ id: m.id, role: m.role, content: m.content, quote: m.quote || '', images: m.images || [], created_date: m.created_date });

// 古い順に並べる。質問と返事は同じ時刻で保存されるので、同時刻はIDの順（質問が先）にする
const byTime = (a, b) =>
  String(a.created_date || '').localeCompare(String(b.created_date || '')) || String(a.id).localeCompare(String(b.id));

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState(null);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState('');
  const [importing, setImporting] = useState(false);
  const { pathname } = useLocation();
  const { toast } = useToast();
  const drag = useDragPosition();

  useEffect(() => {
    // 新しいほうから60件を取り、古い順に並べ直して表示する
    base44.entities.AssistantMessage.list({ sort: '-created_date', limit: 60 })
      .then((page) => setMessages((page.items || []).map(toMessage).sort(byTime)))
      .catch(() => setMessages([]));
  }, []);

  // 検索で選んだ発言がまだ読み込まれていないとき、その発言から最新までを読み込む
  const loadFrom = async (iso) => {
    try {
      const page = await base44.entities.AssistantMessage.filter({ created_date: { $gte: iso } }, { sort: 'created_date', limit: 500 });
      const saved = (page.items || []).map(toMessage);
      setMessages((prev) => {
        // 送ったばかりでまだ保存されていない発言は残す
        const unsaved = (prev || []).filter(
          (m) => /^[ua]-/.test(String(m.id)) && !saved.some((s) => s.role === m.role && s.content === m.content)
        );
        return [...saved.sort(byTime), ...unsaved];
      });
    } catch (e) {
      toast({ title: '会話を読み込めませんでした', description: e.message, variant: 'destructive' });
    }
  };

  // 会話に出てきた知識を、その都度カードにする。返事の表示は待たせない
  // 続けて送ったときは、前のカードづくりが終わってからもう一度だけ走らせる
  const cardJob = useRef({ running: false, again: false });
  const makeCards = async () => {
    if (cardJob.current.running) {
      cardJob.current.again = true;
      return;
    }
    cardJob.current.running = true;
    try {
      const res = await base44.functions.invoke('generateAssistantCards', {});
      const count = res.data?.created?.length || 0;
      if (count) {
        toast({
          title: `知識カードを${count}枚 育てました`,
          description: 'AIチャットでの会話から作りました。「知識カード」から見られます。',
        });
      }
    } catch {
      // カードづくりに失敗しても会話は続けられるので、知らせない
    } finally {
      cardJob.current.running = false;
      if (cardJob.current.again) {
        cardJob.current.again = false;
        makeCards();
      }
    }
  };

  // 画面で選んだ文章を受け取り、引用つきの質問として開く
  useEffect(
    () =>
      onAskSelection((text) => {
        setQuote(text);
        setOpen(true);
      }),
    []
  );

  const send = async (raw, imgs = []) => {
    const uris = imgs.map((i) => i.uri);
    // 画像だけを送ったときは、画像について聞いたことにする
    const text = String(raw || '').trim() || (uris.length ? 'この画像について教えて' : '');
    if (!text || busy) return;
    const currentQuote = quote;
    setOpen(true);
    setBusy(true);
    setQuote('');
    setMessages((prev) => [...(prev || []), { id: `u-${Date.now()}`, role: 'user', content: text, quote: currentQuote, images: uris, previews: imgs.map((i) => i.preview) }]);
    try {
      // 画像は、AIが読める期限つきのURLにして渡す（保存するのは保存先の場所だけ）
      const imageUrls = uris.length ? await signedUrls(uris) : [];
      const res = await base44.functions.invoke('assistantChat', {
        message: text,
        images: imageUrls,
        image_uris: uris,
        quote: currentQuote,
        page: pageLabelOf(pathname),
        path: pathname,
        context: visibleContext(),
      });
      if (res.data?.error) throw new Error(res.data.error);
      setMessages((prev) => [...(prev || []), { id: `a-${Date.now()}`, role: 'assistant', content: res.data.reply }]);
      if (res.data?.suggestCards) makeCards();
    } catch (e) {
      toast({ title: 'うまく答えられませんでした', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // 入力欄に貼った、ほかのAIとの会話を取り込む。結果は会話にも残す
  const runImport = async (raw, imgs = []) => {
    const text = String(raw || '').trim();
    const uris = imgs.map((i) => i.uri);
    if ((!text && !uris.length) || busy) return;
    const label = `ほかのAIとの会話を取り込む（${[text ? `${text.length.toLocaleString()}字` : '', uris.length ? `画像${uris.length}枚` : ''].filter(Boolean).join('・')}）`;
    setOpen(true);
    setBusy(true);
    setImporting(true);
    setMessages((prev) => [...(prev || []), { id: `u-${Date.now()}`, role: 'user', content: label, images: uris, previews: imgs.map((i) => i.preview) }]);
    try {
      const result = await importExternal(text, uris);
      const report = importReport(result);
      setMessages((prev) => [...(prev || []), { id: `a-${Date.now()}`, role: 'assistant', content: report }]);
      // 取り込みの報告は会話の記録に残すが、カードづくりの対象にはしない（cards_checked で印をつける）
      base44.entities.AssistantMessage.bulkCreate([
        { role: 'user', content: label, page: '取り込み', images: uris },
        { role: 'assistant', content: report, page: '取り込み', cards_checked: true },
      ]).catch(() => {});
    } catch (e) {
      toast({ title: '取り込めませんでした', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      setImporting(false);
    }
  };

  const toggleExpand = () => {
    // 広げる・戻すときは、画面からはみ出さないよう位置をもとに戻す
    drag.reset();
    setExpanded((v) => !v);
  };

  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-30 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {open && (
        <div
          ref={drag.ref}
          className={`pointer-events-auto relative transition-[width,height] duration-300 ${
            expanded
              ? 'h-[min(82dvh,calc(100dvh-9rem))] w-[min(760px,calc(100vw-1.5rem))]'
              : 'h-[min(540px,calc(100dvh-9rem))] w-[min(380px,calc(100vw-1.5rem))]'
          }`}
          style={{ transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)` }}
        >
          <AssistantPanel
            messages={messages}
            busy={busy}
            onSend={send}
            onImport={runImport}
            importing={importing}
            onClose={() => setOpen(false)}
            onLoadFrom={loadFrom}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            quote={quote}
            onClearQuote={() => setQuote('')}
            dragProps={drag.dragProps}
            dragging={drag.dragging}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-[12px] text-muted-foreground shadow-[0_8px_24px_-12px_rgba(40,34,28,0.45)] transition-colors hover:text-foreground"
        title="伴走者に話しかける"
      >
        <MessageCircle className="h-4 w-4 text-primary" strokeWidth={1.7} />
        {open ? '閉じる' : 'AIに聞く'}
      </button>
    </div>
  );
}
