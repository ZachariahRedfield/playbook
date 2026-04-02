import fs from 'node:fs';
import path from 'node:path';
import { CHANGE_SCOPE_RELATIVE_PATH } from '../changeScope.js';
import type { ChangeScopeBundle } from '../changeScope.js';
import type { PlanTask } from './types.js';

const REQUIRED_BOUNDARY_CHECKS = ['no-mutation-authority-escalation', 'writes-must-stay-inside-allowedFiles'] as const;

type ChangeScopeCheckStatus = 'green' | 'red' | 'unspecified';

export type ApplyChangeScope = {
  scopeId: string;
  allowedFiles: string[];
  patchSizeBudget: {
    maxFiles: number;
    maxHunks: number;
    maxAddedLines: number;
    maxRemovedLines: number;
  };
  boundaryChecks: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeBundle = (bundle: unknown): ApplyChangeScope => {
  if (!isRecord(bundle)) {
    throw new Error('Invalid change-scope bundle: expected object entry.');
  }

  const scopeId = bundle.scopeId;
  const mutationScope = bundle.mutationScope;
  if (typeof scopeId !== 'string' || !isRecord(mutationScope)) {
    throw new Error('Invalid change-scope bundle: missing scopeId or mutationScope.');
  }

  const allowedFiles = mutationScope.allowedFiles;
  const patchSizeBudget = mutationScope.patchSizeBudget;
  const boundaryChecks = mutationScope.boundaryChecks;
  if (!Array.isArray(allowedFiles) || !allowedFiles.every((entry) => typeof entry === 'string')) {
    throw new Error('Invalid change-scope bundle: mutationScope.allowedFiles must be a string array.');
  }
  if (!isRecord(patchSizeBudget)) {
    throw new Error('Invalid change-scope bundle: mutationScope.patchSizeBudget must be an object.');
  }
  if (!Array.isArray(boundaryChecks) || !boundaryChecks.every((entry) => typeof entry === 'string')) {
    throw new Error('Invalid change-scope bundle: mutationScope.boundaryChecks must be a string array.');
  }

  const budgetFields = ['maxFiles', 'maxHunks', 'maxAddedLines', 'maxRemovedLines'] as const;
  for (const field of budgetFields) {
    const value = patchSizeBudget[field];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid change-scope bundle: mutationScope.patchSizeBudget.${field} must be a non-negative integer.`);
    }
  }

  return {
    scopeId,
    allowedFiles: [...new Set(allowedFiles)].sort((left, right) => left.localeCompare(right)),
    patchSizeBudget: {
      maxFiles: patchSizeBudget.maxFiles as number,
      maxHunks: patchSizeBudget.maxHunks as number,
      maxAddedLines: patchSizeBudget.maxAddedLines as number,
      maxRemovedLines: patchSizeBudget.maxRemovedLines as number
    },
    boundaryChecks: [...new Set(boundaryChecks)].sort((left, right) => left.localeCompare(right))
  };
};

const parseBoundaryCheck = (entry: string): { id: string; status: ChangeScopeCheckStatus } => {
  const trimmed = entry.trim();
  if (trimmed.length === 0) {
    return { id: '', status: 'unspecified' };
  }

  const match = /^(?<id>[^:=]+)\s*[:=]\s*(?<status>green|ok|pass|passed|red|fail|failed|blocked)$/i.exec(trimmed);
  if (!match?.groups) {
    return { id: trimmed, status: 'unspecified' };
  }

  const statusToken = match.groups.status.toLowerCase();
  if (['green', 'ok', 'pass', 'passed'].includes(statusToken)) {
    return { id: match.groups.id.trim(), status: 'green' };
  }

  return { id: match.groups.id.trim(), status: 'red' };
};

const countLines = (content: string): number => {
  if (content.length === 0) {
    return 0;
  }
  return content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length;
};

const estimatePatch = (tasks: PlanTask[]): { files: number; hunks: number; addedLines: number; removedLines: number } => {
  const mutationCandidates = tasks.filter((task) => task.autoFix);
  const files = new Set(mutationCandidates.map((task) => task.file).filter((file): file is string => typeof file === 'string')).size;
  const hunks = mutationCandidates.length;

  let addedLines = 0;
  let removedLines = 0;
  for (const task of mutationCandidates) {
    if (task.write?.content) {
      addedLines += countLines(task.write.content);
      continue;
    }

    // Conservative minimum for non-managed writes. Fail closed when budget is too tight.
    addedLines += 1;
    removedLines += 1;
  }

  return { files, hunks, addedLines, removedLines };
};

export const readApplyChangeScope = (repoRoot: string): ApplyChangeScope | null => {
  const artifactPath = path.resolve(repoRoot, CHANGE_SCOPE_RELATIVE_PATH);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read change-scope artifact at ${artifactPath}: ${message}`);
  }

  if (!isRecord(payload)) {
    throw new Error(`Invalid change-scope artifact at ${artifactPath}: expected an object.`);
  }

  if (payload.kind !== 'change-scope') {
    throw new Error(`Invalid change-scope artifact at ${artifactPath}: kind must be "change-scope".`);
  }

  const bundles = payload.bundles;
  if (!Array.isArray(bundles) || bundles.length === 0) {
    throw new Error(`Invalid change-scope artifact at ${artifactPath}: bundles must contain at least one entry.`);
  }

  const preferredBundle = bundles.find((entry) => {
    if (!isRecord(entry) || !isRecord(entry.source)) {
      return false;
    }
    return entry.source.command === 'plan';
  }) ?? bundles[0];

  return normalizeBundle(preferredBundle as ChangeScopeBundle);
};

