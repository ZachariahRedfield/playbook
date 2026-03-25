import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { MemoryKnowledgeArtifact, MemoryKnowledgeEntry } from '../memory/knowledge.js';
import type { MemoryCompactionReviewArtifact } from '../memory/compactionReview.js';
import type { MemoryReplayResult } from '../schema/memoryReplay.js';
import type { LifecycleCandidatesArtifact } from '../schema/lifecycleCandidate.js';
import { readKnowledgeReviewReceiptsArtifact, type KnowledgeReviewReceiptEntry } from './reviewReceipts.js';
import { readReviewPolicyArtifact, type ReviewPolicyTargetKind } from './reviewPolicy.js';

export const REVIEW_QUEUE_SCHEMA_VERSION = '1.0' as const;
export const REVIEW_QUEUE_RELATIVE_PATH = '.playbook/review-queue.json' as const;

const KNOWLEDGE_ARTIFACT_PATHS = [
  '.playbook/memory/knowledge/decisions.json',
  '.playbook/memory/knowledge/patterns.json',
  '.playbook/memory/knowledge/failure-modes.json',
  '.playbook/memory/knowledge/invariants.json'
] as const;

const GOVERNED_DOC_PATHS = ['docs/PLAYBOOK_PRODUCT_ROADMAP.md', 'docs/PLAYBOOK_DEV_WORKFLOW.md'] as const;
const GOVERNED_DOC_PREFIXES = ['docs/postmortems/'] as const;
const ARCHITECTURE_DECISIONS_DIR = 'docs/architecture/decisions' as const;
const MEMORY_CANDIDATES_PATH = '.playbook/memory/candidates.json' as const;
const MEMORY_COMPACTION_REVIEW_PATH = '.playbook/memory/compaction-review.json' as const;
const MEMORY_LIFECYCLE_CANDIDATES_PATH = '.playbook/memory/lifecycle-candidates.json' as const;

const TRIGGER_STRENGTH_EVIDENCE_PREFIX = 'trigger-strength:' as const;

export type ReviewRecommendedAction = 'reaffirm' | 'revise' | 'supersede';
export type ReviewPriority = 'high' | 'medium' | 'low';
export type ReviewTargetKind = 'knowledge' | 'doc';
export type ReviewTriggerType = 'cadence' | 'evidence' | 'cadence+evidence';

export type ReviewQueueEntry = {
  queueEntryId: string;
  targetKind: ReviewTargetKind;
  cadenceKind: ReviewPolicyTargetKind;
  targetId?: string;
  path?: string;
  sourceSurface: string;
  reasonCode: string;
  evidenceRefs: string[];
  triggerType: ReviewTriggerType;
  triggerSource: string;
  triggerReasonCode: string;
  triggerEvidenceRefs: string[];
  triggerStrength: number;
  recommendedAction: ReviewRecommendedAction;
  reviewPriority: ReviewPriority;
  nextReviewAt?: string;
  overdue?: boolean;
  deferredUntil?: string;
  generatedAt: string;
};

export type ReviewQueueArtifact = {
  schemaVersion: typeof REVIEW_QUEUE_SCHEMA_VERSION;
  kind: 'playbook-review-queue';
  proposalOnly: true;
  authority: 'read-only';
  generatedAt: string;
  entries: ReviewQueueEntry[];
};

export type BuildReviewQueueOptions = {
  generatedAt?: string;
  staleKnowledgeDays?: number;
  docReviewWindowDays?: number;
  deferWindowDays?: number;
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

const normalizeTriggerStrength = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
};

const priorityWeight: Record<ReviewPriority, number> = { high: 0, medium: 1, low: 2 };

const priorityFromTriggerStrength = (triggerStrength: number): ReviewPriority => {
  if (triggerStrength >= 85) {
    return 'high';
  }
  if (triggerStrength >= 60) {
    return 'medium';
  }
  return 'low';
};

const toTriggerStrengthEvidence = (triggerStrength: number): string =>
  `${TRIGGER_STRENGTH_EVIDENCE_PREFIX}${normalizeTriggerStrength(triggerStrength)}`;

