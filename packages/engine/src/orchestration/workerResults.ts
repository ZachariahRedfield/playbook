import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { LaneExecutionStatus } from './laneState.js';
import type { WorksetPlanArtifact, WorksetLane } from './worksetPlan.js';

export const WORKER_RESULTS_RELATIVE_PATH = '.playbook/worker-results.json' as const;

export type WorkerResultCompletionStatus = 'in_progress' | 'completed' | 'blocked';

export type WorkerResultFragmentRef = {
  target_path: string;
  fragment_path: string;
  fragment_id?: string;
};

export type WorkerResultArtifactRef = {
  path: string;
  kind: 'proof' | 'artifact';
  description?: string;
};

export type WorkerResultEntry = {
  schemaVersion: '1.0';
  kind: 'worker-result';
  result_id: string;
  lane_id: string;
  task_ids: string[];
  worker_type: string;
  completion_status: WorkerResultCompletionStatus;
  summary: string;
  blockers: string[];
  unresolved_items: string[];
  fragment_refs: WorkerResultFragmentRef[];
  proof_refs: WorkerResultArtifactRef[];
  artifact_refs: WorkerResultArtifactRef[];
  submitted_at: string;
  proposalOnly: true;
};

export type WorkerResultsArtifact = {
  schemaVersion: '1.0';
  kind: 'worker-results';
  proposalOnly: true;
  generatedAt: string;
  results: WorkerResultEntry[];
};

type WorkerResultInput = Omit<WorkerResultEntry, 'schemaVersion' | 'kind' | 'result_id' | 'submitted_at' | 'proposalOnly'> & {
  submitted_at?: string;
};

const PROTECTED_SINGLETON_DOCS = new Set([
  'docs/CHANGELOG.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/commands/orchestrate.md',
  'docs/commands/workers.md'
]);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalize(record[key])])
        .filter(([, entry]) => entry !== undefined)
    );
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') return undefined;
  return value;
};

const fingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
const sortUnique = (values: readonly string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const sortRefs = <T extends { path?: string; target_path?: string; fragment_path?: string; kind?: string }>(entries: readonly T[]): T[] =>
  [...entries].sort((left, right) =>
    `${left.target_path ?? left.path ?? ''}:${left.fragment_path ?? ''}:${left.kind ?? ''}`.localeCompare(
      `${right.target_path ?? right.path ?? ''}:${right.fragment_path ?? ''}:${right.kind ?? ''}`
    )
  );

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');

const laneById = (worksetPlan: WorksetPlanArtifact): Map<string, WorksetLane> =>
  new Map(worksetPlan.lanes.map((lane) => [lane.lane_id, lane]));

const buildResultId = (entry: Omit<WorkerResultEntry, 'result_id'>): string => `worker-result:${fingerprint(entry).slice(0, 16)}`;

export const createWorkerResultsArtifact = (): WorkerResultsArtifact => ({
  schemaVersion: '1.0',
  kind: 'worker-results',
  proposalOnly: true,
  generatedAt: new Date(0).toISOString(),
  results: []
});

export const readWorkerResultsArtifact = (cwd: string, relativePath = WORKER_RESULTS_RELATIVE_PATH): WorkerResultsArtifact => {
  const absolutePath = path.join(cwd, relativePath);
  if (!fs.existsSync(absolutePath)) return createWorkerResultsArtifact();
  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as Partial<WorkerResultsArtifact>;
  return {
    schemaVersion: '1.0',
    kind: 'worker-results',
    proposalOnly: true,
    generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date(0).toISOString(),
    results: Array.isArray(parsed.results) ? parsed.results as WorkerResultEntry[] : []
  };
};

const validateFragmentRefs = (lane: WorksetLane, fragmentRefs: WorkerResultFragmentRef[]): string[] => {
  const expectedSurfaces = new Set((lane.expected_surfaces ?? []).map((surface) => normalizePath(surface)));
  const errors: string[] = [];
  for (const ref of fragmentRefs) {
    const target = normalizePath(ref.target_path);
    const fragmentPath = normalizePath(ref.fragment_path);
    if (!PROTECTED_SINGLETON_DOCS.has(target)) {
      errors.push(`fragment ref target ${target} is not a protected singleton doc`);
      continue;
    }
    if (!expectedSurfaces.has(target)) {
      errors.push(`fragment ref target ${target} is not owned by lane ${lane.lane_id}`);
    }
    if (!fragmentPath.startsWith('.playbook/')) {
      errors.push(`fragment ref ${fragmentPath} must point to a .playbook artifact`);
    }
  }
  return errors;
};

export const validateWorkerResultInput = (worksetPlan: WorksetPlanArtifact, input: WorkerResultInput): string[] => {
  const errors: string[] = [];
  const lane = laneById(worksetPlan).get(input.lane_id);
  if (!lane) return [`lane_id ${input.lane_id} was not found in .playbook/workset-plan.json`];
  if (!Array.isArray(input.task_ids) || input.task_ids.length === 0) {
    errors.push('task_ids must contain at least one task id');
  }
  const normalizedTaskIds = sortUnique(input.task_ids ?? []);
  const laneTaskIds = sortUnique(lane.task_ids);
  if (normalizedTaskIds.join('|') !== laneTaskIds.join('|')) {
    errors.push(`task_ids must exactly match lane ${lane.lane_id} task ids: ${laneTaskIds.join(', ')}`);
  }
  if (!input.worker_type?.trim()) errors.push('worker_type is required');
  if (!['in_progress', 'completed', 'blocked'].includes(input.completion_status)) {
    errors.push('completion_status must be one of in_progress, completed, or blocked');
  }
  if (typeof input.summary !== 'string' || input.summary.trim().length === 0) {
    errors.push('summary is required');
  }
  if (lane.protected_doc_consolidation.has_protected_doc_work) {
    if ((input.fragment_refs ?? []).length === 0) {
      errors.push(`lane ${lane.lane_id} includes protected singleton doc work; fragment_refs are required`);
    }
    errors.push(...validateFragmentRefs(lane, input.fragment_refs ?? []));
  }
  for (const ref of [...(input.proof_refs ?? []), ...(input.artifact_refs ?? [])]) {
    if (!ref.path?.trim()) errors.push('proof/artifact refs must include a path');
  }
  return errors;
};

const normalizeResult = (input: WorkerResultInput): WorkerResultEntry => {
  const normalizedBase: Omit<WorkerResultEntry, 'result_id'> = {
    schemaVersion: '1.0',
    kind: 'worker-result',
    lane_id: input.lane_id,
    task_ids: sortUnique(input.task_ids),
    worker_type: input.worker_type.trim(),
    completion_status: input.completion_status,
    summary: input.summary.trim(),
    blockers: sortUnique(input.blockers ?? []),
    unresolved_items: sortUnique(input.unresolved_items ?? []),
    fragment_refs: sortRefs((input.fragment_refs ?? []).map((ref) => ({
      target_path: normalizePath(ref.target_path),
      fragment_path: normalizePath(ref.fragment_path),
      ...(ref.fragment_id ? { fragment_id: ref.fragment_id } : {})
    }))),
    proof_refs: sortRefs((input.proof_refs ?? []).map((ref) => ({ path: normalizePath(ref.path), kind: 'proof' as const, ...(ref.description ? { description: ref.description } : {}) }))),
    artifact_refs: sortRefs((input.artifact_refs ?? []).map((ref) => ({ path: normalizePath(ref.path), kind: 'artifact' as const, ...(ref.description ? { description: ref.description } : {}) }))),
    submitted_at: input.submitted_at ?? new Date(0).toISOString(),
    proposalOnly: true
  };
  return {
    ...normalizedBase,
    result_id: buildResultId(normalizedBase)
  };
};

const sortResults = (results: readonly WorkerResultEntry[]): WorkerResultEntry[] =>
  [...results].sort((left, right) =>
    `${left.lane_id}:${left.task_ids.join(',')}:${left.worker_type}:${left.result_id}`.localeCompare(
      `${right.lane_id}:${right.task_ids.join(',')}:${right.worker_type}:${right.result_id}`
    )
  );

export const mergeWorkerResult = (existing: WorkerResultsArtifact, input: WorkerResultInput): { artifact: WorkerResultsArtifact; result: WorkerResultEntry } => {
  const result = normalizeResult(input);
  const deduped = existing.results.filter((entry) => entry.result_id !== result.result_id);
  return {
    result,
    artifact: {
      schemaVersion: '1.0',
      kind: 'worker-results',
      proposalOnly: true,
      generatedAt: new Date(0).toISOString(),
      results: sortResults([...deduped, result])
    }
  };
};

export const writeWorkerResultsArtifact = (cwd: string, artifact: WorkerResultsArtifact, relativePath = WORKER_RESULTS_RELATIVE_PATH): void => {
  const absolutePath = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
};

export const laneStatusOverridesFromWorkerResults = (artifact: WorkerResultsArtifact): Record<string, LaneExecutionStatus> => {
  const overrides = new Map<string, LaneExecutionStatus>();
  for (const result of artifact.results) {
    if (result.completion_status === 'completed') overrides.set(result.lane_id, 'completed');
    if (result.completion_status === 'blocked') overrides.set(result.lane_id, 'blocked');
    if (result.completion_status === 'in_progress') overrides.set(result.lane_id, 'running');
  }
  return Object.fromEntries([...overrides.entries()].sort(([left], [right]) => left.localeCompare(right)));
};
