import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { buildStackBlock, buildTranscript } from '../../shared/tutorContext.ts';
import { CARD_SCHEMA, cardFieldsInstruction, saveTalkCards } from '../../shared/cardsFromTalk.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (!body.conversationId) {
      return Response.json({ error: 'conversationId が必要です' }, { status: 400 });
    }

    const conversation = await base44.entities.Conversation.get(body.conversationId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!conversation) {
      return Response.json({ error: '対話が見つかりません' }, { status: 404 });
    }

    const stack = conversation.stack_id
      ? await base44.entities.LearningStack.get(conversation.stack_id).catch((e) =>
          e.status === 404 ? null : Promise.reject(e)
        )
      : null;

    // 前回カードにした発言より後だけを使う（毎回呼ばれるので、同じ部分を何度もカードにしない）
    const query = conversation.cards_generated_at
      ? { conversation_id: conversation.id, created_date: { $gt: conversation.cards_generated_at } }
      : { conversation_id: conversation.id };
    const historyPage = await base44.entities.Message.filter(query, { sort: '-created_date', limit: 40 });
    const history = (historyPage.items || []).slice().reverse();
    if (!history.some((m) => m.role === 'user')) {
      return Response.json({ created: [], reason: '新しい対話がありません' });
    }

    const prompt = [
      'あなたは学習者の対話から知識の構造を取り出す編集者です。',
      buildStackBlock(stack),
      `[対話]\n${buildTranscript(history)}`,
      `[タスク]\nこの対話に出てきた正しい知識を、0〜4枚の知識カードにしてください。知識として残せるものがなければ cards は空の配列にする。\n${cardFieldsInstruction()}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: CARD_SCHEMA,
    });

    const created = await saveTalkCards(
      base44,
      Array.isArray(result?.cards) ? result.cards : [],
      {
        source: 'dialogue',
        stack_id: conversation.stack_id || '',
        source_conversation_id: conversation.id,
      },
      stack ? stack.name : ''
    );

    // 次回はここまでの続きから。処理中に届いた発言を飛ばさないよう、今回使った最後の発言の時刻にする
    await base44.entities.Conversation.update(conversation.id, {
      cards_generated_at: history[history.length - 1].created_date,
    });

    if (!created.length) {
      return Response.json({ created: [], reason: '新しい概念は見つかりませんでした' });
    }
    return Response.json({ created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
