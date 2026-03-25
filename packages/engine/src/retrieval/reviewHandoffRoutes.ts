import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { REVIEW_HANDOFFS_RELATIVE_PATH, type ReviewHandoffDecision, type ReviewHandoffEntry, type ReviewHandoffsArtifact } from './reviewHandoffs.js';
import { KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH, type KnowledgeReviewReceiptEntry } from './reviewReceipts.js';
import { REVIEW_QUEUE_RELATIVE_PATH, type ReviewQueueEntry } from './reviewQueue.js';

export const REVIEW_HANDOFF_ROUTES_SCHEMA_VERSION = '1.0' as const;
export const REVIEW_HANDOFF_ROUTES_RELATIVE_PATH = '.playbook/review-handoff-routes.json' as const;

export type ReviewHandoffRouteTargetKind = ReviewHandoffEntry['targetKind'] | 'pattern' | 'rule';
export type ReviewHandoffRouteSurface = 'story' | 'promote' | 'docs' | 'memory';

export type ReviewHandoffRouteEntry = {
  routeId: string;
  handoffId: string;
  targetKind: ReviewHandoffRouteTargetKind;
  targetId?: string;
  path?: string;
  recommendedSurface: ReviewHandoffRouteSurface;
  recommendedArtifact: string;
  reasonCode: string;
  evidenceRefs: string[];
  nextActionText: string;
};

export type ReviewHandoffRoutesArtifact = {
  schemaVersion: typeof REVIEW_HANDOFF_ROUTES_SCHEMA_VERSION;
  kind: 'playbook-review-handoff-routes';
  proposalOnly: true;
  authority: 'read-only';
  generatedAt: string;
  routes: ReviewHandoffRouteEntry[];
};

const EMPTY_HANDOFFS: ReviewHandoffsArtifact = {
  schemaVersion: '1.0',
  kind: 'playbook-review-handoffs',
  proposalOnly: true,
  authority: 'read-only',
  generatedAt: new Date(0).toISOString(),
  handoffs: [],
  deferred: []
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

const readHandoffsArtifact = (repoRoot: string): ReviewHandoffsArtifact => {
  const fullPath = path.join(repoRoot, REVIEW_HANDOFFS_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    return EMPTY_HANDOFFS;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.handoffs)) {
      return EMPTY_HANDOFFS;
    }
    return {
      ...EMPTY_HANDOFFS,
      generatedAt: asIso(typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined, EMPTY_HANDOFFS.generatedAt),
      handoffs: parsed.handoffs.filter(
        (entry): entry is ReviewHandoffEntry => isRecord(entry) && typeof entry.handoffId === 'string' && entry.handoffId.length > 0
      )
    };
  } catch {
    return EMPTY_HANDOFFS;
  }
};

const readQueueEntries = (repoRoot: string): Map<string, ReviewQueueEntry> => {
  const fullPath = path.join(repoRoot, REVIEW_QUEUE_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.entries)) {
      return new Map();
    }
    const entries = parsed.entries.filter(
      (entry): entry is ReviewQueueEntry => isRecord(entry) && typeof entry.queueEntryId === 'string' && entry.queueEntryId.length > 0
    );
    return new Map(entries.map((entry) => [entry.queueEntryId, entry]));
  } catch {
    return new Map();
  }
};

const readReceiptEntries = (repoRoot: string): Map<string, KnowledgeReviewReceiptEntry> => {
  const fullPath = path.join(repoRoot, KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.receipts)) {
      return new Map();
    }
    const receipts = parsed.receipts.filter(
      (entry): entry is KnowledgeReviewReceiptEntry => isRecord(entry) && typeof entry.receiptId === 'string' && entry.receiptId.length > 0
    );
    return new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  } catch {
    return new Map();
  }
};

const buildTargetRef = (targetKind: ReviewHandoffRouteTargetKind, targetId?: string, targetPath?: string): string => {
  if (targetId) {
    return `${targetKind}:${targetId}`;
  }
  return `path:${targetPath ?? ''}`;
};

const hasOperationalGapSignal = (values: readonly string[]): boolean =>
  values.some((value) => /(operational[-_]gap|backlog|story[-_]seed)/i.test(value));

const routeRevisionKnowledgeSurface = (evidenceRefs: string[], sourceSurface: string): ReviewHandoffRouteSurface => {
  if (sourceSurface.includes('memory') || evidenceRefs.some((value) => value.startsWith('event:'))) {
    return 'memory';
  }
  return 'promote';
};

type ResolvedRoutePlan = {
  recommendedSurface: ReviewHandoffRouteSurface;
  recommendedArtifact: string;
  reasonCode: string;
  nextActionText: string;
};

