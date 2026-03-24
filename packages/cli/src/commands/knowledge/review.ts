import fs from 'node:fs';
import path from 'node:path';
import {
  REVIEW_QUEUE_RELATIVE_PATH,
  buildReviewQueue,
  type ReviewQueueArtifact,
  type ReviewQueueEntry,
  type ReviewRecommendedAction,
  writeReviewQueueArtifact
} from '@zachariahredfield/playbook-engine';
import { readOptionValue } from './shared.js';

const reviewActions = ['reaffirm', 'revise', 'supersede'] as const satisfies readonly ReviewRecommendedAction[];
const reviewKinds = ['knowledge', 'doc', 'rule', 'pattern'] as const;

type ReviewKindFilter = (typeof reviewKinds)[number];

const parseReviewAction = (args: string[]): ReviewRecommendedAction | undefined => {
  const raw = readOptionValue(args, '--action');
  if (raw === null) {
    return undefined;
  }
  if ((reviewActions as readonly string[]).includes(raw)) {
    return raw as ReviewRecommendedAction;
  }
  throw new Error(`playbook knowledge review: invalid --action value "${raw}"; expected reaffirm, revise, or supersede`);
};

const parseReviewKind = (args: string[]): ReviewKindFilter | undefined => {
  const raw = readOptionValue(args, '--kind');
  if (raw === null) {
    return undefined;
  }
  if ((reviewKinds as readonly string[]).includes(raw)) {
    return raw as ReviewKindFilter;
  }
  throw new Error(`playbook knowledge review: invalid --kind value "${raw}"; expected knowledge, doc, rule, or pattern`);
};

const matchesKind = (entry: ReviewQueueEntry, kind: ReviewKindFilter | undefined): boolean => {
  if (!kind) {
    return true;
  }
  if (kind === 'knowledge' || kind === 'doc') {
    return entry.targetKind === kind;
  }
  if (kind === 'pattern') {
    return (
      entry.targetKind === 'knowledge' &&
      (entry.targetId?.toLowerCase().includes('pattern') ||
        entry.evidenceRefs.some((reference: string) => reference.toLowerCase().includes('/knowledge/patterns.json')))
    );
  }
  return false;
};

export const runKnowledgeReview = (cwd: string, args: string[]): ReviewQueueArtifact & {
  command: 'knowledge-review';
  queuePath: string;
  filters: {
    action?: ReviewRecommendedAction;
    kind?: ReviewKindFilter;
  };
  entries: ReviewQueueEntry[];
} => {
  const action = parseReviewAction(args);
  const kind = parseReviewKind(args);
  const builtArtifact = buildReviewQueue(cwd);
  writeReviewQueueArtifact(cwd, builtArtifact);

  const queuePath = path.join(cwd, REVIEW_QUEUE_RELATIVE_PATH);
  const materializedArtifact = JSON.parse(fs.readFileSync(queuePath, 'utf8')) as ReviewQueueArtifact;
  const entries = (materializedArtifact.entries as ReviewQueueEntry[]).filter(
    (entry: ReviewQueueEntry) => (!action || entry.recommendedAction === action) && matchesKind(entry, kind)
  );

  return {
    ...materializedArtifact,
    command: 'knowledge-review',
    queuePath: REVIEW_QUEUE_RELATIVE_PATH,
    filters: {
      ...(action ? { action } : {}),
      ...(kind ? { kind } : {})
    },
    entries
  };
};
