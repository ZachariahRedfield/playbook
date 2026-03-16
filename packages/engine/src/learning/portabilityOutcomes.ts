import { createHash } from 'node:crypto';
import path from 'node:path';
import type {
  PortabilityAdoptionStatus,
  PortabilityDecisionStatus,
  PortabilityObservedOutcome,
  PortabilityOutcomeRecord
} from '@zachariahredfield/playbook-core';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';

export const PORTABILITY_OUTCOMES_SCHEMA_VERSION = '1.0' as const;
export const PORTABILITY_OUTCOMES_RELATIVE_PATH = '.playbook/portability-outcomes.json' as const;

export type PortabilityOutcomesArtifact = {
  schemaVersion: typeof PORTABILITY_OUTCOMES_SCHEMA_VERSION;
  kind: 'portability-outcomes';
  generatedAt: string;
  records: PortabilityOutcomeRecord[];
};

export type PortabilityOutcomeInput = Omit<PortabilityOutcomeRecord, 'record_id'>;

export type PortabilityOutcomeSummary = {
  total_records: number;
  decision_status_counts: Record<PortabilityDecisionStatus, number>;
  by_pattern: Record<string, number>;
  by_source_repo: Record<string, number>;
  by_target_repo: Record<string, number>;
};

const PORTABILITY_DECISIONS: readonly PortabilityDecisionStatus[] = ['proposed', 'reviewed', 'accepted', 'rejected', 'superseded'] as const;
const PORTABILITY_ADOPTIONS: readonly PortabilityAdoptionStatus[] = ['adopted', 'not-adopted', 'superseded'] as const;
const PORTABILITY_OBSERVED_OUTCOMES: readonly PortabilityObservedOutcome[] = ['successful', 'unsuccessful', 'inconclusive'] as const;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asDecisionStatus = (value: unknown): PortabilityDecisionStatus => {
  if (typeof value === 'string' && (PORTABILITY_DECISIONS as readonly string[]).includes(value)) {
    return value as PortabilityDecisionStatus;
  }
  return 'proposed';
};

const asAdoptionStatus = (value: unknown): PortabilityAdoptionStatus | undefined => {
  if (typeof value === 'string' && (PORTABILITY_ADOPTIONS as readonly string[]).includes(value)) {
    return value as PortabilityAdoptionStatus;
  }
  return undefined;
};

const asObservedOutcome = (value: unknown): PortabilityObservedOutcome | undefined => {
  if (typeof value === 'string' && (PORTABILITY_OBSERVED_OUTCOMES as readonly string[]).includes(value)) {
    return value as PortabilityObservedOutcome;
  }
  return undefined;
};

const round4 = (value: number): number => Number(value.toFixed(4));

const asOutcomeConfidence = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return round4(Math.max(0, Math.min(1, value)));
};

const asTimestamp = (value: unknown): string => asNonEmptyString(value) ?? new Date(0).toISOString();

const compareRecords = (left: PortabilityOutcomeRecord, right: PortabilityOutcomeRecord): number =>
  left.timestamp.localeCompare(right.timestamp) ||
  left.recommendation_id.localeCompare(right.recommendation_id) ||
  left.pattern_id.localeCompare(right.pattern_id) ||
  left.source_repo.localeCompare(right.source_repo) ||
  left.target_repo.localeCompare(right.target_repo) ||
  left.decision_status.localeCompare(right.decision_status) ||
  left.record_id.localeCompare(right.record_id);

const buildRecordId = (record: Omit<PortabilityOutcomeRecord, 'record_id'>): string => {
  const digest = createHash('sha256').update(JSON.stringify(record), 'utf8').digest('hex').slice(0, 16);
  return `portability-outcome-${digest}`;
};

const normalizeRecord = (input: Partial<PortabilityOutcomeRecord>): PortabilityOutcomeRecord => {
  const recommendationId = asNonEmptyString(input.recommendation_id) ?? 'unknown-recommendation';
  const patternId = asNonEmptyString(input.pattern_id) ?? recommendationId;
  const sourceRepo = asNonEmptyString(input.source_repo) ?? 'unknown-source';
  const targetRepo = asNonEmptyString(input.target_repo) ?? 'unknown-target';
  const decisionStatus = asDecisionStatus(input.decision_status);
  const timestamp = asTimestamp(input.timestamp);
  const decisionReason = asNonEmptyString(input.decision_reason);
  const adoptionStatus = asAdoptionStatus(input.adoption_status);
  const observedOutcome = asObservedOutcome(input.observed_outcome);
  const outcomeConfidence = asOutcomeConfidence(input.outcome_confidence);

  const base: Omit<PortabilityOutcomeRecord, 'record_id'> = {
    recommendation_id: recommendationId,
    pattern_id: patternId,
    source_repo: sourceRepo,
    target_repo: targetRepo,
    decision_status: decisionStatus,
    ...(decisionReason ? { decision_reason: decisionReason } : {}),
    ...(adoptionStatus ? { adoption_status: adoptionStatus } : {}),
    ...(observedOutcome ? { observed_outcome: observedOutcome } : {}),
    ...(outcomeConfidence === undefined ? {} : { outcome_confidence: outcomeConfidence }),
    timestamp
  };

  return {
    record_id: asNonEmptyString(input.record_id) ?? buildRecordId(base),
    ...base
  };
};

