import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { TUTOR_IDENTITY } from '../../shared/tutorContext.ts';
import { FIELDS, INTERPRET_RULES } from '../../shared/taxonomy.ts';

const fieldName = (id) => FIELDS.find((f) => f.id === id)?.label || '未分類';

// 全画面共通のAIチャット。いま見ている画面と、学習・制作の記録を踏まえて答える
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const message = String(body.message || '').trim().slice(0, 1500);
    const page = String(body.page || '').slice(0, 60);
    const path = String(body.path || '').slice(0, 120);
    const pageContext = String(body.context || '').trim().slice(0, 1800);
    if (!message) return Response.json({ error: 'メッセージを入力してください' }, { status: 400 });

    const today = new Date().toISOString().slice(0, 10);

    const [history, profiles, cards, attempts, reviews, projects, subs] = await Promise.all([
      base44.entities.AssistantMessage.filter({}, { sort: '-created_date', limit: 14 }),
      base44.entities.Profile.list({ limit: 1 }),
      base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 300 }),
      base44.entities.PracticeAttempt.list({ sort: '-created_date', limit: 300 }),
      base44.entities.ReviewItem.filter({ due_date: { $lte: today } }, { limit: 200 }),
      base44.entities.Project.filter({ status: { $in: ['idea', 'building', 'polishing'] } }, { sort: '-updated_date', limit: 3 }),
      base44.entities.Submission.list({ sort: '-created_date', limit: 30 }).catch(() => ({ items: [] })),
    ]);

    const profile = (profiles.items || [])[0];

    const cardStats = {};
    (cards.items || []).forEach((c) => {
      const k = fieldName(c.field);
      cardStats[k] = (cardStats[k] || 0) + 1;
    });
    const practiceStats = {};
    (attempts.items || []).forEach((a) => {
      const k = fieldName(a.field);
      practiceStats[k] = practiceStats[k] || { total: 0, ok: 0 };
      practiceStats[k].total += 1;
      if (a.correct) practiceStats[k].ok += 1;
    });
    const practiceLine =
      Object.entries(practiceStats)
        .map(([k, v]) => `${k} ${Math.round((v.ok / v.total) * 100)}%（${v.total}問）`)
        .join('、') || '記録なし';
    const shaky = (cards.items || [])
      .filter((c) => (Number(c.understanding) || 0) <= 1)
      .slice(0, 6)
      .map((c) => c.title)
      .join('、');
    const codeItems = subs.items || [];
    const codeLine = codeItems.length
      ? `${codeItems.length}回提出 / 正解 ${codeItems.filter((s) => s.verdict === 'correct').length}回`
      : '記録なし';

    const talk = (history.items || [])
      .slice()
      .reverse()
      .map((m) => `${m.role === 'user' ? 'ユーザー' : '伴走者'}: ${String(m.content).slice(0, 600)}`)
      .join('\n');

    const prompt = `${TUTOR_IDENTITY}

[この窓口の役割]
アプリのどの画面からでも開ける相談窓口です。いま見ている画面の内容と、本人の学習・制作の記録を踏まえて答えます。
- まず質問に直接答える。結論を先に。
- 画面や記録に出ていないことは断定しない。存在しないボタンや画面を作らない。
- コーディング問題を解いている画面では、完成コードや解法そのものは出さず、考え方の方向づけにとどめる。
- 確立した事実と、解釈・仮説・未解決の議論を分けて話す。
- 見出し記号やアスタリスクは使わない。目安は2〜8文。
${INTERPRET_RULES}

[本人]
${profile?.ultimate_goal ? `目的: ${profile.ultimate_goal}` : '目的は未設定'}
${profile?.current_focus ? `いまの焦点: ${profile.current_focus}` : ''}
${profile?.tone ? `望む語り口: ${profile.tone}` : ''}

[記録]
- 知識カード: ${Object.entries(cardStats).map(([k, v]) => `${k} ${v}枚`).join('、') || 'まだなし'}
- まだ曖昧なカード: ${shaky || 'なし'}
- 練習の言えた割合: ${practiceLine}
- 今日の復習待ち: ${(reviews.items || []).length}枚
- 進行中のプロジェクト: ${(projects.items || []).map((p) => `${p.title}${p.next_step ? `（次の一歩: ${p.next_step}）` : ''}`).join(' / ') || 'なし'}
- コーディング練習: ${codeLine}

[いま見ている画面] ${page || '不明'}${path ? `（${path}）` : ''}
[画面に表示されている内容（抜粋）]
${pageContext || '（取得できませんでした）'}

[直近の会話（古い順）]
${talk || '（はじめての会話）'}

[今回の発話]
ユーザー: ${message}`;

    const reply = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const text = String(reply || '').trim() || 'うまく言葉にできませんでした。もう一度話しかけてください。';

    await base44.entities.AssistantMessage.bulkCreate([
      { role: 'user', content: message, page },
      { role: 'assistant', content: text, page },
    ]);

    return Response.json({ reply: text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
