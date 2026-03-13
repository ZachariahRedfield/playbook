import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { MemoryCandidateKind, MemoryReplayCandidate, MemoryReplayResult } from '../schema/memoryReplay.js';

const MEMORY_CANDIDATES_PATH = '.playbook/memory/candidates.json' as const;
const KNOWLEDGE_DIR = '.playbook/memory/knowledge' as const;
const KNOWLEDGE_SCHEMA_VERSION = '1.0' as const;
const CANDIDATE_STALE_DAYS = 30;

export type MemoryKnowledgeKind = Exclude<MemoryCandidateKind, 'open_question'>;

export type MemoryKnowledgeEntry = {
  knowledgeId: string;
  candidateId: string;
  sourceCandidateIds: string[];
  sourceEventFingerprints: string[];
  kind: MemoryKnowledgeKind;
  title: string;
  summary: string;
  fingerprint: string;
  module: string;
  ruleId: string;
  failureShape: string;
  promotedAt: string;
  provenance: MemoryReplayCandidate['provenance'];
  status: 'active' | 'superseded' | 'retired';
  supersedes: string[];
  supersededBy: string[];
  retiredAt?: string;
  retirementReason?: string;
};

export type MemoryKnowledgeArtifact = {
  schemaVersion: typeof KNOWLEDGE_SCHEMA_VERSION;
  artifact: 'memory-knowledge';
  kind: MemoryKnowledgeKind;
  generatedAt: string;
  entries: MemoryKnowledgeEntry[];
};

export type MemoryPromotionResult = {
  schemaVersion: '1.0';
  command: 'memory-promote';
  promoted: MemoryKnowledgeEntry;
  supersededIds: string[];
  artifactPath: string;
};

export type MemoryRetireResult = {
  schemaVersion: '1.0';
  command: 'memory-retire';
  retired: MemoryKnowledgeEntry;
  artifactPath: string;
};

export type MemorySupersedeResult = {
  schemaVersion: '1.0';
  command: 'memory-supersede';
  superseded: MemoryKnowledgeEntry;
  successor: MemoryKnowledgeEntry;
  artifactPath: string;
};

