import { createHash } from 'node:crypto';

type CompactionEvidence = {
  sourceType: string;
  sourceRef: string;
  summary: string;
};

export type InternalCompactionCandidate = {
  candidateRef?: string;
  title: string;
  trigger?: string;
  context?: string;
  mechanism: string;
  invariant?: string;
  response?: string;
  examples?: string[];
  evidence?: CompactionEvidence[];
};

export type InternalCompactionPattern = InternalCompactionCandidate & {
  id: string;
};

export type CanonicalCompactionCandidate = {
  title: string;
  trigger: string;
  context: string;
  mechanism: string;
  invariant: string;
  response: string;
  examples: string[];
  evidence: CompactionEvidence[];
};

type CanonicalCompactionPattern = CanonicalCompactionCandidate & { id: string };

type CompactionDecisionReason =
  | 'empty-mechanism'
  | 'exact-duplicate'
  | 'supports-existing-pattern'
  | 'wording-variant-same-mechanism'
  | 'new-pattern';

export type CompactionDecision =
  | { bucket: 'discard'; reason: CompactionDecisionReason }
  | { bucket: 'attach'; reason: CompactionDecisionReason; targetPatternId: string }
  | { bucket: 'merge'; reason: CompactionDecisionReason; mergeTargetPatternId: string }
  | { bucket: 'add'; reason: CompactionDecisionReason };

export type CompactionReviewReasonCode =
  | CompactionDecisionReason
  | 'discard-insufficient-signal'
  | 'discard-already-canonical'
  | 'attach-evidence-to-pattern'
  | 'merge-lexical-variance'
  | 'add-novel-pattern';

export type CompactionReviewArtifact = {
  candidateRef: string;
  canonicalFingerprint: string;
  canonicalCandidate: CanonicalCompactionCandidate;
  bucket: CompactionDecision['bucket'];
  reasonCodes: CompactionReviewReasonCode[];
  explanations: string[];
  targetPatternId?: string;
  mergeTargetPatternId?: string;
  discardRationale?: string;
  attachRationale?: string;
  mergeRationale?: string;
  noveltyRationale?: string;
  comparison?: {
    comparedPatternId: string;
    matchingFields: string[];
    differingFields: string[];
  };
};

const REVIEW_REASON_ORDER: Record<CompactionReviewReasonCode, number> = {
  'empty-mechanism': 10,
  'exact-duplicate': 20,
  'supports-existing-pattern': 30,
  'wording-variant-same-mechanism': 40,
  'new-pattern': 50,
  'discard-insufficient-signal': 60,
  'discard-already-canonical': 70,
  'attach-evidence-to-pattern': 80,
  'merge-lexical-variance': 90,
  'add-novel-pattern': 100
};

const REVIEW_REASON_MESSAGES: Record<CompactionReviewReasonCode, string> = {
  'empty-mechanism': 'Candidate mechanism is empty after canonicalization.',
  'exact-duplicate': 'Candidate fingerprint exactly matches an existing canonical pattern.',
  'supports-existing-pattern': 'Candidate supports an existing pattern identity and should attach evidence.',
  'wording-variant-same-mechanism': 'Candidate uses different wording but resolves to the same mechanism fingerprint.',
  'new-pattern': 'Candidate does not match existing identity or mechanism fingerprints.',
  'discard-insufficient-signal': 'Discarded because canonical mechanism signal is insufficient for retention.',
  'discard-already-canonical': 'Discarded because the content is already represented canonically.',
  'attach-evidence-to-pattern': 'Attach decision preserves existing pattern while adding supporting evidence context.',
  'merge-lexical-variance': 'Merge decision collapses lexical variation into an existing canonical mechanism.',
  'add-novel-pattern': 'Add decision preserves a novel canonical mechanism for future matching.'
};

const REVIEW_COMPARISON_FIELDS: (keyof CanonicalCompactionCandidate)[] = [
  'title',
  'trigger',
  'context',
  'mechanism',
  'invariant',
  'response',
  'examples',
  'evidence'
];

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeMechanismText = (value: string): string =>
  normalizeText(value)
    .replace(/[(){}\[\],.:;!?"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stableUniqueSort = (items: string[], normalizer: (value: string) => string = normalizeText): string[] => {
  const keyed = new Map<string, string>();
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = normalizer(trimmed);
    if (!keyed.has(key)) keyed.set(key, trimmed);
  }
  return Array.from(keyed.values()).sort((a, b) => normalizer(a).localeCompare(normalizer(b)) || a.localeCompare(b));
};

