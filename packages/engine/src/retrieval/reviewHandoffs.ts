import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  readKnowledgeReviewReceiptsArtifact,
  type KnowledgeReviewReceiptEntry,
  type KnowledgeReviewTargetKind
} from './reviewReceipts.js';
import { REVIEW_QUEUE_RELATIVE_PATH, type ReviewQueueArtifact, type ReviewQueueEntry } from './reviewQueue.js';

export const REVIEW_HANDOFFS_SCHEMA_VERSION = '1.0' as const;
export const REVIEW_HANDOFFS_RELATIVE_PATH = '.playbook/review-handoffs.json' as const;

export type ReviewHandoffDecision = 'revise' | 'supersede';
export type ReviewHandoffFollowupType = 'revise-target' | 'supersede-target';

export type ReviewHandoffEntry = {
  handoffId: string;
  queueEntryId: string;
  receiptId: string;
  targetKind: KnowledgeReviewTargetKind;
  targetId?: string;
  path?: string;
  decision: ReviewHandoffDecision;
  recommendedFollowupType: ReviewHandoffFollowupType;
  recommendedFollowupRef: string;
  evidenceRefs: string[];
  nextActionText: string;
};

export type ReviewDeferredMetadata = {
  queueEntryId: string;
  receiptId: string;
  decision: 'defer';
  deferUntil: string;
  evidenceRefs: string[];
};

