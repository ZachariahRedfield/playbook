import fs from 'node:fs';
import path from 'node:path';
import {
  REVIEW_QUEUE_RELATIVE_PATH,
  buildReviewQueue,
  writeReviewQueueArtifact,
  type ReviewQueueArtifact,
  type ReviewQueueEntry
} from '@zachariahredfield/playbook-engine';
import { readOptionValue } from './shared.js';

type ReviewAction = 'reaffirm' | 'revise' | 'supersede';
type ReviewKind = 'knowledge' | 'doc' | 'rule' | 'pattern';

export type KnowledgeReviewPayload = {
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

const reviewActions: readonly ReviewAction[] = ['reaffirm', 'revise', 'supersede'] as const;
const reviewKinds: readonly ReviewKind[] = ['knowledge', 'doc', 'rule', 'pattern'] as const;

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

const readReviewQueueArtifact = (cwd: string): ReviewQueueArtifact => {
  const fullPath = path.join(cwd, REVIEW_QUEUE_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`playbook knowledge review: missing artifact at ${REVIEW_QUEUE_RELATIVE_PATH}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ReviewQueueArtifact;
};

const asReviewKind = (entry: ReviewQueueEntry): ReviewKind => {
  if (entry.targetKind === 'knowledge' || entry.targetKind === 'doc') {
    return entry.targetKind;
  }
  return 'knowledge';
};

const zeroActionSummary = (): Record<ReviewAction, number> => ({ reaffirm: 0, revise: 0, supersede: 0 });
const zeroKindSummary = (): Record<ReviewKind, number> => ({ knowledge: 0, doc: 0, rule: 0, pattern: 0 });

export const runKnowledgeReview = (cwd: string, args: string[]): KnowledgeReviewPayload => {
  const actionFilter = parseActionFilter(readOptionValue(args, '--action'));
  const kindFilter = parseKindFilter(readOptionValue(args, '--kind'));

  const materialized = buildReviewQueue(cwd);
  writeReviewQueueArtifact(cwd, materialized);
  const reviewQueue = readReviewQueueArtifact(cwd);

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
