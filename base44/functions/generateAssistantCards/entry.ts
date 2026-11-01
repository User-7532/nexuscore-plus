import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { CARD_SCHEMA, cardFieldsInstruction, saveTalkCards } from '../../shared/cardsFromTalk.ts';
import { lastCardMark } from '../../shared/assistantCards.ts';

// 全画面共通のAIチャットの会話から知識カードを作る。
// 前回カードにした発言（cards_checked=true）より後の会話だけを使う
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const mark = await lastCardMark(base44);
    const query = mark ? { created_date: { $gt: mark.created_date } } : {};
    const page = await base44.entities.AssistantMessage.filter(query, { sort: '-created_date', limit: 40 });
    const recent = (page.items || []).slice().reverse();

    if (!recent.some((m) => m.role === 'user')) {
      return Response.json({ created: [], reason: '新しい会話がありません' });
    }

    const transcript = recent
      .map(
        (m) =>
          `${m.role === 'user' ? 'ユーザー' : 'AI'}${m.page ? `（${m.page}）` : ''}: ${
            m.quote ? `［引用「${String(m.quote).slice(0, 300)}」について］` : ''
          }${String(m.content || '').slice(0, 1500)}`
      )
      .join('\n\n');

    const prompt = `あなたは学習者の会話から知識の構造を取り出す編集者です。
次は、アプリのどの画面からでも開ける相談窓口での会話です。括弧内は話しかけたときに開いていた画面です。

[会話]
${transcript}

[タスク]
この会話に出てきた正しい知識を、0〜4枚の知識カードにしてください。知識として残せるものは1往復だけの会話でもカードにしてよい。
- アプリの使い方、予定の相談、あいさつなど、知識として残すものがなければ cards は空の配列にする。
- コーディング問題の解法そのものはカードにしない。出てきた考え方や概念だけを扱う。
${cardFieldsInstruction()}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: CARD_SCHEMA,
    });

    const created = await saveTalkCards(
      base44,
      Array.isArray(result?.cards) ? result.cards : [],
      { source: 'assistant' }
    );

    // ここまでの会話はカードにしたので、最後の発言に印をつける（次回はこれより後だけを見る）
    const last = recent[recent.length - 1];
    await base44.entities.AssistantMessage.update(last.id, { cards_checked: true });

    if (!created.length) {
      return Response.json({ created: [], reason: '新しい概念は見つかりませんでした' });
    }
    return Response.json({ created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
