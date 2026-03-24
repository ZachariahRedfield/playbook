import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryKnowledgeArtifact, MemoryKnowledgeEntry } from '../memory/knowledge.js';
import type { MemoryReplayResult } from '../schema/memoryReplay.js';

export const REVIEW_QUEUE_SCHEMA_VERSION = '1.0' as const;
export const REVIEW_QUEUE_RELATIVE_PATH = '.playbook/review-queue.json' as const;
export const KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION = '1.0' as const;
export const KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH = '.playbook/knowledge-review-receipts.json' as const;

const KNOWLEDGE_ARTIFACT_PATHS = [
  '.playbook/memory/knowledge/decisions.json',
  '.playbook/memory/knowledge/patterns.json',
  '.playbook/memory/knowledge/failure-modes.json',
  '.playbook/memory/knowledge/invariants.json'
] as const;

const GOVERNED_DOC_PATHS = ['docs/PLAYBOOK_PRODUCT_ROADMAP.md', 'docs/PLAYBOOK_DEV_WORKFLOW.md'] as const;
const GOVERNED_DOC_PREFIXES = ['docs/postmortems/'] as const;
const MEMORY_CANDIDATES_PATH = '.playbook/memory/candidates.json' as const;

export type ReviewRecommendedAction = 'reaffirm' | 'revise' | 'supersede';
export type ReviewDecision = ReviewRecommendedAction | 'defer';
export type ReviewPriority = 'high' | 'medium' | 'low';
export type ReviewTargetKind = 'knowledge' | 'doc';

export type ReviewQueueEntry = {
  queueEntryId: string;
  targetKind: ReviewTargetKind;
  targetId?: string;
  path?: string;
  sourceSurface: string;
  reasonCode: string;
  evidenceRefs: string[];
  recommendedAction: ReviewRecommendedAction;
  reviewPriority: ReviewPriority;
  generatedAt: string;
  availableAt?: string;
};

export type ReviewQueueArtifact = {
  schemaVersion: typeof REVIEW_QUEUE_SCHEMA_VERSION;
  kind: 'playbook-review-queue';
  proposalOnly: true;
  authority: 'read-only';
  generatedAt: string;
  entries: ReviewQueueEntry[];
};

export type KnowledgeReviewReceipt = {
  receiptId: string;
  queueEntryId: string;
  targetKind: ReviewTargetKind;
  targetId?: string;
  path?: string;
  sourceSurface: string;
  reasonCode: string;
  decision: ReviewDecision;
  decidedAt: string;
  evidenceRefs: string[];
  followUpArtifactRef?: string;
  availableAt?: string;
};

export type KnowledgeReviewReceiptsArtifact = {
  schemaVersion: typeof KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION;
  kind: 'playbook-knowledge-review-receipts';
  proposalOnly: true;
  authority: 'read-only';
  generatedAt: string;
  receipts: KnowledgeReviewReceipt[];
};

export type WriteKnowledgeReviewReceiptInput = {
  queueEntryId: string;
  targetKind: ReviewTargetKind;
  targetId?: string;
  path?: string;
  sourceSurface: string;
  reasonCode: string;
  decision: ReviewDecision;
  decidedAt?: string;
  evidenceRefs?: string[];
  followUpArtifactRef?: string;
  availableAt?: string;
};

export type BuildReviewQueueOptions = {
  generatedAt?: string;
  staleKnowledgeDays?: number;
  docReviewWindowDays?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readJsonFile = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const fileAgeDays = (filePath: string, nowMs: number): number => {
  const stats = fs.statSync(filePath);
  const ageMs = Math.max(0, nowMs - stats.mtimeMs);
  return ageMs / (1000 * 60 * 60 * 24);
};

const safeIso = (value: string | undefined, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return fallback;
  }
  return new Date(ms).toISOString();
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const parseKnowledgeEntries = (repoRoot: string): Array<{ entry: MemoryKnowledgeEntry; sourcePath: string }> => {
  const collected: Array<{ entry: MemoryKnowledgeEntry; sourcePath: string }> = [];

  for (const relativePath of KNOWLEDGE_ARTIFACT_PATHS) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const parsed = readJsonFile<Partial<MemoryKnowledgeArtifact>>(fullPath);
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    for (const rawEntry of entries) {
      if (!isRecord(rawEntry) || typeof rawEntry.knowledgeId !== 'string' || rawEntry.knowledgeId.length === 0) {
        continue;
      }
      const entry = rawEntry as MemoryKnowledgeEntry;
      collected.push({ entry, sourcePath: relativePath });
    }
  }

  return collected;
};

