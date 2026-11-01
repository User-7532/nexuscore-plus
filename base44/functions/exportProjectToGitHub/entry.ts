import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

function toBase64(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function slugify(title) {
  const ascii = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return ascii || 'attractor-project';
}

function buildReadme(project) {
  const lines = [`# ${project.title}`, ''];
  if (project.one_liner) lines.push(project.one_liner, '');
  if (project.motivation) lines.push('## なぜ作るのか', project.motivation, '');
  if (project.next_step) lines.push('## 次の一歩', project.next_step, '');
  const steps = project.steps || [];
  if (steps.length) {
    lines.push('## ステップ');
    steps.forEach((s) => lines.push(`- [${s.done ? 'x' : ' '}] ${s.label}`));
    lines.push('');
  }
  lines.push('_Attractor から書き出しました。_');
  return lines.join('\n');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (!body.projectId) {
      return Response.json({ error: 'projectId が必要です' }, { status: 400 });
    }

    const project = await base44.entities.Project.get(body.projectId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!project) {
      return Response.json({ error: 'プロジェクトが見つかりません' }, { status: 404 });
    }

    const connection = await base44.asServiceRole.connectors
      .getConnection('github')
      .catch(() => null);
    if (!connection || !connection.accessToken) {
      return Response.json(
        { error: 'GitHubとまだつながっていません。ダッシュボードの Integrations からGitHubを連携してください。' },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${connection.accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Attractor',
      'Content-Type': 'application/json',
    };

    const meRes = await fetch('https://api.github.com/user', {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!meRes.ok) {
      return Response.json(
        { error: 'GitHubとの連携が切れているようです。Integrations から連携し直してください。' },
        { status: 502 }
      );
    }
    const me = await meRes.json();
    const owner = me.login;
    const repoName = slugify(project.title);

    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repoName,
        description: String(project.one_liner || project.title || '').slice(0, 300),
        private: true,
        auto_init: true,
      }),
      signal: AbortSignal.timeout(20000),
    });

    let branch = 'main';
    if (!createRes.ok && createRes.status !== 422) {
      const detail = await createRes.json().catch(() => ({}));
      return Response.json(
        { error: `リポジトリを作成できませんでした: ${detail.message || createRes.status}` },
        { status: 502 }
      );
    }
    if (createRes.ok) {
      const repo = await createRes.json();
      branch = repo.default_branch || 'main';
    }

    const files = (project.files || []).filter((f) => String(f.path || '').trim());
    const payloads = [
      { path: 'README.md', content: buildReadme(project) },
      ...files.slice(0, 10).map((f) => ({ path: String(f.path).replace(/^\/+/, ''), content: f.content || '' })),
    ];

    for (const file of payloads) {
      const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURI(file.path)}`;
      const existing = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      const meta = existing.ok ? await existing.json() : null;
      const putRes = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Attractor: ${file.path}`,
          content: toBase64(file.content),
          branch,
          ...(meta && meta.sha ? { sha: meta.sha } : {}),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!putRes.ok) {
        const detail = await putRes.json().catch(() => ({}));
        return Response.json(
          { error: `${file.path} を書き出せませんでした: ${detail.message || putRes.status}` },
          { status: 502 }
        );
      }
    }

    const repoUrl = `https://github.com/${owner}/${repoName}`;
    await base44.entities.Project.update(project.id, { github_url: repoUrl });

    return Response.json({ repoUrl, fileCount: payloads.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}