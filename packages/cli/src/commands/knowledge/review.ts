import fs from 'node:fs';
import path from 'node:path';
import {
  KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH,
  REVIEW_HANDOFF_ROUTES_RELATIVE_PATH,
  REVIEW_HANDOFFS_RELATIVE_PATH,
  REVIEW_QUEUE_RELATIVE_PATH,
  buildReviewHandoffRoutesArtifact,
  buildReviewQueue,
  buildReviewHandoffsArtifact,
  writeReviewHandoffRoutesArtifact,
  writeKnowledgeReviewReceipt,
  writeReviewHandoffsArtifact,
  writeReviewQueueArtifact,
  type KnowledgeReviewDecision,
  type ReviewHandoffDecision,
  type ReviewHandoffEntry,
  type ReviewHandoffsArtifact,
  type ReviewHandoffRouteEntry,
  type ReviewHandoffRoutesArtifact,
  type KnowledgeReviewReceiptEntry,
  type ReviewQueueArtifact,
  type ReviewQueueEntry
} from '@zachariahredfield/playbook-engine';
import { readOptionValue, readOptionValues, resolveSubcommandArgument } from './shared.js';

type ReviewAction = 'reaffirm' | 'revise' | 'supersede';
type ReviewKind = 'knowledge' | 'doc' | 'rule' | 'pattern';
type ReviewDecision = KnowledgeReviewDecision;
type RecordableReviewKind = 'knowledge' | 'doc';
type DueFilter = 'now' | 'overdue' | 'all';
type TriggerFilter = 'cadence' | 'evidence' | 'all';
type HandoffDecisionFilter = ReviewHandoffDecision;
type RouteSurfaceFilter = ReviewHandoffRouteEntry['recommendedSurface'];

type KnowledgeReviewListPayload = {
  schemaVersion: '1.0';
  command: 'knowledge-review';
  artifactPath: typeof REVIEW_QUEUE_RELATIVE_PATH;
  generatedAt: string;
  reviewOnly: true;
  authority: 'read-only';
  filters: {
    action?: ReviewAction;
    kind?: ReviewKind;
    due?: DueFilter;
    trigger?: TriggerFilter;
    triggerSource?: string;
  };
  summary: {
    total: number;
    returned: number;
    byAction: Record<ReviewAction, number>;
    byKind: Record<ReviewKind, number>;
    cadence: {
      dueNow: number;
      overdue: number;
      deferred: number;
      evidenceTriggered: number;
    };
    triggers: {
      cadence: number;
      evidence: number;
      mixed: number;
    };
  };
  entries: ReviewQueueEntry[];
};

type KnowledgeReviewRecordPayload = {
  schemaVersion: '1.0';
  command: 'knowledge-review-record';
  artifactPath: typeof KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH;
  reviewOnly: true;
  authority: 'explicit-review-receipt';
  queueEntryId: string;
  decision: ReviewDecision;
  target: {
    targetKind: RecordableReviewKind;
    targetId?: string;
    path?: string;
  };
  reasonCode: string;
  evidenceRefs: string[];
  followupRefs: string[];
  nextAction: string;
  receipt: KnowledgeReviewReceiptEntry;
};

type KnowledgeReviewHandoffsPayload = {
  schemaVersion: '1.0';
  command: 'knowledge-review-handoffs';
  artifactPath: typeof REVIEW_HANDOFFS_RELATIVE_PATH;
  generatedAt: string;
  reviewOnly: true;
  authority: 'read-only';
  proposalOnly: true;
  filters: {
    decision?: HandoffDecisionFilter;
    kind?: ReviewKind;
  };
  summary: {
    total: number;
    returned: number;
    byDecision: Record<ReviewHandoffDecision, number>;
    byKind: Record<ReviewKind, number>;
  };
  handoffs: ReviewHandoffEntry[];
};

