import type { CandidateRelated, CompactionCandidate } from './candidateTypes.js';
import { COMPACTION_CANDIDATE_SCHEMA_VERSION } from './candidateTypes.js';
import { createCandidateFingerprint } from './candidateFingerprint.js';

type CandidateInput = Omit<CompactionCandidate, 'schemaVersion' | 'kind' | 'candidateId' | 'canonical' | 'evidence' | 'related'> & {
  evidence: CompactionCandidate['evidence'];
  related?: Partial<CandidateRelated>;
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeMechanismText = (value: string): string =>
  normalizeText(value)
    .replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z\b/g, ' <timestamp> ')
    .replace(/\b(?:sha|hash)[=:]\s*[a-f0-9]{7,64}\b/gi, ' hash=<hash> ')
    .replace(/\b[0-9a-f]{7,40}\b/gi, '<hash>')
    .replace(/\/workspace\/[^\s)]+/g, '<workspace-path>')
    .replace(/\b[a-f0-9]{8}-[a-f0-9-]{27}\b/gi, '<uuid>')
    .replace(/\s+/g, ' ')
    .trim();

const toStableRolePath = (value: string): string => {
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized) return normalized;
  if (normalized.startsWith('packages/cli/')) return normalized.replace(/^packages\/cli\//, 'role:cli/');
  if (normalized.startsWith('packages/engine/')) return normalized.replace(/^packages\/engine\//, 'role:engine/');
  if (normalized.startsWith('packages/core/')) return normalized.replace(/^packages\/core\//, 'role:core/');
  if (normalized.startsWith('packages/node/')) return normalized.replace(/^packages\/node\//, 'role:node/');
  if (normalized.startsWith('docs/')) return normalized.replace(/^docs\//, 'role:docs/');
  return normalized;
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const normalizeRelated = (related?: Partial<CandidateRelated>): CandidateRelated => ({
  modules: uniqueSorted((related?.modules ?? []).map((value) => value.trim())),
  rules: uniqueSorted((related?.rules ?? []).map((value) => value.trim())),
  docs: uniqueSorted((related?.docs ?? []).map((value) => toStableRolePath(value))),
  owners: uniqueSorted((related?.owners ?? []).map((value) => value.trim().toLowerCase())),
  graphNodes: uniqueSorted((related?.graphNodes ?? []).map((value) => value.trim())),
  riskSignals: uniqueSorted((related?.riskSignals ?? []).map((value) => normalizeMechanismText(value))),
  tests: uniqueSorted((related?.tests ?? []).map((value) => toStableRolePath(value)))
});

export const canonicalizeCandidate = (input: CandidateInput): CompactionCandidate => {
  const normalizedSubject = `${input.subjectKind}:${toStableRolePath(input.subjectRef)}`;
  const normalizedTrigger = normalizeMechanismText(input.trigger);
  const normalizedMechanism = normalizeMechanismText(input.mechanism);

  const related = normalizeRelated(input.related);
  const canonicalCore = {
    sourceKind: input.sourceKind,
    subjectKind: input.subjectKind,
    normalizedSubject,
    normalizedTrigger,
    normalizedMechanism,
    invariant: normalizeMechanismText(input.invariant ?? ''),
    response: normalizeMechanismText(input.response ?? ''),
    related
  };

  const fingerprint = createCandidateFingerprint(canonicalCore);

  const evidence = [...input.evidence]
    .map((entry) => ({
      sourceKind: entry.sourceKind,
      sourceRef: entry.sourceRef.trim(),
      pointer: entry.pointer.trim(),
      summary: normalizeMechanismText(entry.summary)
    }))
    .filter((entry) => entry.sourceRef && entry.pointer && entry.summary)
    .sort((a, b) =>
      a.sourceKind.localeCompare(b.sourceKind) ||
      a.sourceRef.localeCompare(b.sourceRef) ||
      a.pointer.localeCompare(b.pointer) ||
      a.summary.localeCompare(b.summary)
    );

  return {
    schemaVersion: COMPACTION_CANDIDATE_SCHEMA_VERSION,
    kind: 'compaction-candidate',
    candidateId: `${input.sourceKind}:${fingerprint.slice(0, 16)}`,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    subjectKind: input.subjectKind,
    subjectRef: input.subjectRef,
    trigger: input.trigger.trim(),
    mechanism: input.mechanism.trim(),
    invariant: input.invariant?.trim() || undefined,
    response: input.response?.trim() || undefined,
    evidence,
    related,
    canonical: {
      normalizedTrigger,
      normalizedMechanism,
      normalizedSubject,
      fingerprint
    }
  };
};
