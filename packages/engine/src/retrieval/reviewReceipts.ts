import fs from 'node:fs';
import path from 'node:path';

export const KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION = '1.0' as const;
export const KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH = '.playbook/knowledge-review-receipts.json' as const;

export type KnowledgeReviewDecision = 'reaffirm' | 'revise' | 'supersede' | 'defer';
export type KnowledgeReviewTargetKind = 'knowledge' | 'doc';

export type KnowledgeReviewReceiptEntry = {
  receiptId: string;
  queueEntryId: string;
  targetKind: KnowledgeReviewTargetKind;
  targetId?: string;
  path?: string;
  sourceSurface: string;
  reasonCode: string;
  decision: KnowledgeReviewDecision;
  evidenceRefs: string[];
  decidedAt: string;
  deferUntil?: string;
  followUpArtifactPath?: string;
};

export type KnowledgeReviewReceiptsArtifact = {
  schemaVersion: typeof KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION;
  kind: 'playbook-knowledge-review-receipts';
  generatedAt: string;
  receipts: KnowledgeReviewReceiptEntry[];
};

export type WriteKnowledgeReviewReceiptInput = Omit<KnowledgeReviewReceiptEntry, 'receiptId' | 'decidedAt' | 'evidenceRefs'> & {
  receiptId?: string;
  decidedAt?: string;
  evidenceRefs?: string[];
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

const ensureUniqueSortedStrings = (values: readonly string[] | undefined): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort((left, right) => left.localeCompare(right));
};

const buildFallbackReceiptId = (entry: Omit<KnowledgeReviewReceiptEntry, 'receiptId'>): string => [
  entry.queueEntryId,
  entry.decision,
  entry.decidedAt,
  entry.targetKind,
  entry.targetId ?? entry.path ?? ''
].join(':');

const normalizeReceipt = (raw: unknown): KnowledgeReviewReceiptEntry | null => {
  if (!isRecord(raw)) {
    return null;
  }

  const queueEntryId = typeof raw.queueEntryId === 'string' ? raw.queueEntryId : null;
  const targetKind = raw.targetKind === 'knowledge' || raw.targetKind === 'doc' ? raw.targetKind : null;
  const sourceSurface = typeof raw.sourceSurface === 'string' ? raw.sourceSurface : null;
  const reasonCode = typeof raw.reasonCode === 'string' ? raw.reasonCode : null;
  const decision = raw.decision === 'reaffirm' || raw.decision === 'revise' || raw.decision === 'supersede' || raw.decision === 'defer' ? raw.decision : null;
  const targetId = typeof raw.targetId === 'string' && raw.targetId.length > 0 ? raw.targetId : undefined;
  const targetPath = typeof raw.path === 'string' && raw.path.length > 0 ? raw.path : undefined;
  const followUpArtifactPath = typeof raw.followUpArtifactPath === 'string' && raw.followUpArtifactPath.length > 0 ? raw.followUpArtifactPath : undefined;
  const deferUntil = asIso(typeof raw.deferUntil === 'string' ? raw.deferUntil : undefined, '');

  if (!queueEntryId || !targetKind || !sourceSurface || !reasonCode || !decision) {
    return null;
  }

  if (!targetId && !targetPath) {
    return null;
  }

  const decidedAt = asIso(typeof raw.decidedAt === 'string' ? raw.decidedAt : undefined, new Date(0).toISOString());
  const evidenceRefs = ensureUniqueSortedStrings(Array.isArray(raw.evidenceRefs) ? (raw.evidenceRefs as string[]) : undefined);

  const normalizedWithoutId: Omit<KnowledgeReviewReceiptEntry, 'receiptId'> = {
    queueEntryId,
    targetKind,
    ...(targetId ? { targetId } : {}),
    ...(targetPath ? { path: targetPath } : {}),
    sourceSurface,
    reasonCode,
    decision,
    evidenceRefs,
    decidedAt,
    ...(deferUntil ? { deferUntil } : {}),
    ...(followUpArtifactPath ? { followUpArtifactPath } : {})
  };

  const receiptId =
    typeof raw.receiptId === 'string' && raw.receiptId.length > 0
      ? raw.receiptId
      : buildFallbackReceiptId(normalizedWithoutId);

  return {
    receiptId,
    ...normalizedWithoutId
  };
};

const sortReceipts = (receipts: KnowledgeReviewReceiptEntry[]): KnowledgeReviewReceiptEntry[] =>
  [...receipts].sort((left, right) =>
    left.queueEntryId.localeCompare(right.queueEntryId) ||
    left.decidedAt.localeCompare(right.decidedAt) ||
    left.decision.localeCompare(right.decision) ||
    left.receiptId.localeCompare(right.receiptId)
  );

