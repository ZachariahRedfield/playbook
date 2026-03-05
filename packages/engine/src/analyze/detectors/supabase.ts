import fs from 'node:fs';
import path from 'node:path';
import type { RepoContext, StackDetector } from '../../plugins/pluginTypes.js';

const detectSupabase = (repo: RepoContext): { confidence: number; evidence: string[] } | null => {
  const { repoRoot, dependencies, devDependencies } = repo;
  const pkg = { ...dependencies, ...devDependencies };
  const evidence: string[] = [];

  if (fs.existsSync(path.join(repoRoot, 'supabase', 'config.toml'))) {
    evidence.push('file:supabase/config.toml');
  }
  if (fs.existsSync(path.join(repoRoot, 'supabase', 'migrations'))) {
    evidence.push('directory:supabase/migrations');
  }
  if (pkg['@supabase/supabase-js']) evidence.push('dependency:@supabase/supabase-js');

  if (!evidence.length) return null;
  const confidence = evidence.includes('dependency:@supabase/supabase-js') ? 1 : 0.85;
  return { confidence, evidence };
};

export const supabaseDetector: StackDetector = {
  id: 'supabase',
  label: 'Supabase',
  detect: detectSupabase
};