const canonicalizeEvidence = (items?: CompactionEvidence[]): CompactionEvidence[] => {
  const keyed = new Map<string, CompactionEvidence>();
  for (const item of items ?? []) {
    const sourceType = normalizeText(item.sourceType);
    const sourceRef = item.sourceRef.trim();
    const summary = item.summary.trim();
    if (!sourceType || !sourceRef || !summary) continue;
    const key = `${sourceType}|${sourceRef.toLowerCase()}|${normalizeMechanismText(summary)}`;
    if (!keyed.has(key)) keyed.set(key, { sourceType, sourceRef, summary });
  }

  return Array.from(keyed.values()).sort(
    (a, b) =>
      a.sourceType.localeCompare(b.sourceType) ||
      a.sourceRef.localeCompare(b.sourceRef) ||
      normalizeMechanismText(a.summary).localeCompare(normalizeMechanismText(b.summary)) ||
      a.summary.localeCompare(b.summary)
  );
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

const stableHash = (value: string): string => createHash('sha256').update(value).digest('hex');

export const canonicalizeCompactionCandidate = (candidate: InternalCompactionCandidate): CanonicalCompactionCandidate => ({
  title: normalizeText(candidate.title),
  trigger: normalizeMechanismText(candidate.trigger ?? ''),
  context: normalizeMechanismText(candidate.context ?? ''),
  mechanism: normalizeMechanismText(candidate.mechanism),
  invariant: normalizeMechanismText(candidate.invariant ?? ''),
  response: normalizeMechanismText(candidate.response ?? ''),
  examples: stableUniqueSort((candidate.examples ?? []).map((item) => normalizeMechanismText(item)), normalizeMechanismText),
  evidence: canonicalizeEvidence(candidate.evidence)
});

const canonicalizePattern = (pattern: InternalCompactionPattern): CanonicalCompactionPattern => ({
  id: pattern.id.trim(),
  ...canonicalizeCompactionCandidate(pattern)
});

const sortCanonicalPatterns = (patterns: InternalCompactionPattern[]): CanonicalCompactionPattern[] =>
  patterns
    .map(canonicalizePattern)
    .sort((a, b) => a.id.localeCompare(b.id) || fingerprintCompactionCandidate(a).localeCompare(fingerprintCompactionCandidate(b)));

const candidateIdentity = (candidate: CanonicalCompactionCandidate): Omit<CanonicalCompactionCandidate, 'examples' | 'evidence'> & {
  examples: string[];
} => ({
  title: candidate.title,
  trigger: candidate.trigger,
  context: candidate.context,
  mechanism: candidate.mechanism,
  invariant: candidate.invariant,
  response: candidate.response,
  examples: candidate.examples
});

export const fingerprintCompactionCandidate = (candidate: CanonicalCompactionCandidate): string => stableHash(stableStringify(candidate));

const identityFingerprint = (candidate: CanonicalCompactionCandidate): string => stableHash(stableStringify(candidateIdentity(candidate)));

const mechanismFingerprint = (candidate: CanonicalCompactionCandidate): string =>
  stableHash(stableStringify({ mechanism: candidate.mechanism, invariant: candidate.invariant }));

const reasonCodesForDecision = (decision: CompactionDecision): CompactionReviewReasonCode[] => {
  const reasonCodes: CompactionReviewReasonCode[] = [decision.reason];

  if (decision.bucket === 'discard') {
    reasonCodes.push(decision.reason === 'empty-mechanism' ? 'discard-insufficient-signal' : 'discard-already-canonical');
  }

  if (decision.bucket === 'attach') reasonCodes.push('attach-evidence-to-pattern');
  if (decision.bucket === 'merge') reasonCodes.push('merge-lexical-variance');
  if (decision.bucket === 'add') reasonCodes.push('add-novel-pattern');

  return reasonCodes.sort((a, b) => REVIEW_REASON_ORDER[a] - REVIEW_REASON_ORDER[b] || a.localeCompare(b));
};

const compareCanonicalCandidates = (
  left: CanonicalCompactionCandidate,
  right: CanonicalCompactionCandidate,
  comparedPatternId: string
): CompactionReviewArtifact['comparison'] => {
  const matchingFields: string[] = [];
  const differingFields: string[] = [];

  for (const field of REVIEW_COMPARISON_FIELDS) {
    const leftValue = stableStringify(left[field]);
    const rightValue = stableStringify(right[field]);
    if (leftValue === rightValue) matchingFields.push(field);
    else differingFields.push(field);
  }

  return {
    comparedPatternId,
    matchingFields,
    differingFields
  };
};

const explainReasonCodes = (codes: CompactionReviewReasonCode[]): string[] => codes.map((code) => REVIEW_REASON_MESSAGES[code]);

export const decideCompactionBucket = (
  inputCandidate: InternalCompactionCandidate,
  existingPatterns: InternalCompactionPattern[]
): { decision: CompactionDecision; canonicalCandidate: CanonicalCompactionCandidate; fingerprint: string } => {
  const canonicalCandidate = canonicalizeCompactionCandidate(inputCandidate);
  const fingerprint = fingerprintCompactionCandidate(canonicalCandidate);

  if (!canonicalCandidate.mechanism) {
    return { decision: { bucket: 'discard', reason: 'empty-mechanism' }, canonicalCandidate, fingerprint };
  }

  const sortedPatterns = sortCanonicalPatterns(existingPatterns);

  const candidateIdentityFingerprint = identityFingerprint(canonicalCandidate);
  const candidateMechanismFingerprint = mechanismFingerprint(canonicalCandidate);

  for (const pattern of sortedPatterns) {
    const patternFingerprint = fingerprintCompactionCandidate(pattern);
    if (patternFingerprint === fingerprint) {
      return {
        decision: { bucket: 'discard', reason: 'exact-duplicate' },
        canonicalCandidate,
        fingerprint
      };
    }

    if (identityFingerprint(pattern) === candidateIdentityFingerprint) {
      return {
        decision: { bucket: 'attach', reason: 'supports-existing-pattern', targetPatternId: pattern.id },
        canonicalCandidate,
        fingerprint
      };
    }

    if (mechanismFingerprint(pattern) === candidateMechanismFingerprint) {
      return {
        decision: { bucket: 'merge', reason: 'wording-variant-same-mechanism', mergeTargetPatternId: pattern.id },
        canonicalCandidate,
        fingerprint
      };
    }
  }

  return {
    decision: { bucket: 'add', reason: 'new-pattern' },
    canonicalCandidate,
    fingerprint
  };
};

export const buildCompactionReviewArtifact = (
  inputCandidate: InternalCompactionCandidate,
  existingPatterns: InternalCompactionPattern[]
): CompactionReviewArtifact => {
  const { decision, canonicalCandidate, fingerprint } = decideCompactionBucket(inputCandidate, existingPatterns);
  const reasonCodes = reasonCodesForDecision(decision);
  const explanations = explainReasonCodes(reasonCodes);
  const candidateRef = inputCandidate.candidateRef?.trim() || fingerprint;
  const sortedPatterns = sortCanonicalPatterns(existingPatterns);

  const artifact: CompactionReviewArtifact = {
    candidateRef,
    canonicalFingerprint: fingerprint,
    canonicalCandidate,
    bucket: decision.bucket,
    reasonCodes,
    explanations
  };

  if (decision.bucket === 'discard') {
    artifact.discardRationale = explanations.join(' ');
  }

  if (decision.bucket === 'attach') {
    artifact.targetPatternId = decision.targetPatternId;
    artifact.attachRationale = explanations.join(' ');
    const target = sortedPatterns.find((pattern) => pattern.id === decision.targetPatternId);
    if (target) artifact.comparison = compareCanonicalCandidates(canonicalCandidate, target, target.id);
  }

  if (decision.bucket === 'merge') {
    artifact.mergeTargetPatternId = decision.mergeTargetPatternId;
    artifact.mergeRationale = explanations.join(' ');
    const target = sortedPatterns.find((pattern) => pattern.id === decision.mergeTargetPatternId);
    if (target) artifact.comparison = compareCanonicalCandidates(canonicalCandidate, target, target.id);
  }

  if (decision.bucket === 'add') {
    artifact.noveltyRationale = explanations.join(' ');
  }

  return artifact;
};
