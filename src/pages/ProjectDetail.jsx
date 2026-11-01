import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Github, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import ProjectOverview from '@/components/project/ProjectOverview';
import ProjectCode from '@/components/project/ProjectCode';
import ProjectCoach from '@/components/project/ProjectCoach';
import ProjectCardLinks from '@/components/project/ProjectCardLinks';
import { STAGE_LABELS, STAGE_STYLES } from '@/components/project/stages';
import { cn } from '@/lib/utils';

export default function ProjectDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    base44.entities.Project.get(id)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [id]);

  const exportToGithub = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportProjectToGitHub', { projectId: id });
      setProject((prev) => ({ ...prev, github_url: res.data.repoUrl }));
      toast({ title: 'GitHubに書き出しました', description: res.data.repoUrl });
      window.open(res.data.repoUrl, '_blank', 'noopener');
    } catch (error) {
      toast({
        title: '書き出せませんでした',
        description: error?.response?.data?.error || 'GitHubの連携を確認してください。',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[14px]">このプロジェクトは見つかりませんでした</p>
        <Link to="/projects" className="text-[12.5px] text-primary">
          プロジェクト一覧へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" strokeWidth={1.8} />
        プロジェクト一覧
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px]', STAGE_STYLES[project.stage])}>
            {STAGE_LABELS[project.stage] || STAGE_LABELS.family}
          </span>
          <h1 className="text-[22px] leading-relaxed">{project.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {project.github_url && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              GitHubで見る
            </a>
          )}
          <Button
            variant="outline"
            onClick={exportToGithub}
            disabled={exporting}
            className="h-9 gap-1.5 rounded-full border-border bg-card text-[12px]"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} /> : <Github className="h-3.5 w-3.5" strokeWidth={1.8} />}
            GitHubに書き出す
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-9 rounded-full bg-secondary/70 p-1">
          <TabsTrigger value="overview" className="rounded-full px-4 text-[12px]">
            概要
          </TabsTrigger>
          <TabsTrigger value="code" className="rounded-full px-4 text-[12px]">
            コード
          </TabsTrigger>
          <TabsTrigger value="coach" className="rounded-full px-4 text-[12px]">
            コーチ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-7">
          <ProjectOverview project={project} onUpdated={setProject} />
          <ProjectCardLinks project={project} onUpdated={setProject} />
        </TabsContent>

        <TabsContent value="code">
          <ProjectCode project={project} onUpdated={setProject} />
        </TabsContent>

        <TabsContent value="coach">
          <ProjectCoach project={project} onReviewed={(review) => setProject((prev) => ({ ...prev, last_review: review }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}