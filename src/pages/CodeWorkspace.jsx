import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookText, ChevronDown, Loader2, Send, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { LANGUAGES, fallbackTemplate, getTemplate } from '@/lib/code/languages';
import CodeEditor from '@/components/code/CodeEditor';
import ProblemBrief from '@/components/code/ProblemBrief';
import HintBox from '@/components/code/HintBox';
import GradeResult from '@/components/code/GradeResult';
import MiniChat from '@/components/code/MiniChat';
import { cn } from '@/lib/utils';

const SYNTAX_SUGGESTIONS = {
  python: ['for 文とrange の書き方', 'リストの内包表記', '二次元リストの作り方', '小数を指定した桁で丸める'],
  cpp: ['for 文の書き方', 'vector の宣言と追加', '二次元の vector', '小数を指定した桁で出力する'],
  c: ['for 文の書き方', '配列の宣言と初期化', 'malloc と free の使い方', 'printf の書式指定子'],
};

const MENTOR_SUGGESTIONS = ['なぜその書き方になるの？', '別の解き方はある？', '計算量はどう考えればいい？', 'この題材の意味とコードはどうつながる？'];

export default function CodeWorkspace() {
  const { problemId } = useParams();
  const [params] = useSearchParams();
  const { toast } = useToast();

  const [problem, setProblem] = useState(null);
  const [failed, setFailed] = useState(false);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [hints, setHints] = useState([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    base44.entities.Problem.get(problemId)
      .then((p) => {
        setProblem(p);
        const wanted = params.get('lang');
        const has = (id) => (p.templates || []).some((t) => t.language === id);
        const lang = LANGUAGES.some((l) => l.id === wanted) ? wanted : LANGUAGES.map((l) => l.id).find(has) || 'python';
        setLanguage(lang);
        setCode(getTemplate(p, lang) || fallbackTemplate(lang));
      })
      .catch(() => setFailed(true));
  }, [problemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchLanguage = (next) => {
    if (next === language || !problem) return;
    const pristine = !code.trim() || (problem.templates || []).some((t) => t.code === code) || code === fallbackTemplate(language);
    if (!pristine && !window.confirm('言語を切り替えると、コードは初期状態に戻ります。よろしいですか？')) return;
    setLanguage(next);
    setCode(getTemplate(problem, next) || fallbackTemplate(next));
    setResult(null);
  };

  const revealHint = async () => {
    if (hintLoading || !problem || hints.length >= 3) return;
    setHintLoading(true);
    try {
      const res = await base44.functions.invoke('codeHint', { problem_id: problem.id, level: hints.length + 1, language, code });
      if (res.data?.error) throw new Error(res.data.error);
      setHints((h) => [...h, res.data.hint]);
    } catch (e) {
      toast({ title: 'ヒントを出せませんでした', description: e.message, variant: 'destructive' });
    } finally {
      setHintLoading(false);
    }
  };

  const grade = async () => {
    if (grading || !problem) return;
    if (!code.trim()) {
      toast({ title: 'コードが空です', description: '何か書いてから見てもらいましょう' });
      return;
    }
    setGrading(true);
    try {
      const res = await base44.functions.invoke('gradeCode', {
        problem_id: problem.id,
        language,
        code,
        hints_used: hints.length,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      });
      if (res.data?.error) throw new Error(res.data.error);
      setResult(res.data.result);
      requestAnimationFrame(() => document.getElementById('grade-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      toast({ title: '採点できませんでした', description: e.message, variant: 'destructive' });
    } finally {
      setGrading(false);
    }
  };

  if (failed) {
    return (
      <div className="py-24 text-center">
        <p className="text-[13px] text-muted-foreground">この問題は見つかりませんでした。</p>
        <Link to="/code" className="mt-4 inline-block text-[12px] text-primary hover:opacity-70">
          問題の一覧に戻る
        </Link>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/code" className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} /> 問題の一覧
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <aside className="hidden rounded-[22px] border border-border/60 bg-card p-6 lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
          <ProblemBrief problem={problem} />
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-[20px] border border-border/70 bg-card lg:hidden">
            <button type="button" onClick={() => setBriefOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3.5 text-[12.5px]">
              <span>問題文を読む</span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${briefOpen ? 'rotate-180' : ''}`} />
            </button>
            {briefOpen && (
              <div className="border-t border-border/60 px-5 py-5">
                <ProblemBrief problem={problem} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => switchLanguage(l.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11.5px] transition-colors',
                  language === l.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                )}
              >
                {l.label}
              </button>
            ))}
          </div>

          <CodeEditor value={code} onChange={setCode} language={language} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={grade}
              disabled={grading}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[12.5px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {grading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={1.8} />}
              {grading ? 'AIが読んでいます' : '採点してもらう'}
            </button>
            <span className="text-[10.5px] text-muted-foreground">コードは実行せず、AIがテストケースを追って判定します</span>
          </div>

          <HintBox hints={hints} loading={hintLoading} onReveal={revealHint} disabled={grading} />

          <MiniChat
            key={`syntax-${language}`}
            fn="codeSyntaxHelp"
            payload={{ problem_id: problem.id, language, code }}
            icon={BookText}
            title="文法・語彙を聞く"
            note="解き方は出しません。書き方だけ答えます"
            intro="書き方で詰まったら、そのまま聞いてください。使っている言語に合わせて、短いコード例を出します。"
            suggestions={SYNTAX_SUGGESTIONS[language] || SYNTAX_SUGGESTIONS.python}
            placeholder="例：二次元のリストで、隣のマスを数える書き方は？"
            monoReply
            collapsible
            defaultOpen={false}
          />

          {result && (
            <div id="grade-result" className="space-y-4">
              <GradeResult result={result} />
              <MiniChat
                fn="codeMentor"
                payload={{ problem_id: problem.id, last_result: JSON.stringify(result).slice(0, 4000) }}
                icon={Sparkles}
                title="メンターと振り返る"
                note="採点の結果について、納得できるまで"
                suggestions={MENTOR_SUGGESTIONS}
                placeholder="疑問をそのまま書いてみる"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
