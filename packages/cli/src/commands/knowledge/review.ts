import fs from 'node:fs';
import path from 'node:path';
import {
  KNOWLEDGE_REVIEW_RECEIPTS_RELATIVE_PATH,
  REVIEW_QUEUE_RELATIVE_PATH,
  buildReviewQueue,
  writeKnowledgeReviewReceipt,
  writeReviewQueueArtifact,
  type KnowledgeReviewDecision,
  type KnowledgeReviewReceiptEntry,
  type ReviewQueueArtifact,
  type ReviewQueueEntry
} from '@zachariahredfield/playbook-engine';
import { readOptionValue, readOptionValues, resolveSubcommandArgument } from './shared.js';

type ReviewAction = 'reaffirm' | 'revise' | 'supersede';
type ReviewKind = 'knowledge' | 'doc' | 'rule' | 'pattern';
type ReviewDecision = KnowledgeReviewDecision;
type RecordableReviewKind = 'knowledge' | 'doc';

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
  };
  summary: {
    total: number;
    returned: number;
    byAction: Record<ReviewAction, number>;
    byKind: Record<ReviewKind, number>;
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

export type KnowledgeReviewPayload = KnowledgeReviewListPayload | KnowledgeReviewRecordPayload;

const reviewActions: readonly ReviewAction[] = ['reaffirm', 'revise', 'supersede'] as const;
const reviewKinds: readonly ReviewKind[] = ['knowledge', 'doc', 'rule', 'pattern'] as const;
const reviewDecisions: readonly ReviewDecision[] = ['reaffirm', 'revise', 'supersede', 'defer'] as const;

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

const parseRecordDecision = (raw: string | null): ReviewDecision => {
  if (raw === null) {
    throw new Error('playbook knowledge review record: missing required --decision <reaffirm|revise|supersede|defer>');
  }

  if ((reviewDecisions as readonly string[]).includes(raw)) {
    return raw as ReviewDecision;
  }

  throw new Error(`playbook knowledge review record: invalid --decision value "${raw}"; expected reaffirm, revise, supersede, or defer`);
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

const zeroActionSummary = (): Record<ReviewAction, number> => ({ reaffirm: 0, revise: 0, supersede: 0 });
const zeroKindSummary = (): Record<ReviewKind, number> => ({ knowledge: 0, doc: 0, rule: 0, pattern: 0 });

const materializeReviewQueue = (cwd: string): ReviewQueueArtifact => {
  const materialized = buildReviewQueue(cwd);
  writeReviewQueueArtifact(cwd, materialized);
  return readReviewQueueArtifact(cwd);
};

const runKnowledgeReviewList = (cwd: string, args: string[]): KnowledgeReviewListPayload => {
  const actionFilter = parseActionFilter(readOptionValue(args, '--action'));
  const kindFilter = parseKindFilter(readOptionValue(args, '--kind'));

  const reviewQueue = materializeReviewQueue(cwd);

  const entries = reviewQueue.entries.filter((entry: ReviewQueueEntry) => {
    const entryKind = asReviewKind(entry);
    if (actionFilter && entry.recommendedAction !== actionFilter) {
      return false;
    }
    if (kindFilter && entryKind !== kindFilter) {
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

  return {
    schemaVersion: '1.0',
    command: 'knowledge-review',
    artifactPath: REVIEW_QUEUE_RELATIVE_PATH,
    generatedAt: reviewQueue.generatedAt,
    reviewOnly: true,
    authority: 'read-only',
    filters: {
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(kindFilter ? { kind: kindFilter } : {})
    },
    summary: {
      total: reviewQueue.entries.length,
      returned: entries.length,
      byAction,
      byKind
    },
    entries
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

  return runKnowledgeReviewList(cwd, args);
};
