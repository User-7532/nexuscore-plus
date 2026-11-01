import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    correct: { type: 'boolean' },
    feedback: { type: 'string' },
  },
  required: ['correct', 'feedback'],
};

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const questionId = String(body.question_id || '');
    const answerText = String(body.answer_text || '').trim().slice(0, 3000);
    if (!questionId) return Response.json({ error: 'question_id が必要です' }, { status: 400 });
    if (!answerText) return Response.json({ error: '解答を入力してください' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const question = await base44.entities.PracticeQuestion.get(questionId).catch(() => null);
    if (!question) return Response.json({ error: '問題が見つかりません' }, { status: 404 });
    const card = await base44.entities.KnowledgeCard.get(question.card_id).catch(() => null);

    const prompt = `あなたは学習者の理解を確かめる採点者です。次の記述問題への解答を判定してください。

[もとになった知識カード]
${card ? `${card.title}: ${card.summary}` : '（見つかりませんでした）'}

[問題] ${question.text}
[想定した解答] ${question.model_answer || question.answer || '(なし)'}
[解説] ${question.explanation || '(なし)'}

判定の基準:
- 想定した解答の要点を、自分の言葉で説明できていれば正解。言い回しが違っても、意味が合っていれば正解にする。
- 要点が抜けている、逆の意味になっている、あいまいで正誤がはっきりしない場合は不正解。迷う場合は不正解にする。
- 問題が名称を答えるよう求めている場合は、求められた名称がすべて解答に含まれているときだけ正解にする。問題文にすでに書かれている名称を書かなかったことは、減点しない。

[学習者の解答]
${answerText}

feedback は日本語で2〜3文。相手を評価する言い方はせず、正解なら次に考えるとよい観点を1つ、不正解なら抜けている要点を具体的に示す。専門用語は正確に。`;

    const verdict = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: VERDICT_SCHEMA });

    return Response.json({
      correct: verdict?.correct === true,
      feedback: String(verdict?.feedback || '').trim(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