const parseTriggerStrengthEvidence = (evidenceRefs: string[]): number | null => {
  const strengths = evidenceRefs
    .filter((value) => value.startsWith(TRIGGER_STRENGTH_EVIDENCE_PREFIX))
    .map((value) => Number.parseInt(value.slice(TRIGGER_STRENGTH_EVIDENCE_PREFIX.length), 10))
    .filter((value) => Number.isInteger(value))
    .map((value) => normalizeTriggerStrength(value));
  if (strengths.length === 0) {
    return null;
  }
  return Math.max(...strengths);
};

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

const parseCompactionReviewArtifact = (repoRoot: string): Partial<MemoryCompactionReviewArtifact> | null => {
  const reviewPath = path.join(repoRoot, MEMORY_COMPACTION_REVIEW_PATH);
  if (!fs.existsSync(reviewPath)) {
    return null;
  }
  return readJsonFile<Partial<MemoryCompactionReviewArtifact>>(reviewPath);
};

const parseLifecycleCandidatesArtifact = (repoRoot: string): Partial<LifecycleCandidatesArtifact> | null => {
  const candidatesPath = path.join(repoRoot, MEMORY_LIFECYCLE_CANDIDATES_PATH);
  if (!fs.existsSync(candidatesPath)) {
    return null;
  }
  return readJsonFile<Partial<LifecycleCandidatesArtifact>>(candidatesPath);
};

type ArchitectureDecisionTriggerMetadata = {
  reasonCode: string;
  signalPath: string;
  evidenceRefs: string[];
  strength?: number;
};

const REVIEW_TRIGGER_METADATA_BLOCK_PATTERN =
  /##\s+Review Triggers[\s\S]*?```json\s*([\s\S]*?)```/im;

const asArchitectureDecisionTrigger = (value: unknown): ArchitectureDecisionTriggerMetadata | null => {
  if (!isRecord(value) || typeof value.reasonCode !== 'string' || typeof value.signalPath !== 'string') {
    return null;
  }

  const reasonCode = value.reasonCode.trim();
  const signalPath = value.signalPath.trim();
  if (reasonCode.length === 0 || signalPath.length === 0) {
    return null;
  }

  const evidenceRefs = Array.isArray(value.evidenceRefs)
    ? value.evidenceRefs
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

  const strength = typeof value.strength === 'number' ? value.strength : undefined;
  return {
    reasonCode,
    signalPath,
    evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : [signalPath],
    strength
  };
};

