import fs from 'node:fs';
import path from 'node:path';
import type { BucketTarget } from './bucketTypes.js';
import { canonicalizeCandidate } from './canonicalizeCandidate.js';
import type { PatternCard } from './patternCardTypes.js';

export const PATTERN_CARD_DIRECTORY_RELATIVE_PATH = '.playbook/patterns' as const;

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const byPatternId = (left: PatternCard, right: PatternCard): number => left.patternId.localeCompare(right.patternId);

const asPatternCard = (value: unknown): PatternCard | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const card = value as Partial<PatternCard>;
  if (card.kind !== 'playbook-pattern-card' || typeof card.patternId !== 'string') return undefined;
  return {
    ...card,
    schemaVersion: '1.0',
    kind: 'playbook-pattern-card',
    examples: uniqueSorted(Array.isArray(card.examples) ? card.examples : []),
    evidence: uniqueSorted(Array.isArray(card.evidence) ? card.evidence : []),
    sourceKinds: uniqueSorted(Array.isArray(card.sourceKinds) ? card.sourceKinds : []),
    sourceRefs: uniqueSorted(Array.isArray(card.sourceRefs) ? card.sourceRefs : []),
    relatedModules: uniqueSorted(Array.isArray(card.relatedModules) ? card.relatedModules : []),
    relatedRules: uniqueSorted(Array.isArray(card.relatedRules) ? card.relatedRules : []),
    relatedDocs: uniqueSorted(Array.isArray(card.relatedDocs) ? card.relatedDocs : []),
    relatedOwners: uniqueSorted(Array.isArray(card.relatedOwners) ? card.relatedOwners : []),
    relatedTests: uniqueSorted(Array.isArray(card.relatedTests) ? card.relatedTests : []),
    relatedRiskSignals: uniqueSorted(Array.isArray(card.relatedRiskSignals) ? card.relatedRiskSignals : []),
    relatedGraphNodes: uniqueSorted(Array.isArray(card.relatedGraphNodes) ? card.relatedGraphNodes : []),
    relatedPatterns: uniqueSorted(Array.isArray(card.relatedPatterns) ? card.relatedPatterns : []),
    supersedes: uniqueSorted(Array.isArray(card.supersedes) ? card.supersedes : []),
    supersededBy: uniqueSorted(Array.isArray(card.supersededBy) ? card.supersededBy : []),
    confidence: card.confidence ?? null,
    title: card.title ?? card.patternId,
    status: card.status ?? 'candidate',
    createdFromBucket: card.createdFromBucket ?? 'add',
    trigger: card.trigger ?? '',
    context: card.context ?? '',
    mechanism: card.mechanism ?? '',
    invariant: card.invariant ?? '',
    implication: card.implication ?? '',
    response: card.response ?? '',
    reviewState: card.reviewState ?? 'pending-review',
    promotionState: card.promotionState ?? 'not-promoted'
  } as PatternCard;
};

export const readPatternCards = (repoRoot: string): PatternCard[] => {
  const directory = path.join(repoRoot, PATTERN_CARD_DIRECTORY_RELATIVE_PATH);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => asPatternCard(JSON.parse(fs.readFileSync(path.join(directory, entry), 'utf8'))))
    .filter((entry): entry is PatternCard => Boolean(entry))
    .sort(byPatternId);
};

export const writePatternCards = (repoRoot: string, cards: PatternCard[]): string[] => {
  const directory = path.join(repoRoot, PATTERN_CARD_DIRECTORY_RELATIVE_PATH);
  fs.mkdirSync(directory, { recursive: true });

  return [...cards].sort(byPatternId).map((card) => {
    const targetPath = path.join(directory, `${card.patternId}.json`);
    fs.writeFileSync(targetPath, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
    return targetPath;
  });
};

export const toExistingPatternTargets = (cards: PatternCard[]): BucketTarget[] =>
  cards.map((card) => ({
    targetId: card.patternId,
    origin: 'known-pattern' as const,
    candidate: canonicalizeCandidate({
      sourceKind: 'verify',
      sourceRef: card.patternId,
      subjectKind: 'repository',
      subjectRef: card.context || card.patternId,
      trigger: card.trigger,
      mechanism: card.mechanism,
      invariant: card.invariant,
      response: card.response,
      evidence: card.evidence.map((summary, index) => ({
        sourceKind: 'verify',
        sourceRef: card.patternId,
        pointer: `evidence[${index}]`,
        summary
      })),
      related: {
        modules: card.relatedModules,
        rules: card.relatedRules,
        docs: card.relatedDocs,
        owners: card.relatedOwners,
        tests: card.relatedTests,
        riskSignals: card.relatedRiskSignals,
        graphNodes: card.relatedGraphNodes
      }
    })
  }));
