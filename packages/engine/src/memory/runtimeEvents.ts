import fs from 'node:fs';
import path from 'node:path';
import {
  createMemoryEvent,
  memoryArtifactPaths,
  type MemoryEvent,
  type SessionEvidenceReference,
  type SalienceScoreEnvelope
} from '@zachariahredfield/playbook-core';
import type { VerifyReport } from '../report/types.js';
import type { PlanTask } from '../execution/types.js';
import type { FixExecutionResult } from '../execution/fixExecutor.js';
import { decideAdmission, readCurrentMemoryPressureBand, toAdmissionKey, writeAdmissionRollup } from './admission.js';

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((left, right) => left.localeCompare(right))) {
      const nested = canonicalize(record[key]);
      if (nested !== undefined) normalized[key] = nested;
    }
    return normalized;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  return value;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, deterministicStringify(payload), 'utf8');
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const buildEvidence = (paths: string[], occurredAt: number, stepId: string): SessionEvidenceReference[] =>
  uniqueSorted(paths).map((artifactPath) => ({
    kind: 'session-evidence-reference',
    schemaVersion: '1.0.0',
    sessionId: 'repo-local',
    stepId,
    artifactPath,
    capturedAt: occurredAt
  }));

const defaultSalience = (occurredAt: number, reasonCodes: string[]): SalienceScoreEnvelope => ({
  scoreVersion: '1',
  score: 0.5,
  reasonCodes,
  scoredAt: occurredAt
});

export const buildVerifyMemoryEvent = (input: { repoId: string; report: VerifyReport; occurredAt?: number }): MemoryEvent => {
  const occurredAt = input.occurredAt ?? Date.now();
  const ruleIds = uniqueSorted(input.report.failures.map((failure) => failure.id));
  const canonicalKey = `verify|ok:${input.report.ok ? '1' : '0'}|failures:${input.report.summary.failures}|warnings:${input.report.summary.warnings}|rules:${ruleIds.join(',')}`;

  return createMemoryEvent({
    repoId: input.repoId,
    eventType: 'verify.findings.summary.v1',
    occurredAt,
    summary: input.report.ok ? 'verify completed without failures' : 'verify completed with failures',
    canonicalKey,
    fingerprintDimensions: ['command:verify', ...ruleIds.map((ruleId) => `rule:${ruleId}`)],
    evidence: buildEvidence(['.playbook/findings.json'], occurredAt, 'verify-summary'),
    salience: defaultSalience(occurredAt, ['verify-summary'])
  });
};

export const buildPlanMemoryEvent = (input: {
  repoId: string;
  verifyReport: { ok: boolean; failures: Array<{ id: string }>; summary?: { failures: number; warnings: number } };
  tasks: PlanTask[];
  occurredAt?: number;
}): MemoryEvent => {
  const occurredAt = input.occurredAt ?? Date.now();
  const ruleIds = uniqueSorted(input.verifyReport.failures.map((failure) => failure.id));
  const taskRuleIds = uniqueSorted(input.tasks.map((task) => task.ruleId));
  const failureCount = input.verifyReport.summary?.failures ?? input.verifyReport.failures.length;
  const warningCount = input.verifyReport.summary?.warnings ?? 0;
  const canonicalKey = `plan|verifyOk:${input.verifyReport.ok ? '1' : '0'}|failures:${failureCount}|warnings:${warningCount}|tasks:${input.tasks.length}|rules:${taskRuleIds.join(',')}`;

  return createMemoryEvent({
    repoId: input.repoId,
    eventType: 'plan.generation.summary.v1',
    occurredAt,
    summary: 'plan generation completed',
    canonicalKey,
    fingerprintDimensions: ['command:plan', ...ruleIds.map((ruleId) => `rule:${ruleId}`), ...taskRuleIds.map((ruleId) => `task-rule:${ruleId}`)],
    evidence: buildEvidence(['.playbook/findings.json', '.playbook/plan.json'], occurredAt, 'plan-summary'),
    salience: defaultSalience(occurredAt, ['plan-summary'])
  });
};