export type ReviewHandoffsArtifact = {
  schemaVersion: typeof REVIEW_HANDOFFS_SCHEMA_VERSION;
  kind: 'playbook-review-handoffs';
  proposalOnly: true;
  authority: 'read-only';
  generatedAt: string;
  handoffs: ReviewHandoffEntry[];
  deferred: ReviewDeferredMetadata[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const asIso = (value: string | undefined, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
};

const ensureUniqueSortedStrings = (values: readonly string[]): string[] =>
  [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort((left, right) => left.localeCompare(right));

const buildTargetKey = (entry: Pick<KnowledgeReviewReceiptEntry, 'targetKind' | 'targetId' | 'path'>): string =>
  [entry.targetKind, entry.targetId ?? '', entry.path ?? ''].join('|');

const compareReceipts = (left: KnowledgeReviewReceiptEntry, right: KnowledgeReviewReceiptEntry): number =>
  left.queueEntryId.localeCompare(right.queueEntryId) ||
  left.decidedAt.localeCompare(right.decidedAt) ||
  left.receiptId.localeCompare(right.receiptId);

const pickLatestReceipt = (left: KnowledgeReviewReceiptEntry, right: KnowledgeReviewReceiptEntry): KnowledgeReviewReceiptEntry => {
  const leftMs = Date.parse(left.decidedAt);
  const rightMs = Date.parse(right.decidedAt);
  if (leftMs !== rightMs) {
    return rightMs > leftMs ? right : left;
  }
  return right.receiptId.localeCompare(left.receiptId) > 0 ? right : left;
};

const resolveLatestReceipts = (receipts: KnowledgeReviewReceiptEntry[]): KnowledgeReviewReceiptEntry[] => {
  const byQueueEntryId = new Map<string, KnowledgeReviewReceiptEntry>();
  const byTarget = new Map<string, KnowledgeReviewReceiptEntry>();

  for (const receipt of receipts) {
    const byQueue = byQueueEntryId.get(receipt.queueEntryId);
    if (!byQueue) {
      byQueueEntryId.set(receipt.queueEntryId, receipt);
    } else {
      byQueueEntryId.set(receipt.queueEntryId, pickLatestReceipt(byQueue, receipt));
    }

    const targetKey = buildTargetKey(receipt);
    const byReceiptTarget = byTarget.get(targetKey);
    if (!byReceiptTarget) {
      byTarget.set(targetKey, receipt);
    } else {
      byTarget.set(targetKey, pickLatestReceipt(byReceiptTarget, receipt));
    }
  }

  const seen = new Set<string>();
  const latest: KnowledgeReviewReceiptEntry[] = [];

  for (const receipt of [...byQueueEntryId.values(), ...byTarget.values()].sort(compareReceipts)) {
    if (seen.has(receipt.receiptId)) {
      continue;
    }
    seen.add(receipt.receiptId);
    latest.push(receipt);
  }

  return latest.sort(compareReceipts);
};

const readReviewQueueArtifact = (repoRoot: string): ReviewQueueArtifact => {
  const queuePath = path.join(repoRoot, REVIEW_QUEUE_RELATIVE_PATH);
  if (!fs.existsSync(queuePath)) {
    return {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: new Date(0).toISOString(),
      entries: []
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(queuePath, 'utf8')) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.entries)) {
      return {
        schemaVersion: '1.0',
        kind: 'playbook-review-queue',
        proposalOnly: true,
        authority: 'read-only',
        generatedAt: new Date(0).toISOString(),
        entries: []
      };
    }
    const entries = parsed.entries.filter((entry): entry is ReviewQueueEntry => isRecord(entry) && typeof entry.queueEntryId === 'string');
    return {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: asIso(typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined, new Date(0).toISOString()),
      entries
    };
  } catch {
    return {
      schemaVersion: '1.0',
      kind: 'playbook-review-queue',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: new Date(0).toISOString(),
      entries: []
    };
  }
};

const buildRecommendedFollowupRef = (receipt: KnowledgeReviewReceiptEntry): string => {
  if (receipt.targetId) {
    return `${receipt.targetKind}:${receipt.targetId}`;
  }
  return `path:${receipt.path ?? ''}`;
};

const buildHandoffId = (receipt: KnowledgeReviewReceiptEntry): string =>
  createHash('sha256')
    .update([
      receipt.queueEntryId,
      receipt.receiptId,
      receipt.decision,
      receipt.targetKind,
      receipt.targetId ?? '',
      receipt.path ?? ''
    ].join('|'))
    .digest('hex')
    .slice(0, 16);

const sortHandoffs = (handoffs: ReviewHandoffEntry[]): ReviewHandoffEntry[] =>
  [...handoffs].sort((left, right) =>
    left.queueEntryId.localeCompare(right.queueEntryId) ||
    left.receiptId.localeCompare(right.receiptId) ||
    left.handoffId.localeCompare(right.handoffId)
  );

const sortDeferred = (deferred: ReviewDeferredMetadata[]): ReviewDeferredMetadata[] =>
  [...deferred].sort((left, right) =>
    left.queueEntryId.localeCompare(right.queueEntryId) ||
    left.receiptId.localeCompare(right.receiptId) ||
    left.deferUntil.localeCompare(right.deferUntil)
  );

export const buildReviewHandoffsArtifact = (repoRoot: string, generatedAt: string = new Date().toISOString()): ReviewHandoffsArtifact => {
  const reviewQueue = readReviewQueueArtifact(repoRoot);
  const latestReceipts = resolveLatestReceipts(readKnowledgeReviewReceiptsArtifact(repoRoot).receipts);
  const queueByEntryId = new Map<string, ReviewQueueEntry>(reviewQueue.entries.map((entry) => [entry.queueEntryId, entry]));

  const handoffs: ReviewHandoffEntry[] = [];
  const deferred: ReviewDeferredMetadata[] = [];

  for (const receipt of latestReceipts) {
    const queueEntry = queueByEntryId.get(receipt.queueEntryId);
    const targetId = receipt.targetId ?? queueEntry?.targetId;
    const targetPath = receipt.path ?? queueEntry?.path;

    if (receipt.decision === 'defer') {
      deferred.push({
        queueEntryId: receipt.queueEntryId,
        receiptId: receipt.receiptId,
        decision: 'defer',
        deferUntil: asIso(receipt.deferUntil, receipt.decidedAt),
        evidenceRefs: ensureUniqueSortedStrings([
          ...receipt.evidenceRefs,
          ...(queueEntry?.evidenceRefs ?? []),
          `review-receipt:${receipt.receiptId}`
        ])
      });
      continue;
    }

    if (receipt.decision === 'reaffirm') {
      continue;
    }

    if (!targetId && !targetPath) {
      continue;
    }

    const recommendedFollowupType: ReviewHandoffFollowupType = receipt.decision === 'supersede' ? 'supersede-target' : 'revise-target';
    const recommendedFollowupRef = buildRecommendedFollowupRef({ ...receipt, ...(targetId ? { targetId } : {}), ...(targetPath ? { path: targetPath } : {}) });

    handoffs.push({
      handoffId: buildHandoffId(receipt),
      queueEntryId: receipt.queueEntryId,
      receiptId: receipt.receiptId,
      targetKind: receipt.targetKind,
      ...(targetId ? { targetId } : {}),
      ...(targetPath ? { path: targetPath } : {}),
      decision: receipt.decision,
      recommendedFollowupType,
      recommendedFollowupRef,
      evidenceRefs: ensureUniqueSortedStrings([
        ...receipt.evidenceRefs,
        ...(queueEntry?.evidenceRefs ?? []),
        `review-receipt:${receipt.receiptId}`
      ]),
      nextActionText:
        receipt.decision === 'supersede'
          ? `Record explicit supersession follow-up for ${recommendedFollowupRef} through existing promote or supersede flows.`
          : `Record explicit revision follow-up for ${recommendedFollowupRef} through existing promotion, story, or docs workflows.`
    });
  }

  return {
    schemaVersion: REVIEW_HANDOFFS_SCHEMA_VERSION,
    kind: 'playbook-review-handoffs',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt: asIso(generatedAt, new Date().toISOString()),
    handoffs: sortHandoffs(handoffs),
    deferred: sortDeferred(deferred)
  };
};

export const writeReviewHandoffsArtifact = (repoRoot: string, artifact: ReviewHandoffsArtifact): string => {
  const outputPath = path.join(repoRoot, REVIEW_HANDOFFS_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};
