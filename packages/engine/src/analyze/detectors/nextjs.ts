import fs from 'node:fs';
import path from 'node:path';
import type { RepoContext, StackDetector } from '../../plugins/pluginTypes.js';

const detectNextjs = (repo: RepoContext): { confidence: number; evidence: string[] } | null => {
  const { repoRoot, dependencies, devDependencies } = repo;
  const pkg = { ...dependencies, ...devDependencies };
  const evidence: string[] = [];
  const nextConfigs = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
  for (const file of nextConfigs) {
    if (fs.existsSync(path.join(repoRoot, file))) evidence.push(`config:${file}`);
  }
  if (fs.existsSync(path.join(repoRoot, 'app'))) evidence.push('directory:app/');
  if (fs.existsSync(path.join(repoRoot, 'pages'))) evidence.push('directory:pages/');
  if (pkg.next) evidence.push('dependency:next');

  if (!evidence.length) return null;
  const confidence = evidence.includes('dependency:next') ? 1 : 0.85;
  return { confidence, evidence };
};

export const nextjsDetector: StackDetector = {
  id: 'nextjs',
  label: 'Next.js',
  detect: detectNextjs
};