export const enforceApplyChangeScope = (tasks: PlanTask[], scope: ApplyChangeScope): void => {
  const checks = scope.boundaryChecks.map(parseBoundaryCheck).filter((entry) => entry.id.length > 0);
  const checkIds = new Set(checks.map((entry) => entry.id));
  const missingChecks = REQUIRED_BOUNDARY_CHECKS.filter((check) => !checkIds.has(check));
  if (missingChecks.length > 0) {
    throw new Error(
      `Change-scope enforcement failed for ${scope.scopeId}: required boundary checks are missing (${missingChecks.join(', ')}).`
    );
  }

  const redChecks = checks.filter((entry) => entry.status === 'red').map((entry) => entry.id).sort((left, right) => left.localeCompare(right));
  if (redChecks.length > 0) {
    throw new Error(`Change-scope enforcement failed for ${scope.scopeId}: boundary checks are red (${redChecks.join(', ')}).`);
  }

  const allowedFiles = new Set(scope.allowedFiles);
  const mutatedFiles = [...new Set(tasks.map((task) => task.file).filter((file): file is string => typeof file === 'string'))].sort((left, right) =>
    left.localeCompare(right)
  );
  const disallowedFiles = mutatedFiles.filter((file) => !allowedFiles.has(file));
  if (disallowedFiles.length > 0) {
    throw new Error(
      `Change-scope enforcement failed for ${scope.scopeId}: out-of-scope mutation requested (${disallowedFiles.join(', ')}).`
    );
  }

  const estimate = estimatePatch(tasks);
  const overflow: string[] = [];
  if (estimate.files > scope.patchSizeBudget.maxFiles) {
    overflow.push(`maxFiles ${estimate.files}/${scope.patchSizeBudget.maxFiles}`);
  }
  if (estimate.hunks > scope.patchSizeBudget.maxHunks) {
    overflow.push(`maxHunks ${estimate.hunks}/${scope.patchSizeBudget.maxHunks}`);
  }
  if (estimate.addedLines > scope.patchSizeBudget.maxAddedLines) {
    overflow.push(`maxAddedLines ${estimate.addedLines}/${scope.patchSizeBudget.maxAddedLines}`);
  }
  if (estimate.removedLines > scope.patchSizeBudget.maxRemovedLines) {
    overflow.push(`maxRemovedLines ${estimate.removedLines}/${scope.patchSizeBudget.maxRemovedLines}`);
  }

  if (overflow.length > 0) {
    throw new Error(`Change-scope enforcement failed for ${scope.scopeId}: patch budget exceeded (${overflow.join('; ')}).`);
  }
};
