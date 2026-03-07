import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { analyzeRepo } from '../analyze/index.js';
import { loadConfig } from '../config/load.js';
import { verifyRepo } from '../verify/index.js';
import { getDefaultPlaybookIgnoreSuggestions } from '../indexer/playbookIgnore.js';

type RepoIndexPayload = {
  framework?: string;
  language?: string;
  architecture?: {
    features?: string[];
  };
};

export type GovernanceStatusItem = {
  id: 'playbook-config' | 'architecture-docs' | 'checklist-verify-step' | 'repo-index';
  ok: boolean;
  message: string;
};

type ArtifactClass = 'runtime' | 'automation' | 'contract' | 'unknown';

export type ArtifactClassificationModel = {
  runtime: string[];
  automation: string[];
  contract: string[];
};

export type ArtifactHygieneFindingType = 'runtime-artifact-committed' | 'large-generated-json' | 'frequently-modified-generated-artifact' | 'missing-playbookignore';

export type ArtifactHygieneFinding = {
  type: ArtifactHygieneFindingType;
  path?: string;
  message: string;
  recommendation: string;
};

export type ArtifactHygieneSuggestion = {
  id: 'PB012' | 'PB013' | 'PB014';
  title: string;
  entries?: string[];
};

export type ArtifactHygieneReport = {
  classification: ArtifactClassificationModel;
  findings: ArtifactHygieneFinding[];
  suggestions: ArtifactHygieneSuggestion[];
};

export type RepositoryHealth = {
  framework: string;
  language: string;
  architecture: string;
  governanceStatus: GovernanceStatusItem[];
  verifySummary: {
    ok: boolean;
    failures: number;
    warnings: number;
  };
  suggestedActions: string[];
  issues: string[];
  artifactHygiene: ArtifactHygieneReport;
};

const ARTIFACT_CLASSIFICATION: ArtifactClassificationModel = {
  runtime: ['.playbook/repo-index.json', '.playbook/plan.json', '.playbook/verify.json', '.playbook/session-cleanup*.json', '.playbook/cache/**'],
  automation: ['.playbook/ci-plan*.json', '.playbook/ci-verify*.json', '.github/artifacts/**'],
  contract: ['tests/contracts/*.snapshot.json', '.playbook/demo-artifacts/**', 'docs/*diagram*.md']
};

const LARGE_JSON_THRESHOLD_BYTES = 500_000;
const LARGE_REPO_FILE_THRESHOLD = 200;
const FREQUENT_ARTIFACT_MODIFICATION_THRESHOLD = 5;

const parseRepoIndex = (repoRoot: string): { payload: RepoIndexPayload | null; exists: boolean; outdated: boolean } => {
  const indexPath = path.join(repoRoot, '.playbook', 'repo-index.json');
  if (!fs.existsSync(indexPath)) {
    return { payload: null, exists: false, outdated: true };
  }

  let payload: RepoIndexPayload | null = null;
  try {
    payload = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as RepoIndexPayload;
  } catch {
    return { payload: null, exists: true, outdated: true };
  }

  const indexMtime = fs.statSync(indexPath).mtimeMs;
  const freshnessChecks = [
    path.join(repoRoot, 'package.json'),
    path.join(repoRoot, 'playbook.config.json'),
    path.join(repoRoot, 'docs', 'ARCHITECTURE.md'),
    path.join(repoRoot, 'docs', 'PLAYBOOK_CHECKLIST.md')
  ];

  const outdated = freshnessChecks
    .filter((candidate) => fs.existsSync(candidate))
    .some((candidate) => fs.statSync(candidate).mtimeMs > indexMtime);

  return { payload, exists: true, outdated };
};

