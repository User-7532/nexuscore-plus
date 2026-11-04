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

    // 解釈が中心の問いは、一つの正解との一致ではなく、観点を満たしているかで判定する
    const rubric = question.assessment === 'rubric' && Array.isArray(question.rubric) ? question.rubric : [];
    const criteria = rubric.length
      ? `判定の基準（観点方式）:
- この問いには一つの正解はない。想定した解答は一例にすぎない。
- 次の観点のうち半分以上を満たし、事実の誤りがなければ correct にする。
${rubric.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}
- 想定と違う結論でも、根拠が示され、筋が通っていれば減点しない。
- 事実として誤っていること、または確立していない仮説を断定していることは、feedback で具体的に指摘する。それが論の中心なら correct にしない。
- feedback では、満たした観点と足りない観点を分けて示す。学習者の結論の善し悪しは評価しない。`
      : `判定の基準:
- 想定した解答は、正解の一例にすぎない。問題文の条件（聞いている対象・観点・数）を満たし、内容が正しければ、想定した解答と違う要素を挙げていても正解にする。言い回しの違いは問わない。
- 妥当な答えが何通りもある問いでは、問いに合った正しい答えを挙げていれば正解。想定した解答の要素がそろっていないことだけを理由に不正解にしない。問題文で求めていない要素を書いていないことも減点しない。
- 問題文で数や観点が示されているときは、それを満たしているかを確かめる。足りなければ不正解。
- 不正解にするのは、事実の誤りがある、逆の意味になっている、問いに答えていない、指定の数や観点を満たしていない、あいまいで正しいかどうか判断できない、のいずれかの場合だけ。妥当な別解かどうか迷うときは、内容が正しければ正解にする。
- 問題が名称を答えるよう求めている場合は、求められた名称がすべて解答に含まれているときだけ正解にする。問題文にすでに書かれている名称を書かなかったことは、減点しない。`;

    const prompt = `あなたは学習者の理解を確かめる採点者です。次の記述問題への解答を判定してください。

[もとになった知識カード]
${card ? `${card.title}: ${card.summary}${card.verifiable ? `\n確かめられること: ${card.verifiable}` : ''}${card.interpretation ? `\n解釈・仮説: ${card.interpretation}` : ''}` : '（見つかりませんでした）'}

[問題] ${question.text}
[想定した解答（正解の一例）] ${question.model_answer || question.answer || '(なし)'}
${!rubric.length && Array.isArray(question.expected_points) && question.expected_points.length ? `[問題文で求めている要素] ${question.expected_points.join(' / ')}\n` : ''}[解説] ${question.explanation || '(なし)'}

${criteria}

[学習者の解答]
${answerText}

feedback は日本語で2〜3文。相手を評価する言い方はせず、正解なら次に考えるとよい観点を1つ、不正解なら問いのどの条件を満たしていないか・どこが誤りかを具体的に示し、正解になる答え方の例を1つ添える。専門用語は正確に。`;

    const verdict = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: VERDICT_SCHEMA });

    return Response.json({
      correct: verdict?.correct === true,
      feedback: String(verdict?.feedback || '').trim(),
      assessment: rubric.length ? 'rubric' : 'exact',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
