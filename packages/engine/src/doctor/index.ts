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
  memoryDiagnostics: MemoryDiagnosticsReport;
};

export type MemoryDiagnosticSeverity = 'info' | 'warning';

export type MemoryDiagnosticCode =
  | 'memory-artifacts-absent'
  | 'memory-artifacts-missing'
  | 'memory-artifacts-malformed'
  | 'candidate-hoarding-risk'
  | 'superseded-knowledge-lingering'
  | 'replay-output-inconsistent'
  | 'promoted-knowledge-provenance-gap'
  | 'memory-lifecycle-healthy';

export type MemoryDiagnosticFinding = {
  code: MemoryDiagnosticCode;
  severity: MemoryDiagnosticSeverity;
  message: string;
  recommendation: string;
};

export type MemoryDiagnosticSuggestion = {
  id: 'PB015' | 'PB016' | 'PB017' | 'PB018';
  title: string;
  actions: string[];
};

export type MemoryDiagnosticsReport = {
  findings: MemoryDiagnosticFinding[];
  suggestions: MemoryDiagnosticSuggestion[];
};

const ARTIFACT_CLASSIFICATION: ArtifactClassificationModel = {
  runtime: ['.playbook/repo-index.json', '.playbook/plan.json', '.playbook/verify.json', '.playbook/session-cleanup*.json', '.playbook/cache/**'],
  automation: ['.playbook/ci-plan*.json', '.playbook/ci-verify*.json', '.github/artifacts/**'],
  contract: ['tests/contracts/*.snapshot.json', '.playbook/demo-artifacts/**', 'docs/*diagram*.md']
};

const LARGE_JSON_THRESHOLD_BYTES = 500_000;
const LARGE_REPO_FILE_THRESHOLD = 200;
const FREQUENT_ARTIFACT_MODIFICATION_THRESHOLD = 5;
const MEMORY_STALE_DAYS = 30;
const MEMORY_CANDIDATE_HOARDING_THRESHOLD = 25;
const MEMORY_STALE_CANDIDATE_THRESHOLD = 10;

type MemoryReplayIndexPayload = {
  events?: Array<{ eventId?: string; relativePath?: string }>;
};

type MemoryCandidatePayload = {
  candidateId?: string;
  lastSeenAt?: string;
  provenance?: Array<{ eventId?: string; sourcePath?: string; fingerprint?: string }>;
};

type MemoryCandidatesArtifact = {
  candidates?: MemoryCandidatePayload[];
};

type MemoryKnowledgeEntryPayload = {
  status?: string;
  supersededBy?: string[];
  provenance?: Array<{ eventId?: string; sourcePath?: string; fingerprint?: string }>;
};

type MemoryKnowledgeArtifactPayload = {
  entries?: MemoryKnowledgeEntryPayload[];
};

const readJsonSafe = <T>(filePath: string): { payload: T | null; malformed: boolean } => {
  if (!fs.existsSync(filePath)) {
    return { payload: null, malformed: false };
  }

  try {
    return {
      payload: JSON.parse(fs.readFileSync(filePath, 'utf8')) as T,
      malformed: false
    };
  } catch {
    return { payload: null, malformed: true };
  }
};

