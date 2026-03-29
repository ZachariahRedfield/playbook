import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  InteropActionRequest,
  InteropActionStatus,
  InteropCapabilityRegistration,
  InteropExecutionReceipt,
  InteropHeartbeatSnapshot,
  PlaybookLifelineInteropRuntimeArtifact,
  RemediationInteropActionKind,
  RendezvousManifest,
  RendezvousManifestEvaluation
} from '@zachariahredfield/playbook-core';
import {
  PLAYBOOK_LIFELINE_INTEROP_ARTIFACT_KIND,
  PLAYBOOK_LIFELINE_INTEROP_SCHEMA_VERSION
} from '@zachariahredfield/playbook-core';
import {
  getFitnessActionContract,
  getFitnessReceiptTypeForAction,
  isFitnessActionName
} from '../integrations/fitnessContract.js';

const STORE_PATH = '.playbook/lifeline-interop-runtime.json' as const;

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const nowIso = (): string => new Date().toISOString();
const sha256File = (filePath: string): string => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const sortById = <T extends { request_id: string }>(entries: T[]): T[] => [...entries].sort((a, b) => a.request_id.localeCompare(b.request_id));

const assertFitnessSeamContract = (input: {
  action_kind: RemediationInteropActionKind;
  receipt_type: string;
  routing: { channel: string; target: string; priority: string; maxDeliveryLatencySeconds: number };
  context: string;
}): void => {
  const actionContract = getFitnessActionContract(input.action_kind);
  const expectedReceiptType = getFitnessReceiptTypeForAction(input.action_kind);
  if (input.receipt_type !== expectedReceiptType) {
    throw new Error(`${input.context}: receipt_type mismatch for ${input.action_kind}. expected=${expectedReceiptType} actual=${input.receipt_type}.`);
  }
  if (
    input.routing.channel !== actionContract.routing.channel ||
    input.routing.target !== actionContract.routing.target ||
    input.routing.priority !== actionContract.routing.priority ||
    input.routing.maxDeliveryLatencySeconds !== actionContract.routing.maxDeliveryLatencySeconds
  ) {
    throw new Error(`${input.context}: routing mismatch for ${input.action_kind}.`);
  }
};

export const createEmptyInteropRuntime = (): PlaybookLifelineInteropRuntimeArtifact => ({
  schemaVersion: PLAYBOOK_LIFELINE_INTEROP_SCHEMA_VERSION,
  kind: PLAYBOOK_LIFELINE_INTEROP_ARTIFACT_KIND,
  generatedAt: nowIso(),
  capabilities: [],
  requests: [],
  statuses: [],
  receipts: [],
  heartbeat: null
});

export const readInteropRuntime = (cwd: string): PlaybookLifelineInteropRuntimeArtifact => {
  const absolute = path.resolve(cwd, STORE_PATH);
  if (!fs.existsSync(absolute)) return createEmptyInteropRuntime();
  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8')) as PlaybookLifelineInteropRuntimeArtifact;
  return {
    ...createEmptyInteropRuntime(),
    ...parsed,
    capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : [],
    requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
    receipts: Array.isArray(parsed.receipts) ? parsed.receipts : []
  };
};

export const writeInteropRuntime = (cwd: string, artifact: PlaybookLifelineInteropRuntimeArtifact): string => {
  const absolute = path.resolve(cwd, STORE_PATH);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const stable: PlaybookLifelineInteropRuntimeArtifact = {
    ...artifact,
    generatedAt: nowIso(),
    capabilities: [...artifact.capabilities].sort((a, b) => a.capability_id.localeCompare(b.capability_id)),
    requests: sortById(artifact.requests),
    statuses: sortById(artifact.statuses),
    receipts: [...artifact.receipts].sort((a, b) => a.receipt_id.localeCompare(b.receipt_id))
  };
  fs.writeFileSync(absolute, deterministicStringify(stable));
  return STORE_PATH;
};