const parseArchitectureDecisionTriggers = (
  repoRoot: string
): Array<{ decisionPath: string; trigger: ArchitectureDecisionTriggerMetadata }> => {
  const decisionsDir = path.join(repoRoot, ARCHITECTURE_DECISIONS_DIR);
  if (!fs.existsSync(decisionsDir)) {
    return [];
  }

  const decisionDocs = fs
    .readdirSync(decisionsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => `${ARCHITECTURE_DECISIONS_DIR}/${entry.name}`)
    .sort((a, b) => a.localeCompare(b));

  const collected: Array<{ decisionPath: string; trigger: ArchitectureDecisionTriggerMetadata }> = [];
  for (const decisionPath of decisionDocs) {
    const fullPath = path.join(repoRoot, decisionPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const metadataMatch = content.match(REVIEW_TRIGGER_METADATA_BLOCK_PATTERN);
    if (!metadataMatch || typeof metadataMatch[1] !== 'string') {
      continue;
    }

    let parsedMetadata: unknown;
    try {
      parsedMetadata = JSON.parse(metadataMatch[1]);
    } catch {
      continue;
    }

    const metadataEntries = Array.isArray(parsedMetadata) ? parsedMetadata : [];
    for (const metadataEntry of metadataEntries) {
      const trigger = asArchitectureDecisionTrigger(metadataEntry);
      if (!trigger) {
        continue;
      }
      collected.push({ decisionPath, trigger });
    }
  }

  return collected;
};

const sortQueueEntries = (entries: ReviewQueueEntry[]): ReviewQueueEntry[] =>
  [...entries].sort((left, right) =>
    priorityWeight[left.reviewPriority] - priorityWeight[right.reviewPriority] ||
    right.triggerStrength - left.triggerStrength ||
    left.queueEntryId.localeCompare(right.queueEntryId) ||
    left.targetKind.localeCompare(right.targetKind) ||
    (left.targetId ?? left.path ?? '').localeCompare(right.targetId ?? right.path ?? '') ||
    left.reasonCode.localeCompare(right.reasonCode) ||
    left.sourceSurface.localeCompare(right.sourceSurface) ||
    left.recommendedAction.localeCompare(right.recommendedAction) ||
    left.evidenceRefs.join('|').localeCompare(right.evidenceRefs.join('|'))
  );

const buildQueueEntryId = (entry: Omit<ReviewQueueEntry, 'queueEntryId' | 'generatedAt'>): string =>
  createHash('sha256')
    .update(
      [
        entry.targetKind,
        entry.cadenceKind,
        entry.targetId ?? '',
        entry.path ?? '',
        entry.sourceSurface,
        entry.reasonCode,
        entry.triggerType,
        entry.triggerSource,
        entry.triggerReasonCode,
        String(entry.triggerStrength),
        entry.recommendedAction,
        entry.reviewPriority,
        [...entry.evidenceRefs].sort((left, right) => left.localeCompare(right)).join('|')
      ].join('|')
    )
    .digest('hex')
    .slice(0, 16);

const withQueueEntryId = (entry: Omit<ReviewQueueEntry, 'queueEntryId'>): ReviewQueueEntry => ({
  ...entry,
  queueEntryId: buildQueueEntryId(entry)
});

const dedupeQueueEntries = (entries: ReviewQueueEntry[]): ReviewQueueEntry[] => {
  const byKey = new Map<string, ReviewQueueEntry>();

  for (const entry of entries) {
    const entryKey = [
      entry.targetKind,
      entry.cadenceKind,
      entry.targetId ?? '',
      entry.path ?? '',
      entry.sourceSurface,
      entry.reasonCode,
      entry.triggerType,
      entry.triggerSource,
      entry.triggerReasonCode,
      String(entry.triggerStrength),
      entry.recommendedAction,
      entry.reviewPriority
    ].join('|');

    const existing = byKey.get(entryKey);
    if (!existing) {
      byKey.set(entryKey, {
        ...entry,
        evidenceRefs: [...entry.evidenceRefs].sort((a, b) => a.localeCompare(b)),
        triggerEvidenceRefs: [...entry.triggerEvidenceRefs].sort((a, b) => a.localeCompare(b))
      });
      continue;
    }

    const mergedEvidence = [...existing.evidenceRefs, ...entry.evidenceRefs]
      .filter((value, index, all) => all.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));

    const mergedTriggerEvidence = [...existing.triggerEvidenceRefs, ...entry.triggerEvidenceRefs]
      .filter((value, index, all) => all.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));

    byKey.set(entryKey, { ...existing, evidenceRefs: mergedEvidence, triggerEvidenceRefs: mergedTriggerEvidence });
  }

  return [...byKey.values()];
};

const buildTargetKey = (entry: Pick<ReviewQueueEntry, 'targetKind' | 'targetId' | 'path'>): string =>
  [entry.targetKind, entry.targetId ?? '', entry.path ?? ''].join('|');

const resolveLatestReceipts = (receipts: KnowledgeReviewReceiptEntry[]): {
  byQueueEntryId: Map<string, KnowledgeReviewReceiptEntry>;
  byTarget: Map<string, KnowledgeReviewReceiptEntry>;
} => {
  const byQueueEntryId = new Map<string, KnowledgeReviewReceiptEntry>();
  const byTarget = new Map<string, KnowledgeReviewReceiptEntry>();

  for (const receipt of receipts) {
    const receiptTime = Date.parse(receipt.decidedAt);

    const currentByQueue = byQueueEntryId.get(receipt.queueEntryId);
    if (!currentByQueue || Date.parse(currentByQueue.decidedAt) <= receiptTime) {
      byQueueEntryId.set(receipt.queueEntryId, receipt);
    }

    const targetKey = buildTargetKey(receipt);
    const currentByTarget = byTarget.get(targetKey);
    if (!currentByTarget || Date.parse(currentByTarget.decidedAt) <= receiptTime) {
      byTarget.set(targetKey, receipt);
    }
  }

  return { byQueueEntryId, byTarget };
};

