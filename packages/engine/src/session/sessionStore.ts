import fs from 'node:fs';
import path from 'node:path';
import { readExecutionRun } from '../execution/writeExecutionRun.js';

export type SessionPinnedArtifactKind = 'finding' | 'plan' | 'run' | 'pattern' | 'artifact';

export type SessionPinnedArtifact = {
  artifact: string;
  kind: SessionPinnedArtifactKind;
  pinnedAt: string;
};

export type SessionStep = 'verify' | 'plan' | 'apply' | 'resume' | 'idle';

export type SessionContract = {
  version: 1;
  sessionId: string;
  repoRoot: string;
  activeGoal: string;
  selectedRunId: string | null;
  pinnedArtifacts: SessionPinnedArtifact[];
  currentStep: SessionStep;
  unresolvedQuestions: string[];
  constraints: string[];
  lastUpdatedTime: string;
};

export type ResumeSessionResult = {
  session: SessionContract;
  warnings: string[];
  activeRunFound: boolean;
};

export const SESSION_ARTIFACT_RELATIVE_PATH = '.playbook/session.json';

const nowIso = (): string => new Date().toISOString();

const resolveSessionPath = (repoRoot: string): string => path.join(repoRoot, SESSION_ARTIFACT_RELATIVE_PATH);

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const normalizeList = (entries: string[] | undefined): string[] => {
  if (!entries) {
    return [];
  }

  return [...new Set(entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0))].sort((left, right) => left.localeCompare(right));
};

const normalizeArtifactRef = (repoRoot: string, artifact: string): string => {
  const absolute = path.resolve(repoRoot, artifact);
  const relative = path.relative(repoRoot, absolute);
  if (relative.startsWith('..')) {
    throw new Error(`Pinned artifact must resolve inside repo root: ${artifact}`);
  }
  return relative.split(path.sep).join('/');
};

const inferKind = (artifact: string): SessionPinnedArtifactKind => {
  if (artifact.includes('/runs/') || artifact.endsWith('.run.json')) {
    return 'run';
  }
  if (artifact.includes('plan')) {
    return 'plan';
  }
  if (artifact.includes('find')) {
    return 'finding';
  }
  if (artifact.includes('pattern')) {
    return 'pattern';
  }
  return 'artifact';
};

const writeSession = (repoRoot: string, session: SessionContract): SessionContract => {
  const artifactPath = resolveSessionPath(repoRoot);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, deterministicStringify(session), 'utf8');
  return session;
};

const buildSessionId = (repoRoot: string): string => {
  const seed = Buffer.from(path.resolve(repoRoot)).toString('base64url').slice(0, 10);
  return `session-${seed}`;
};

export const readSession = (repoRoot: string): SessionContract | null => {
  const artifactPath = resolveSessionPath(repoRoot);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as SessionContract;
  if (!parsed || parsed.version !== 1) {
    throw new Error(`Invalid session artifact at ${artifactPath}`);
  }

  return parsed;
};

export const initializeSession = (
  repoRoot: string,
  seed?: Partial<Pick<SessionContract, 'activeGoal' | 'selectedRunId' | 'constraints' | 'unresolvedQuestions' | 'currentStep'>>
): SessionContract => {
  const timestamp = nowIso();
  return writeSession(repoRoot, {
    version: 1,
    sessionId: buildSessionId(repoRoot),
    repoRoot: path.resolve(repoRoot),
    activeGoal: seed?.activeGoal?.trim() || 'deterministic workflow continuity',
    selectedRunId: seed?.selectedRunId ?? null,
    pinnedArtifacts: [],
    currentStep: seed?.currentStep ?? 'idle',
    unresolvedQuestions: normalizeList(seed?.unresolvedQuestions),
    constraints: normalizeList(seed?.constraints),
    lastUpdatedTime: timestamp
  });
};

export const updateSession = (
  repoRoot: string,
  patch: Partial<Pick<SessionContract, 'activeGoal' | 'selectedRunId' | 'currentStep' | 'constraints' | 'unresolvedQuestions'>>
): SessionContract => {
  const current = readSession(repoRoot) ?? initializeSession(repoRoot);
  const next: SessionContract = {
    ...current,
    activeGoal: patch.activeGoal?.trim() || current.activeGoal,
    selectedRunId: patch.selectedRunId === undefined ? current.selectedRunId : patch.selectedRunId,
    currentStep: patch.currentStep ?? current.currentStep,
    unresolvedQuestions: patch.unresolvedQuestions ? normalizeList(patch.unresolvedQuestions) : current.unresolvedQuestions,
    constraints: patch.constraints ? normalizeList(patch.constraints) : current.constraints,
    lastUpdatedTime: nowIso()
  };

  return writeSession(repoRoot, next);
};

export const pinSessionArtifact = (
  repoRoot: string,
  artifact: string,
  kind?: SessionPinnedArtifactKind
): SessionContract => {
  const current = readSession(repoRoot) ?? initializeSession(repoRoot);
  const normalized = normalizeArtifactRef(repoRoot, artifact);
  const nextPinned: SessionPinnedArtifact[] = [
    ...current.pinnedArtifacts.filter((entry) => entry.artifact !== normalized),
    {
      artifact: normalized,
      kind: kind ?? inferKind(normalized),
      pinnedAt: nowIso()
    }
  ].sort((left, right) => left.artifact.localeCompare(right.artifact));

  return writeSession(repoRoot, {
    ...current,
    pinnedArtifacts: nextPinned,
    lastUpdatedTime: nowIso()
  });
};

export const clearSession = (repoRoot: string): boolean => {
  const artifactPath = resolveSessionPath(repoRoot);
  if (!fs.existsSync(artifactPath)) {
    return false;
  }
  fs.rmSync(artifactPath, { force: true });
  return true;
};

export const resumeSession = (repoRoot: string): ResumeSessionResult => {
  const session = readSession(repoRoot);
  if (!session) {
    throw new Error('No repo-scoped session found. Run `playbook session show` or `playbook session pin <artifact>` first.');
  }

  const warnings: string[] = [];
  for (const artifact of session.pinnedArtifacts) {
    const absolute = path.resolve(repoRoot, artifact.artifact);
    if (!fs.existsSync(absolute)) {
      warnings.push(`Missing pinned artifact: ${artifact.artifact}`);
    }
  }

  let activeRunFound = false;
  if (session.selectedRunId) {
    try {
      readExecutionRun(repoRoot, session.selectedRunId);
      activeRunFound = true;
    } catch {
      warnings.push(`Selected run not found: ${session.selectedRunId}`);
    }
  }

  const refreshed = updateSession(repoRoot, { currentStep: 'resume' });
  return {
    session: refreshed,
    warnings,
    activeRunFound
  };
};

export const attachSessionRunState = (
  repoRoot: string,
  input: {
    step: SessionStep;
    runId: string;
    goal?: string;
    artifacts?: Array<{ artifact: string; kind?: SessionPinnedArtifactKind }>;
  }
): SessionContract => {
  const session = updateSession(repoRoot, {
    currentStep: input.step,
    selectedRunId: input.runId,
    activeGoal: input.goal
  });

  let next = session;
  for (const artifact of input.artifacts ?? []) {
    next = pinSessionArtifact(repoRoot, artifact.artifact, artifact.kind);
  }

  return next;
};

export const sessionArtifactPath = (repoRoot: string): string => resolveSessionPath(repoRoot);