type KnowledgeReviewRoutesPayload = {
  schemaVersion: '1.0';
  command: 'knowledge-review-routes';
  artifactPath: typeof REVIEW_HANDOFF_ROUTES_RELATIVE_PATH;
  generatedAt: string;
  reviewOnly: true;
  authority: 'read-only';
  proposalOnly: true;
  filters: {
    surface?: RouteSurfaceFilter;
    decision?: HandoffDecisionFilter;
    kind?: ReviewKind;
  };
  summary: {
    total: number;
    returned: number;
    bySurface: Record<RouteSurfaceFilter, number>;
    byDecision: Record<ReviewHandoffDecision, number>;
    byKind: Record<ReviewKind, number>;
  };
  routes: ReviewHandoffRouteEntry[];
};

export type KnowledgeReviewPayload = KnowledgeReviewListPayload | KnowledgeReviewRecordPayload | KnowledgeReviewHandoffsPayload | KnowledgeReviewRoutesPayload;

const reviewActions: readonly ReviewAction[] = ['reaffirm', 'revise', 'supersede'] as const;
const reviewKinds: readonly ReviewKind[] = ['knowledge', 'doc', 'rule', 'pattern'] as const;
const reviewDecisions: readonly ReviewDecision[] = ['reaffirm', 'revise', 'supersede', 'defer'] as const;
const dueFilters: readonly DueFilter[] = ['now', 'overdue', 'all'] as const;
const triggerFilters: readonly TriggerFilter[] = ['cadence', 'evidence', 'all'] as const;

const parseActionFilter = (raw: string | null): ReviewAction | undefined => {
  if (raw === null) {
    return undefined;
  }
  if ((reviewActions as readonly string[]).includes(raw)) {
    return raw as ReviewAction;
  }
  throw new Error(`playbook knowledge review: invalid --action value "${raw}"; expected reaffirm, revise, or supersede`);
};

const parseKindFilter = (raw: string | null): ReviewKind | undefined => {
  if (raw === null) {
    return undefined;
  }
  if ((reviewKinds as readonly string[]).includes(raw)) {
    return raw as ReviewKind;
  }
  throw new Error(`playbook knowledge review: invalid --kind value "${raw}"; expected knowledge, doc, rule, or pattern`);
};

const parseDueFilter = (raw: string | null): DueFilter => {
  if (raw === null) {
    return 'all';
  }
  if ((dueFilters as readonly string[]).includes(raw)) {
    return raw as DueFilter;
  }
  throw new Error(`playbook knowledge review: invalid --due value "${raw}"; expected now, overdue, or all`);
};


const parseTriggerFilter = (raw: string | null): TriggerFilter => {
  if (raw === null) {
    return 'all';
  }
  if ((triggerFilters as readonly string[]).includes(raw)) {
    return raw as TriggerFilter;
  }
  throw new Error(`playbook knowledge review: invalid --trigger value "${raw}"; expected cadence, evidence, or all`);
};

const parseRecordDecision = (raw: string | null): ReviewDecision => {
  if (raw === null) {
    throw new Error('playbook knowledge review record: missing required --decision <reaffirm|revise|supersede|defer>');
  }

  if ((reviewDecisions as readonly string[]).includes(raw)) {
    return raw as ReviewDecision;
  }

  throw new Error(`playbook knowledge review record: invalid --decision value "${raw}"; expected reaffirm, revise, supersede, or defer`);
};

const parseHandoffDecisionFilter = (raw: string | null): HandoffDecisionFilter | undefined => {
  if (raw === null) {
    return undefined;
  }
  if (raw === 'revise' || raw === 'supersede') {
    return raw;
  }
  throw new Error(`playbook knowledge review handoffs: invalid --decision value "${raw}"; expected revise or supersede`);
};

const parseRouteSurfaceFilter = (raw: string | null): RouteSurfaceFilter | undefined => {
  if (raw === null) {
    return undefined;
  }
  if (raw === 'story' || raw === 'promote' || raw === 'docs' || raw === 'memory') {
    return raw;
  }
  throw new Error(`playbook knowledge review routes: invalid --surface value "${raw}"; expected story, promote, docs, or memory`);
};

