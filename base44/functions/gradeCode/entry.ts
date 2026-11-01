import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { LANG_FENCE, LANG_LABEL, loadProblem, pickLanguage } from '../../shared/codeContext.ts';

const MAX_CODE = 20000;

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['correct', 'partial', 'wrong'] },
    score: { type: 'number' },
    test_results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { case: { type: 'string' }, passed: { type: 'boolean' }, reason: { type: 'string' } },
        required: ['case', 'passed', 'reason'],
      },
    },
    time_complexity: { type: 'string' },
    space_complexity: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
  },
  required: ['verdict', 'score', 'test_results', 'time_complexity', 'issues', 'explanation'],
};

// 提出コードをAIが読み、テストケースを1件ずつ追って判定する（実際には実行しない）
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const problem = await loadProblem(base44, String(body.problem_id || ''));
    if (!problem) return Response.json({ error: '問題が見つかりません' }, { status: 404 });
    const language = pickLanguage(body.language);
    const code = String(body.code || '');
    if (!code.trim()) return Response.json({ error: 'コードが空です' }, { status: 400 });
    if (code.length > MAX_CODE) return Response.json({ error: 'コードが長すぎます' }, { status: 400 });

    const cases =
      (problem.test_cases || [])
        .map((t, i) => `${i + 1}. 入力: ${t.input || '-'} / 期待する出力: ${t.expected || '-'}${t.note ? ` (${t.note})` : ''}`)
        .join('\n') || '(指定なし。問題文から妥当なケースを3つ考えて検証)';

    const prompt = `あなたはプログラミングの採点者です。次の提出コードを読み、実際には実行せず、テストケースを1件ずつ頭の中で追いかけて判定してください。

[問題]
${problem.title}
${problem.statement}

[制約]
${problem.constraints || '特になし'}

[検証するテストケース]
${cases}

[言語] ${LANG_LABEL[language]}
[想定の計算量] ${problem.expected_complexity || '指定なし'}

[提出コード]
\`\`\`${LANG_FENCE[language]}
${code}
\`\`\`

判定のルール:
- コードは実行しない。上のテストケースを順に手で追い、各ケースの出力を予想して合否を出す。
- コンパイルエラーや未定義動作になりそうな箇所があれば、その時点で wrong とし、理由を書く。
- 全ケース通過なら correct、考え方は合っているが一部ケースで落ちるなら partial、根本的に誤りなら wrong。
- score は 0〜100 の整数。time_complexity と space_complexity は O(...) の形で書く。
- issues は「直したほうがいい点」を最大4つ、短い日本語で。
- 言語が C のときは、C++専用の機能が混ざっていればコンパイルエラーとして扱う。malloc した領域の free 忘れや、配列の範囲外アクセスも指摘する。
- explanation は 250字程度の日本語。専門用語は正確な標準用語で書き、比喩や曖昧な言い換えはしない。`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: GRADE_SCHEMA });

    const submission = await base44.entities.Submission.create({
      problem_id: problem.id,
      problem_title: problem.title,
      language,
      code,
      verdict: ['correct', 'partial', 'wrong'].includes(result?.verdict) ? result.verdict : 'wrong',
      score: Math.max(0, Math.min(100, Math.round(Number(result?.score) || 0))),
      time_complexity: result?.time_complexity || '',
      space_complexity: result?.space_complexity || '',
      test_results: result?.test_results || [],
      issues: result?.issues || [],
      explanation: result?.explanation || '',
      topics: problem.topics || [],
      field: problem.field || '',
      hints_used: Math.max(0, Math.min(3, Number(body.hints_used) || 0)),
      duration_seconds: Number(body.duration_seconds) || 0,
    });

    return Response.json({ result, submission });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