const collectMemoryDiagnostics = (repoRoot: string): MemoryDiagnosticsReport => {
  const findings: MemoryDiagnosticFinding[] = [];
  const suggestions = new Set<MemoryDiagnosticSuggestion['id']>();
  const memoryRoot = path.join(repoRoot, '.playbook', 'memory');

  if (!fs.existsSync(memoryRoot)) {
    findings.push({
      code: 'memory-artifacts-absent',
      severity: 'info',
      message: 'Memory artifacts are not initialized under .playbook/memory.',
      recommendation: 'Run memory workflows before enabling memory control-plane automation.'
    });

    return {
      findings,
      suggestions: []
    };
  }

  const indexPath = path.join(memoryRoot, 'index.json');
  const candidatesPath = path.join(memoryRoot, 'candidates.json');
  const knowledgePaths = [
    path.join(memoryRoot, 'knowledge', 'decisions.json'),
    path.join(memoryRoot, 'knowledge', 'patterns.json'),
    path.join(memoryRoot, 'knowledge', 'failure-modes.json'),
    path.join(memoryRoot, 'knowledge', 'invariants.json')
  ];

  const missingPaths = [indexPath, candidatesPath].filter((artifactPath) => !fs.existsSync(artifactPath));
  if (missingPaths.length > 0) {
    findings.push({
      code: 'memory-artifacts-missing',
      severity: 'warning',
      message: `Missing required memory artifacts: ${missingPaths.map((entry) => path.relative(repoRoot, entry)).join(', ')}`,
      recommendation: 'Regenerate missing memory artifacts before relying on replay or promotion diagnostics.'
    });
    suggestions.add('PB015');
  }

  const index = readJsonSafe<MemoryReplayIndexPayload>(indexPath);
  const candidates = readJsonSafe<MemoryCandidatesArtifact>(candidatesPath);
  const malformedArtifacts: string[] = [];
  if (index.malformed) {
    malformedArtifacts.push(path.relative(repoRoot, indexPath));
  }
  if (candidates.malformed) {
    malformedArtifacts.push(path.relative(repoRoot, candidatesPath));
  }

  const parsedKnowledge = knowledgePaths.map((knowledgePath) => ({
    path: knowledgePath,
    parsed: readJsonSafe<MemoryKnowledgeArtifactPayload>(knowledgePath)
  }));

  for (const artifact of parsedKnowledge) {
    if (artifact.parsed.malformed) {
      malformedArtifacts.push(path.relative(repoRoot, artifact.path));
    }
  }

  if (malformedArtifacts.length > 0) {
    findings.push({
      code: 'memory-artifacts-malformed',
      severity: 'warning',
      message: `Malformed memory artifacts detected: ${[...new Set(malformedArtifacts)].sort((a, b) => a.localeCompare(b)).join(', ')}`,
      recommendation: 'Repair malformed JSON memory artifacts to restore deterministic replay and lifecycle diagnostics.'
    });
    suggestions.add('PB015');
  }

  const candidateEntries = Array.isArray(candidates.payload?.candidates) ? candidates.payload?.candidates ?? [] : [];
  const staleCutoff = Date.now() - MEMORY_STALE_DAYS * 24 * 60 * 60 * 1000;
  const staleCandidates = candidateEntries.filter((candidate) => {
    if (typeof candidate.lastSeenAt !== 'string') {
      return false;
    }
    const parsed = Date.parse(candidate.lastSeenAt);
    return !Number.isNaN(parsed) && parsed < staleCutoff;
  });

  if (candidateEntries.length >= MEMORY_CANDIDATE_HOARDING_THRESHOLD || staleCandidates.length >= MEMORY_STALE_CANDIDATE_THRESHOLD) {
    findings.push({
      code: 'candidate-hoarding-risk',
      severity: 'warning',
      message: `Candidate accumulation risk detected (${candidateEntries.length} candidates, ${staleCandidates.length} stale).`,
      recommendation: 'Prune stale candidates and promote only high-signal replay outcomes to avoid memory hoarding.'
    });
    suggestions.add('PB016');
  }

  const knowledgeEntries = parsedKnowledge.flatMap((entry) => (Array.isArray(entry.parsed.payload?.entries) ? entry.parsed.payload?.entries ?? [] : []));
  const lingeringSuperseded = knowledgeEntries.filter((entry) => entry.status === 'superseded' && (entry.supersededBy?.length ?? 0) === 0).length;
  if (lingeringSuperseded > 0) {
    findings.push({
      code: 'superseded-knowledge-lingering',
      severity: 'warning',
      message: `Superseded promoted knowledge is lingering without retirement linkage (${lingeringSuperseded} entries).`,
      recommendation: 'Retire or relink superseded knowledge entries so lifecycle state remains explicit.'
    });
    suggestions.add('PB017');
  }

  const replayEventRefs = new Map<string, string>();
  for (const eventRef of Array.isArray(index.payload?.events) ? index.payload?.events ?? [] : []) {
    if (typeof eventRef.eventId === 'string' && typeof eventRef.relativePath === 'string') {
      replayEventRefs.set(eventRef.eventId, eventRef.relativePath);
    }
  }

  const missingReplayEvents = Array.from(replayEventRefs.values()).filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
  let candidateReplayMismatches = 0;
  for (const candidate of candidateEntries) {
    for (const provenance of Array.isArray(candidate.provenance) ? candidate.provenance : []) {
      if (typeof provenance.eventId !== 'string' || typeof provenance.sourcePath !== 'string') {
        candidateReplayMismatches += 1;
        continue;
      }

      const indexedRelativePath = replayEventRefs.get(provenance.eventId);
      if (!indexedRelativePath || indexedRelativePath !== provenance.sourcePath) {
        candidateReplayMismatches += 1;
      }
    }
  }

  if (missingReplayEvents.length > 0 || candidateReplayMismatches > 0) {
    findings.push({
      code: 'replay-output-inconsistent',
      severity: 'warning',
      message: `Replay output inconsistencies detected (${missingReplayEvents.length} missing indexed events, ${candidateReplayMismatches} provenance mismatches).`,
      recommendation: 'Regenerate replay outputs from a valid memory index and event set before promotion.'
    });
    suggestions.add('PB018');
  }

  const provenanceGaps = knowledgeEntries.filter((entry) =>
    !Array.isArray(entry.provenance) ||
    entry.provenance.length === 0 ||
    entry.provenance.some(
      (provenance) =>
        typeof provenance.eventId !== 'string' ||
        typeof provenance.sourcePath !== 'string' ||
        typeof provenance.fingerprint !== 'string'
    )
  ).length;

  if (provenanceGaps > 0) {
    findings.push({
      code: 'promoted-knowledge-provenance-gap',
      severity: 'warning',
      message: `Promoted knowledge provenance gaps detected (${provenanceGaps} entries).`,
      recommendation: 'Ensure promoted knowledge retains complete candidate/event provenance before downstream automation consumes it.'
    });
    suggestions.add('PB017');
  }

  if (findings.length === 0) {
    findings.push({
      code: 'memory-lifecycle-healthy',
      severity: 'info',
      message: 'Memory replay and promoted-knowledge lifecycle diagnostics are healthy.',
      recommendation: 'Continue replay-before-promotion and salience-gated promotion workflows.'
    });
  }

  const suggestionList: Record<MemoryDiagnosticSuggestion['id'], MemoryDiagnosticSuggestion> = {
    PB015: {
      id: 'PB015',
      title: 'Repair memory artifact integrity',
      actions: ['Rebuild .playbook/memory/index.json', 'Regenerate .playbook/memory/candidates.json', 'Validate JSON artifacts before commit']
    },
    PB016: {
      id: 'PB016',
      title: 'Reduce memory candidate hoarding',
      actions: ['Prune stale candidates', 'Promote only high-salience candidates', 'Schedule periodic memory-prune checks']
    },
    PB017: {
      id: 'PB017',
      title: 'Retire or relink superseded promoted knowledge',
      actions: ['Retire superseded records explicitly', 'Preserve provenance on promoted entries', 'Keep supersession lineage bidirectional']
    },
    PB018: {
      id: 'PB018',
      title: 'Regenerate replay outputs for deterministic consistency',
      actions: ['Refresh memory index events', 'Re-run memory replay', 'Revalidate candidate provenance against index events']
    }
  };

  return {
    findings,
    suggestions: [...suggestions].sort((a, b) => a.localeCompare(b)).map((id) => suggestionList[id])
  };
};

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
  const memoryDiagnostics = collectMemoryDiagnostics(repoRoot);

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
  for (const finding of memoryDiagnostics.findings) {
    if (finding.severity === 'warning') {
      issues.push(finding.message);
    }
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

  if (memoryDiagnostics.findings.some((finding) => finding.severity === 'warning')) {
    suggestedActions.add('playbook memory replay --json');
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
    artifactHygiene,
    memoryDiagnostics
  };
};