const readReviewQueueArtifact = (cwd: string): ReviewQueueArtifact => {
  const fullPath = path.join(cwd, REVIEW_QUEUE_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`playbook knowledge review: missing artifact at ${REVIEW_QUEUE_RELATIVE_PATH}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ReviewQueueArtifact;
};

const asReviewKind = (entry: ReviewQueueEntry): ReviewKind => {
  const targetKind = String((entry as { targetKind?: unknown }).targetKind);
  if (targetKind === 'knowledge' || targetKind === 'doc' || targetKind === 'rule' || targetKind === 'pattern') {
    return targetKind;
  }
  return 'knowledge';
};

const asReviewKindValue = (targetKind: unknown): ReviewKind => {
  if (targetKind === 'knowledge' || targetKind === 'doc' || targetKind === 'rule' || targetKind === 'pattern') {
    return targetKind;
  }
  return 'knowledge';
};

const zeroActionSummary = (): Record<ReviewAction, number> => ({ reaffirm: 0, revise: 0, supersede: 0 });
const zeroKindSummary = (): Record<ReviewKind, number> => ({ knowledge: 0, doc: 0, rule: 0, pattern: 0 });

const materializeReviewQueue = (cwd: string): ReviewQueueArtifact => {
  const materialized = buildReviewQueue(cwd);
  writeReviewQueueArtifact(cwd, materialized);
  return readReviewQueueArtifact(cwd);
};

const materializeReviewHandoffs = (cwd: string): ReviewHandoffsArtifact => {
  const materialized = buildReviewHandoffsArtifact(cwd);
  writeReviewHandoffsArtifact(cwd, materialized);
  const fullPath = path.join(cwd, REVIEW_HANDOFFS_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`playbook knowledge review handoffs: missing artifact at ${REVIEW_HANDOFFS_RELATIVE_PATH}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ReviewHandoffsArtifact;
};

const materializeReviewHandoffRoutes = (cwd: string): ReviewHandoffRoutesArtifact => {
  const materialized = buildReviewHandoffRoutesArtifact(cwd);
  writeReviewHandoffRoutesArtifact(cwd, materialized);
  const fullPath = path.join(cwd, REVIEW_HANDOFF_ROUTES_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`playbook knowledge review routes: missing artifact at ${REVIEW_HANDOFF_ROUTES_RELATIVE_PATH}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ReviewHandoffRoutesArtifact;
};

const isOverdueEntry = (entry: ReviewQueueEntry): boolean => entry.overdue === true;

const isDeferredEntry = (entry: ReviewQueueEntry): boolean => typeof entry.deferredUntil === 'string' && entry.deferredUntil.length > 0;

const matchesDueFilter = (entry: ReviewQueueEntry, dueFilter: DueFilter): boolean => {
  if (dueFilter === 'all') {
    return true;
  }
  if (dueFilter === 'overdue') {
    return isOverdueEntry(entry);
  }
  return !isDeferredEntry(entry) || isOverdueEntry(entry);
};

const summarizeCadence = (entries: ReviewQueueEntry[]): { dueNow: number; overdue: number; deferred: number; evidenceTriggered: number } => ({
  dueNow: entries.filter((entry) => !isDeferredEntry(entry) || isOverdueEntry(entry)).length,
  overdue: entries.filter((entry) => isOverdueEntry(entry)).length,
  deferred: entries.filter((entry) => isDeferredEntry(entry) && !isOverdueEntry(entry)).length,
  evidenceTriggered: entries.filter((entry) => includesEvidenceTrigger(entry)).length
});

const summarizeTriggers = (entries: ReviewQueueEntry[]): { cadence: number; evidence: number; mixed: number } => ({
  cadence: entries.filter((entry) => entry.triggerType === 'cadence').length,
  evidence: entries.filter((entry) => entry.triggerType === 'evidence').length,
  mixed: entries.filter((entry) => entry.triggerType === 'cadence+evidence').length
});

const includesCadenceTrigger = (entry: ReviewQueueEntry): boolean => entry.triggerType === 'cadence' || entry.triggerType === 'cadence+evidence';
const includesEvidenceTrigger = (entry: ReviewQueueEntry): boolean => entry.triggerType === 'evidence' || entry.triggerType === 'cadence+evidence';

const matchesTriggerFilter = (entry: ReviewQueueEntry, triggerFilter: TriggerFilter): boolean => {
  if (triggerFilter === 'all') {
    return true;
  }
  if (triggerFilter === 'cadence') {
    return includesCadenceTrigger(entry);
  }
  return includesEvidenceTrigger(entry);
};

const enrichEntry = (entry: ReviewQueueEntry): ReviewQueueEntry => ({
  ...entry,
  triggerType: entry.triggerType,
  triggerReasonCode: entry.triggerReasonCode,
  triggerSource: entry.triggerSource,
  triggerEvidenceRefs: [...entry.triggerEvidenceRefs]
});


const runKnowledgeReviewList = (cwd: string, args: string[]): KnowledgeReviewListPayload => {
  const actionFilter = parseActionFilter(readOptionValue(args, '--action'));
  const kindFilter = parseKindFilter(readOptionValue(args, '--kind'));
  const dueFilter = parseDueFilter(readOptionValue(args, '--due'));
  const triggerFilter = parseTriggerFilter(readOptionValue(args, '--trigger'));
  const triggerSourceFilter = readOptionValue(args, '--trigger-source') ?? undefined;

  const reviewQueue = materializeReviewQueue(cwd);

  const entries = reviewQueue.entries.filter((entry: ReviewQueueEntry) => {
    const entryKind = asReviewKind(entry);
    if (actionFilter && entry.recommendedAction !== actionFilter) {
      return false;
    }
    if (kindFilter && entryKind !== kindFilter) {
      return false;
    }
    if (!matchesDueFilter(entry, dueFilter)) {
      return false;
    }
    if (!matchesTriggerFilter(entry, triggerFilter)) {
      return false;
    }
    if (triggerSourceFilter && entry.triggerSource !== triggerSourceFilter) {
      return false;
    }
    return true;
  });

  const byAction = zeroActionSummary();
  const byKind = zeroKindSummary();
  for (const entry of entries) {
    byAction[entry.recommendedAction as ReviewAction] += 1;
    byKind[asReviewKind(entry)] += 1;
  }

  const enrichedEntries = entries.map(enrichEntry);

  return {
    schemaVersion: '1.0',
    command: 'knowledge-review',
    artifactPath: REVIEW_QUEUE_RELATIVE_PATH,
    generatedAt: reviewQueue.generatedAt,
    reviewOnly: true,
    authority: 'read-only',
    filters: {
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(kindFilter ? { kind: kindFilter } : {}),
      due: dueFilter,
      trigger: triggerFilter,
      ...(triggerSourceFilter ? { triggerSource: triggerSourceFilter } : {})
    },
    summary: {
      total: reviewQueue.entries.length,
      returned: entries.length,
      byAction,
      byKind,
      cadence: summarizeCadence(enrichedEntries),
      triggers: summarizeTriggers(enrichedEntries)
    },
    entries: enrichedEntries
  };
};

const runKnowledgeReviewHandoffs = (cwd: string, args: string[]): KnowledgeReviewHandoffsPayload => {
  const decisionFilter = parseHandoffDecisionFilter(readOptionValue(args, '--decision'));
  const kindFilter = parseKindFilter(readOptionValue(args, '--kind'));
  const artifact = materializeReviewHandoffs(cwd);

  const handoffs = artifact.handoffs.filter((handoff: ReviewHandoffEntry) => {
    if (decisionFilter && handoff.decision !== decisionFilter) {
      return false;
    }
    if (kindFilter && asReviewKindValue(handoff.targetKind) !== kindFilter) {
      return false;
    }
    return true;
  });

  const byDecision: Record<ReviewHandoffDecision, number> = { revise: 0, supersede: 0 };
  const byKind = zeroKindSummary();
  for (const handoff of handoffs) {
    byDecision[handoff.decision] += 1;
    byKind[asReviewKindValue(handoff.targetKind)] += 1;
  }

  return {
    schemaVersion: '1.0',
    command: 'knowledge-review-handoffs',
    artifactPath: REVIEW_HANDOFFS_RELATIVE_PATH,
    generatedAt: artifact.generatedAt,
    reviewOnly: true,
    authority: 'read-only',
    proposalOnly: true,
    filters: {
      ...(decisionFilter ? { decision: decisionFilter } : {}),
      ...(kindFilter ? { kind: kindFilter } : {})
    },
    summary: {
      total: artifact.handoffs.length,
      returned: handoffs.length,
      byDecision,
      byKind
    },
    handoffs
  };
};

const runKnowledgeReviewRoutes = (cwd: string, args: string[]): KnowledgeReviewRoutesPayload => {
  const surfaceFilter = parseRouteSurfaceFilter(readOptionValue(args, '--surface'));
  const decisionFilter = parseHandoffDecisionFilter(readOptionValue(args, '--decision'));
  const kindFilter = parseKindFilter(readOptionValue(args, '--kind'));
  const handoffArtifact = materializeReviewHandoffs(cwd);
  const routeArtifact = materializeReviewHandoffRoutes(cwd);
  const decisionByHandoffId = new Map<string, ReviewHandoffDecision>(
    handoffArtifact.handoffs.map((handoff: ReviewHandoffEntry) => [handoff.handoffId, handoff.decision])
  );

  const routes = routeArtifact.routes.filter((route: ReviewHandoffRouteEntry) => {
    if (surfaceFilter && route.recommendedSurface !== surfaceFilter) {
      return false;
    }
    if (kindFilter && asReviewKindValue(route.targetKind) !== kindFilter) {
      return false;
    }
    if (decisionFilter && decisionByHandoffId.get(route.handoffId) !== decisionFilter) {
      return false;
    }
    return true;
  });

  const bySurface: Record<RouteSurfaceFilter, number> = { story: 0, promote: 0, docs: 0, memory: 0 };
  const byDecision: Record<ReviewHandoffDecision, number> = { revise: 0, supersede: 0 };
  const byKind = zeroKindSummary();
  for (const route of routes) {
    bySurface[route.recommendedSurface] += 1;
    byKind[asReviewKindValue(route.targetKind)] += 1;
    const decision = decisionByHandoffId.get(route.handoffId);
    if (decision === 'revise' || decision === 'supersede') {
      byDecision[decision] += 1;
    }
  }

  return {
    schemaVersion: '1.0',
    command: 'knowledge-review-routes',
    artifactPath: REVIEW_HANDOFF_ROUTES_RELATIVE_PATH,
    generatedAt: routeArtifact.generatedAt,
    reviewOnly: true,
    authority: 'read-only',
    proposalOnly: true,
    filters: {
      ...(surfaceFilter ? { surface: surfaceFilter } : {}),
      ...(decisionFilter ? { decision: decisionFilter } : {}),
      ...(kindFilter ? { kind: kindFilter } : {})
    },
    summary: {
      total: routeArtifact.routes.length,
      returned: routes.length,
      bySurface,
      byDecision,
      byKind
    },
    routes
  };
};

const asRecordableTargetKind = (targetKind: ReviewQueueEntry['targetKind']): RecordableReviewKind => {
  if (targetKind === 'knowledge' || targetKind === 'doc') {
    return targetKind;
  }

  throw new Error(`playbook knowledge review record: unsupported target kind "${targetKind}" for receipt recording`);
};

const toNextAction = (decision: ReviewDecision): string => {
  if (decision === 'reaffirm') {
    return 'no additional action required until next review window';
  }
  if (decision === 'defer') {
    return 'wait for defer window before the next review pass';
  }
  if (decision === 'revise') {
    return 'create and link the follow-up revision artifact explicitly';
  }
  return 'perform explicit supersession through the existing promotion/supersession workflow';
};

const runKnowledgeReviewRecord = (cwd: string, args: string[]): KnowledgeReviewRecordPayload => {
  const queueEntryId = readOptionValue(args, '--from');
  if (!queueEntryId) {
    throw new Error('playbook knowledge review record: missing required --from <queueEntryId>');
  }

  if (readOptionValue(args, '--reviewed-by')) {
    throw new Error('playbook knowledge review record: --reviewed-by is not supported by the current receipt contract');
  }

  const decision = parseRecordDecision(readOptionValue(args, '--decision'));
  const reasonCode = readOptionValue(args, '--reason-code');
  const receiptId = readOptionValue(args, '--receipt-id') ?? undefined;
  const followupRefs = readOptionValues(args, '--followup-ref');
  const evidenceRefs = readOptionValues(args, '--evidence-ref');

  const reviewQueue = materializeReviewQueue(cwd);
  const queueEntry = reviewQueue.entries.find((entry: ReviewQueueEntry) => entry.queueEntryId === queueEntryId);
  if (!queueEntry) {
    throw new Error(`playbook knowledge review record: queue entry not found for --from "${queueEntryId}"`);
  }

  const targetKind = asRecordableTargetKind(queueEntry.targetKind);

  const combinedEvidenceRefs = [...queueEntry.evidenceRefs, ...evidenceRefs]
    .filter((value: string, index: number, values: string[]) => typeof value === 'string' && value.length > 0 && values.indexOf(value) === index)
    .sort((left: string, right: string) => left.localeCompare(right));

  const nextArtifact = writeKnowledgeReviewReceipt(cwd, {
    ...(receiptId ? { receiptId } : {}),
    queueEntryId: queueEntry.queueEntryId,
    targetKind,
    ...(queueEntry.targetId ? { targetId: queueEntry.targetId } : {}),
    ...(queueEntry.path ? { path: queueEntry.path } : {}),
    sourceSurface: queueEntry.sourceSurface,
    reasonCode: reasonCode ?? queueEntry.reasonCode,
    decision,
    evidenceRefs: combinedEvidenceRefs,
    ...(followupRefs[0] ? { followUpArtifactPath: followupRefs[0] } : {})
  });

  const matchingReceipts = nextArtifact.receipts
    .filter(
      (receipt: KnowledgeReviewReceiptEntry) =>
        receipt.queueEntryId === queueEntry.queueEntryId &&
        receipt.targetKind === targetKind &&
        (queueEntry.targetId ? receipt.targetId === queueEntry.targetId : true) &&
        (queueEntry.path ? receipt.path === queueEntry.path : true)
    )
    .sort((left: KnowledgeReviewReceiptEntry, right: KnowledgeReviewReceiptEntry) => left.decidedAt.localeCompare(right.decidedAt) || left.receiptId.localeCompare(right.receiptId));

  const receipt = receiptId
    ? matchingReceipts.find((entry: KnowledgeReviewReceiptEntry) => entry.receiptId === receiptId) ?? matchingReceipts.at(-1)
    : matchingReceipts.at(-1);

  if (!receipt) {
    throw new Error('playbook knowledge review record: failed to resolve recorded receipt entry');
  }

  return {
    schemaVersion: '1.0',
    command: 'knowledge-review-record',
    artifactPath: KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH,
    reviewOnly: true,
    authority: 'explicit-review-receipt',
    queueEntryId: queueEntry.queueEntryId,
    decision,
    target: {
      targetKind,
      ...(queueEntry.targetId ? { targetId: queueEntry.targetId } : {}),
      ...(queueEntry.path ? { path: queueEntry.path } : {})
    },
    reasonCode: reasonCode ?? queueEntry.reasonCode,
    evidenceRefs: combinedEvidenceRefs,
    followupRefs,
    nextAction: toNextAction(decision),
    receipt
  };
};

export const runKnowledgeReview = (cwd: string, args: string[]): KnowledgeReviewPayload => {
  const reviewSubcommand = resolveSubcommandArgument(args);
  if (reviewSubcommand === 'record') {
    return runKnowledgeReviewRecord(cwd, args);
  }
  if (reviewSubcommand === 'handoffs') {
    return runKnowledgeReviewHandoffs(cwd, args);
  }
  if (reviewSubcommand === 'routes') {
    return runKnowledgeReviewRoutes(cwd, args);
  }

  return runKnowledgeReviewList(cwd, args);
};