export type MemoryPruneResult = {
  schemaVersion: '1.0';
  command: 'memory-prune';
  staleCandidatesPruned: number;
  supersededKnowledgePruned: number;
  duplicateKnowledgeCollapsed: number;
  duplicateCandidatesCollapsed: number;
  updatedArtifacts: string[];
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const safeIsoDate = (value: string | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

const knowledgePathByKind: Record<MemoryKnowledgeKind, string> = {
  decision: `${KNOWLEDGE_DIR}/decisions.json`,
  pattern: `${KNOWLEDGE_DIR}/patterns.json`,
  failure_mode: `${KNOWLEDGE_DIR}/failure-modes.json`,
  invariant: `${KNOWLEDGE_DIR}/invariants.json`
};

const resolveKnowledgePath = (kind: MemoryKnowledgeKind): string => knowledgePathByKind[kind];

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const readCandidates = (projectRoot: string): MemoryReplayResult => {
  const fullPath = path.join(projectRoot, MEMORY_CANDIDATES_PATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`playbook memory promote: missing replay artifact at ${MEMORY_CANDIDATES_PATH}`);
  }

  const parsed = readJson<MemoryReplayResult>(fullPath);
  if (!Array.isArray(parsed.candidates)) {
    throw new Error(`playbook memory promote: invalid replay artifact at ${MEMORY_CANDIDATES_PATH}`);
  }
  return parsed;
};

const ensureCandidateComplete = (candidate: MemoryReplayCandidate): void => {
  if (!isNonEmptyString(candidate.candidateId)) {
    throw new Error('playbook memory promote: invalid candidate: missing candidateId');
  }
  if (!isNonEmptyString(candidate.title) || !isNonEmptyString(candidate.summary) || !isNonEmptyString(candidate.fingerprint)) {
    throw new Error(`playbook memory promote: invalid candidate: incomplete narrative fields for ${candidate.candidateId}`);
  }
  if (!isNonEmptyString(candidate.module) || !isNonEmptyString(candidate.ruleId) || !isNonEmptyString(candidate.failureShape)) {
    throw new Error(`playbook memory promote: invalid candidate: missing classification fields for ${candidate.candidateId}`);
  }
  if (!Array.isArray(candidate.provenance) || candidate.provenance.length === 0) {
    throw new Error(`playbook memory promote: invalid candidate: missing provenance for ${candidate.candidateId}`);
  }
  for (const provenance of candidate.provenance) {
    if (!isNonEmptyString(provenance.eventId) || !isNonEmptyString(provenance.sourcePath) || !isNonEmptyString(provenance.fingerprint)) {
      throw new Error(`playbook memory promote: invalid candidate: malformed provenance for ${candidate.candidateId}`);
    }
  }
};

export const listCandidateKnowledge = (projectRoot: string): MemoryReplayCandidate[] =>
  [...readCandidates(projectRoot).candidates].sort((left, right) => left.candidateId.localeCompare(right.candidateId));

export const loadCandidateKnowledgeById = (projectRoot: string, candidateId: string): MemoryReplayCandidate => {
  const candidate = readCandidates(projectRoot).candidates.find((entry) => entry.candidateId === candidateId);
  if (!candidate) {
    throw new Error(`playbook memory promote: candidate not found: ${candidateId}`);
  }
  return candidate;
};

const readKnowledgeArtifact = (projectRoot: string, kind: MemoryKnowledgeKind): MemoryKnowledgeArtifact => {
  const relativePath = resolveKnowledgePath(kind);
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    return {
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      artifact: 'memory-knowledge',
      kind,
      generatedAt: new Date(0).toISOString(),
      entries: []
    };
  }

  const parsed = readJson<Partial<MemoryKnowledgeArtifact>>(fullPath);
  const entries = Array.isArray(parsed.entries)
    ? (parsed.entries as Partial<MemoryKnowledgeEntry>[]).map((entry) => {
      const status: MemoryKnowledgeEntry['status'] = entry.status === 'superseded' || entry.status === 'retired' ? entry.status : 'active';
      return {
        knowledgeId: entry.knowledgeId ?? '',
        candidateId: entry.candidateId ?? '',
        sourceCandidateIds: uniqueSorted([...(Array.isArray(entry.sourceCandidateIds) ? entry.sourceCandidateIds : []), ...(entry.candidateId ? [entry.candidateId] : [])]),
        sourceEventFingerprints: uniqueSorted(Array.isArray(entry.sourceEventFingerprints)
          ? entry.sourceEventFingerprints
          : Array.isArray(entry.provenance)
            ? entry.provenance.map((source) => source.fingerprint)
            : []),
        kind: (entry.kind ?? kind) as MemoryKnowledgeKind,
        title: entry.title ?? '',
        summary: entry.summary ?? '',
        fingerprint: entry.fingerprint ?? '',
        module: entry.module ?? '',
        ruleId: entry.ruleId ?? '',
        failureShape: entry.failureShape ?? '',
        promotedAt: entry.promotedAt ?? new Date(0).toISOString(),
        provenance: Array.isArray(entry.provenance) ? entry.provenance : [],
        status,
        supersedes: uniqueSorted(Array.isArray(entry.supersedes) ? entry.supersedes : []),
        supersededBy: uniqueSorted(Array.isArray(entry.supersededBy) ? entry.supersededBy : []),
        ...(safeIsoDate(entry.retiredAt) ? { retiredAt: safeIsoDate(entry.retiredAt) as string } : {}),
        ...(isNonEmptyString(entry.retirementReason) ? { retirementReason: entry.retirementReason } : {})
      };
    })
    : [];

  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    artifact: 'memory-knowledge',
    kind,
    generatedAt: safeIsoDate(parsed.generatedAt) ?? new Date(0).toISOString(),
    entries
  };
};

