import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  TUTOR_IDENTITY,
  modeInstruction,
  buildStackBlock,
  buildProjectBlock,
  buildTranscript,
} from '../../shared/tutorContext.ts';
import { memoryBlock } from '../../shared/memory.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const conversationId = body.conversationId;
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 4000) : '';
    if (!conversationId || !content) {
      return Response.json({ error: 'conversationId と content が必要です' }, { status: 400 });
    }

    const conversation = await base44.entities.Conversation.get(conversationId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!conversation) {
      return Response.json({ error: '対話が見つかりません' }, { status: 404 });
    }

    const historyPage = await base44.entities.Message.filter(
      { conversation_id: conversationId },
      { sort: '-created_date', limit: 20 }
    );
    const history = (historyPage.items || []).slice().reverse();

    const stack = conversation.stack_id
      ? await base44.entities.LearningStack.get(conversation.stack_id).catch((e) =>
          e.status === 404 ? null : Promise.reject(e)
        )
      : null;

    const project = conversation.project_id
      ? await base44.entities.Project.get(conversation.project_id).catch((e) =>
          e.status === 404 ? null : Promise.reject(e)
        )
      : null;

    const mode = conversation.mode || 'learn';
    const memo = await memoryBlock(base44).catch(() => '');

    const prompt = [
      TUTOR_IDENTITY,
      modeInstruction(mode),
      memo,
      buildStackBlock(stack),
      buildProjectBlock(project, mode),
      `[これまでの対話]\n${buildTranscript(history)}`,
      `[今回の発話]\nユーザー: ${content}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const reply = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

    const saved = await base44.entities.Message.bulkCreate([
      { conversation_id: conversationId, role: 'user', content },
      { conversation_id: conversationId, role: 'assistant', content: reply },
    ]);

    const messageCount = (conversation.message_count || history.length) + 2;
    const update = { message_count: messageCount, last_message_at: new Date().toISOString() };
    if (!conversation.title || conversation.title === '新しい対話') {
      update.title = content.slice(0, 28);
    }
    await base44.entities.Conversation.update(conversationId, update);

    return Response.json({
      reply,
      messages: saved,
      messageCount,
      suggestCards: mode !== 'review',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}