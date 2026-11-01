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

    const historyPage = await base44.entities.Message.filter(
      { conversation_id: conversation.id },
      { sort: 'created_date', limit: 40 }
    );
    const history = historyPage.items || [];
    if (history.length < 2) {
      return Response.json({ created: [], reason: '対話がまだ短すぎます' });
    }

    const prompt = [
      'あなたは学習者の対話から知識の構造を取り出す編集者です。',
      buildStackBlock(stack),
      `[対話]\n${buildTranscript(history)}`,
      `[タスク]\nこの対話から、相手が実際に手に入れた概念を1〜4枚の知識カードにしてください。\n${cardFieldsInstruction()}`,
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

    await base44.entities.Conversation.update(conversation.id, {
      cards_generated_at: new Date().toISOString(),
    });

    if (!created.length) {
      return Response.json({ created: [], reason: '新しい概念は見つかりませんでした' });
    }
    return Response.json({ created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
