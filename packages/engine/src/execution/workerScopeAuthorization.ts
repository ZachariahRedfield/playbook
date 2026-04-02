import fs from 'node:fs';
import path from 'node:path';
import { WORKER_LAUNCH_PLAN_RELATIVE_PATH, type WorkerLaunchPlanArtifact } from '../orchestration/workerLaunchPlan.js';
import type { WorkerResultArtifactRef, WorkerResultFragmentRef } from '../orchestration/workerResults.js';

type WorkerSubmitInput = {
  lane_id: string;
  fragment_refs?: WorkerResultFragmentRef[];
  artifact_refs?: WorkerResultArtifactRef[];
};

type ScopeValidationResult = {
  allowedWriteSurfaces: string[];
  errors: string[];
};

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');

const isPathWithinSurface = (target: string, surface: string): boolean => {
  if (surface.endsWith('/')) return target === surface.slice(0, -1) || target.startsWith(surface);
  return target === surface;
};

const readLaunchPlan = (cwd: string): WorkerLaunchPlanArtifact | null => {
  const absolutePath = path.join(cwd, WORKER_LAUNCH_PLAN_RELATIVE_PATH);
  if (!fs.existsSync(absolutePath)) return null;
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as WorkerLaunchPlanArtifact;
};

const collectTouchedMutationTargets = (input: WorkerSubmitInput): string[] => {
  const fragmentTargets = (input.fragment_refs ?? []).map((entry) => normalizePath(entry.target_path));
  const artifactTargets = (input.artifact_refs ?? []).map((entry) => normalizePath(entry.path));
  return [...new Set([...fragmentTargets, ...artifactTargets])].sort((left, right) => left.localeCompare(right));
};

export const validateWorkerSubmitAgainstScope = (cwd: string, input: WorkerSubmitInput): ScopeValidationResult => {
  const launchPlan = readLaunchPlan(cwd);
  if (!launchPlan) {
    return { allowedWriteSurfaces: [], errors: ['scope:worker-launch-plan-missing'] };
  }

  const lane = launchPlan.lanes.find((entry) => entry.lane_id === input.lane_id);
  if (!lane) {
    return { allowedWriteSurfaces: [], errors: [`scope:lane-not-in-launch-plan:${input.lane_id}`] };
  }

  const allowedWriteSurfaces = lane.declaredChangeScope.enforced ? lane.declaredChangeScope.allowedWriteSurfaces : lane.allowedWriteSurfaces;
  if (allowedWriteSurfaces.length === 0) {
    return { allowedWriteSurfaces, errors: [`scope:no-allowed-write-surfaces:${input.lane_id}`] };
  }

  const touchedTargets = collectTouchedMutationTargets(input);
  const outOfScopeTargets = touchedTargets.filter(
    (target) => !allowedWriteSurfaces.some((surface) => isPathWithinSurface(target, normalizePath(surface)))
  );

  const errors = outOfScopeTargets.length > 0 ? [`scope:out-of-scope-targets:${outOfScopeTargets.join(',')}`] : [];
  const budget = lane.declaredChangeScope.patchSizeBudget;
  if (budget && touchedTargets.length > budget.maxFiles) {
    errors.push(`scope:mutation-budget-exceeded:maxFiles:${touchedTargets.length}/${budget.maxFiles}`);
  }

  return { allowedWriteSurfaces: [...allowedWriteSurfaces].sort((left, right) => left.localeCompare(right)), errors };
};