const isGovernedDoc = (docPath: string): boolean =>
  GOVERNED_DOC_PATHS.includes(docPath as (typeof GOVERNED_DOC_PATHS)[number]) ||
  GOVERNED_DOC_PREFIXES.some((prefix) => docPath.startsWith(prefix));

const parsePostmortemCandidateEntries = (repoRoot: string): Array<{ candidateId: string; sourcePath: string }> => {
  const candidatesPath = path.join(repoRoot, MEMORY_CANDIDATES_PATH);
  if (!fs.existsSync(candidatesPath)) {
    return [];
  }

  const parsed = readJsonFile<Partial<MemoryReplayResult>>(candidatesPath);
  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const entries: Array<{ candidateId: string; sourcePath: string }> = [];

  for (const candidate of candidates) {
    if (!isRecord(candidate) || typeof candidate.candidateId !== 'string' || !Array.isArray(candidate.provenance)) {
      continue;
    }

    for (const provenance of candidate.provenance) {
      if (!isRecord(provenance) || typeof provenance.sourcePath !== 'string') {
        continue;
      }
      if (!provenance.sourcePath.startsWith('docs/postmortems/')) {
        continue;
      }
      entries.push({ candidateId: candidate.candidateId, sourcePath: provenance.sourcePath });
    }
  }

  return entries;
};

const priorityWeight: Record<ReviewPriority, number> = { high: 0, medium: 1, low: 2 };

const sortQueueEntries = (entries: ReviewQueueEntry[]): ReviewQueueEntry[] =>
  [...entries].sort((left, right) =>
    priorityWeight[left.reviewPriority] - priorityWeight[right.reviewPriority] ||
    left.targetKind.localeCompare(right.targetKind) ||
    (left.targetId ?? left.path ?? '').localeCompare(right.targetId ?? right.path ?? '') ||
    left.reasonCode.localeCompare(right.reasonCode) ||
    left.sourceSurface.localeCompare(right.sourceSurface) ||
    left.recommendedAction.localeCompare(right.recommendedAction) ||
    (left.availableAt ?? '').localeCompare(right.availableAt ?? '') ||
    left.evidenceRefs.join('|').localeCompare(right.evidenceRefs.join('|'))
  );

const queueIdentity = (entry: Omit<ReviewQueueEntry, 'queueEntryId' | 'generatedAt'>): string =>
  JSON.stringify({
    targetKind: entry.targetKind,
    targetId: entry.targetId ?? '',
    path: entry.path ?? '',
    sourceSurface: entry.sourceSurface,
    reasonCode: entry.reasonCode,
    recommendedAction: entry.recommendedAction,
    reviewPriority: entry.reviewPriority,
    availableAt: entry.availableAt ?? '',
    evidenceRefs: uniqueSorted(entry.evidenceRefs)
  });

const toQueueEntryId = (entry: Omit<ReviewQueueEntry, 'queueEntryId' | 'generatedAt'>): string =>
  `rq_${createHash('sha256').update(queueIdentity(entry)).digest('hex').slice(0, 16)}`;

const dedupeQueueEntries = (entries: Omit<ReviewQueueEntry, 'queueEntryId'>[]): ReviewQueueEntry[] => {
  const byKey = new Map<string, ReviewQueueEntry>();

  for (const entry of entries) {
    const keyEntry: Omit<ReviewQueueEntry, 'queueEntryId' | 'generatedAt'> = {
      targetKind: entry.targetKind,
      targetId: entry.targetId,
      path: entry.path,
      sourceSurface: entry.sourceSurface,
      reasonCode: entry.reasonCode,
      evidenceRefs: entry.evidenceRefs,
      recommendedAction: entry.recommendedAction,
      reviewPriority: entry.reviewPriority,
      availableAt: entry.availableAt
    };

    const entryKey = queueIdentity(keyEntry);
    const existing = byKey.get(entryKey);
    if (!existing) {
      byKey.set(entryKey, {
        ...entry,
        queueEntryId: toQueueEntryId(keyEntry),
        evidenceRefs: uniqueSorted(entry.evidenceRefs)
      });
      continue;
    }

    const mergedEvidence = uniqueSorted([...existing.evidenceRefs, ...entry.evidenceRefs]);
    byKey.set(entryKey, { ...existing, evidenceRefs: mergedEvidence });
  }

  return [...byKey.values()];
};

