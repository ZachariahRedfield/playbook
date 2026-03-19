import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeJsonArtifactAbsolute } from './jsonArtifact.js';

export type WorkflowPromotion = {
  schemaVersion: '1.0';
  kind: 'workflow-promotion';
  workflow_kind: string;
  staged_generation: true;
  candidate_artifact_path: string;
  staged_artifact_path: string;
  committed_target_path: string;
  validation_status: 'passed' | 'blocked';
  validation_passed: boolean;
  promotion_status: 'promoted' | 'blocked';
  promoted: boolean;
  committed_state_preserved: boolean;
  blocked_reason: string | null;
  error_summary: string | null;
  generated_at: string;
  summary: string;
};

export type PromotionReceiptOutcome = 'promoted' | 'noop' | 'conflict';

export type PromotionReceipt = {
  schemaVersion: '1.0';
  kind: 'promotion-receipt';
  receipt_id: string;
  promotion_kind: 'story' | 'pattern';
  workflow_kind: string;
  generated_at: string;
  source_ref: string;
  source_fingerprint: string;
  target_artifact_path: string;
  target_id: string;
  before_fingerprint: string | null;
  after_fingerprint: string | null;
  outcome: PromotionReceiptOutcome;
  committed: boolean;
  committed_state_preserved: boolean;
  summary: string;
  conflict_reason: string | null;
};

export type PromotionReceiptLog = {
  schemaVersion: '1.0';
  kind: 'promotion-receipt-log';
  receipts: PromotionReceipt[];
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort((a, b) => a.localeCompare(b))) {
      const entry = canonicalize((value as Record<string, unknown>)[key]);
      if (entry !== undefined) normalized[key] = entry;
    }
    return normalized;
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') return undefined;
  return value;
};

const stableSerialize = (value: unknown): string => JSON.stringify(canonicalize(value));
const stableStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;
const fingerprintOf = (value: unknown): string => createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');