export const buildApplyMemoryEvent = (input: {
  repoId: string;
  result: FixExecutionResult;
  tasks: PlanTask[];
  postApplyVerificationArtifact?: string;
  postApplyVerification?: Pick<VerifyReport, 'ok' | 'summary'>;
  occurredAt?: number;
}): MemoryEvent => {
  const occurredAt = input.occurredAt ?? Date.now();
  const taskRuleIds = uniqueSorted(input.tasks.map((task) => task.ruleId));
  const postApply = input.postApplyVerification;
  const canonicalKey = `apply|applied:${input.result.summary.applied}|failed:${input.result.summary.failed}|skipped:${input.result.summary.skipped}|unsupported:${input.result.summary.unsupported}|tasks:${input.tasks.length}|rules:${taskRuleIds.join(',')}|postVerify:${postApply ? (postApply.ok ? '1' : '0') : 'na'}|postVerifyFailures:${postApply?.summary.failures ?? -1}`;
  const evidencePaths = ['.playbook/plan.json'];
  if (input.postApplyVerificationArtifact) evidencePaths.push(input.postApplyVerificationArtifact);

  return createMemoryEvent({
    repoId: input.repoId,
    eventType: 'apply.execution.summary.v1',
    occurredAt,
    summary: 'apply execution completed',
    canonicalKey,
    fingerprintDimensions: [
      'command:apply',
      ...taskRuleIds.map((ruleId) => `task-rule:${ruleId}`),
      ...(input.postApplyVerificationArtifact ? ['post-apply-verify:linked'] : [])
    ],
    evidence: buildEvidence(evidencePaths, occurredAt, 'apply-summary'),
    salience: defaultSalience(occurredAt, ['apply-summary', ...(input.postApplyVerificationArtifact ? ['post-apply-verify-linkage'] : [])])
  });
};

export const writeMemoryRuntimeEvent = (repoRoot: string, event: MemoryEvent): string => {
  const eventPath = memoryArtifactPaths.runtimeEvents;
  const existingCount = fs.existsSync(path.join(repoRoot, eventPath))
    ? fs.readdirSync(path.join(repoRoot, eventPath)).filter((entry) => entry.endsWith('.json')).length
    : 0;
  const decision = decideAdmission({
    band: readCurrentMemoryPressureBand(repoRoot),
    isCanonical: false,
    isReviewCritical: false,
    isHighSignal: event.salience.score >= 0.75,
    isLowSignal: event.salience.score < 0.4,
    duplicateCount: existingCount,
    admissionKey: toAdmissionKey({ channel: 'runtime-memory-event', kind: event.kind, payload: event })
  });
  if (decision.action === 'rollup') {
    writeAdmissionRollup({
      repoRoot,
      channel: 'runtime-memory',
      rollupKey: decision.rollupKey,
      occurredAt: new Date(event.occurredAt).toISOString(),
      sample: event as unknown as Record<string, unknown>
    });
    return path.join(repoRoot, '.playbook/memory/events/rollups', `runtime-memory-${decision.rollupKey}.json`);
  }
  if (decision.action === 'dedupe' || decision.action === 'skip') {
    return path.join(repoRoot, memoryArtifactPaths.runtimeEvents, `${event.eventInstanceId}.skipped`);
  }
  const filePath = path.join(repoRoot, memoryArtifactPaths.runtimeEvents, `${event.eventInstanceId}.json`);
  writeJson(filePath, event);
  return filePath;
};

export const captureMemoryRuntimeEventSafe = (repoRoot: string, event: MemoryEvent): void => {
  try {
    writeMemoryRuntimeEvent(repoRoot, event);
  } catch {
    // Runtime memory capture is additive and must not block primary command contracts.
  }
};