const reviewTargetKey = (targetKind: ReviewTargetKind, targetId?: string, path?: string): string => `${targetKind}|${targetId ?? ''}|${path ?? ''}`;

const reviewWindowDaysForEntry = (entry: ReviewQueueEntry, staleKnowledgeDays: number, docReviewWindowDays: number): number =>
  entry.targetKind === 'knowledge' ? staleKnowledgeDays : docReviewWindowDays;

const normalizeReceipt = (input: WriteKnowledgeReviewReceiptInput, generatedAt: string): KnowledgeReviewReceipt => {
  const decidedAt = safeIso(input.decidedAt, generatedAt);
  const availableAt = input.decision === 'defer' ? safeIso(input.availableAt, decidedAt) : undefined;
  const evidenceRefs = uniqueSorted(Array.isArray(input.evidenceRefs) ? input.evidenceRefs.map((value) => String(value)) : []);
  const payload = {
    queueEntryId: input.queueEntryId,
    targetKind: input.targetKind,
    targetId: input.targetId ?? '',
    path: input.path ?? '',
    sourceSurface: input.sourceSurface,
    reasonCode: input.reasonCode,
    decision: input.decision,
    decidedAt,
    evidenceRefs,
    followUpArtifactRef: input.followUpArtifactRef ?? '',
    availableAt: availableAt ?? ''
  };

  return {
    receiptId: `krr_${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16)}`,
    queueEntryId: input.queueEntryId,
    targetKind: input.targetKind,
    targetId: input.targetId,
    path: input.path,
    sourceSurface: input.sourceSurface,
    reasonCode: input.reasonCode,
    decision: input.decision,
    decidedAt,
    evidenceRefs,
    followUpArtifactRef: input.followUpArtifactRef,
    availableAt
  };
};

export const readKnowledgeReviewReceiptsArtifact = (repoRoot: string): KnowledgeReviewReceiptsArtifact => {
  const artifactPath = path.join(repoRoot, KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH);
  const fallbackGeneratedAt = new Date(0).toISOString();
  if (!fs.existsSync(artifactPath)) {
    return {
      schemaVersion: KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION,
      kind: 'playbook-knowledge-review-receipts',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: fallbackGeneratedAt,
      receipts: []
    };
  }

  const parsed = readJsonFile<Partial<KnowledgeReviewReceiptsArtifact>>(artifactPath);
  const receipts: KnowledgeReviewReceipt[] = Array.isArray(parsed.receipts)
    ? parsed.receipts
        .filter((value): value is KnowledgeReviewReceipt => isRecord(value) && typeof value.queueEntryId === 'string' && typeof value.decision === 'string')
        .map((value) => ({
          receiptId: typeof value.receiptId === 'string' && value.receiptId.length > 0 ? value.receiptId : `krr_${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)}`,
          queueEntryId: value.queueEntryId,
          targetKind: (value.targetKind === 'doc' ? 'doc' : 'knowledge') as ReviewTargetKind,
          targetId: typeof value.targetId === 'string' ? value.targetId : undefined,
          path: typeof value.path === 'string' ? value.path : undefined,
          sourceSurface: typeof value.sourceSurface === 'string' ? value.sourceSurface : 'unknown',
          reasonCode: typeof value.reasonCode === 'string' ? value.reasonCode : 'unknown',
          decision: (value.decision === 'defer' ? 'defer' : value.decision === 'revise' ? 'revise' : value.decision === 'supersede' ? 'supersede' : 'reaffirm') as ReviewDecision,
          decidedAt: safeIso(value.decidedAt, fallbackGeneratedAt),
          evidenceRefs: uniqueSorted(Array.isArray(value.evidenceRefs) ? value.evidenceRefs.map((ref) => String(ref)) : []),
          followUpArtifactRef: typeof value.followUpArtifactRef === 'string' ? value.followUpArtifactRef : undefined,
          availableAt: typeof value.availableAt === 'string' ? safeIso(value.availableAt, safeIso(value.decidedAt, fallbackGeneratedAt)) : undefined
        }))
    : [];

  const sortedReceipts = [...receipts].sort((left, right) =>
    left.decidedAt.localeCompare(right.decidedAt) || left.queueEntryId.localeCompare(right.queueEntryId) || left.receiptId.localeCompare(right.receiptId)
  );

  return {
    schemaVersion: KNOWLEDGE_REVIEW_RECEIPTS_SCHEMA_VERSION,
    kind: 'playbook-knowledge-review-receipts',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt: safeIso(parsed.generatedAt, fallbackGeneratedAt),
    receipts: sortedReceipts
  };
};

