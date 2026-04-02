import fs from 'node:fs';
import path from 'node:path';
import type { LaneStateArtifact } from './laneState.js';
import type { WorksetPlanArtifact } from './worksetPlan.js';
import type { WorkerAssignmentsArtifact } from './workerAssignments.js';

type PolicyEvaluationArtifact = {
  summary?: { blocked?: number };
  evaluations?: Array<{ decision?: string; reason?: string }>;
};

type VerifyArtifact = {
  failures?: Array<{ id?: string; message?: string }>;
  findings?: Array<{ level?: string; rule?: string; message?: string }>;
};

export const WORKER_LAUNCH_PLAN_RELATIVE_PATH = '.playbook/worker-launch-plan.json' as const;

export type WorkerLaunchPlanLane = {
  lane_id: string;
  worker_id: string | null;
  worker_type: string | null;
  launchEligible: boolean;
  blockers: string[];
  requiredCapabilities: string[];
  allowedWriteSurfaces: string[];
  protectedSingletonImpact: {
    hasProtectedSingletonWork: boolean;
    targets: string[];
    consolidationStage: string;
    unresolved: boolean;
  };
  requiredReceipts: string[];
  releaseReadyPreconditions: string[];
};

export type WorkerLaunchPlanArtifact = {
  schemaVersion: '1.0';
  kind: 'worker-launch-plan';
  proposalOnly: true;
  generatedAt: string;
  sourceArtifacts: {
    worksetPlanPath: string;
    laneStatePath: string;
    workerAssignmentsPath: string;
    verifyPath: string;
    policyEvaluationPath: string;
  };
  summary: {
    launchEligibleLanes: string[];
    blockedLanes: Array<{ lane_id: string; blockers: string[] }>;
    failClosedReasons: string[];
  };
  lanes: WorkerLaunchPlanLane[];
};

const PROTECTED_SINGLETON_DOCS = new Set([
  'docs/CHANGELOG.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/commands/orchestrate.md',
  'docs/commands/workers.md'
]);

const VERIFY_RELATIVE_PATH = '.playbook/verify-report.json';
const POLICY_EVALUATION_RELATIVE_PATH = '.playbook/policy-evaluation.json';

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));

const readJsonIfPresent = <T>(cwd: string, relativePath: string): T | undefined => {
  const absolutePath = path.join(cwd, relativePath);
  if (!fs.existsSync(absolutePath)) return undefined;
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
};

const verifyBlockers = (verify: VerifyArtifact | undefined): string[] => {
  if (!verify) return [];
  const failures = (verify.failures ?? []).map((failure) => failure.id ?? failure.message ?? 'verify-failure');
  const findingFailures = (verify.findings ?? [])
    .filter((finding) => finding.level === 'failure' || finding.level === 'error')
    .map((finding) => finding.rule ?? finding.message ?? `verify-${finding.level ?? 'failure'}`);
  return uniqueSorted([...failures, ...findingFailures].map((entry) => `verify:${entry}`));
};

const policyBlockers = (policy: PolicyEvaluationArtifact | undefined): string[] => {
  if (!policy) return [];
  const blockedFromSummary = Number(policy.summary?.blocked ?? 0);
  const blockedEvaluations = (policy.evaluations ?? []).filter((entry) => entry.decision === 'blocked');
  if (blockedFromSummary <= 0 && blockedEvaluations.length === 0) return [];
  const reasons = blockedEvaluations.map((entry) => entry.reason ?? 'blocked');
  if (reasons.length === 0) reasons.push(`blocked-count-${blockedFromSummary}`);
  return uniqueSorted(reasons).map((reason) => `policy:${reason}`);
};

const requiredCapabilitiesForLane = (workerType: string | null, hasProtectedDocWork: boolean): string[] => {
  const capabilities = workerType ? [`worker-type:${workerType}`] : ['worker-type:unassigned'];
  if (hasProtectedDocWork) capabilities.push('protected-doc-fragment-authoring');
  return uniqueSorted(capabilities);
};