export const registerInteropCapability = (
  runtime: PlaybookLifelineInteropRuntimeArtifact,
  capability: Omit<InteropCapabilityRegistration, 'registered_at'> & { registered_at?: string }
): PlaybookLifelineInteropRuntimeArtifact => {
  if (!isFitnessActionName(capability.action_kind)) {
    throw new Error(`Cannot register interop capability: action_kind ${capability.action_kind} is not a supported Fitness contract action.`);
  }
  assertFitnessSeamContract({
    action_kind: capability.action_kind,
    receipt_type: capability.receipt_type,
    routing: capability.routing,
    context: 'Cannot register interop capability'
  });
  const registered: InteropCapabilityRegistration = { ...capability, registered_at: capability.registered_at ?? nowIso() };
  const filtered = runtime.capabilities.filter((entry) => entry.capability_id !== registered.capability_id);
  return { ...runtime, capabilities: [...filtered, registered] };
};

export const emitBoundedInteropActionRequest = (input: {
  runtime: PlaybookLifelineInteropRuntimeArtifact;
  manifest: RendezvousManifest;
  evaluation: RendezvousManifestEvaluation;
  action_kind: RemediationInteropActionKind;
  capability_id: string;
  manifest_path?: string;
  max_attempts?: number;
}): { runtime: PlaybookLifelineInteropRuntimeArtifact; request: InteropActionRequest } => {
  if (!input.evaluation.releaseReady) {
    throw new Error('Cannot emit interop request: rendezvous state is not release-ready.');
  }
  if (!isFitnessActionName(input.action_kind)) {
    throw new Error(`Cannot emit interop request: action_kind ${input.action_kind} is not a supported Fitness contract action.`);
  }
  const actionContract = getFitnessActionContract(input.action_kind);
  const receiptType = getFitnessReceiptTypeForAction(input.action_kind);
  const capability = input.runtime.capabilities.find((entry) => entry.capability_id === input.capability_id && entry.action_kind === input.action_kind);
  if (!capability) {
    throw new Error(`Cannot emit interop request: capability ${input.capability_id} is not registered for ${input.action_kind}.`);
  }
  assertFitnessSeamContract({
    action_kind: capability.action_kind,
    receipt_type: capability.receipt_type,
    routing: capability.routing,
    context: 'Cannot emit interop request'
  });

  const manifestPath = input.manifest_path ?? '.playbook/rendezvous-manifest.json';
  const manifestHash = createHash('sha256').update(deterministicStringify(input.manifest)).digest('hex');
  const idempotencyKey = `${capability.idempotency_key_prefix}:${input.manifest.remediationId}:${input.action_kind}`;
  const existing = input.runtime.requests.find((entry) => entry.idempotency_key === idempotencyKey);
  if (existing) {
    return { runtime: input.runtime, request: existing };
  }

  const createdAt = nowIso();
  const request: InteropActionRequest = {
    request_id: `interop-${String(input.runtime.requests.length + 1).padStart(4, '0')}`,
    remediation_id: input.manifest.remediationId,
    action_kind: input.action_kind,
    receipt_type: receiptType,
    routing: actionContract.routing,
    capability_id: input.capability_id,
    created_at: createdAt,
    updated_at: createdAt,
    request_state: 'pending',
    idempotency_key: idempotencyKey,
    rendezvous_manifest_path: manifestPath,
    rendezvous_manifest_sha256: manifestHash,
    bounded_inputs: input.manifest.requiredArtifactIds.map((id) => `artifact:${id}`),
    blocked_reason: null,
    retry: {
      attempts: 0,
      max_attempts: input.max_attempts ?? 3,
      reconcile_token: createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16),
      last_attempt_at: null,
      next_retry_at: null
    }
  };

  return {
    runtime: {
      ...input.runtime,
      requests: [...input.runtime.requests, request],
      statuses: [...input.runtime.statuses, {
        request_id: request.request_id,
        request_state: 'pending',
        updated_at: createdAt,
        detail: 'Request emitted from release-ready rendezvous manifest.'
      }]
    },
    request
  };
};