export const writeKnowledgeReviewReceipt = (repoRoot: string, input: WriteKnowledgeReviewReceiptInput): string => {
  const artifact = readKnowledgeReviewReceiptsArtifact(repoRoot);
  const generatedAt = new Date().toISOString();
  const receipt = normalizeReceipt(input, generatedAt);

  const nextArtifact: KnowledgeReviewReceiptsArtifact = {
    ...artifact,
    generatedAt,
    receipts: [...artifact.receipts, receipt].sort((left, right) =>
      left.decidedAt.localeCompare(right.decidedAt) || left.queueEntryId.localeCompare(right.queueEntryId) || left.receiptId.localeCompare(right.receiptId)
    )
  };

  const outputPath = path.join(repoRoot, KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(nextArtifact, null, 2)}\n`, 'utf8');
  return outputPath;
};

const latestReceiptByTarget = (receipts: KnowledgeReviewReceipt[]): Map<string, KnowledgeReviewReceipt> => {
  const latest = new Map<string, KnowledgeReviewReceipt>();
  for (const receipt of receipts) {
    const key = reviewTargetKey(receipt.targetKind, receipt.targetId, receipt.path);
    const prior = latest.get(key);
    if (!prior || prior.decidedAt < receipt.decidedAt || (prior.decidedAt === receipt.decidedAt && prior.receiptId < receipt.receiptId)) {
      latest.set(key, receipt);
    }
  }
  return latest;
};

export const buildReviewQueue = (repoRoot: string, options: BuildReviewQueueOptions = {}): ReviewQueueArtifact => {
  const generatedAt = safeIso(options.generatedAt, new Date().toISOString());
  const nowMs = Date.parse(generatedAt);
  const staleKnowledgeDays = options.staleKnowledgeDays ?? 45;
  const docReviewWindowDays = options.docReviewWindowDays ?? 90;

  const entries: Array<Omit<ReviewQueueEntry, 'queueEntryId'>> = [];

  for (const { entry, sourcePath } of parseKnowledgeEntries(repoRoot)) {
    const promotedMs = Date.parse(entry.promotedAt);
    const promotedAgeDays = Number.isNaN(promotedMs) ? staleKnowledgeDays + 1 : Math.max(0, (nowMs - promotedMs) / (1000 * 60 * 60 * 24));

    if (entry.status === 'active' && promotedAgeDays >= staleKnowledgeDays) {
      entries.push({
        targetKind: 'knowledge',
        targetId: entry.knowledgeId,
        sourceSurface: 'memory-knowledge',
        reasonCode: 'stale-active-knowledge',
        evidenceRefs: [sourcePath, ...entry.sourceCandidateIds.map((id) => `candidate:${id}`), ...entry.sourceEventFingerprints.map((id) => `event:${id}`)].sort((a, b) => a.localeCompare(b)),
        recommendedAction: 'reaffirm',
        reviewPriority: 'high',
        generatedAt
      });
      continue;
    }

    if (entry.status === 'superseded') {
      entries.push({
        targetKind: 'knowledge',
        targetId: entry.knowledgeId,
        sourceSurface: 'memory-knowledge',
        reasonCode: 'superseded-knowledge-lineage-check',
        evidenceRefs: [sourcePath, ...entry.supersededBy.map((id) => `knowledge:${id}`)].sort((a, b) => a.localeCompare(b)),
        recommendedAction: 'supersede',
        reviewPriority: 'medium',
        generatedAt
      });
    }
  }

  for (const { candidateId, sourcePath } of parsePostmortemCandidateEntries(repoRoot)) {
    entries.push({
      targetKind: 'doc',
      path: sourcePath,
      sourceSurface: 'memory-candidates',
      reasonCode: 'postmortem-candidate-context',
      evidenceRefs: [`candidate:${candidateId}`, MEMORY_CANDIDATES_PATH],
      recommendedAction: 'revise',
      reviewPriority: 'medium',
      generatedAt
    });
  }

  for (const relativePath of GOVERNED_DOC_PATHS) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const ageDays = fileAgeDays(fullPath, nowMs);
    if (ageDays < docReviewWindowDays || !isGovernedDoc(relativePath)) {
      continue;
    }

    entries.push({
      targetKind: 'doc',
      path: relativePath,
      sourceSurface: 'governed-docs',
      reasonCode: 'governed-doc-staleness-window',
      evidenceRefs: [relativePath],
      recommendedAction: 'reaffirm',
      reviewPriority: 'low',
      generatedAt
    });
  }

  const postmortemsPath = path.join(repoRoot, 'docs/postmortems');
  if (fs.existsSync(postmortemsPath)) {
    const postmortemDocs = fs
      .readdirSync(postmortemsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => `docs/postmortems/${entry.name}`)
      .filter((relativePath) => isGovernedDoc(relativePath))
      .sort((a, b) => a.localeCompare(b));

    for (const relativePath of postmortemDocs) {
      const fullPath = path.join(repoRoot, relativePath);
      const ageDays = fileAgeDays(fullPath, nowMs);
      if (ageDays < docReviewWindowDays) {
        continue;
      }

      entries.push({
        targetKind: 'doc',
        path: relativePath,
        sourceSurface: 'governed-docs',
        reasonCode: 'governed-doc-staleness-window',
        evidenceRefs: [relativePath],
        recommendedAction: 'reaffirm',
        reviewPriority: 'low',
        generatedAt
      });
    }
  }

  const latestReceipts = latestReceiptByTarget(readKnowledgeReviewReceiptsArtifact(repoRoot).receipts);
  const deduped = dedupeQueueEntries(entries);
  const filtered = deduped.flatMap<ReviewQueueEntry>((entry) => {
    const receipt = latestReceipts.get(reviewTargetKey(entry.targetKind, entry.targetId, entry.path));
    if (!receipt) {
      return [entry];
    }

    if (receipt.decision === 'supersede') {
      return [];
    }

    if (receipt.decision === 'reaffirm') {
      const receiptMs = Date.parse(receipt.decidedAt);
      const suppressUntilMs = receiptMs + reviewWindowDaysForEntry(entry, staleKnowledgeDays, docReviewWindowDays) * 24 * 60 * 60 * 1000;
      if (nowMs < suppressUntilMs) {
        return [];
      }
      return [entry];
    }

    if (receipt.decision === 'revise') {
      if (typeof receipt.followUpArtifactRef === 'string' && receipt.followUpArtifactRef.length > 0) {
        const followUpPath = path.join(repoRoot, receipt.followUpArtifactRef);
        if (fs.existsSync(followUpPath)) {
          return [];
        }
      }
      return [entry];
    }

    const availableAt = safeIso(receipt.availableAt, receipt.decidedAt);
    return [{ ...entry, reviewPriority: 'low' as ReviewPriority, availableAt }];
  });

  return {
    schemaVersion: REVIEW_QUEUE_SCHEMA_VERSION,
    kind: 'playbook-review-queue',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt,
    entries: sortQueueEntries(filtered)
  };
};

export const writeReviewQueueArtifact = (repoRoot: string, artifact: ReviewQueueArtifact): string => {
  const outputPath = path.join(repoRoot, REVIEW_QUEUE_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};