const addDays = (dateMs: number, days: number): number => dateMs + days * 24 * 60 * 60 * 1000;

const asIsoIfValid = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
};

const asOverdue = (nowMs: number, nextReviewAt: string): boolean => {
  const nextMs = Date.parse(nextReviewAt);
  return !Number.isNaN(nextMs) && nowMs > nextMs;
};

const applyReceiptState = (
  repoRoot: string,
  entries: ReviewQueueEntry[],
  nowMs: number,
  cadenceByKind: Record<ReviewPolicyTargetKind, { reaffirmCadenceDays: number; deferWindowDays: number }>
): ReviewQueueEntry[] => {
  const receiptArtifact = readKnowledgeReviewReceiptsArtifact(repoRoot);
  const { byQueueEntryId, byTarget } = resolveLatestReceipts(receiptArtifact.receipts);

  const transformed: ReviewQueueEntry[] = [];

  for (const entry of entries) {
    const latestReceipt = byQueueEntryId.get(entry.queueEntryId) ?? byTarget.get(buildTargetKey(entry));
    if (!latestReceipt) {
      transformed.push(entry);
      continue;
    }

    const receiptMs = Date.parse(latestReceipt.decidedAt);
    const cadence = cadenceByKind[entry.cadenceKind];

    if (latestReceipt.decision === 'reaffirm') {
      const priorStrength = parseTriggerStrengthEvidence(latestReceipt.evidenceRefs);
      const strongerEvidence = priorStrength !== null && entry.triggerStrength > priorStrength;
      if (strongerEvidence) {
        transformed.push(entry);
        continue;
      }

      const nextReviewMs = addDays(receiptMs, cadence.reaffirmCadenceDays);
      if (nowMs < nextReviewMs) {
        continue;
      }
      const nextReviewAt = new Date(nextReviewMs).toISOString();
      transformed.push({ ...entry, nextReviewAt, overdue: asOverdue(nowMs, nextReviewAt) });
      continue;
    }

    if (latestReceipt.decision === 'defer') {
      const priorStrength = parseTriggerStrengthEvidence(latestReceipt.evidenceRefs);
      const strongerEvidence = priorStrength !== null && entry.triggerStrength > priorStrength;
      if (strongerEvidence) {
        transformed.push(entry);
        continue;
      }

      const explicitDeferredUntil = asIsoIfValid(latestReceipt.deferUntil);
      const nextReviewMs = explicitDeferredUntil ? Date.parse(explicitDeferredUntil) : addDays(receiptMs, cadence.deferWindowDays);
      if (nowMs < nextReviewMs) {
        continue;
      }
      const deferredUntil = new Date(nextReviewMs).toISOString();
      transformed.push({
        ...entry,
        deferredUntil,
        nextReviewAt: deferredUntil,
        overdue: asOverdue(nowMs, deferredUntil),
        evidenceRefs: [...entry.evidenceRefs, `review-receipt:${latestReceipt.receiptId}`]
          .filter((value, index, all) => all.indexOf(value) === index)
          .sort((left, right) => left.localeCompare(right))
      });
      continue;
    }

    if (latestReceipt.decision === 'supersede') {
      continue;
    }

    if (latestReceipt.decision === 'revise') {
      if (latestReceipt.followUpArtifactPath) {
        const followUpPath = path.join(repoRoot, latestReceipt.followUpArtifactPath);
        if (fs.existsSync(followUpPath)) {
          continue;
        }
      }

      transformed.push({
        ...entry,
        nextReviewAt: latestReceipt.decidedAt,
        overdue: true,
        evidenceRefs: [...entry.evidenceRefs, `review-receipt:${latestReceipt.receiptId}`]
          .filter((value, index, all) => all.indexOf(value) === index)
          .sort((left, right) => left.localeCompare(right))
      });
      continue;
    }

    transformed.push(entry);
  }

  return transformed;
};

