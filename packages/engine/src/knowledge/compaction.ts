import { createHash } from 'node:crypto';

type CompactionEvidence = {
  sourceType: string;
  sourceRef: string;
  summary: string;
};

export type InternalCompactionCandidate = {
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

export const decideCompactionBucket = (
  inputCandidate: InternalCompactionCandidate,
  existingPatterns: InternalCompactionPattern[]
): { decision: CompactionDecision; canonicalCandidate: CanonicalCompactionCandidate; fingerprint: string } => {
  const canonicalCandidate = canonicalizeCompactionCandidate(inputCandidate);
  const fingerprint = fingerprintCompactionCandidate(canonicalCandidate);

  if (!canonicalCandidate.mechanism) {
    return { decision: { bucket: 'discard', reason: 'empty-mechanism' }, canonicalCandidate, fingerprint };
  }

  const sortedPatterns = existingPatterns
    .map(canonicalizePattern)
    .sort((a, b) => a.id.localeCompare(b.id) || fingerprintCompactionCandidate(a).localeCompare(fingerprintCompactionCandidate(b)));

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
