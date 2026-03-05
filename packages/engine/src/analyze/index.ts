import fs from 'node:fs';
import path from 'node:path';
import { loadPlugins } from '../plugins/loadPlugins.js';
import {
  getRegisteredDetectors,
  registerDetector,
  resetPluginRegistry
} from '../plugins/pluginRegistry.js';
import type { StackDetector } from '../plugins/pluginTypes.js';
import { detectNextjs } from './detectors/nextjs.js';
import { detectSupabase } from './detectors/supabase.js';
import { detectTailwind } from './detectors/tailwind.js';

export type AnalyzeResult = {
  detected: string[];
  summary: string;
};

const readPackageDeps = (repoRoot: string): Record<string, string> => {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return { ...pkg.dependencies, ...pkg.devDependencies };
};

const coreDetectors: StackDetector[] = [
  { id: 'nextjs', detect: detectNextjs },
  { id: 'supabase', detect: detectSupabase },
  { id: 'tailwind', detect: detectTailwind }
];

export const analyzeRepo = (repoRoot: string): AnalyzeResult => {
  const deps = readPackageDeps(repoRoot);

  resetPluginRegistry();
  coreDetectors.forEach(registerDetector);
  loadPlugins(repoRoot);

  const detected = getRegisteredDetectors()
    .filter((detector) => detector.detect(repoRoot, deps))
    .map((detector) => detector.id);

  const summary = detected.length
    ? `Detected stack: ${detected.join(', ')}`
    : 'No known stack components detected.';

  const architecture = path.join(repoRoot, 'docs', 'ARCHITECTURE.md');
  if (fs.existsSync(architecture)) {
    const marker = '<!-- PLAYBOOK:ANALYZE_SUGGESTIONS -->';
    const content = fs.readFileSync(architecture, 'utf8');
    if (content.includes(marker)) {
      const block = `\n### Detected Stack\n\n- ${detected.length ? detected.join('\n- ') : 'none detected'}\n`;
      const replaced = content.replace(marker, `${marker}${block}`);
      if (replaced !== content) fs.writeFileSync(architecture, replaced);
    }
  }

  return { detected, summary };
};
