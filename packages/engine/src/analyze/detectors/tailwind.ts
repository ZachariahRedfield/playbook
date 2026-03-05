import fs from 'node:fs';
import path from 'node:path';
import type { RepoContext, StackDetector } from '../../plugins/pluginTypes.js';

const detectTailwind = (repo: RepoContext): { confidence: number; evidence: string[] } | null => {
  const { repoRoot, dependencies, devDependencies } = repo;
  const pkg = { ...dependencies, ...devDependencies };
  const evidence: string[] = [];
  const files = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.ts'];
  for (const file of files) {
    if (fs.existsSync(path.join(repoRoot, file))) evidence.push(`config:${file}`);
  }

  const postCssConfigFiles = [
    'postcss.config.js',
    'postcss.config.cjs',
    'postcss.config.mjs',
    'postcss.config.ts'
  ];
  for (const file of postCssConfigFiles) {
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('tailwindcss')) evidence.push(`config:${file}:tailwindcss`);
  }

  if (pkg.tailwindcss) evidence.push('dependency:tailwindcss');

  if (!evidence.length) return null;
  const confidence = evidence.includes('dependency:tailwindcss') ? 1 : 0.85;
  return { confidence, evidence };
};

export const tailwindDetector: StackDetector = {
  id: 'tailwind',
  label: 'Tailwind',
  detect: detectTailwind
};
