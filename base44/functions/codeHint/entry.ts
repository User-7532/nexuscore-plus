import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { LANG_LABEL, loadProblem, pickLanguage } from '../../shared/codeContext.ts';

// 3段階のヒント。段階が上がるほど具体的になるが、完成コードは出さない
const LEVEL_GUIDE = {
  1: '考え方の方向づけだけ。解き方の全体像には触れず「どこに目をつけるか」を一言で。',
  2: '使う道具（データ構造やアルゴリズムの名前）を1つ挙げ、なぜそれが効くのかを説明する。コードは書かない。',
  3: '具体的な手順を箇条書きで3〜4行。ただし完成コードは書かない。',
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const problem = await loadProblem(base44, String(body.problem_id || ''));
    if (!problem) return Response.json({ error: '問題が見つかりません' }, { status: 404 });
    const level = Math.max(1, Math.min(3, Number(body.level) || 1));
    const language = pickLanguage(body.language);
    const code = String(body.code || '').slice(0, 12000);

    const prompt = `あなたはプログラミングの先生です。学習者が次の問題を解いています。ヒントを1つだけ出してください。

[問題] ${problem.title}
${problem.statement}

[言語] ${LANG_LABEL[language]}
[学習者の今のコード]
\`\`\`
${code || '(まだ何も書いていない)'}
\`\`\`

[ヒントのレベル] ${level} / 3
[このレベルで出す内容] ${LEVEL_GUIDE[level]}

ルール:
- 日本語で3文以内（レベル3は箇条書き可）。専門用語は正確な標準用語で書き、比喩や曖昧な言い換えをしない。
- 答えのコードをそのまま書かない。
- 学習者のコードに明らかな間違いがあれば、まずそこを指摘する。
- 最後に短い問いかけを1つ入れて、考えを促す。`;

    const hint = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    return Response.json({ hint: String(hint || '').trim(), level });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