export const runLifelineMockRuntimeOnce = (runtime: PlaybookLifelineInteropRuntimeArtifact, runtimeId: string): PlaybookLifelineInteropRuntimeArtifact => {
  const next = { ...runtime, requests: [...runtime.requests], statuses: [...runtime.statuses], receipts: [...runtime.receipts] };
  const pending = next.requests.find((entry) => entry.request_state === 'pending' || entry.request_state === 'running');
  if (!pending) {
    next.heartbeat = {
      runtime_id: runtimeId,
      observed_at: nowIso(),
      health: 'healthy',
      active_request_id: null,
      pending_requests: next.requests.filter((entry) => entry.request_state === 'pending' || entry.request_state === 'running').length,
      completed_requests: next.requests.filter((entry) => entry.request_state === 'completed').length
    };
    return next;
  }

  assertFitnessSeamContract({
    action_kind: pending.action_kind,
    receipt_type: pending.receipt_type,
    routing: pending.routing,
    context: 'Cannot execute interop request'
  });

  if (pending.request_state === 'pending') {
    pending.request_state = 'running';
    pending.updated_at = nowIso();
    pending.retry.attempts += 1;
    pending.retry.last_attempt_at = pending.updated_at;
    next.statuses.push({ request_id: pending.request_id, request_state: 'running', updated_at: pending.updated_at, detail: 'Mock runtime accepted request.' });
  }

  const outcome: InteropExecutionReceipt['outcome'] = pending.action_kind === 'revise_weekly_goal_plan' ? 'blocked' : 'completed';
  pending.updated_at = nowIso();
  pending.request_state = outcome === 'completed' ? 'completed' : 'blocked';
  pending.blocked_reason = outcome === 'blocked'
    ? { reason_code: 'mock_blocked_apply', reason: 'Mock runtime blocks apply-result to preserve bounded trust.', rejected: true, blocked_at: pending.updated_at }
    : null;

  const receipt: InteropExecutionReceipt = {
    receipt_id: `receipt-${pending.request_id}`,
    request_id: pending.request_id,
    runtime_id: runtimeId,
    action_kind: pending.action_kind,
    receipt_type: pending.receipt_type,
    routing: pending.routing,
    received_at: pending.created_at,
    completed_at: pending.updated_at,
    outcome,
    output_artifact_path: outcome === 'completed' ? pending.rendezvous_manifest_path : null,
    output_sha256: outcome === 'completed' ? pending.rendezvous_manifest_sha256 : null,
    detail: outcome === 'completed' ? 'Mock runtime executed request idempotently and returned receipt.' : 'Mock runtime rejected action as explicitly blocked.'
  };
  if (!next.receipts.some((entry) => entry.request_id === pending.request_id)) {
    next.receipts.push(receipt);
  }
  next.statuses.push({ request_id: pending.request_id, request_state: pending.request_state, updated_at: pending.updated_at, detail: receipt.detail });

  next.heartbeat = {
    runtime_id: runtimeId,
    observed_at: nowIso(),
    health: outcome === 'completed' ? 'healthy' : 'degraded',
    active_request_id: pending.request_id,
    pending_requests: next.requests.filter((entry) => entry.request_state === 'pending' || entry.request_state === 'running').length,
    completed_requests: next.requests.filter((entry) => entry.request_state === 'completed').length
  };

  return next;
};

export const reconcileInteropRuntime = (runtime: PlaybookLifelineInteropRuntimeArtifact): PlaybookLifelineInteropRuntimeArtifact => {
  const now = nowIso();
  const next = { ...runtime, requests: [...runtime.requests], statuses: [...runtime.statuses], receipts: [...runtime.receipts] };

  for (const request of next.requests) {
    const receipt = next.receipts.find((entry) => entry.request_id === request.request_id);
    if (!receipt) continue;
    if (receipt.outcome === 'completed') request.request_state = 'completed';
    else if (receipt.outcome === 'blocked') request.request_state = 'blocked';
    else request.request_state = 'failed';
    request.updated_at = now;
    next.statuses.push({ request_id: request.request_id, request_state: request.request_state, updated_at: now, detail: 'State reconciled from durable receipt.' });
  }

  next.heartbeat = {
    runtime_id: next.heartbeat?.runtime_id ?? 'lifeline-mock-runtime',
    observed_at: now,
    health: next.requests.some((entry) => entry.request_state === 'failed' || entry.request_state === 'blocked') ? 'degraded' : 'healthy',
    active_request_id: null,
    pending_requests: next.requests.filter((entry) => entry.request_state === 'pending' || entry.request_state === 'running').length,
    completed_requests: next.requests.filter((entry) => entry.request_state === 'completed').length
  };

  return next;
};

export const loadManifestHashFromDisk = (cwd: string, manifestPath = '.playbook/rendezvous-manifest.json'): string => {
  const absolute = path.resolve(cwd, manifestPath);
  return sha256File(absolute);
};