const readArtifact = (repoRoot: string): PortabilityOutcomesArtifact | undefined =>
  readJsonIfExists<PortabilityOutcomesArtifact>(path.join(repoRoot, PORTABILITY_OUTCOMES_RELATIVE_PATH));

export const listPortabilityOutcomes = (repoRoot: string): PortabilityOutcomeRecord[] => {
  const artifact = readArtifact(repoRoot);
  const rawRecords = artifact?.schemaVersion === PORTABILITY_OUTCOMES_SCHEMA_VERSION && Array.isArray(artifact.records) ? artifact.records : [];
  return rawRecords.map((entry) => normalizeRecord(entry)).sort(compareRecords);
};

export const summarizePortabilityOutcomes = (records: PortabilityOutcomeRecord[]): PortabilityOutcomeSummary => {
  const byPattern = new Map<string, number>();
  const bySourceRepo = new Map<string, number>();
  const byTargetRepo = new Map<string, number>();
  const decisionStatusCounts = new Map<PortabilityDecisionStatus, number>(PORTABILITY_DECISIONS.map((entry) => [entry, 0]));

  for (const record of records) {
    byPattern.set(record.pattern_id, (byPattern.get(record.pattern_id) ?? 0) + 1);
    bySourceRepo.set(record.source_repo, (bySourceRepo.get(record.source_repo) ?? 0) + 1);
    byTargetRepo.set(record.target_repo, (byTargetRepo.get(record.target_repo) ?? 0) + 1);
    decisionStatusCounts.set(record.decision_status, (decisionStatusCounts.get(record.decision_status) ?? 0) + 1);
  }

  const toSortedRecord = (map: Map<string, number>): Record<string, number> =>
    Object.fromEntries([...map.entries()].sort((left, right) => left[0].localeCompare(right[0])));

  return {
    total_records: records.length,
    decision_status_counts: Object.fromEntries(PORTABILITY_DECISIONS.map((entry) => [entry, decisionStatusCounts.get(entry) ?? 0])) as Record<
      PortabilityDecisionStatus,
      number
    >,
    by_pattern: toSortedRecord(byPattern),
    by_source_repo: toSortedRecord(bySourceRepo),
    by_target_repo: toSortedRecord(byTargetRepo)
  };
};

export const writePortabilityOutcomeRecord = (repoRoot: string, input: PortabilityOutcomeInput): { artifactPath: string; record: PortabilityOutcomeRecord } => {
  const artifactPath = path.join(repoRoot, PORTABILITY_OUTCOMES_RELATIVE_PATH);
  const records = listPortabilityOutcomes(repoRoot);
  const record = normalizeRecord(input);

  const deduped = records.filter((entry) => entry.record_id !== record.record_id);
  const nextRecords = [...deduped, record].sort(compareRecords);

  const artifact: PortabilityOutcomesArtifact = {
    schemaVersion: PORTABILITY_OUTCOMES_SCHEMA_VERSION,
    kind: 'portability-outcomes',
    generatedAt: nextRecords[nextRecords.length - 1]?.timestamp ?? new Date(0).toISOString(),
    records: nextRecords
  };

  writeDeterministicJsonAtomic(artifactPath, artifact);
  return { artifactPath, record };
};

export const getPortabilityOutcomeSummary = (repoRoot: string): PortabilityOutcomeSummary => summarizePortabilityOutcomes(listPortabilityOutcomes(repoRoot));

export const findPortabilityOutcomes = (
  repoRoot: string,
  filters: Partial<Pick<PortabilityOutcomeRecord, 'pattern_id' | 'source_repo' | 'target_repo' | 'decision_status'>>
): PortabilityOutcomeRecord[] => {
  const records = listPortabilityOutcomes(repoRoot);
  return records.filter((record) => {
    if (filters.pattern_id && record.pattern_id !== filters.pattern_id) return false;
    if (filters.source_repo && record.source_repo !== filters.source_repo) return false;
    if (filters.target_repo && record.target_repo !== filters.target_repo) return false;
    if (filters.decision_status && record.decision_status !== filters.decision_status) return false;
    return true;
  });
};