export const buildWorkerLaunchPlan = (
  cwd: string,
  input: {
    worksetPlan: WorksetPlanArtifact;
    laneState: LaneStateArtifact;
    workerAssignments: WorkerAssignmentsArtifact;
    worksetPlanPath?: string;
    laneStatePath?: string;
    workerAssignmentsPath?: string;
  }
): WorkerLaunchPlanArtifact => {
  const worksetPlanById = new Map(input.worksetPlan.lanes.map((lane) => [lane.lane_id, lane]));
  const assignmentsByLane = new Map(input.workerAssignments.lanes.map((lane) => [lane.lane_id, lane]));
  const workersByLane = new Map(
    input.workerAssignments.workers.flatMap((worker) =>
      worker.lane_ids.map((laneId) => [laneId, { worker_id: worker.worker_id, worker_type: worker.worker_type }] as const)
    )
  );

  const verify = readJsonIfPresent<VerifyArtifact>(cwd, VERIFY_RELATIVE_PATH);
  const policy = readJsonIfPresent<PolicyEvaluationArtifact>(cwd, POLICY_EVALUATION_RELATIVE_PATH);
  const repoVerifyBlockers = verifyBlockers(verify);
  const repoPolicyBlockers = policyBlockers(policy);

  const lanes: WorkerLaunchPlanLane[] = [...input.laneState.lanes]
    .sort((left, right) => left.lane_id.localeCompare(right.lane_id))
    .map((laneStateEntry) => {
      const worksetLane = worksetPlanById.get(laneStateEntry.lane_id);
      const assignment = assignmentsByLane.get(laneStateEntry.lane_id);
      const worker = workersByLane.get(laneStateEntry.lane_id);
      const protectedTargets = uniqueSorted((worksetLane?.expected_surfaces ?? []).filter((surface) => PROTECTED_SINGLETON_DOCS.has(surface)));
      const hasProtectedSingletonWork = protectedTargets.length > 0;
      const consolidationStage = laneStateEntry.protected_doc_consolidation.stage;
      const blockedByProtectedSingleton = hasProtectedSingletonWork && consolidationStage !== 'applied' && consolidationStage !== 'not_applicable';
      const missingCapability = !laneStateEntry.worker_ready || !worker || assignment?.status !== 'assigned';
      const laneDependencyBlocked = !laneStateEntry.dependencies_satisfied || laneStateEntry.readiness_status === 'blocked' || laneStateEntry.status === 'blocked';

      const blockers = uniqueSorted([
        ...repoVerifyBlockers,
        ...repoPolicyBlockers,
        ...(blockedByProtectedSingleton
          ? [`protected-doc:${consolidationStage}:${laneStateEntry.protected_doc_consolidation.summary}`]
          : []),
        ...(missingCapability ? ['capability:missing-required-worker-capability'] : []),
        ...(laneDependencyBlocked ? laneStateEntry.blocking_reasons.map((reason) => `lane:${reason}`) : [])
      ]);

      const requiredReceipts = uniqueSorted([
        '.playbook/workset-plan.json',
        '.playbook/lane-state.json',
        '.playbook/worker-assignments.json',
        ...(hasProtectedSingletonWork ? [`.playbook/orchestrator/workers/${laneStateEntry.lane_id}/worker-fragment.json`] : [])
      ]);

      const releaseReadyPreconditions = uniqueSorted([
        'no-verify-or-policy-blockers',
        'lane-readiness-and-dependencies-satisfied',
        ...(hasProtectedSingletonWork ? ['protected-singleton-consolidation-resolved'] : []),
        'required-capabilities-present',
        'runtime-capability-registration-authorized',
        'required-receipts-recorded'
      ]);

      const allowedWriteSurfaces = uniqueSorted([
        ...((worksetLane?.expected_surfaces ?? []).filter((surface) => !PROTECTED_SINGLETON_DOCS.has(surface))),
        ...(hasProtectedSingletonWork ? [`.playbook/orchestrator/workers/${laneStateEntry.lane_id}/`] : [])
      ]);

      return {
        lane_id: laneStateEntry.lane_id,
        worker_id: worker?.worker_id ?? null,
        worker_type: worker?.worker_type ?? null,
        launchEligible: blockers.length === 0,
        blockers,
        requiredCapabilities: requiredCapabilitiesForLane(worker?.worker_type ?? null, hasProtectedSingletonWork),
        allowedWriteSurfaces,
        protectedSingletonImpact: {
          hasProtectedSingletonWork,
          targets: protectedTargets,
          consolidationStage,
          unresolved: blockedByProtectedSingleton
        },
        requiredReceipts,
        releaseReadyPreconditions
      };
    });

  const blockedLanes = lanes
    .filter((lane) => !lane.launchEligible)
    .map((lane) => ({ lane_id: lane.lane_id, blockers: lane.blockers }))
    .sort((left, right) => left.lane_id.localeCompare(right.lane_id));

  return {
    schemaVersion: '1.0',
    kind: 'worker-launch-plan',
    proposalOnly: true,
    generatedAt: new Date(0).toISOString(),
    sourceArtifacts: {
      worksetPlanPath: input.worksetPlanPath ?? '.playbook/workset-plan.json',
      laneStatePath: input.laneStatePath ?? '.playbook/lane-state.json',
      workerAssignmentsPath: input.workerAssignmentsPath ?? '.playbook/worker-assignments.json',
      verifyPath: VERIFY_RELATIVE_PATH,
      policyEvaluationPath: POLICY_EVALUATION_RELATIVE_PATH
    },
    summary: {
      launchEligibleLanes: lanes.filter((lane) => lane.launchEligible).map((lane) => lane.lane_id).sort((a, b) => a.localeCompare(b)),
      blockedLanes,
      failClosedReasons: uniqueSorted([
        'protected-singleton-docs-unresolved',
        'verify-or-policy-blockers',
        'missing-required-capability',
        'runtime-capability-registration-incomplete',
        'unresolved-lane-dependency-or-blocker-state'
      ])
    },
    lanes
  };
};

export const writeWorkerLaunchPlanArtifact = (
  cwd: string,
  artifact: WorkerLaunchPlanArtifact,
  relativePath = WORKER_LAUNCH_PLAN_RELATIVE_PATH
): void => {
  const absolutePath = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
};
