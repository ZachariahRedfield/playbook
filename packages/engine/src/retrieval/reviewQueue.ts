import fs from 'node:fs';
import path from 'node:path';
import type { MemoryKnowledgeArtifact, MemoryKnowledgeEntry } from '../memory/knowledge.js';
import type { MemoryReplayResult } from '../schema/memoryReplay.js';

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
const MEMORY_CANDIDATES_PATH = '.playbook/memory/candidates.json' as const;

export type ReviewRecommendedAction = 'reaffirm' | 'revise' | 'supersede';
export type ReviewPriority = 'high' | 'medium' | 'low';
export type ReviewTargetKind = 'knowledge' | 'doc';

export type ReviewQueueEntry = {
  targetKind: ReviewTargetKind;
  targetId?: string;
  path?: string;
  sourceSurface: string;
  reasonCode: string;
  evidenceRefs: string[];
  recommendedAction: ReviewRecommendedAction;
  reviewPriority: ReviewPriority;
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
    left.sourceSurface.localeCompare(right.sourceSurface)
  );

export const buildReviewQueue = (repoRoot: string, options: BuildReviewQueueOptions = {}): ReviewQueueArtifact => {
  const generatedAt = safeIso(options.generatedAt, new Date().toISOString());
  const nowMs = Date.parse(generatedAt);
  const staleKnowledgeDays = options.staleKnowledgeDays ?? 45;
  const docReviewWindowDays = options.docReviewWindowDays ?? 90;

  const entries: ReviewQueueEntry[] = [];

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

  return {
    schemaVersion: REVIEW_QUEUE_SCHEMA_VERSION,
    kind: 'playbook-review-queue',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt,
    entries: sortQueueEntries(entries)
  };
};

export const writeReviewQueueArtifact = (repoRoot: string, artifact: ReviewQueueArtifact): string => {
  const outputPath = path.join(repoRoot, REVIEW_QUEUE_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};
