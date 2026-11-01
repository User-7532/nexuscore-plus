import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { LANG_LABEL, LANG_NOTES, loadProblem, pickLanguage } from '../../shared/codeContext.ts';

// 文法・語彙の質問窓口。書き方は具体的に答えるが、解き方は教えない
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const problem = await loadProblem(base44, String(body.problem_id || ''));
    if (!problem) return Response.json({ error: '問題が見つかりません' }, { status: 404 });
    const language = pickLanguage(body.language);
    const code = String(body.code || '').slice(0, 4000);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
    const lastUser = [...messages].reverse().find((m) => m?.role === 'user');
    if (!lastUser || !String(lastUser.content || '').trim()) {
      return Response.json({ error: 'メッセージを入力してください' }, { status: 400 });
    }

    const conversation = messages
      .map((m) => `${m.role === 'user' ? '学習者' : 'あなた'}: ${String(m.content || '').slice(0, 800)}`)
      .join('\n');

    const prompt = `あなたはプログラミングの質問窓口です。学習者が、文法・語彙・標準ライブラリの書き方が分からず手が止まっています。そこだけを具体的に助けてください。

[使用言語] ${LANG_LABEL[language]}
[言語の前提] ${LANG_NOTES[language]}

[いま解いている問題（参考）]
${problem.title}
${String(problem.statement || '').slice(0, 1200)}

[学習者の現在のコード]
\`\`\`
${code || '(まだ何も書かれていない)'}
\`\`\`

[これまでのやりとり（古い順）]
${conversation}

答え方のルール:
- 文法・語彙・標準ライブラリの使い方の質問には、その言語で実際に動く最小限のコード例（1〜8行）を添えて具体的に答える。例は質問に必要な部分だけを抜き出し、問題の答えそのものは書かない。
- 問題の解法（どう解くか、どんなアルゴリズムか）を聞かれた場合は、解法は教えない。ヒントを段階的に開けることを短く伝え、そのうえで文法面の手助けができることを1文で示す。
- 学習者のコードに文法ミスや未定義の関数があれば、該当箇所を引用して直し方を示す。
- 標準ライブラリや関数名は実在するものを正確に書く。不確かなものは書かない。
- 読みやすい簡潔な日本語。前置きや定型の締めは書かない。記号の装飾（アスタリスクや見出し記号）は使わない。`;

    const reply = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    return Response.json({ reply: String(reply || '').trim() || 'うまく答えを作れませんでした。もう一度聞いてください。' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
