import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { loadProblem } from '../../shared/codeContext.ts';

// 採点の結果について、なぜその書き方になるのかを対話で深める
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return Response.json({ error: 'messages is required' }, { status: 400 });

    const problem = await loadProblem(base44, String(body.problem_id || ''));
    const problemBlock = problem ? `[問題] ${problem.title}\n${problem.statement}` : '（問題の指定なし。直前の採点結果について話す）';

    const history = messages
      .slice(-12)
      .map((m) => `${m.role === 'user' ? '学習者' : 'メンター'}: ${String(m.content).slice(0, 2000)}`)
      .join('\n');

    const prompt = `あなたはプログラミングのメンターです。学習者と対話して「なぜその解き方になるのか」の構造的な理解を深めます。

${problemBlock}

[直前の採点結果の要約]
${body.last_result ? String(body.last_result).slice(0, 4000) : 'なし'}

[これまでのやりとり]
${history}

返事のルール:
- 日本語で。まず学習者の質問に正面から答える。前置きは短く。
- 専門用語は正確な標準用語で書く。比喩や曖昧な言い換えでごまかさない。初めて出る用語にだけ括弧書きで短い補足を添える。
- 題材が数理や神経科学などの分野にちなんでいるときは、コードの書き方と、題材の意味のつながりにも触れてよい。
- 4〜8行程度。最後に、学習者自身が手を動かして確認できる小さな一歩を1つ示す。
- 完成コードを丸ごと渡さない。`;

    const reply = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    return Response.json({ reply: String(reply || '').trim() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