const resolveRoutePlan = (
  decision: ReviewHandoffDecision,
  targetKind: ReviewHandoffRouteTargetKind,
  targetRef: string,
  queueEntry: ReviewQueueEntry | undefined,
  receipt: KnowledgeReviewReceiptEntry | undefined,
  targetPath: string | undefined,
  evidenceRefs: string[]
): ResolvedRoutePlan | null => {
  const metadataSignals = [queueEntry?.reasonCode, queueEntry?.sourceSurface, receipt?.reasonCode, receipt?.sourceSurface, ...evidenceRefs].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  if (decision === 'revise' && hasOperationalGapSignal(metadataSignals)) {
    return {
      recommendedSurface: 'story',
      recommendedArtifact: '.playbook/stories.json',
      reasonCode: 'story-seed-operational-gap',
      nextActionText: `Seed a story follow-up for ${targetRef} so the operational/backlog gap is tracked through governed story planning.`
    };
  }

  if (decision === 'revise' && targetKind === 'doc') {
    return {
      recommendedSurface: 'docs',
      recommendedArtifact: targetPath ?? 'docs/',
      reasonCode: 'docs-revision-follow-up',
      nextActionText: `Record a docs revision follow-up for ${targetRef} in the governed docs workflow.`
    };
  }

  if (decision === 'revise' && (targetKind === 'knowledge' || targetKind === 'pattern' || targetKind === 'rule')) {
    const recommendedSurface = routeRevisionKnowledgeSurface(evidenceRefs, queueEntry?.sourceSurface ?? receipt?.sourceSurface ?? '');
    return {
      recommendedSurface,
      recommendedArtifact:
        recommendedSurface === 'promote'
          ? '.playbook/pattern-candidates.json'
          : '.playbook/memory/candidates.json',
      reasonCode: recommendedSurface === 'promote' ? 'promote-revision-follow-up' : 'memory-revision-follow-up',
      nextActionText:
        recommendedSurface === 'promote'
          ? `Prepare a promote follow-up candidate for ${targetRef} before any governed promotion action.`
          : `Capture a memory follow-up for ${targetRef} so revise work is explicit before any promotion.`
    };
  }

  if (decision === 'supersede' && (targetKind === 'knowledge' || targetKind === 'pattern' || targetKind === 'rule')) {
    return {
      recommendedSurface: 'promote',
      recommendedArtifact: '.playbook/memory/knowledge/superseded.json',
      reasonCode: 'supersession-follow-up',
      nextActionText: `Record an explicit supersession follow-up for ${targetRef} through governed promotion/supersede flows.`
    };
  }

  return null;
};

const buildRouteId = (handoffId: string, routePlan: ResolvedRoutePlan): string =>
  createHash('sha256')
    .update([handoffId, routePlan.recommendedSurface, routePlan.reasonCode, routePlan.recommendedArtifact].join('|'))
    .digest('hex')
    .slice(0, 16);

const sortRoutes = (routes: ReviewHandoffRouteEntry[]): ReviewHandoffRouteEntry[] =>
  [...routes].sort((left, right) =>
    left.handoffId.localeCompare(right.handoffId) ||
    left.recommendedSurface.localeCompare(right.recommendedSurface) ||
    left.reasonCode.localeCompare(right.reasonCode) ||
    left.routeId.localeCompare(right.routeId)
  );

export const buildReviewHandoffRoutesArtifact = (
  repoRoot: string,
  generatedAt: string = new Date().toISOString()
): ReviewHandoffRoutesArtifact => {
  const handoffsArtifact = readHandoffsArtifact(repoRoot);
  const queueByEntryId = readQueueEntries(repoRoot);
  const receiptsById = readReceiptEntries(repoRoot);
  const routes: ReviewHandoffRouteEntry[] = [];

  for (const handoff of handoffsArtifact.handoffs) {
    const queueEntry = queueByEntryId.get(handoff.queueEntryId);
    const receipt = receiptsById.get(handoff.receiptId);
    const targetId = handoff.targetId ?? queueEntry?.targetId ?? receipt?.targetId;
    const targetPath = handoff.path ?? queueEntry?.path ?? receipt?.path;

    if (!targetId && !targetPath) {
      continue;
    }

    const targetRef = buildTargetRef(handoff.targetKind, targetId, targetPath);
    const evidenceRefs = ensureUniqueSortedStrings([
      ...handoff.evidenceRefs,
      ...(queueEntry?.evidenceRefs ?? []),
      ...(receipt?.evidenceRefs ?? []),
      `review-handoff:${handoff.handoffId}`
    ]);

    const routePlan = resolveRoutePlan(handoff.decision, handoff.targetKind, targetRef, queueEntry, receipt, targetPath, evidenceRefs);
    if (!routePlan) {
      continue;
    }

    routes.push({
      routeId: buildRouteId(handoff.handoffId, routePlan),
      handoffId: handoff.handoffId,
      targetKind: handoff.targetKind,
      ...(targetId ? { targetId } : {}),
      ...(targetPath ? { path: targetPath } : {}),
      recommendedSurface: routePlan.recommendedSurface,
      recommendedArtifact: routePlan.recommendedArtifact,
      reasonCode: routePlan.reasonCode,
      evidenceRefs,
      nextActionText: routePlan.nextActionText
    });
  }

  return {
    schemaVersion: REVIEW_HANDOFF_ROUTES_SCHEMA_VERSION,
    kind: 'playbook-review-handoff-routes',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt: asIso(generatedAt, new Date().toISOString()),
    routes: sortRoutes(routes)
  };
};

export const writeReviewHandoffRoutesArtifact = (repoRoot: string, artifact: ReviewHandoffRoutesArtifact): string => {
  const outputPath = path.join(repoRoot, REVIEW_HANDOFF_ROUTES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};
