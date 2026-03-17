import fs from 'node:fs';
import path from 'node:path';

export type ReadinessConnectionStatus = 'connected' | 'not_connected';
export type ReadinessLifecycleStage =
  | 'not_connected'
  | 'playbook_not_detected'
  | 'playbook_detected_index_pending'
  | 'indexed_plan_pending'
  | 'planned_apply_pending'
  | 'ready';

export type ReadinessArtifactStatusCode = 'missing_prerequisite_artifact' | 'invalid_artifact' | 'stale_artifact';

export type ReadinessArtifactStatus = {
  present: boolean;
  valid: boolean;
  stale: boolean;
  failure_type: ReadinessArtifactStatusCode | null;
};

export type RepoAdoptionBlocker = {
  code:
    | 'repo_not_connected'
    | 'playbook_not_detected'
    | 'index_required'
    | 'plan_required'
    | 'apply_required'
    | 'fallback_proof_prerequisite_missing';
  message: string;
  next_command: string;
};

export type RepoAdoptionReadiness = {
  schemaVersion: '1.0';
  connection_status: ReadinessConnectionStatus;
  playbook_detected: boolean;
  governed_artifacts_present: {
    repo_index: ReadinessArtifactStatus;
    repo_graph: ReadinessArtifactStatus;
    plan: ReadinessArtifactStatus;
    policy_apply_result: ReadinessArtifactStatus;
  };
  lifecycle_stage: ReadinessLifecycleStage;
  fallback_proof_ready: boolean;
  cross_repo_eligible: boolean;
  blockers: RepoAdoptionBlocker[];
  recommended_next_steps: string[];
};

type BuildReadinessInput = {
  repoRoot: string;
  connected?: boolean;
};

const readJson = (artifactPath: string): unknown => JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as unknown;

const inspectArtifact = (
  repoRoot: string,
  relativePath: string,
  validator: (value: unknown) => boolean
): ReadinessArtifactStatus => {
  const artifactPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(artifactPath)) {
    return { present: false, valid: false, stale: false, failure_type: 'missing_prerequisite_artifact' };
  }

  try {
    const parsed = readJson(artifactPath);
    const valid = validator(parsed);
    return {
      present: true,
      valid,
      stale: false,
      failure_type: valid ? null : 'invalid_artifact'
    };
  } catch {
    return { present: true, valid: false, stale: false, failure_type: 'invalid_artifact' };
  }
};

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export const buildRepoAdoptionReadiness = ({ repoRoot, connected = true }: BuildReadinessInput): RepoAdoptionReadiness => {
  if (!connected) {
    return {
      schemaVersion: '1.0',
      connection_status: 'not_connected',
      playbook_detected: false,
      governed_artifacts_present: {
        repo_index: { present: false, valid: false, stale: false, failure_type: 'missing_prerequisite_artifact' },
        repo_graph: { present: false, valid: false, stale: false, failure_type: 'missing_prerequisite_artifact' },
        plan: { present: false, valid: false, stale: false, failure_type: 'missing_prerequisite_artifact' },
        policy_apply_result: { present: false, valid: false, stale: false, failure_type: 'missing_prerequisite_artifact' }
      },
      lifecycle_stage: 'not_connected',
      fallback_proof_ready: false,
      cross_repo_eligible: false,
      blockers: [
        {
          code: 'repo_not_connected',
          message: 'Repository is not connected to Observer registry.',
          next_command: 'pnpm playbook observer repo add <path>'
        }
      ],
      recommended_next_steps: ['pnpm playbook observer repo add <path>']
    };
  }

  const playbookDetected =
    fs.existsSync(path.join(repoRoot, '.playbook')) ||
    fs.existsSync(path.join(repoRoot, 'playbook.config.json')) ||
    fs.existsSync(path.join(repoRoot, '.playbook', 'config.json'));

  const artifacts = {
    repo_index: inspectArtifact(repoRoot, '.playbook/repo-index.json', (value) => isObject(value) && typeof value.framework === 'string'),
    repo_graph: inspectArtifact(repoRoot, '.playbook/repo-graph.json', (value) => isObject(value) && Array.isArray(value.edges)),
    plan: inspectArtifact(repoRoot, '.playbook/plan.json', (value) => isObject(value) && value.command === 'plan'),
    policy_apply_result: inspectArtifact(repoRoot, '.playbook/policy-apply-result.json', (value) => isObject(value))
  };

  const blockers: RepoAdoptionBlocker[] = [];

  if (!playbookDetected) {
    blockers.push({
      code: 'playbook_not_detected',
      message: 'Playbook configuration/artifacts were not detected in this repository.',
      next_command: 'pnpm playbook init'
    });
  }

  if (!artifacts.repo_index.valid) {
    blockers.push({
      code: 'index_required',
      message: 'Repository index artifact is missing or invalid.',
      next_command: 'pnpm playbook index --json'
    });
  }

  if (!artifacts.plan.valid) {
    blockers.push({
      code: 'plan_required',
      message: 'Plan artifact is missing or invalid.',
      next_command: 'pnpm playbook verify --json && pnpm playbook plan --json'
    });
  }

  if (!artifacts.policy_apply_result.valid) {
    blockers.push({
      code: 'apply_required',
      message: 'Apply output is missing or invalid.',
      next_command: 'pnpm playbook apply --json'
    });
  }

  if (!artifacts.repo_graph.valid || !artifacts.plan.valid) {
    blockers.push({
      code: 'fallback_proof_prerequisite_missing',
      message: 'Fallback proof prerequisites (.playbook/repo-graph.json and .playbook/plan.json) are not ready.',
      next_command: 'pnpm playbook index --json && pnpm playbook verify --json && pnpm playbook plan --json'
    });
  }

  const lifecycleStage: ReadinessLifecycleStage = !playbookDetected
    ? 'playbook_not_detected'
    : !artifacts.repo_index.valid
      ? 'playbook_detected_index_pending'
      : !artifacts.plan.valid
        ? 'indexed_plan_pending'
        : !artifacts.policy_apply_result.valid
          ? 'planned_apply_pending'
          : 'ready';

  const recommendedNextSteps = Array.from(new Set(blockers.map((blocker) => blocker.next_command)));

  return {
    schemaVersion: '1.0',
    connection_status: 'connected',
    playbook_detected: playbookDetected,
    governed_artifacts_present: artifacts,
    lifecycle_stage: lifecycleStage,
    fallback_proof_ready: artifacts.repo_graph.valid && artifacts.plan.valid,
    cross_repo_eligible: artifacts.repo_index.valid,
    blockers,
    recommended_next_steps: recommendedNextSteps
  };
};
