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
  modules: string[];
  docs: string[];
  rules: string[];
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

export const buildRepoIndex = (repoRoot: string): RepoIndex => {
  const dirs = scanDirectories(repoRoot);
  const modules = dirs
    .filter((dir) => dir === 'src/features' || dir.startsWith('src/features/') || dir.endsWith('/src/features') || dir.includes('/src/features/'))
    .filter((dir) => dir !== 'src/features')
    .sort();

  const docs = fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const rules = [...new Set([...verifyRules.map((rule) => rule.id), ...analyzeRules.map((rule) => rule.id)])].sort();

  return {
    framework: detectFramework(repoRoot),
    modules,
    docs,
    rules
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
