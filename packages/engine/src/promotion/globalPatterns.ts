import fs from 'node:fs';
import path from 'node:path';
import { readPatternKnowledgeStoreArtifact, resolvePatternKnowledgeStore, resolvePlaybookHomePath } from '../patternStore.js';
export { DEFAULT_PLAYBOOK_HOME_DIRNAME, PLAYBOOK_HOME_ENV } from '../patternStore.js';

export const GLOBAL_PATTERN_CANDIDATES_SCHEMA_VERSION = '1.0' as const;
export const GLOBAL_PATTERNS_SCHEMA_VERSION = '1.0' as const;
export const PATTERN_CANDIDATES_FILENAME = 'pattern-candidates.json' as const;
export const PATTERNS_FILENAME = 'patterns.json' as const;

export type SourceRef = {
  repoId: string;
  artifactPath: string;
  entryId: string;
  fingerprint: string;
};

export type StoryProvenance = {
  sourceRefs: SourceRef[];
};

export type PatternCandidateRecord = {
  id: string;
  title: string;
  when: string;
  then: string;
  because: string;
  normalizationKey: string;
  storySeed?: string;
  sourceRefs: SourceRef[];
  fingerprint: string;
};

export type PatternCandidateArtifact = {
  schemaVersion: typeof GLOBAL_PATTERN_CANDIDATES_SCHEMA_VERSION;
  kind: 'pattern-candidates';
  candidates: PatternCandidateRecord[];
};

export type PatternRecord = {
  id: string;
  title: string;
  when: string;
  then: string;
  because: string;
  normalizationKey: string;
  storySeed?: string;
  sourceRefs: SourceRef[];
  status: 'active' | 'superseded' | 'retired' | 'demoted';
  promotedAt: string;
  provenance: StoryProvenance;
  supersededBy?: string | null;
  supersedes?: string[];
  retiredAt?: string | null;
  retirementReason?: string | null;
  demotedAt?: string | null;
  demotionReason?: string | null;
  recalledAt?: string | null;
  recallReason?: string | null;
};

export type PatternArtifact = {
  schemaVersion: typeof GLOBAL_PATTERNS_SCHEMA_VERSION;
  kind: 'patterns';
  patterns: PatternRecord[];
};

const compareById = <T extends { id: string }>(left: T, right: T): number => left.id.localeCompare(right.id);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((acc, key) => {
        const normalized = canonicalize(record[key]);
        if (normalized !== undefined) acc[key] = normalized;
        return acc;
      }, {});
  }

  return value;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const normalizeSourceRef = (value: SourceRef): SourceRef => ({
  artifactPath: value.artifactPath,
  entryId: value.entryId,
  fingerprint: value.fingerprint,
  repoId: value.repoId
});

const normalizeCandidate = (value: PatternCandidateRecord): PatternCandidateRecord => ({
  ...value,
  sourceRefs: [...value.sourceRefs].map(normalizeSourceRef).sort((left, right) =>
    left.repoId.localeCompare(right.repoId) ||
    left.artifactPath.localeCompare(right.artifactPath) ||
    left.entryId.localeCompare(right.entryId) ||
    left.fingerprint.localeCompare(right.fingerprint)
  )
});

const normalizePattern = (value: PatternRecord): PatternRecord => ({
  ...value,
  supersededBy: value.supersededBy ?? null,
  supersedes: [...new Set(value.supersedes ?? [])].sort((left, right) => left.localeCompare(right)),
  retiredAt: value.retiredAt ?? null,
  retirementReason: value.retirementReason ?? null,
  demotedAt: value.demotedAt ?? null,
  demotionReason: value.demotionReason ?? null,
  recalledAt: value.recalledAt ?? null,
  recallReason: value.recallReason ?? null,
  provenance: {
    sourceRefs: [...value.provenance.sourceRefs].map(normalizeSourceRef).sort((left, right) =>
      left.repoId.localeCompare(right.repoId) ||
      left.artifactPath.localeCompare(right.artifactPath) ||
      left.entryId.localeCompare(right.entryId) ||
      left.fingerprint.localeCompare(right.fingerprint)
    )
  },
  sourceRefs: [...value.sourceRefs].map(normalizeSourceRef).sort((left, right) =>
    left.repoId.localeCompare(right.repoId) ||
    left.artifactPath.localeCompare(right.artifactPath) ||
    left.entryId.localeCompare(right.entryId) ||
    left.fingerprint.localeCompare(right.fingerprint)
  )
});

export const resolvePlaybookHome = (): string => resolvePlaybookHomePath();

export const createDefaultGlobalPatternCandidatesArtifact = (): PatternCandidateArtifact => ({
  schemaVersion: GLOBAL_PATTERN_CANDIDATES_SCHEMA_VERSION,
  kind: 'pattern-candidates',
  candidates: []
});

export const createDefaultGlobalPatternsArtifact = (): PatternArtifact => ({
  schemaVersion: GLOBAL_PATTERNS_SCHEMA_VERSION,
  kind: 'patterns',
  patterns: []
});

export const canonicalizePatternCandidateArtifact = (artifact: PatternCandidateArtifact): PatternCandidateArtifact => ({
  ...artifact,
  candidates: [...artifact.candidates].map(normalizeCandidate).sort(compareById)
});

export const canonicalizePatternArtifact = (artifact: PatternArtifact): PatternArtifact => ({
  ...artifact,
  patterns: [...artifact.patterns].map(normalizePattern).sort(compareById)
});

export const readGlobalPatternCandidatesArtifact = (playbookHome = resolvePlaybookHome()): PatternCandidateArtifact => {
  const targetPath = path.join(playbookHome, PATTERN_CANDIDATES_FILENAME);
  if (!fs.existsSync(targetPath)) {
    return createDefaultGlobalPatternCandidatesArtifact();
  }

  return canonicalizePatternCandidateArtifact(JSON.parse(fs.readFileSync(targetPath, 'utf8')) as PatternCandidateArtifact);
};

export const readGlobalPatternsArtifact = (playbookHome = resolvePlaybookHome()): PatternArtifact => {
  const { artifact } = readPatternKnowledgeStoreArtifact('global_reusable_pattern_memory', createDefaultGlobalPatternsArtifact(), { playbookHome });
  return canonicalizePatternArtifact(artifact as PatternArtifact);
};

export const writeGlobalPatternCandidatesArtifact = (
  artifact: PatternCandidateArtifact,
  playbookHome = resolvePlaybookHome()
): string => {
  const targetPath = path.join(playbookHome, PATTERN_CANDIDATES_FILENAME);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, deterministicStringify(canonicalizePatternCandidateArtifact(artifact)), 'utf8');
  return targetPath;
};

export const writeGlobalPatternsArtifact = (artifact: PatternArtifact, playbookHome = resolvePlaybookHome()): string => {
  const targetPath = resolvePatternKnowledgeStore('global_reusable_pattern_memory', { playbookHome }).absolutePath;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, deterministicStringify(canonicalizePatternArtifact(artifact)), 'utf8');
  return targetPath;
};