const toKnowledgeId = (candidate: MemoryReplayCandidate): string =>
  `${candidate.kind}-${createHash('sha256').update(`${candidate.candidateId}:${candidate.fingerprint}`).digest('hex').slice(0, 16)}`;

const toComparableTimestamp = (value: string): number => Date.parse(value) || 0;

const sortEntries = (entries: MemoryKnowledgeEntry[]): MemoryKnowledgeEntry[] =>
  [...entries].sort((a, b) => {
    const promotedDelta = toComparableTimestamp(b.promotedAt) - toComparableTimestamp(a.promotedAt);
    if (promotedDelta !== 0) {
      return promotedDelta;
    }
    return a.knowledgeId.localeCompare(b.knowledgeId);
  });

export const promoteMemoryCandidate = (projectRoot: string, fromCandidateId: string): MemoryPromotionResult => {
  const candidate = loadCandidateKnowledgeById(projectRoot, fromCandidateId);
  ensureCandidateComplete(candidate);

  if (candidate.kind === 'open_question') {
    throw new Error('playbook memory promote: open_question candidates are not promotable into doctrine knowledge artifacts');
  }

  const kind = candidate.kind;
  const relativeArtifactPath = resolveKnowledgePath(kind);
  const fullArtifactPath = path.join(projectRoot, relativeArtifactPath);
  const current = readKnowledgeArtifact(projectRoot, kind);

  const nowIso = new Date().toISOString();
  const matchingActive = current.entries.filter((entry) => entry.fingerprint === candidate.fingerprint && entry.status === 'active');
  const promotedEntry: MemoryKnowledgeEntry = {
    knowledgeId: toKnowledgeId(candidate),
    candidateId: candidate.candidateId,
    sourceCandidateIds: uniqueSorted([candidate.candidateId]),
    sourceEventFingerprints: uniqueSorted(candidate.provenance.map((entry) => entry.fingerprint)),
    kind,
    title: candidate.title,
    summary: candidate.summary,
    fingerprint: candidate.fingerprint,
    module: candidate.module,
    ruleId: candidate.ruleId,
    failureShape: candidate.failureShape,
    promotedAt: nowIso,
    provenance: candidate.provenance,
    status: 'active',
    supersedes: uniqueSorted(matchingActive.map((entry) => entry.knowledgeId)),
    supersededBy: []
  };

  const updatedExisting = current.entries.map((entry) => {
    if (promotedEntry.supersedes.includes(entry.knowledgeId)) {
      return {
        ...entry,
        status: 'superseded' as const,
        supersededBy: uniqueSorted([...entry.supersededBy, promotedEntry.knowledgeId])
      };
    }
    return entry;
  });

  const nextEntries = sortEntries([...updatedExisting, promotedEntry]);

  writeJson(fullArtifactPath, {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    artifact: 'memory-knowledge',
    kind,
    generatedAt: nowIso,
    entries: nextEntries
  } satisfies MemoryKnowledgeArtifact);

  return {
    schemaVersion: '1.0',
    command: 'memory-promote',
    promoted: promotedEntry,
    supersededIds: promotedEntry.supersedes,
    artifactPath: relativeArtifactPath
  };
};

const writeKnowledgeArtifact = (projectRoot: string, kind: MemoryKnowledgeKind, artifact: MemoryKnowledgeArtifact): void => {
  writeJson(path.join(projectRoot, resolveKnowledgePath(kind)), artifact);
};

const requireKnowledgeEntry = (artifact: MemoryKnowledgeArtifact, knowledgeId: string): MemoryKnowledgeEntry => {
  const entry = artifact.entries.find((item) => item.knowledgeId === knowledgeId);
  if (!entry) {
    throw new Error(`playbook memory knowledge: record not found: ${knowledgeId}`);
  }
  return entry;
};

