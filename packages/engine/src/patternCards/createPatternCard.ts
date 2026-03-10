import { createHash } from 'node:crypto';
import type { PatternCardDraft } from '../schema/patternCardDraft.js';
import type { PatternCard } from '../schema/patternCard.js';
import type { PromotionDecision } from '../schema/promotionDecision.js';
import { materializePatternCardVersion } from './materializePatternCardVersion.js';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 10);

export const createStablePatternId = (draft: PatternCardDraft): string => {
  const canonical = JSON.stringify({ canonicalKey: draft.canonicalKey, title: draft.title, summary: draft.summary, mechanism: draft.mechanism ?? '', invariant: draft.invariant ?? '' });
  const slug = slugify(draft.canonicalKey || draft.title).slice(0, 48) || 'pattern';
  return `pattern.${slug}_${shortHash(canonical)}`;
};

export const createPatternCard = (input: { draft: PatternCardDraft; decision: PromotionDecision; timestamp: string; patternId?: string }): PatternCard =>
  materializePatternCardVersion({
    decision: { ...input.decision, timestamp: input.timestamp },
    draft: input.draft,
    patternId: input.patternId ?? createStablePatternId(input.draft),
    state: 'promoted'
  });
