import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Feather, Layers, Loader2, Repeat } from 'lucide-react';
import { todayISO } from '@/lib/srs';
import { base44 } from '@/api/base44Client';
import { STAGE_LABELS, STAGE_STYLES } from '@/components/project/stages';
import { cn } from '@/lib/utils';

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const list = { show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'おつかれさまです';
  if (h < 11) return 'おはようございます';
  if (h < 18) return 'こんにちは';
  return 'こんばんは';
}

export default function Home() {
  const [state, setState] = useState({
    loading: true,
    profile: null,
    project: null,
    promptCard: null,
    recentCards: [],
    counts: { cards: 0, conversations: 0, projects: 0 },
  });

  const [dueCount, setDueCount] = useState(0);

  // 今日復習するカードの枚数
  useEffect(() => {
    base44.entities.ReviewItem.filter({ due_date: { $lte: todayISO() } }, { limit: 200 })
      .then((page) => setDueCount((page.items || []).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const [profilePage, cardCount, conversationCount, projectCount, projectPage, cardsPage] = await Promise.all([
        base44.entities.Profile.list({ limit: 1 }),
        base44.entities.KnowledgeCard.count(),
        base44.entities.Conversation.count(),
        base44.entities.Project.count(),
        base44.entities.Project.filter(
          { status: { $in: ['idea', 'building', 'polishing'] } },
          { sort: '-updated_date', limit: 1 }
        ),
        base44.entities.KnowledgeCard.list({ sort: '-created_date', limit: 8 }),
      ]);
      const cards = cardsPage.items || [];
      const promptCard = [...cards].sort((a, b) => (a.visit_count || 0) - (b.visit_count || 0))[0] || null;
      setState({
        loading: false,
        profile: (profilePage.items || [])[0] || null,
        project: (projectPage.items || [])[0] || null,
        promptCard,
        recentCards: cards.slice(0, 3),
        counts: { cards: cardCount, conversations: conversationCount, projects: projectCount },
      });
    })().catch(() => setState((prev) => ({ ...prev, loading: false })));
  }, []);

  const { loading, profile, project, promptCard, recentCards, counts } = state;
  const steps = project?.steps || [];
  const done = steps.filter((s) => s.done).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <motion.div variants={list} initial="hidden" animate="show" className="space-y-10">
      <motion.header variants={fade} className="space-y-4">
        <p className="text-[11.5px] tracking-[0.18em] text-muted-foreground">
          {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
        <h1 className="max-w-xl text-[26px] leading-[1.5] md:text-[32px] md:leading-[1.45]">
          {greeting()}。
          <br />
          今日は、少しだけ動けば十分です。
        </h1>
        <p className="max-w-lg text-[13.5px] leading-relaxed text-muted-foreground">
          {profile?.current_focus
            ? `いまは「${profile.current_focus}」に向かっています。`
            : '考えていることを言葉にして、小さく作って、振り返る。その往復をここで。'}
        </p>
      </motion.header>

      {dueCount > 0 && (
        <motion.div variants={fade}>
          <Link
            to="/practice/review"
            className="group flex items-center justify-between gap-4 rounded-[20px] border border-border/70 bg-card px-5 py-4 transition-colors hover:bg-secondary/40"
          >
            <span className="flex items-center gap-3">
              <Repeat className="h-4 w-4 text-primary" strokeWidth={1.7} />
              <span className="text-[13px]">忘れかけたころのカードが {dueCount} 枚あります</span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.8} />
          </Link>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <motion.section
          variants={fade}
          className="relative overflow-hidden rounded-[24px] border border-border/70 bg-card p-6 md:p-8 lg:col-span-3"
        >
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-accent/40 blur-2xl" />
          <div className="relative space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
              <Feather className="h-3 w-3" strokeWidth={1.8} />
              今日の学びの糸口
            </span>
            {promptCard ? (
              <>
                <div className="space-y-2">
                  <p className="text-[11px] tracking-wide text-primary">{promptCard.domain || '概念'}</p>
                  <h2 className="text-[19px] leading-relaxed md:text-[21px]">{promptCard.title}</h2>
                  <p className="line-clamp-3 text-[13px] leading-[1.9] text-muted-foreground">{promptCard.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/cards"
                    className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[12.5px] text-primary-foreground transition-all duration-300 hover:gap-3"
                  >
                    カードをひらく
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.8} />
                  </Link>
                  {promptCard.open_question && (
                    <p className="text-[11.5px] text-muted-foreground">問い：{promptCard.open_question}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <h2 className="text-[19px] leading-relaxed md:text-[21px]">まず、言葉にするところから</h2>
                  <p className="text-[13px] leading-[1.9] text-muted-foreground">
                    まだカードはありません。AIとの対話を3往復ほど続けると、その中から概念がカードとして自動で生まれます。
                  </p>
                </div>
                <Link
                  to="/tutor"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[12.5px] text-primary-foreground transition-all duration-300 hover:gap-3"
                >
                  AIと話してみる
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.8} />
                </Link>
              </>
            )}
          </div>
        </motion.section>

        <motion.section
          variants={fade}
          className="flex flex-col justify-between gap-6 rounded-[24px] border border-border/70 bg-card p-6 md:p-7 lg:col-span-2"
        >
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
              <Code2 className="h-3 w-3" strokeWidth={1.8} />
              いま進めていること
            </span>
            {project ? (
              <>
                <div className="space-y-1.5">
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[9.5px]', STAGE_STYLES[project.stage])}>
                    {STAGE_LABELS[project.stage]}
                  </span>
                  <h2 className="text-[16.5px] leading-relaxed">{project.title}</h2>
                </div>
                <div className="rounded-2xl bg-secondary/70 px-3.5 py-3">
                  <p className="text-[10.5px] text-muted-foreground">次の小さな一歩</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed">{project.next_step || 'まだ決めていません'}</p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <h2 className="text-[16.5px] leading-relaxed">まだ何もない、まっさらな状態</h2>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  身近な困りごとをひとつ選ぶところから。うまく形になるかは、あとで考えて大丈夫。
                </p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>ステップ</span>
              <span>{steps.length ? `${done} / ${steps.length}` : 'これから'}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-700"
                style={{ width: steps.length ? `${(done / steps.length) * 100}%` : '0%' }}
              />
            </div>
            <Link
              to={project ? `/projects/${project.id}` : '/projects'}
              className="inline-flex items-center gap-1.5 text-[12px] text-primary transition-opacity hover:opacity-70"
            >
              {project ? 'プロジェクトをひらく' : 'プロジェクトをつくる'}
              <ArrowRight className="h-3 w-3" strokeWidth={1.8} />
            </Link>
          </div>
        </motion.section>
      </div>

      <motion.section variants={fade} className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-[14px] text-muted-foreground">育ってきた知識</h2>
          <Link to="/cards" className="text-[11.5px] text-muted-foreground transition-colors hover:text-primary">
            すべて見る
          </Link>
        </div>
        {recentCards.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-border bg-card/40 px-5 py-6 text-center text-[12px] text-muted-foreground">
            ここは、あなたが学んだ概念が静かに積もっていく場所です。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {recentCards.map((card) => (
              <Link
                key={card.id}
                to="/cards"
                className="group rounded-[20px] border border-border/60 bg-card/70 p-4 transition-all duration-500 hover:-translate-y-0.5 hover:border-border hover:bg-card"
              >
                <Layers className="h-4 w-4 text-primary/60" strokeWidth={1.6} />
                <p className="mt-6 text-[13.5px] leading-relaxed">{card.title}</p>
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {(card.key_concepts || []).slice(0, 2).join(' / ') || card.domain}
                </p>
              </Link>
            ))}
          </div>
        )}
      </motion.section>

      <motion.div variants={fade} className="grid gap-3 sm:grid-cols-3">
        {[
          { label: '知識カード', value: counts.cards },
          { label: '対話', value: counts.conversations },
          { label: 'プロジェクト', value: counts.projects },
        ].map((item) => (
          <div key={item.label} className="rounded-[18px] bg-secondary/40 px-5 py-3.5">
            <p className="text-[10.5px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-[18px] text-foreground">{item.value}</p>
          </div>
        ))}
      </motion.div>

      <motion.p variants={fade} className="rounded-[20px] bg-secondary/50 px-5 py-4 text-[12px] leading-relaxed text-muted-foreground">
        つまずいたときは、できなかったことをそのまま書くだけで大丈夫。ここは評価される場所ではありません。
      </motion.p>
    </motion.div>
  );
}