const promoteWorkflowArtifact = (stagedPath: string, destinationPath: string): void => {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-promotion-'));
  const backupPath = path.join(backupRoot, 'artifact-backup.json');
  const destinationExisted = fs.existsSync(destinationPath);
  try {
    if (destinationExisted) fs.copyFileSync(destinationPath, backupPath);
    fs.copyFileSync(stagedPath, destinationPath);
  } catch (error) {
    if (destinationExisted && fs.existsSync(backupPath)) fs.copyFileSync(backupPath, destinationPath);
    else fs.rmSync(destinationPath, { force: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed promoting staged workflow artifact; committed state restored. ${message}`);
  } finally {
    fs.rmSync(backupRoot, { recursive: true, force: true });
  }
};

export type StageWorkflowArtifactInput = {
  cwd: string;
  workflowKind: string;
  candidateRelativePath: string;
  committedRelativePath: string;
  artifact: unknown;
  validate: () => string[];
  generatedAt?: string;
  successSummary: string;
  blockedSummary?: string;
};

export type PromotionAttemptInput = {
  cwd: string;
  promotionKind: 'story' | 'pattern';
  workflowKind: string;
  sourceRef: string;
  sourceFingerprint: string;
  targetArtifactPath: string;
  targetId: string;
  beforeFingerprint: string | null;
  afterFingerprint: string | null;
  outcome: PromotionReceiptOutcome;
  summary: string;
  generatedAt?: string;
  conflictReason?: string | null;
};

const buildWorkflowPromotionResult = (input: {
  workflowKind: string;
  candidateRelativePath: string;
  committedRelativePath: string;
  generatedAt?: string;
  validationErrors: string[];
  successSummary: string;
  blockedSummary?: string;
}): WorkflowPromotion => {
  const blockedReason = input.validationErrors.length > 0 ? input.validationErrors.join('; ') : null;
  const promoted = input.validationErrors.length === 0;

  return {
    schemaVersion: '1.0',
    kind: 'workflow-promotion',
    workflow_kind: input.workflowKind,
    staged_generation: true,
    candidate_artifact_path: input.candidateRelativePath,
    staged_artifact_path: input.candidateRelativePath,
    committed_target_path: input.committedRelativePath,
    validation_status: promoted ? 'passed' : 'blocked',
    validation_passed: promoted,
    promotion_status: promoted ? 'promoted' : 'blocked',
    promoted,
    committed_state_preserved: true,
    blocked_reason: blockedReason,
    error_summary: blockedReason,
    generated_at: input.generatedAt ?? new Date(0).toISOString(),
    summary: promoted ? input.successSummary : input.blockedSummary ?? `Staged ${input.workflowKind} candidate blocked before promotion.`
  };
};

const PROMOTION_RECEIPT_LOG_RELATIVE_PATH = '.playbook/promotion-receipts.json' as const;

const readReceiptLog = (cwd: string): PromotionReceiptLog => {
  const targetPath = path.join(cwd, PROMOTION_RECEIPT_LOG_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    return { schemaVersion: '1.0', kind: 'promotion-receipt-log', receipts: [] };
  }
  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as PromotionReceiptLog;
  return {
    schemaVersion: '1.0',
    kind: 'promotion-receipt-log',
    receipts: Array.isArray(parsed.receipts) ? [...parsed.receipts] : []
  };
};

const sortReceipts = (receipts: PromotionReceipt[]): PromotionReceipt[] =>
  [...receipts].sort((left, right) =>
    left.generated_at.localeCompare(right.generated_at) ||
    left.promotion_kind.localeCompare(right.promotion_kind) ||
    left.target_artifact_path.localeCompare(right.target_artifact_path) ||
    left.target_id.localeCompare(right.target_id) ||
    left.receipt_id.localeCompare(right.receipt_id));

export const emitPromotionReceipt = (input: PromotionAttemptInput): PromotionReceipt => {
  const generatedAt = input.generatedAt ?? new Date(0).toISOString();
  const receiptBase = {
    schemaVersion: '1.0' as const,
    kind: 'promotion-receipt' as const,
    promotion_kind: input.promotionKind,
    workflow_kind: input.workflowKind,
    generated_at: generatedAt,
    source_ref: input.sourceRef,
    source_fingerprint: input.sourceFingerprint,
    target_artifact_path: input.targetArtifactPath,
    target_id: input.targetId,
    before_fingerprint: input.beforeFingerprint,
    after_fingerprint: input.afterFingerprint,
    outcome: input.outcome,
    committed: input.outcome === 'promoted',
    committed_state_preserved: input.outcome !== 'promoted',
    summary: input.summary,
    conflict_reason: input.conflictReason ?? null
  };
  const receipt: PromotionReceipt = {
    ...receiptBase,
    receipt_id: `promotion-receipt:${fingerprintOf(receiptBase).slice(0, 16)}`
  };

  const log = readReceiptLog(input.cwd);
  const nextLog: PromotionReceiptLog = {
    schemaVersion: '1.0',
    kind: 'promotion-receipt-log',
    receipts: sortReceipts([...log.receipts.filter((entry) => entry.receipt_id !== receipt.receipt_id), receipt])
  };
  writeJsonArtifactAbsolute(path.join(input.cwd, PROMOTION_RECEIPT_LOG_RELATIVE_PATH), nextLog as unknown as Record<string, unknown>, 'promote', { envelope: false });
  return receipt;
};

export const previewWorkflowArtifact = (input: StageWorkflowArtifactInput): WorkflowPromotion =>
  buildWorkflowPromotionResult({
    workflowKind: input.workflowKind,
    candidateRelativePath: input.candidateRelativePath,
    committedRelativePath: input.committedRelativePath,
    generatedAt: input.generatedAt,
    validationErrors: input.validate(),
    successSummary: input.successSummary,
    blockedSummary: input.blockedSummary
  });

export const stageWorkflowArtifact = (input: StageWorkflowArtifactInput): WorkflowPromotion => {
  const stagedPath = path.join(input.cwd, input.candidateRelativePath);
  const committedPath = path.join(input.cwd, input.committedRelativePath);

  fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
  fs.writeFileSync(stagedPath, stableStringify(input.artifact), 'utf8');

  const promotion = previewWorkflowArtifact(input);
  if (!promotion.promoted) return promotion;

  promoteWorkflowArtifact(stagedPath, committedPath);
  return promotion;
};
