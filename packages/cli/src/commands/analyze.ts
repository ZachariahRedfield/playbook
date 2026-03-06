import { analyze, formatAnalyzeCi, formatAnalyzeHuman } from '@zachariahredfield/playbook-core';
import { createNodeContext } from '@zachariahredfield/playbook-node';
import fs from 'node:fs';
import path from 'node:path';
import { emitResult, ExitCode } from '../lib/cliContract.js';
import { loadAnalyzeRules } from '../lib/loadAnalyzeRules.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';

export type AnalyzeReport = Awaited<ReturnType<typeof analyze>>;
type AnalyzeRecommendation = AnalyzeReport['recommendations'][number];

type AnalyzeOptions = {
  ci: boolean;
  explain: boolean;
  format: 'text' | 'json';
  quiet: boolean;
};

type RepoIndex = {
  framework: string;
  language: string;
  modules: string[];
  shared_modules: string[];
  docs: string[];
  rules: string[];
  architecture: {
    features: string[];
    shared: string[];
  };
};

const analyzeRules = loadAnalyzeRules();
const verifyRules = loadVerifyRules();

const scanDirectories = (root: string, current = ''): string[] => {
  const full = path.join(root, current);
  if (!fs.existsSync(full)) {
    return [];
  }

  const entries = fs.readdirSync(full, { withFileTypes: true });
  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (['.git', '.playbook', 'node_modules', 'dist', 'coverage'].includes(entry.name)) {
      continue;
    }

    const relative = current ? path.posix.join(current, entry.name) : entry.name;
    dirs.push(relative);
    dirs.push(...scanDirectories(root, relative));
  }

  return dirs;
};

const detectFramework = (repoRoot: string): string => {
  if (fs.existsSync(path.join(repoRoot, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(repoRoot, 'pyproject.toml')) || fs.existsSync(path.join(repoRoot, 'requirements.txt'))) return 'python';
  if (fs.existsSync(path.join(repoRoot, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(repoRoot, 'go.mod'))) return 'go';
  if (fs.existsSync(path.join(repoRoot, 'Gemfile'))) return 'ruby';
  return 'unknown';
};

const repoHasFileExtension = (root: string, extensions: Set<string>, current = ''): boolean => {
  const full = path.join(root, current);
  if (!fs.existsSync(full)) {
    return false;
  }

  const entries = fs.readdirSync(full, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', 'build', 'target', '.git', '.playbook'].includes(entry.name)) {
        continue;
      }
      const relative = current ? path.posix.join(current, entry.name) : entry.name;
      if (repoHasFileExtension(root, extensions, relative)) {
        return true;
      }
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extensions.has(extension)) {
      return true;
    }
  }

  return false;
};

const detectLanguage = (repoRoot: string, framework: string): string => {
  if (framework === 'python') return 'python';
  if (framework === 'rust') return 'rust';
  if (framework === 'go') return 'go';
  if (framework === 'ruby') return 'ruby';

  if (framework === 'node') {
    if (fs.existsSync(path.join(repoRoot, 'tsconfig.json')) || repoHasFileExtension(repoRoot, new Set(['.ts', '.tsx']))) {
      return 'typescript';
    }
    return 'javascript';
  }

  if (repoHasFileExtension(repoRoot, new Set(['.ts', '.tsx']))) return 'typescript';
  if (repoHasFileExtension(repoRoot, new Set(['.js', '.jsx', '.mjs', '.cjs']))) return 'javascript';
  if (repoHasFileExtension(repoRoot, new Set(['.py']))) return 'python';
  if (repoHasFileExtension(repoRoot, new Set(['.rs']))) return 'rust';
  if (repoHasFileExtension(repoRoot, new Set(['.go']))) return 'go';

  return 'unknown';
};

export const buildRepoIndex = (repoRoot: string): RepoIndex => {
  const dirs = scanDirectories(repoRoot);
  const framework = detectFramework(repoRoot);
  const language = detectLanguage(repoRoot, framework);

  const modules = dirs
    .filter((dir) => dir === 'src/features' || dir.startsWith('src/features/') || dir.endsWith('/src/features') || dir.includes('/src/features/'))
    .filter((dir) => dir !== 'src/features')
    .sort();

  const sharedModules = dirs
    .filter((dir) => dir === 'src/shared' || dir.startsWith('src/shared/') || dir.endsWith('/src/shared') || dir.includes('/src/shared/'))
    .sort();

  const architecture = {
    features: [...new Set(modules.map((modulePath) => modulePath.split('/').at(2)).filter((feature): feature is string => Boolean(feature)))].sort(),
    shared: [...new Set(sharedModules.map((modulePath) => path.posix.basename(modulePath)).filter((segment) => segment.length > 0))].sort()
  };

  const docs = fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const rules = [...new Set([...verifyRules.map((rule) => rule.id), ...analyzeRules.map((rule) => rule.id)])].sort();

  return {
    framework,
    language,
    modules,
    shared_modules: sharedModules,
    docs,
    rules,
    architecture
  };
};

const writeRepoIndex = (repoRoot: string): string => {
  const outPath = path.join(repoRoot, '.playbook', 'repo-index.json');
  const payload = buildRepoIndex(repoRoot);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return outPath;
};

const resolveRecommendationGuidance = (recommendation: AnalyzeRecommendation): { explanation?: string; remediation?: string[] } => {
  const rule = analyzeRules.find((candidate) => candidate.check({ recommendation }));
  return {
    explanation: rule?.explanation ?? recommendation.why,
    remediation: rule?.remediation ?? [recommendation.fix]
  };
};

export const collectAnalyzeReport = async (cwd: string): Promise<AnalyzeReport> => analyze(await createNodeContext({ cwd }));

export const runAnalyze = async (cwd: string, opts: AnalyzeOptions): Promise<number> => {
  const ctx = await createNodeContext({ cwd });
  const result = await analyze(ctx);
  const repoIndexPath = writeRepoIndex(ctx.repoRoot);

  if (opts.format === 'text' && !opts.ci) {
    if (!opts.explain) {
      console.log(formatAnalyzeHuman(result));
      console.log(`\nRepository index written: ${path.relative(cwd, repoIndexPath)}`);
      return ExitCode.Success;
    }
  }

  if (opts.format === 'text' && opts.ci && !opts.explain) {
    if (!opts.quiet || !result.ok) {
      console.log(formatAnalyzeCi(result));
      if (!opts.quiet) {
        console.log(`Repository index written: ${path.relative(cwd, repoIndexPath)}`);
      }
    }
    return result.ok ? ExitCode.Success : ExitCode.Failure;
  }

  emitResult({
    format: opts.format,
    quiet: opts.quiet,
    explain: opts.explain,
    command: 'analyze',
    ok: result.ok,
    exitCode: result.ok ? ExitCode.Success : ExitCode.Failure,
    summary: result.ok ? 'Analyze completed successfully.' : 'Analyze completed with findings.',
    findings: result.recommendations.map((rec: AnalyzeRecommendation) => ({
      ...resolveRecommendationGuidance(rec),
      id: `analyze.recommendation.${rec.id}`,
      level: rec.severity === 'WARN' ? 'warning' as const : 'info' as const,
      message: rec.message
    })),
    nextActions: [...result.recommendations.map((rec: AnalyzeRecommendation) => rec.fix), `Review ${path.relative(cwd, repoIndexPath)} for architecture index consumers.`]
  });

  return result.ok ? ExitCode.Success : ExitCode.Failure;
};
