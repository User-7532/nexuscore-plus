import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { TUTOR_IDENTITY, modeInstruction, buildProjectBlock } from '../../shared/tutorContext.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (!body.projectId) {
      return Response.json({ error: 'projectId が必要です' }, { status: 400 });
    }

    const project = await base44.entities.Project.get(body.projectId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!project) {
      return Response.json({ error: 'プロジェクトが見つかりません' }, { status: 404 });
    }

    const files = (project.files || []).filter((f) => String(f.content || '').trim());
    if (!files.length) {
      return Response.json({ error: 'まだコードがありません。1ファイル書いてから振り返りましょう。' }, { status: 400 });
    }

    const prompt = [
      TUTOR_IDENTITY,
      modeInstruction('review'),
      buildProjectBlock(project, 'review'),
      '上記のコードを、本人が次に自分で直せるように振り返ってください。',
    ]
      .filter(Boolean)
      .join('\n\n');

    const review = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

    await base44.entities.Project.update(project.id, {
      last_review: review,
      last_review_at: new Date().toISOString(),
    });

    return Response.json({ review });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}