const runGitLines = (repoRoot: string, args: string[]): string[] => {
  try {
    const output = execSync(`git ${args.join(' ')}`, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  } catch {
    return [];
  }
};

const classifyArtifact = (relativePath: string): ArtifactClass => {
  const normalized = relativePath.split(path.sep).join('/');
  if (normalized.startsWith('.playbook/') && !normalized.startsWith('.playbook/demo-artifacts/')) {
    if (normalized.startsWith('.playbook/ci-')) {
      return 'automation';
    }
    return 'runtime';
  }

  if (normalized.startsWith('.playbook/demo-artifacts/') || /tests\/contracts\/.*\.snapshot\.json$/.test(normalized) || /docs\/.*diagram.*\.md$/i.test(normalized)) {
    return 'contract';
  }

  if (normalized.startsWith('.github/artifacts/')) {
    return 'automation';
  }

  return 'unknown';
};

const isGeneratedArtifact = (relativePath: string): boolean => {
  const normalized = relativePath.split(path.sep).join('/');
  return normalized.startsWith('.playbook/') || normalized.startsWith('dist/') || normalized.startsWith('build/') || normalized.startsWith('coverage/') || normalized.includes('/dist/');
};

const collectArtifactHygiene = (repoRoot: string): ArtifactHygieneReport => {
  const trackedFiles = runGitLines(repoRoot, ['ls-files']);
  const findings: ArtifactHygieneFinding[] = [];

  for (const file of trackedFiles) {
    if (classifyArtifact(file) === 'runtime') {
      findings.push({
        type: 'runtime-artifact-committed',
        path: file,
        message: `Runtime artifact committed: ${file}`,
        recommendation: 'Add runtime artifacts to .gitignore and keep runtime output under .playbook/.'
      });
    }

    if (file.endsWith('.json') && isGeneratedArtifact(file)) {
      const absolutePath = path.join(repoRoot, file);
      if (fs.existsSync(absolutePath)) {
        const fileSize = fs.statSync(absolutePath).size;
        if (fileSize > LARGE_JSON_THRESHOLD_BYTES) {
          findings.push({
            type: 'large-generated-json',
            path: file,
            message: `Large generated JSON artifact detected (${Math.round(fileSize / 1024)} KB): ${file}`,
            recommendation: 'Avoid committing large generated JSON outputs; store runtime artifacts in .playbook/ and regenerate in CI when needed.'
          });
        }
      }
    }
  }

  const generatedCommitLines = runGitLines(repoRoot, ['log', '--name-only', '--pretty=format:', '--', '.playbook', 'dist', 'build', 'coverage']);
  const changeFrequency = generatedCommitLines.reduce<Map<string, number>>((acc, file) => {
    if (file.length === 0 || !isGeneratedArtifact(file)) {
      return acc;
    }
    acc.set(file, (acc.get(file) ?? 0) + 1);
    return acc;
  }, new Map());

  for (const [file, count] of [...changeFrequency.entries()].sort((a, b) => b[1] - a[1])) {
    if (count >= FREQUENT_ARTIFACT_MODIFICATION_THRESHOLD) {
      findings.push({
        type: 'frequently-modified-generated-artifact',
        path: file,
        message: `Generated artifact modified frequently (${count} commits): ${file}`,
        recommendation: 'Move frequently changing generated artifacts to runtime storage and avoid committing them.'
      });
    }
  }

  if (trackedFiles.length >= LARGE_REPO_FILE_THRESHOLD && !fs.existsSync(path.join(repoRoot, '.playbookignore'))) {
    findings.push({
      type: 'missing-playbookignore',
      message: 'Missing .playbookignore in a large repository.',
      recommendation: 'Create .playbookignore to exclude heavy/generated paths from repository intelligence scans.'
    });
  }

  const suggestions: ArtifactHygieneSuggestion[] = [];
  if (findings.some((finding) => finding.type === 'missing-playbookignore')) {
    suggestions.push({ id: 'PB012', title: 'Add .playbookignore', entries: getDefaultPlaybookIgnoreSuggestions() });
  }
  if (findings.some((finding) => finding.type === 'runtime-artifact-committed')) {
    suggestions.push({ id: 'PB013', title: 'Update .gitignore for runtime artifacts', entries: ['.playbook/repo-index.json', '.playbook/plan.json', '.playbook/verify.json'] });
  }
  if (
    findings.some((finding) => finding.type === 'large-generated-json') ||
    findings.some((finding) => finding.type === 'frequently-modified-generated-artifact')
  ) {
    suggestions.push({ id: 'PB014', title: 'Move generated artifacts to .playbook runtime storage' });
  }

  return {
    classification: ARTIFACT_CLASSIFICATION,
    findings,
    suggestions
  };
};

const inferArchitecture = (repoRoot: string, repoIndex: RepoIndexPayload | null): string => {
  const indexedFeatures = repoIndex?.architecture?.features;
  if (Array.isArray(indexedFeatures) && indexedFeatures.length >= 3) {
    return 'Modular Monolith';
  }

  if (fs.existsSync(path.join(repoRoot, 'packages'))) {
    return 'Monorepo';
  }

  if (fs.existsSync(path.join(repoRoot, 'src', 'features'))) {
    return 'Modular Monolith';
  }

  return 'Unknown';
};

const normalizeLanguage = (value: string): string => {
  if (!value) {
    return 'Unknown';
  }

  if (value.toLowerCase() === 'typescript') {
    return 'TypeScript';
  }

  return value[0].toUpperCase() + value.slice(1);
};

const resolveFramework = (repoRoot: string, indexedFramework: string | undefined): string => {
  if (indexedFramework && indexedFramework !== 'unknown' && indexedFramework !== 'node') {
    return indexedFramework;
  }

  const analyzed = analyzeRepo(repoRoot);
  const nextSignal = analyzed.detected.find((item) => item.id === 'nextjs');
  if (nextSignal) {
    return 'Next.js';
  }

  if (indexedFramework && indexedFramework !== 'unknown') {
    return indexedFramework;
  }

  return 'Unknown';
};

const checklistHasVerifyStep = (repoRoot: string, checklistPath: string): boolean => {
  const absolutePath = path.join(repoRoot, checklistPath);
  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  return /(verify|verification)/i.test(content);
};

export const generateRepositoryHealth = (repoRoot: string): RepositoryHealth => {
  const { config, warning } = loadConfig(repoRoot);
  const repoIndex = parseRepoIndex(repoRoot);
  const verify = verifyRepo(repoRoot);
  const artifactHygiene = collectArtifactHygiene(repoRoot);

  const architectureDocsPresent = fs.existsSync(path.join(repoRoot, config.docs.architecturePath));
  const hasChecklistVerifyStep = checklistHasVerifyStep(repoRoot, config.docs.checklistPath);

  const governanceStatus: GovernanceStatusItem[] = [
    {
      id: 'playbook-config',
      ok: !warning,
      message: warning ? 'Playbook config missing; defaults loaded' : 'Playbook config detected'
    },
    {
      id: 'architecture-docs',
      ok: architectureDocsPresent,
      message: architectureDocsPresent ? 'Architecture docs present' : 'Architecture docs missing'
    },
    {
      id: 'checklist-verify-step',
      ok: hasChecklistVerifyStep,
      message: hasChecklistVerifyStep ? 'PLAYBOOK_CHECKLIST includes verify step' : 'PLAYBOOK_CHECKLIST missing verify step'
    },
    {
      id: 'repo-index',
      ok: repoIndex.exists && !repoIndex.outdated,
      message: !repoIndex.exists ? 'Repo index missing' : repoIndex.outdated ? 'Repo index outdated' : 'Repo index up to date'
    }
  ];

  const issues = governanceStatus.filter((entry) => !entry.ok).map((entry) => entry.message);
  for (const finding of artifactHygiene.findings) {
    issues.push(finding.message);
  }

  const suggestedActions = new Set<string>();

  if (verify.failures.length > 0 || verify.warnings.length > 0) {
    suggestedActions.add('playbook plan');
  }

  if (!repoIndex.exists || repoIndex.outdated) {
    suggestedActions.add('playbook analyze');
  }

  if (artifactHygiene.findings.length > 0) {
    suggestedActions.add('playbook doctor --json');
  }

  return {
    framework: resolveFramework(repoRoot, repoIndex.payload?.framework),
    language: normalizeLanguage(repoIndex.payload?.language ?? 'unknown'),
    architecture: inferArchitecture(repoRoot, repoIndex.payload),
    governanceStatus,
    verifySummary: {
      ok: verify.ok,
      failures: verify.failures.length,
      warnings: verify.warnings.length
    },
    suggestedActions: [...suggestedActions],
    issues,
    artifactHygiene
  };
};