export const retirePromotedKnowledge = (
  projectRoot: string,
  knowledgeId: string,
  input: { reason: string; allowAlreadyRetired?: boolean }
): MemoryRetireResult => {
  if (!isNonEmptyString(input.reason)) {
    throw new Error('playbook memory retire: retirement reason is required');
  }

  for (const kind of Object.keys(knowledgePathByKind) as MemoryKnowledgeKind[]) {
    const artifact = readKnowledgeArtifact(projectRoot, kind);
    const target = artifact.entries.find((entry) => entry.knowledgeId === knowledgeId);
    if (!target) {
      continue;
    }

    if (target.status === 'retired' && !input.allowAlreadyRetired) {
      throw new Error(`playbook memory retire: knowledge ${knowledgeId} is already retired; provide explicit reason handling`);
    }

    const retiredAt = new Date().toISOString();
    const updated = artifact.entries.map((entry) =>
      entry.knowledgeId === knowledgeId
        ? {
          ...entry,
          status: 'retired' as const,
          retiredAt,
          retirementReason: input.reason
        }
        : entry
    );

    const nextArtifact = { ...artifact, generatedAt: retiredAt, entries: sortEntries(updated) };
    writeKnowledgeArtifact(projectRoot, kind, nextArtifact);
    return {
      schemaVersion: '1.0',
      command: 'memory-retire',
      retired: requireKnowledgeEntry(nextArtifact, knowledgeId),
      artifactPath: resolveKnowledgePath(kind)
    };
  }

  throw new Error(`playbook memory retire: knowledge not found: ${knowledgeId}`);
};

export const supersedePromotedKnowledge = (
  projectRoot: string,
  supersededKnowledgeId: string,
  successorKnowledgeId: string
): MemorySupersedeResult => {
  const kinds = Object.keys(knowledgePathByKind) as MemoryKnowledgeKind[];
  const artifacts = kinds.map((kind) => ({ kind, artifact: readKnowledgeArtifact(projectRoot, kind) }));

  const supersededLocation = artifacts.find(({ artifact }) => artifact.entries.some((entry) => entry.knowledgeId === supersededKnowledgeId));
  const successorLocation = artifacts.find(({ artifact }) => artifact.entries.some((entry) => entry.knowledgeId === successorKnowledgeId));

  if (!supersededLocation || !successorLocation) {
    throw new Error('playbook memory supersede: knowledge records not found');
  }

  if (supersededLocation.kind !== successorLocation.kind) {
    throw new Error('playbook memory supersede: incompatible knowledge kinds cannot be superseded');
  }

  const kind = supersededLocation.kind;
  const artifact = supersededLocation.artifact;
  const superseded = requireKnowledgeEntry(artifact, supersededKnowledgeId);
  const successor = requireKnowledgeEntry(artifact, successorKnowledgeId);

  const nowIso = new Date().toISOString();
  const updatedEntries = artifact.entries.map((entry) => {
    if (entry.knowledgeId === supersededKnowledgeId) {
      return {
        ...entry,
        status: 'superseded' as const,
        supersededBy: uniqueSorted([...entry.supersededBy, successorKnowledgeId]),
        retiredAt: entry.retiredAt,
        retirementReason: entry.retirementReason
      };
    }

    if (entry.knowledgeId === successorKnowledgeId) {
      return {
        ...entry,
        supersedes: uniqueSorted([...entry.supersedes, supersededKnowledgeId]),
        sourceCandidateIds: uniqueSorted([...entry.sourceCandidateIds, ...superseded.sourceCandidateIds]),
        sourceEventFingerprints: uniqueSorted([...entry.sourceEventFingerprints, ...superseded.sourceEventFingerprints])
      };
    }

    return entry;
  });

  const nextArtifact = {
    ...artifact,
    generatedAt: nowIso,
    entries: sortEntries(updatedEntries)
  };
  writeKnowledgeArtifact(projectRoot, kind, nextArtifact);

  return {
    schemaVersion: '1.0',
    command: 'memory-supersede',
    superseded: requireKnowledgeEntry(nextArtifact, supersededKnowledgeId),
    successor: requireKnowledgeEntry(nextArtifact, successorKnowledgeId),
    artifactPath: resolveKnowledgePath(kind)
  };
};


