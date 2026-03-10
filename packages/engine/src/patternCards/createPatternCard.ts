import { createHash } from 'node:crypto';
import type { PatternCardDraft } from '../schema/patternCardDraft.js';
import type { PatternCard } from '../schema/patternCard.js';
import type { PromotionDecision } from '../schema/promotionDecision.js';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 10);

export const createStablePatternId = (draft: PatternCardDraft): string => {
  const canonical = JSON.stringify({
    canonicalKey: draft.canonicalKey,
    title: draft.title,
    summary: draft.summary,
    mechanism: draft.mechanism ?? '',
    invariant: draft.invariant ?? ''
  });
  const slug = slugify(draft.canonicalKey || draft.title).slice(0, 48) || 'pattern';
  return `pattern.${slug}_${shortHash(canonical)}`;
};

export const createPatternCard = (input: {
  draft: PatternCardDraft;
  decision: PromotionDecision;
  timestamp: string;
  patternId?: string;
  mergedFromPatternIds?: string[];
  supersedesPatternIds?: string[];
}): PatternCard => {
  const { draft, decision, timestamp } = input;
  const patternId = input.patternId ?? createStablePatternId(draft);

  return {
    schemaVersion: '1.0',
    kind: 'playbook-pattern-card',
    patternId,
    canonicalKey: draft.canonicalKey,
    title: draft.title,
    summary: draft.summary,
    mechanism: draft.mechanism,
    invariant: draft.invariant,
    linkedContractRefs: [...draft.linkedContractRefs].sort(),
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    currentVersion: 1,
    versionHistory: [{ version: 1, decisionId: decision.decisionId, decisionType: decision.decisionType === 'supersede' ? 'supersede' : decision.decisionType === 'merge' ? 'merge' : 'promote', timestamp }],
    lineage: {
      originCycleIds: [...new Set([draft.originCycleId, ...draft.recurrence.sourceCycleIds])].sort(),
      sourceDraftIds: [draft.patternId],
      sourceGroupIds: [...new Set([draft.sourceGroupId, ...decision.sourceGroupIds])].sort(),
      sourceZettelIds: [...new Set([...draft.sourceZettelIds, ...decision.sourceZettelIds])].sort(),
      evidenceRefs: [...new Set([...draft.evidenceRefs, ...draft.sourceArtifactPaths])].sort(),
      supersedesPatternIds: [...new Set(input.supersedesPatternIds ?? [])].sort(),
      mergedFromPatternIds: [...new Set(input.mergedFromPatternIds ?? [])].sort(),
      decisionIds: [decision.decisionId]
    }
  };
};