export const buildReviewQueue = (repoRoot: string, options: BuildReviewQueueOptions = {}): ReviewQueueArtifact => {
  const generatedAt = safeIso(options.generatedAt, new Date().toISOString());
  const nowMs = Date.parse(generatedAt);
  const policy = readReviewPolicyArtifact(repoRoot);
  const cadenceByKind: Record<ReviewPolicyTargetKind, { reaffirmCadenceDays: number; deferWindowDays: number }> = {
    knowledge: {
      reaffirmCadenceDays: options.staleKnowledgeDays ?? policy.targetDefaults.knowledge.reaffirmCadenceDays,
      deferWindowDays: options.deferWindowDays ?? policy.targetDefaults.knowledge.deferWindowDays
    },
    pattern: {
      reaffirmCadenceDays: options.staleKnowledgeDays ?? policy.targetDefaults.pattern.reaffirmCadenceDays,
      deferWindowDays: options.deferWindowDays ?? policy.targetDefaults.pattern.deferWindowDays
    },
    rule: {
      reaffirmCadenceDays: options.staleKnowledgeDays ?? policy.targetDefaults.rule.reaffirmCadenceDays,
      deferWindowDays: options.deferWindowDays ?? policy.targetDefaults.rule.deferWindowDays
    },
    doc: {
      reaffirmCadenceDays: options.docReviewWindowDays ?? policy.targetDefaults.doc.reaffirmCadenceDays,
      deferWindowDays: options.deferWindowDays ?? policy.targetDefaults.doc.deferWindowDays
    }
  };

  const lifecycleCandidates = parseLifecycleCandidatesArtifact(repoRoot);
  const lifecycleByTarget = new Map<string, number>();
  if (Array.isArray(lifecycleCandidates?.candidates)) {
    for (const candidate of lifecycleCandidates.candidates) {
      if (!isRecord(candidate) || typeof candidate.target_pattern_id !== 'string') {
        continue;
      }
      const confidence = typeof candidate.confidence === 'number' ? candidate.confidence : 0;
      const score = normalizeTriggerStrength(confidence * 100);
      const current = lifecycleByTarget.get(candidate.target_pattern_id) ?? 0;
      lifecycleByTarget.set(candidate.target_pattern_id, Math.max(current, score));
    }
  }

  const entries: ReviewQueueEntry[] = [];

  for (const { entry, sourcePath } of parseKnowledgeEntries(repoRoot)) {
    const cadenceKind: ReviewPolicyTargetKind = entry.kind === 'pattern' ? 'pattern' : 'knowledge';
    const staleKnowledgeDays = cadenceByKind[cadenceKind].reaffirmCadenceDays;
    const promotedMs = Date.parse(entry.promotedAt);
    const promotedAgeDays = Number.isNaN(promotedMs) ? staleKnowledgeDays + 1 : Math.max(0, (nowMs - promotedMs) / (1000 * 60 * 60 * 24));

    if (entry.status === 'active' && promotedAgeDays >= staleKnowledgeDays) {
      const lifecycleStrength = lifecycleByTarget.get(entry.knowledgeId) ?? 0;
      const triggerStrength = Math.max(55, lifecycleStrength);
      const triggerEvidenceRefs = [
        sourcePath,
        ...(lifecycleStrength > 0 ? [MEMORY_LIFECYCLE_CANDIDATES_PATH] : []),
        ...entry.sourceCandidateIds.map((id) => `candidate:${id}`),
        ...entry.sourceEventFingerprints.map((id) => `event:${id}`)
      ].sort((a, b) => a.localeCompare(b));

      entries.push(withQueueEntryId({
        targetKind: 'knowledge',
        cadenceKind,
        targetId: entry.knowledgeId,
        sourceSurface: 'memory-knowledge',
        reasonCode: 'stale-active-knowledge',
        evidenceRefs: [...triggerEvidenceRefs, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
        triggerType: lifecycleStrength > 0 ? 'cadence+evidence' : 'cadence',
        triggerSource: lifecycleStrength > 0 ? 'memory-lifecycle-candidates' : 'memory-knowledge-cadence',
        triggerReasonCode: lifecycleStrength > 0 ? 'cadence-with-lifecycle-evidence' : 'cadence-window-due',
        triggerEvidenceRefs,
        triggerStrength,
        recommendedAction: 'reaffirm',
        reviewPriority: lifecycleStrength > 0 ? priorityFromTriggerStrength(triggerStrength) : 'high',
        generatedAt
      }));
      continue;
    }

    if (entry.status === 'superseded') {
      const triggerStrength = 90;
      const triggerEvidenceRefs = [sourcePath, ...entry.supersededBy.map((id) => `knowledge:${id}`)].sort((a, b) => a.localeCompare(b));
      entries.push(withQueueEntryId({
        targetKind: 'knowledge',
        cadenceKind,
        targetId: entry.knowledgeId,
        sourceSurface: 'memory-knowledge',
        reasonCode: 'superseded-knowledge-lineage-check',
        evidenceRefs: [...triggerEvidenceRefs, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
        triggerType: 'evidence',
        triggerSource: 'memory-knowledge',
        triggerReasonCode: 'knowledge-supersession-state',
        triggerEvidenceRefs,
        triggerStrength,
        recommendedAction: 'supersede',
        reviewPriority: priorityFromTriggerStrength(triggerStrength),
        generatedAt
      }));
    }
  }

  for (const { candidateId, sourcePath } of parsePostmortemCandidateEntries(repoRoot)) {
    const triggerStrength = 78;
    const triggerEvidenceRefs = [`candidate:${candidateId}`, MEMORY_CANDIDATES_PATH].sort((a, b) => a.localeCompare(b));
    entries.push(withQueueEntryId({
      targetKind: 'doc',
      cadenceKind: 'doc',
      path: sourcePath,
      sourceSurface: 'memory-candidates',
      reasonCode: 'postmortem-candidate-context',
      evidenceRefs: [...triggerEvidenceRefs, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
      triggerType: 'evidence',
      triggerSource: 'memory-candidates',
      triggerReasonCode: 'postmortem-promotion-candidate',
      triggerEvidenceRefs,
      triggerStrength,
      recommendedAction: 'revise',
      reviewPriority: priorityFromTriggerStrength(triggerStrength),
      generatedAt
    }));
  }

  const compactionReview = parseCompactionReviewArtifact(repoRoot);
  if (Array.isArray(compactionReview?.entries)) {
    for (const reviewEntry of compactionReview.entries) {
      if (!isRecord(reviewEntry) || !isRecord(reviewEntry.promotion) || !Array.isArray(reviewEntry.promotion.matchedKnowledgeIds)) {
        continue;
      }

      for (const knowledgeId of reviewEntry.promotion.matchedKnowledgeIds) {
        if (typeof knowledgeId !== 'string' || knowledgeId.length === 0) {
          continue;
        }
        const triggerStrength = 82;
        const triggerEvidenceRefs = [MEMORY_COMPACTION_REVIEW_PATH, `compaction-review:${String(reviewEntry.reviewId ?? 'unknown')}`]
          .sort((a, b) => a.localeCompare(b));
        entries.push(withQueueEntryId({
          targetKind: 'knowledge',
          cadenceKind: 'knowledge',
          targetId: knowledgeId,
          sourceSurface: 'memory-compaction-review',
          reasonCode: 'compaction-review-evidence',
          evidenceRefs: [...triggerEvidenceRefs, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
          triggerType: 'evidence',
          triggerSource: 'memory-compaction-review',
          triggerReasonCode: 'compaction-knowledge-match',
          triggerEvidenceRefs,
          triggerStrength,
          recommendedAction: 'revise',
          reviewPriority: priorityFromTriggerStrength(triggerStrength),
          generatedAt
        }));
      }
    }
  }

  if (Array.isArray(lifecycleCandidates?.candidates)) {
    for (const candidate of lifecycleCandidates.candidates) {
      if (!isRecord(candidate) || typeof candidate.target_pattern_id !== 'string' || candidate.target_pattern_id.length === 0) {
        continue;
      }
      const confidence = typeof candidate.confidence === 'number' ? candidate.confidence : 0;
      const triggerStrength = normalizeTriggerStrength(confidence * 100);
      if (triggerStrength < 60) {
        continue;
      }
      const triggerEvidenceRefs = [
        MEMORY_LIFECYCLE_CANDIDATES_PATH,
        `lifecycle:${typeof candidate.recommendation_id === 'string' ? candidate.recommendation_id : candidate.target_pattern_id}`
      ].sort((a, b) => a.localeCompare(b));
      entries.push(withQueueEntryId({
        targetKind: 'knowledge',
        cadenceKind: 'pattern',
        targetId: candidate.target_pattern_id,
        sourceSurface: 'memory-lifecycle-candidates',
        reasonCode: 'lifecycle-fresh-evidence',
        evidenceRefs: [...triggerEvidenceRefs, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
        triggerType: 'evidence',
        triggerSource: 'memory-lifecycle-candidates',
        triggerReasonCode: 'pattern-lifecycle-candidate',
        triggerEvidenceRefs,
        triggerStrength,
        recommendedAction: 'revise',
        reviewPriority: priorityFromTriggerStrength(triggerStrength),
        generatedAt
      }));
    }
  }

  for (const { decisionPath, trigger } of parseArchitectureDecisionTriggers(repoRoot)) {
    const signalPath = path.join(repoRoot, trigger.signalPath);
    if (!fs.existsSync(signalPath)) {
      continue;
    }

    const triggerStrength = normalizeTriggerStrength(trigger.strength ?? 72);
    const triggerEvidenceRefs = [trigger.signalPath, ...trigger.evidenceRefs]
      .filter((value, index, all) => all.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));

    entries.push(withQueueEntryId({
      targetKind: 'doc',
      cadenceKind: 'doc',
      path: decisionPath,
      sourceSurface: 'architecture-decisions',
      reasonCode: 'architecture-decision-review-trigger',
      evidenceRefs: [...triggerEvidenceRefs, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
      triggerType: 'evidence',
      triggerSource: 'architecture-decision',
      triggerReasonCode: trigger.reasonCode,
      triggerEvidenceRefs,
      triggerStrength,
      recommendedAction: 'reaffirm',
      reviewPriority: priorityFromTriggerStrength(triggerStrength),
      generatedAt
    }));
  }

  for (const relativePath of GOVERNED_DOC_PATHS) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const docReviewWindowDays = cadenceByKind.doc.reaffirmCadenceDays;
    const ageDays = fileAgeDays(fullPath, nowMs);
    if (ageDays < docReviewWindowDays || !isGovernedDoc(relativePath)) {
      continue;
    }

    const triggerStrength = 35;
    entries.push(withQueueEntryId({
      targetKind: 'doc',
      cadenceKind: 'doc',
      path: relativePath,
      sourceSurface: 'governed-docs',
      reasonCode: 'governed-doc-staleness-window',
      evidenceRefs: [relativePath, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
      triggerType: 'cadence',
      triggerSource: 'governed-docs',
      triggerReasonCode: 'cadence-window-due',
      triggerEvidenceRefs: [relativePath],
      triggerStrength,
      recommendedAction: 'reaffirm',
      reviewPriority: 'low',
      generatedAt
    }));
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
      const docReviewWindowDays = cadenceByKind.doc.reaffirmCadenceDays;
      const fullPath = path.join(repoRoot, relativePath);
      const ageDays = fileAgeDays(fullPath, nowMs);
      if (ageDays < docReviewWindowDays) {
        continue;
      }

      const triggerStrength = 35;
      entries.push(withQueueEntryId({
        targetKind: 'doc',
        cadenceKind: 'doc',
        path: relativePath,
        sourceSurface: 'governed-docs',
        reasonCode: 'governed-doc-staleness-window',
        evidenceRefs: [relativePath, toTriggerStrengthEvidence(triggerStrength)].sort((a, b) => a.localeCompare(b)),
        triggerType: 'cadence',
        triggerSource: 'governed-docs',
        triggerReasonCode: 'cadence-window-due',
        triggerEvidenceRefs: [relativePath],
        triggerStrength,
        recommendedAction: 'reaffirm',
        reviewPriority: 'low',
        generatedAt
      }));
    }
  }

  const receiptAppliedEntries = applyReceiptState(repoRoot, entries, nowMs, cadenceByKind);

  return {
    schemaVersion: REVIEW_QUEUE_SCHEMA_VERSION,
    kind: 'playbook-review-queue',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt,
    entries: sortQueueEntries(dedupeQueueEntries(receiptAppliedEntries))
  };
};

export const writeReviewQueueArtifact = (repoRoot: string, artifact: ReviewQueueArtifact): string => {
  const outputPath = path.join(repoRoot, REVIEW_QUEUE_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};