const mergeReceipts = (receipts: KnowledgeReviewReceiptEntry[]): KnowledgeReviewReceiptEntry[] => {
  const byReceiptId = new Map<string, KnowledgeReviewReceiptEntry>();
  for (const receipt of sortReceipts(receipts)) {
    byReceiptId.set(receipt.receiptId, receipt);
  }
  return sortReceipts([...byReceiptId.values()]);
};

export const createEmptyKnowledgeReviewReceiptsArtifact = (generatedAt: string = new Date().toISOString()): KnowledgeReviewReceiptsArtifact => ({
  schemaVersion: KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION,
  kind: 'playbook-knowledge-review-receipts',
  generatedAt: asIso(generatedAt, new Date().toISOString()),
  receipts: []
});

export const normalizeKnowledgeReviewReceiptsArtifact = (raw: unknown, generatedAtFallback: string = new Date().toISOString()): KnowledgeReviewReceiptsArtifact => {
  if (!isRecord(raw)) {
    return createEmptyKnowledgeReviewReceiptsArtifact(generatedAtFallback);
  }

  const generatedAt = asIso(typeof raw.generatedAt === 'string' ? raw.generatedAt : undefined, generatedAtFallback);
  const receipts = Array.isArray(raw.receipts)
    ? sortReceipts(
        raw.receipts
          .map((entry) => normalizeReceipt(entry))
          .filter((entry): entry is KnowledgeReviewReceiptEntry => entry !== null)
      )
    : [];

  return {
    schemaVersion: KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION,
    kind: 'playbook-knowledge-review-receipts',
    generatedAt,
    receipts
  };
};

export const readKnowledgeReviewReceiptsArtifact = (repoRoot: string): KnowledgeReviewReceiptsArtifact => {
  const fullPath = path.join(repoRoot, KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    return createEmptyKnowledgeReviewReceiptsArtifact();
  }

  try {
    return normalizeKnowledgeReviewReceiptsArtifact(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
  } catch {
    return createEmptyKnowledgeReviewReceiptsArtifact();
  }
};

export const writeKnowledgeReviewReceiptsArtifact = (repoRoot: string, artifact: KnowledgeReviewReceiptsArtifact): string => {
  const fullPath = path.join(repoRoot, KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const normalized = normalizeKnowledgeReviewReceiptsArtifact(artifact, artifact.generatedAt);
  fs.writeFileSync(fullPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return fullPath;
};

export const writeKnowledgeReviewReceipt = (repoRoot: string, input: WriteKnowledgeReviewReceiptInput): KnowledgeReviewReceiptsArtifact => {
  const existing = readKnowledgeReviewReceiptsArtifact(repoRoot);
  const decidedAt = asIso(input.decidedAt, new Date().toISOString());
  const targetId = typeof input.targetId === 'string' && input.targetId.length > 0 ? input.targetId : undefined;
  const targetPath = typeof input.path === 'string' && input.path.length > 0 ? input.path : undefined;

  if (!targetId && !targetPath) {
    throw new Error('playbook retrieval review-receipts: receipt requires targetId or path');
  }

  const normalizedWithoutId: Omit<KnowledgeReviewReceiptEntry, 'receiptId'> = {
    queueEntryId: input.queueEntryId,
    targetKind: input.targetKind,
    ...(targetId ? { targetId } : {}),
    ...(targetPath ? { path: targetPath } : {}),
    sourceSurface: input.sourceSurface,
    reasonCode: input.reasonCode,
    decision: input.decision,
    evidenceRefs: ensureUniqueSortedStrings(input.evidenceRefs),
    decidedAt,
    ...(typeof input.deferUntil === 'string' && input.deferUntil.length > 0 ? { deferUntil: asIso(input.deferUntil, decidedAt) } : {}),
    ...(input.followUpArtifactPath ? { followUpArtifactPath: input.followUpArtifactPath } : {})
  };

  const nextReceipt: KnowledgeReviewReceiptEntry = {
    receiptId: input.receiptId && input.receiptId.length > 0 ? input.receiptId : buildFallbackReceiptId(normalizedWithoutId),
    ...normalizedWithoutId
  };

  const nextArtifact: KnowledgeReviewReceiptsArtifact = {
    ...existing,
    generatedAt: asIso(decidedAt, decidedAt),
    receipts: mergeReceipts([...existing.receipts, nextReceipt])
  };

  writeKnowledgeReviewReceiptsArtifact(repoRoot, nextArtifact);
  return nextArtifact;
};