const staleCutoffMs = (): number => Date.now() - CANDIDATE_STALE_DAYS * 24 * 60 * 60 * 1000;

const collapseByFingerprint = <T extends { fingerprint: string }>(entries: T[], chooseKeep: (left: T, right: T) => T): { kept: T[]; removed: number } => {
  const byFingerprint = new Map<string, T>();
  let removed = 0;

  for (const entry of entries) {
    const existing = byFingerprint.get(entry.fingerprint);
    if (!existing) {
      byFingerprint.set(entry.fingerprint, entry);
      continue;
    }
    removed += 1;
    byFingerprint.set(entry.fingerprint, chooseKeep(existing, entry));
  }

  return { kept: [...byFingerprint.values()], removed };
};

export const pruneMemoryKnowledge = (projectRoot: string): MemoryPruneResult => {
  const updatedArtifacts = new Set<string>();
  let staleCandidatesPruned = 0;
  let supersededKnowledgePruned = 0;
  let duplicateKnowledgeCollapsed = 0;
  let duplicateCandidatesCollapsed = 0;

  const candidatesPath = path.join(projectRoot, MEMORY_CANDIDATES_PATH);
  if (fs.existsSync(candidatesPath)) {
    const candidatesArtifact = readCandidates(projectRoot);
    const activeCandidates = candidatesArtifact.candidates.filter((candidate) => {
      const candidateLastSeen = safeIsoDate((candidate as MemoryReplayCandidate & { lastSeenAt?: string }).lastSeenAt);
      if (!candidateLastSeen) {
        return true;
      }
      if (Date.parse(candidateLastSeen) < staleCutoffMs()) {
        staleCandidatesPruned += 1;
        return false;
      }
      return true;
    });

    const dedupedCandidates = collapseByFingerprint(activeCandidates, (left) => left);
    duplicateCandidatesCollapsed += dedupedCandidates.removed;

    if (staleCandidatesPruned > 0 || duplicateCandidatesCollapsed > 0) {
      writeJson(candidatesPath, {
        ...candidatesArtifact,
        candidates: dedupedCandidates.kept
      });
      updatedArtifacts.add(MEMORY_CANDIDATES_PATH);
    }
  }

  (Object.keys(knowledgePathByKind) as MemoryKnowledgeKind[]).forEach((kind) => {
    const relativePath = resolveKnowledgePath(kind);
    const fullPath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      return;
    }

    const artifact = readKnowledgeArtifact(projectRoot, kind);
    const withoutSuperseded = artifact.entries.filter((entry) => {
      if (entry.status === 'superseded' || entry.supersededBy.length > 0) {
        supersededKnowledgePruned += 1;
        return false;
      }
      return true;
    });

    const deduped = collapseByFingerprint(withoutSuperseded, (left, right) =>
      toComparableTimestamp(left.promotedAt) >= toComparableTimestamp(right.promotedAt) ? left : right
    );

    duplicateKnowledgeCollapsed += deduped.removed;

    if (supersededKnowledgePruned > 0 || deduped.removed > 0) {
      writeJson(fullPath, {
        ...artifact,
        generatedAt: new Date().toISOString(),
        entries: sortEntries(deduped.kept)
      });
      updatedArtifacts.add(relativePath);
    }
  });

  return {
    schemaVersion: '1.0',
    command: 'memory-prune',
    staleCandidatesPruned,
    supersededKnowledgePruned,
    duplicateKnowledgeCollapsed,
    duplicateCandidatesCollapsed,
    updatedArtifacts: [...updatedArtifacts].sort((a, b) => a.localeCompare(b))
  };
};
