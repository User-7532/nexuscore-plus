import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// 添付された画像（ほかのAIとの会話のスクリーンショットなど）を、文字に起こす
const MAX_IMAGES = 5;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const urls = (Array.isArray(body.urls) ? body.urls : [])
      .map((u) => String(u || ''))
      .filter((u) => /^https:\/\//.test(u))
      .slice(0, MAX_IMAGES);
    if (!urls.length) return Response.json({ error: '画像がありません' }, { status: 400 });

    const text = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `添付した${urls.length}枚の画像は、利用者が学習のために取り込みたい資料です（多くは、ほかのAIとの会話のスクリーンショット）。画像に書かれている内容を、文字に起こしてください。

- 画像の順に、書かれている文章をできるだけそのまま書き写す。要約しない。
- 会話なら、発言ごとに「利用者:」「AI:」をつけて区別する。どちらの発言か画像から判断できないときは、つけずに書き写す。
- コードはコードとしてそのまま書き写す。数式は読める形で書く。
- 図や表は、何が書かれているかを言葉で説明する（例: 「図: 〇〇から△△への矢印」）。
- 読み取れない部分は［判読不能］と書く。推測で補ったり、書かれていない説明を足したりしない。
- 画像と画像のあいだに「---」を入れる。前置きや感想は書かない。`,
      file_urls: urls,
    });

    return Response.json({ text: String(text || '').trim().slice(0, 60000) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
