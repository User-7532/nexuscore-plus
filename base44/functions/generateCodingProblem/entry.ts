import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { FIELDS } from '../../shared/taxonomy.ts';
import { LANG_LABEL, pickLanguage } from '../../shared/codeContext.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    statement: { type: 'string' },
    constraints: { type: 'string' },
    test_cases: {
      type: 'array',
      items: {
        type: 'object',
        properties: { input: { type: 'string' }, expected: { type: 'string' }, note: { type: 'string' } },
        required: ['input', 'expected'],
      },
    },
    expected_complexity: { type: 'string' },
    time_limit_minutes: { type: 'number' },
    topics: { type: 'array', items: { type: 'string' } },
    theme: { type: 'string' },
    templates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { language: { type: 'string' }, code: { type: 'string' } },
        required: ['language', 'code'],
      },
    },
  },
  required: ['title', 'statement', 'test_cases', 'topics', 'templates'],
};

const DIFFICULTY_JA = {
  basic: '基礎（ループ・条件分岐・配列などの定石をそのまま使う）',
  intermediate: '中級（データ構造の選び方や、計算量を意識する必要がある）',
  advanced: '上級（複数の考え方を組み合わせる。設計と説明も問われる）',
};

// 大分野にちなんだ、プログラムで確かめやすい題材の例
const FIELD_THEMES = {
  'active-inference': 'ベイズ更新、KLダイバージェンス、簡単な生成モデルでの予測誤差の計算など',
  'math-physics': 'シャノンエントロピーや相互情報量の計算、ランダムウォーク、ロジスティック写像、イジング模型の小さな格子など',
  computation: 'ライフゲームの1世代更新、チューリングマシンや有限オートマトンのシミュレータ、文字列の圧縮によるコルモゴロフ複雑性の近似など',
  neuroscience: 'リーキー積分発火モデル、ヘブ則による重みの更新、スパイク列の発火率の計算など',
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const difficulty = ['basic', 'intermediate', 'advanced'].includes(body.difficulty) ? body.difficulty : 'basic';
    const language = pickLanguage(body.language);
    const request = String(body.request || '').slice(0, 800);
    const fieldId = FIELDS.some((f) => f.id === body.field) ? body.field : '';
    const field = FIELDS.find((f) => f.id === fieldId);

    const [problemsPage, subsPage] = await Promise.all([
      base44.entities.Problem.list({ sort: '-created_date', limit: 30 }),
      base44.entities.Submission.list({ sort: '-created_date', limit: 60 }),
    ]);
    const avoid = (problemsPage.items || []).map((p) => p.title).slice(0, 20);
    const weak = {};
    (subsPage.items || []).forEach((s) => {
      if (s.verdict === 'correct') return;
      (s.topics || []).forEach((t) => {
        weak[t] = (weak[t] || 0) + 1;
      });
    });
    const weakTopics = Object.entries(weak)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([t]) => t);

    const prompt = `あなたはプログラミング練習の出題者です。Python・C++・C のどれでも解ける問題を1問作ってください。

[この人の要望（最優先で反映する）] ${request || '特になし'}
[題材] ${field ? `${field.label}にちなんだ題材にする。例: ${FIELD_THEMES[field.id]}。題材の背景知識は問題文の中で必要な分だけ説明し、知らなくても解けるようにする。` : '一般的なアルゴリズムの題材'}
[難易度] ${DIFFICULTY_JA[difficulty]}
[主に使う言語] ${LANG_LABEL[language]}
[この人が誤答しやすいトピック] ${weakTopics.join('、') || '不明'}
[避けたい既出タイトル] ${avoid.join('、') || 'なし'}

作り方のルール:
- 問題文は日本語で、入出力の仕様がはっきり分かるように書く。関数のシグネチャ（引数と戻り値）も問題文に明記する。
- 題材の数式や規則を使うときは、計算の定義を問題文に正確に書く（例: エントロピーの対数の底、ライフゲームの境界の扱い）。
- test_cases は境界値を含めて3〜4個。input と expected は簡潔な文字列で書き、expected は実際に計算して正しい値にする。浮動小数点の答えは小数点以下の桁数を問題文で指定する。
- templates には python・cpp・c の3つのひな形（関数シグネチャと空の本体）を入れる。language は "python"・"cpp"・"c"。c のひな形は C 言語だけで書く。
- topics には、解くのに使うアルゴリズム上のトピック（配列、二次元配列、ハッシュマップ、再帰、動的計画法、シミュレーションなど）を2〜3個入れる。
- theme には題材を10〜20字で入れる。
- 専門用語は正確な標準用語を使い、比喩や曖昧な言い換えはしない。解法や答えのコードは書かない。`;

    const generated = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA });
    if (!generated?.title || !generated?.statement) return Response.json({ error: '問題を作れませんでした。もう一度お試しください。' }, { status: 502 });

    const problem = await base44.entities.Problem.create({
      title: String(generated.title).slice(0, 120),
      statement: String(generated.statement),
      constraints: String(generated.constraints || ''),
      difficulty,
      topics: (generated.topics || []).slice(0, 4),
      field: fieldId,
      theme: String(generated.theme || '').slice(0, 40),
      templates: Array.isArray(generated.templates) ? generated.templates : [],
      test_cases: (generated.test_cases || []).slice(0, 5),
      expected_complexity: String(generated.expected_complexity || ''),
      time_limit_minutes:
        Number(generated.time_limit_minutes) || (difficulty === 'advanced' ? 40 : difficulty === 'intermediate' ? 25 : 15),
    });

    return Response.json({ problem });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
