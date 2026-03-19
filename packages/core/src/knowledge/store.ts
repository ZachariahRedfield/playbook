import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  KnowledgeArtifactType,
  KnowledgeCompareResult,
  KnowledgeLifecycleState,
  KnowledgeProvenanceResult,
  KnowledgeQueryOptions,
  KnowledgeRecord,
  KnowledgeSummary,
  KnowledgeSupersessionResult,
  KnowledgeTimelineOptions
} from './types.js';

const MEMORY_ROOT = '.playbook/memory' as const;
const MEMORY_EVENTS_DIR = `${MEMORY_ROOT}/events` as const;
const MEMORY_CANDIDATES_PATH = `${MEMORY_ROOT}/candidates.json` as const;
const KNOWLEDGE_PATHS = [
  `${MEMORY_ROOT}/knowledge/decisions.json`,
  `${MEMORY_ROOT}/knowledge/patterns.json`,
  `${MEMORY_ROOT}/knowledge/failure-modes.json`,
  `${MEMORY_ROOT}/knowledge/invariants.json`
] as const;
const DEFAULT_STALE_DAYS = 45;
const EPOCH_ISO = new Date(0).toISOString();
const PLAYBOOK_HOME_ENV = 'PLAYBOOK_HOME' as const;
const DEFAULT_PLAYBOOK_HOME_DIRNAME = '.playbook' as const;

type MemoryEventArtifact = {
  kind?: unknown;
  eventInstanceId?: unknown;
  eventFingerprint?: unknown;
  createdAt?: unknown;
  repoRevision?: unknown;
  sources?: unknown;
  subjectModules?: unknown;
  ruleIds?: unknown;
  riskSummary?: unknown;
  outcome?: unknown;
  salienceInputs?: unknown;
};

type MemoryCandidateProvenance = {
  eventId?: unknown;
  sourcePath?: unknown;
  fingerprint?: unknown;
  runId?: unknown;
};

type MemoryCandidateArtifact = {
  command?: unknown;
  generatedAt?: unknown;
  candidates?: unknown;
};

type MemoryCandidateEntry = {
  candidateId?: unknown;
  kind?: unknown;
  title?: unknown;
  summary?: unknown;
  clusterKey?: unknown;
  salienceScore?: unknown;
  salienceFactors?: unknown;
  fingerprint?: unknown;
  module?: unknown;
  ruleId?: unknown;
  failureShape?: unknown;
  eventCount?: unknown;
  provenance?: unknown;
  lastSeenAt?: unknown;
  supersession?: unknown;
};

type MemoryKnowledgeArtifact = {
  kind?: unknown;
  generatedAt?: unknown;
  entries?: unknown;
};

type MemoryKnowledgeEntry = {
  knowledgeId?: unknown;
  candidateId?: unknown;
  sourceCandidateIds?: unknown;
  sourceEventFingerprints?: unknown;
  kind?: unknown;
  title?: unknown;
  summary?: unknown;
  fingerprint?: unknown;
  module?: unknown;
  ruleId?: unknown;
  failureShape?: unknown;
  promotedAt?: unknown;
  provenance?: unknown;
  status?: unknown;
  supersedes?: unknown;
  supersededBy?: unknown;
  retiredAt?: unknown;
  retirementReason?: unknown;
};

type GlobalPatternLifecycleEvent = {
  operation?: unknown;
  at?: unknown;
  reason?: unknown;
  from_status?: unknown;
  to_status?: unknown;
};

type GlobalPatternEntry = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  pattern_family?: unknown;
  source_artifact?: unknown;
  signals?: unknown;
  confidence?: unknown;
  evidence_refs?: unknown;
  status?: unknown;
  provenance?: unknown;
  superseded_by?: unknown;
  retired_at?: unknown;
  retirement_reason?: unknown;
  demoted_at?: unknown;
  demotion_reason?: unknown;
  recalled_at?: unknown;
  recall_reason?: unknown;
  lifecycle_events?: unknown;
};

type GlobalPatternArtifact = {
  kind?: unknown;
  patterns?: unknown;
};

const safeReadJson = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const toRelativePath = (projectRoot: string, filePath: string): string =>
  path.relative(projectRoot, filePath).replaceAll('\\', '/');

const listJsonFiles = (dirPath: string): string[] => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return listJsonFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.json') ? [fullPath] : [];
  });
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

const toIsoDate = (value: unknown, fallback: string = EPOCH_ISO): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
};

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const resolveRepoName = (projectRoot: string): string => {
  const packageJson = safeReadJson<{ name?: unknown }>(path.join(projectRoot, 'package.json'));
  if (typeof packageJson?.name === 'string' && packageJson.name.trim().length > 0) {
    return packageJson.name;
  }

  return path.basename(projectRoot);
};

const staleCutoffMs = (staleDays: number): number => Date.now() - staleDays * 24 * 60 * 60 * 1000;
const resolvePlaybookHome = (): string => {
  const configured = process.env[PLAYBOOK_HOME_ENV]?.trim();
  return configured && configured.length > 0 ? path.resolve(configured) : path.join(os.homedir(), DEFAULT_PLAYBOOK_HOME_DIRNAME);
};

const isStaleCandidate = (lastSeenAt: unknown, staleDays: number): boolean => {
  if (typeof lastSeenAt !== 'string') {
    return false;
  }

  const parsed = Date.parse(lastSeenAt);
  return !Number.isNaN(parsed) && parsed < staleCutoffMs(staleDays);
};

const withLifecycle = (
  record: Omit<KnowledgeRecord, 'lifecycle'>,
  lifecycle: Partial<KnowledgeRecord['lifecycle']> = {}
): KnowledgeRecord => ({
  ...record,
  lifecycle: {
    state: lifecycle.state ?? (record.type === 'evidence' ? 'observed' : record.type === 'candidate' ? (record.status === 'stale' ? 'stale' : 'candidate') : record.status),
    warnings: lifecycle.warnings ?? [],
    supersedes: lifecycle.supersedes ?? [],
    supersededBy: lifecycle.supersededBy ?? []
  }
});

const sortRecords = (records: KnowledgeRecord[], order: 'asc' | 'desc'): KnowledgeRecord[] => {
  const sorted = [...records].sort((left, right) => {
    const createdDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (createdDelta !== 0) {
      return createdDelta;
    }

    const leftKey = [
      left.type,
      left.status,
      left.source.command ?? '',
      left.source.kind,
      typeof left.metadata.module === 'string' ? left.metadata.module : '',
      typeof left.metadata.ruleId === 'string' ? left.metadata.ruleId : '',
      typeof left.metadata.title === 'string' ? left.metadata.title : '',
      typeof left.metadata.kind === 'string' ? left.metadata.kind : '',
      JSON.stringify(left.metadata.eventFingerprint ?? null),
      left.id
    ].join('\u0000');
    const rightKey = [
      right.type,
      right.status,
      right.source.command ?? '',
      right.source.kind,
      typeof right.metadata.module === 'string' ? right.metadata.module : '',
      typeof right.metadata.ruleId === 'string' ? right.metadata.ruleId : '',
      typeof right.metadata.title === 'string' ? right.metadata.title : '',
      typeof right.metadata.kind === 'string' ? right.metadata.kind : '',
      JSON.stringify(right.metadata.eventFingerprint ?? null),
      right.id
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });

  return order === 'desc' ? sorted.reverse() : sorted;
};

const normalizeConfidence = (value: unknown): number | null => {
  const score = toNumberOrNull(value);
  if (score === null) {
    return null;
  }

  return Math.max(0, Math.min(1, score / 10));
};

const readEvidenceRecords = (projectRoot: string, repo: string): KnowledgeRecord[] =>
  listJsonFiles(path.join(projectRoot, MEMORY_EVENTS_DIR))
    .flatMap((filePath) => {
      const parsed = safeReadJson<MemoryEventArtifact>(filePath);
      if (!parsed || typeof parsed.eventInstanceId !== 'string') {
        return [];
      }

      const relativePath = toRelativePath(projectRoot, filePath);
      const fingerprint = typeof parsed.eventFingerprint === 'string' ? parsed.eventFingerprint : '';

      return [withLifecycle({
        id: parsed.eventInstanceId,
        type: 'evidence' as const,
        createdAt: toIsoDate(parsed.createdAt),
        repo,
        source: {
          kind: 'memory-event' as const,
          path: relativePath,
          command: typeof parsed.kind === 'string' ? parsed.kind : null
        },
        confidence: null,
        status: 'observed' as const,
        provenance: {
          repo,
          sourceCommand: typeof parsed.kind === 'string' ? parsed.kind : null,
          runId: null,
          sourcePath: relativePath,
          eventIds: [parsed.eventInstanceId],
          evidenceIds: [parsed.eventInstanceId],
          fingerprints: fingerprint ? [fingerprint] : [],
          relatedRecordIds: []
        },
        metadata: {
          kind: parsed.kind ?? null,
          eventFingerprint: parsed.eventFingerprint ?? null,
          repoRevision: parsed.repoRevision ?? null,
          subjectModules: toStringArray(parsed.subjectModules),
          ruleIds: toStringArray(parsed.ruleIds),
          riskSummary: parsed.riskSummary ?? null,
          outcome: parsed.outcome ?? null,
          salienceInputs: parsed.salienceInputs ?? null,
          sources: Array.isArray(parsed.sources) ? parsed.sources : []
        }
      })];
    });

const readCandidateRecords = (projectRoot: string, repo: string, staleDays: number): KnowledgeRecord[] => {
  const artifactPath = path.join(projectRoot, MEMORY_CANDIDATES_PATH);
  const parsed = safeReadJson<MemoryCandidateArtifact>(artifactPath);
  if (!parsed || !Array.isArray(parsed.candidates)) {
    return [];
  }

  return parsed.candidates
    .flatMap((candidate) => {
      const entry = candidate as MemoryCandidateEntry;
      if (typeof entry.candidateId !== 'string') {
        return [];
      }

      const provenanceEntries = Array.isArray(entry.provenance)
        ? entry.provenance as MemoryCandidateProvenance[]
        : [];
      const eventIds = provenanceEntries
        .map((item) => (typeof item.eventId === 'string' ? item.eventId : null))
        .filter((value): value is string => value !== null);
      const sourcePaths = provenanceEntries
        .map((item) => (typeof item.sourcePath === 'string' ? item.sourcePath : null))
        .filter((value): value is string => value !== null);
      const fingerprints = provenanceEntries
        .map((item) => (typeof item.fingerprint === 'string' ? item.fingerprint : null))
        .filter((value): value is string => value !== null);
      const runId = provenanceEntries.find((item) => typeof item.runId === 'string')?.runId as string | undefined;
      const relativePath = toRelativePath(projectRoot, artifactPath);

      return [withLifecycle({
        id: entry.candidateId,
        type: 'candidate' as const,
        createdAt: toIsoDate(entry.lastSeenAt, toIsoDate(parsed.generatedAt)),
        repo,
        source: {
          kind: 'memory-candidate' as const,
          path: relativePath,
          command: typeof parsed.command === 'string' ? parsed.command : null
        },
        confidence: normalizeConfidence(entry.salienceScore),
        status: isStaleCandidate(entry.lastSeenAt, staleDays) ? 'stale' : 'active',
        provenance: {
          repo,
          sourceCommand: typeof parsed.command === 'string' ? parsed.command : null,
          runId: runId ?? null,
          sourcePath: sourcePaths[0] ?? relativePath,
          eventIds,
          evidenceIds: [...eventIds],
          fingerprints,
          relatedRecordIds: []
        },
        metadata: {
          kind: entry.kind ?? null,
          title: entry.title ?? null,
          summary: entry.summary ?? null,
          clusterKey: entry.clusterKey ?? null,
          salienceScore: entry.salienceScore ?? null,
          salienceFactors: entry.salienceFactors ?? null,
          fingerprint: entry.fingerprint ?? null,
          module: entry.module ?? null,
          ruleId: entry.ruleId ?? null,
          failureShape: entry.failureShape ?? null,
          eventCount: entry.eventCount ?? null,
          lastSeenAt: typeof entry.lastSeenAt === 'string' ? toIsoDate(entry.lastSeenAt) : null,
          supersession: entry.supersession ?? null
        }
      }, {
        state: isStaleCandidate(entry.lastSeenAt, staleDays) ? 'stale' : 'candidate',
        warnings: isStaleCandidate(entry.lastSeenAt, staleDays) ? ['Candidate is stale and should be revalidated before reuse.'] : [],
      })];
    });
};

const readPromotedRecords = (projectRoot: string, repo: string): KnowledgeRecord[] =>
  KNOWLEDGE_PATHS.flatMap((relativePath) => {
    const parsed = safeReadJson<MemoryKnowledgeArtifact>(path.join(projectRoot, relativePath));
    if (!parsed || !Array.isArray(parsed.entries)) {
      return [];
    }

    return parsed.entries
      .flatMap((value) => {
        const entry = value as MemoryKnowledgeEntry;
        if (typeof entry.knowledgeId !== 'string') {
          return [];
        }

        const provenanceEntries = Array.isArray(entry.provenance)
          ? entry.provenance as MemoryCandidateProvenance[]
          : [];
        const eventIds = provenanceEntries
          .map((item) => (typeof item.eventId === 'string' ? item.eventId : null))
          .filter((item): item is string => item !== null);
        const sourcePaths = provenanceEntries
          .map((item) => (typeof item.sourcePath === 'string' ? item.sourcePath : null))
          .filter((item): item is string => item !== null);
        const provenanceFingerprints = provenanceEntries
          .map((item) => (typeof item.fingerprint === 'string' ? item.fingerprint : null))
          .filter((item): item is string => item !== null);
        const supersedes = toStringArray(entry.supersedes);
        const supersededBy = toStringArray(entry.supersededBy);
        const status =
          entry.status === 'retired'
            ? 'retired'
            : entry.status === 'superseded' || supersededBy.length > 0
              ? 'superseded'
              : 'active';
        const relatedRecordIds = [
          ...toStringArray(entry.sourceCandidateIds),
          ...supersedes,
          ...supersededBy,
          ...(typeof entry.candidateId === 'string' ? [entry.candidateId] : [])
        ];

        return [withLifecycle({
          id: entry.knowledgeId,
          type: status === 'superseded' ? 'superseded' as KnowledgeArtifactType : 'promoted' as KnowledgeArtifactType,
          createdAt: toIsoDate(entry.promotedAt, toIsoDate(parsed.generatedAt)),
          repo,
          source: {
            kind: 'memory-knowledge' as const,
            path: relativePath,
            command: null
          },
          confidence: null,
          status,
          provenance: {
            repo,
            sourceCommand: null,
            runId: (provenanceEntries.find((item) => typeof item.runId === 'string')?.runId as string | undefined) ?? null,
            sourcePath: sourcePaths[0] ?? relativePath,
            eventIds,
            evidenceIds: [...eventIds],
            fingerprints: [...new Set([...provenanceFingerprints, ...toStringArray(entry.sourceEventFingerprints)])]
              .sort((left, right) => left.localeCompare(right)),
            relatedRecordIds: [...new Set(relatedRecordIds)].sort((left, right) => left.localeCompare(right))
          },
          metadata: {
            kind: entry.kind ?? parsed.kind ?? null,
            candidateId: entry.candidateId ?? null,
            title: entry.title ?? null,
            summary: entry.summary ?? null,
            fingerprint: entry.fingerprint ?? null,
            module: entry.module ?? null,
            ruleId: entry.ruleId ?? null,
            failureShape: entry.failureShape ?? null,
            sourceCandidateIds: toStringArray(entry.sourceCandidateIds),
            sourceEventFingerprints: toStringArray(entry.sourceEventFingerprints),
            supersedes,
            supersededBy,
            retiredAt: typeof entry.retiredAt === 'string' ? toIsoDate(entry.retiredAt) : null,
            retirementReason: entry.retirementReason ?? null
          }
        }, {
          state: status,
          warnings: status === 'retired'
            ? ['Knowledge is retired and should be treated as historical context only.']
            : status === 'superseded'
              ? ['Knowledge has been superseded by a newer promoted record.']
              : [],
          supersedes,
          supersededBy
        })];
      });
  });

const readGlobalPatternRecords = (projectRoot: string): KnowledgeRecord[] => {
  const playbookHome = resolvePlaybookHome();
  const candidatePath = path.join(playbookHome, '.playbook', 'patterns.json');
  const compatibilityPath = path.join(playbookHome, 'patterns.json');
  const resolvedPath = fs.existsSync(candidatePath) ? candidatePath : compatibilityPath;
  const parsed = safeReadJson<GlobalPatternArtifact>(resolvedPath);
  if (!parsed || !Array.isArray(parsed.patterns)) {
    return [];
  }

  return parsed.patterns.flatMap((value) => {
    const entry = value as GlobalPatternEntry;
    if (typeof entry.id !== 'string' || entry.id.trim().length === 0) {
      return [];
    }
    const rawStatus = typeof entry.status === 'string' ? entry.status : 'active';
    const lifecycleState: KnowledgeLifecycleState =
      rawStatus === 'promoted' ? 'active'
        : rawStatus === 'active' || rawStatus === 'superseded' || rawStatus === 'retired' || rawStatus === 'demoted'
          ? rawStatus
          : 'active';
    const status =
      lifecycleState === 'retired' ? 'retired'
        : lifecycleState === 'superseded' ? 'superseded'
        : 'active';
    const provenanceRecord = entry.provenance && typeof entry.provenance === 'object' && !Array.isArray(entry.provenance)
      ? entry.provenance as Record<string, unknown>
      : {};
    const supersededBy = typeof entry.superseded_by === 'string' && entry.superseded_by ? [entry.superseded_by] : [];
    const lifecycleEvents = Array.isArray(entry.lifecycle_events) ? entry.lifecycle_events as GlobalPatternLifecycleEvent[] : [];
    const supersedes = lifecycleEvents
      .filter((event) => event.operation === 'supersede')
      .map((event) => (typeof event.reason === 'string' && event.reason.startsWith('supersedes:') ? event.reason.slice('supersedes:'.length).trim() : null))
      .filter((event): event is string => Boolean(event));
    const warnings = [
      lifecycleState !== 'active' ? `Global reusable pattern is ${lifecycleState}.` : '',
      lifecycleState === 'demoted' ? 'Demoted patterns remain inspectable but should not be treated as active doctrine.' : '',
    ].filter((value): value is string => value.length > 0);

    return [withLifecycle({
      id: entry.id,
      type: status === 'superseded' ? 'superseded' : 'promoted',
      createdAt: toIsoDate(
        typeof provenanceRecord.promoted_at === 'string' ? provenanceRecord.promoted_at : entry.retired_at ?? entry.demoted_at ?? entry.recalled_at,
        EPOCH_ISO
      ),
      repo: resolveRepoName(projectRoot),
      source: {
        kind: 'global-pattern-memory',
        path: path.relative(projectRoot, resolvedPath).replaceAll('\\', '/'),
        command: null
      },
      confidence: toNumberOrNull(entry.confidence),
      status,
      provenance: {
        repo: 'global_reusable_pattern_memory',
        sourceCommand: null,
        runId: null,
        sourcePath: path.relative(projectRoot, resolvedPath).replaceAll('\\', '/'),
        eventIds: [],
        evidenceIds: toStringArray(entry.evidence_refs),
        fingerprints: [],
        relatedRecordIds: [...new Set([...(typeof provenanceRecord.candidate_id === 'string' ? [provenanceRecord.candidate_id] : []), ...supersedes, ...supersededBy])].sort((a,b)=>a.localeCompare(b))
      },
      metadata: {
        kind: 'global-reusable-pattern',
        title: entry.title ?? entry.id,
        summary: entry.description ?? null,
        patternFamily: entry.pattern_family ?? null,
        sourceArtifact: entry.source_artifact ?? null,
        evidenceRefs: toStringArray(entry.evidence_refs),
        signals: toStringArray(entry.signals),
        candidateId: typeof provenanceRecord.candidate_id === 'string' ? provenanceRecord.candidate_id : null,
        promotedAt: typeof provenanceRecord.promoted_at === 'string' ? toIsoDate(provenanceRecord.promoted_at) : null,
        retiredAt: typeof entry.retired_at === 'string' ? toIsoDate(entry.retired_at) : null,
        retirementReason: entry.retirement_reason ?? null,
        demotedAt: typeof entry.demoted_at === 'string' ? toIsoDate(entry.demoted_at) : null,
        demotionReason: entry.demotion_reason ?? null,
        recalledAt: typeof entry.recalled_at === 'string' ? toIsoDate(entry.recalled_at) : null,
        recallReason: entry.recall_reason ?? null,
        lifecycleEvents
      }
    }, {
      state: lifecycleState,
      warnings,
      supersedes,
      supersededBy
    })];
  });
};

const hasModuleMatch = (record: KnowledgeRecord, moduleName: string): boolean => {
  if (typeof record.metadata.module === 'string' && record.metadata.module === moduleName) {
    return true;
  }

  return Array.isArray(record.metadata.subjectModules)
    && record.metadata.subjectModules.some((entry) => entry === moduleName);
};

const hasRuleMatch = (record: KnowledgeRecord, ruleId: string): boolean => {
  if (typeof record.metadata.ruleId === 'string' && record.metadata.ruleId === ruleId) {
    return true;
  }

  return Array.isArray(record.metadata.ruleIds)
    && record.metadata.ruleIds.some((entry) => entry === ruleId);
};

const matchesText = (record: KnowledgeRecord, query: string): boolean =>
  JSON.stringify(record).toLowerCase().includes(query.toLowerCase());

const collectKnowledgeRecords = (projectRoot: string, staleDays: number): KnowledgeRecord[] => {
  const repo = resolveRepoName(projectRoot);
  return [
    ...readEvidenceRecords(projectRoot, repo),
    ...readCandidateRecords(projectRoot, repo, staleDays),
    ...readPromotedRecords(projectRoot, repo),
    ...readGlobalPatternRecords(projectRoot)
  ];
};

const applyKnowledgeFilters = (records: KnowledgeRecord[], options: KnowledgeQueryOptions = {}): KnowledgeRecord[] => {
  const filtered = records
    .filter((record) => (options.type ? record.type === options.type : true))
    .filter((record) => (options.status ? record.status === options.status : true))
    .filter((record) => (options.module ? hasModuleMatch(record, options.module) : true))
    .filter((record) => (options.ruleId ? hasRuleMatch(record, options.ruleId) : true))
    .filter((record) => (options.text ? matchesText(record, options.text) : true))
    .filter((record) => (options.lifecycle ? record.lifecycle.state === options.lifecycle : true));

  const ordered = sortRecords(filtered, options.order ?? 'desc');
  return typeof options.limit === 'number' && options.limit >= 0 ? ordered.slice(0, options.limit) : ordered;
};

export const buildKnowledgeSummary = (records: KnowledgeRecord[]): KnowledgeSummary => ({
  total: records.length,
  byType: {
    evidence: records.filter((record) => record.type === 'evidence').length,
    candidate: records.filter((record) => record.type === 'candidate').length,
    promoted: records.filter((record) => record.type === 'promoted').length,
    superseded: records.filter((record) => record.type === 'superseded').length
  },
  byStatus: {
    observed: records.filter((record) => record.status === 'observed').length,
    active: records.filter((record) => record.status === 'active').length,
    stale: records.filter((record) => record.status === 'stale').length,
    retired: records.filter((record) => record.status === 'retired').length,
    superseded: records.filter((record) => record.status === 'superseded').length
  },
  byLifecycle: {
    observed: records.filter((record) => record.lifecycle.state === 'observed').length,
    candidate: records.filter((record) => record.lifecycle.state === 'candidate').length,
    active: records.filter((record) => record.lifecycle.state === 'active').length,
    stale: records.filter((record) => record.lifecycle.state === 'stale').length,
    retired: records.filter((record) => record.lifecycle.state === 'retired').length,
    superseded: records.filter((record) => record.lifecycle.state === 'superseded').length,
    demoted: records.filter((record) => record.lifecycle.state === 'demoted').length
  }
});

export const listKnowledge = (projectRoot: string, options: KnowledgeQueryOptions = {}): KnowledgeRecord[] =>
  applyKnowledgeFilters(collectKnowledgeRecords(projectRoot, options.staleDays ?? DEFAULT_STALE_DAYS), options);

export const queryKnowledge = (projectRoot: string, options: KnowledgeQueryOptions = {}): KnowledgeRecord[] =>
  listKnowledge(projectRoot, options);

export const getKnowledgeById = (
  projectRoot: string,
  id: string,
  options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}
): KnowledgeRecord | null =>
  collectKnowledgeRecords(projectRoot, options.staleDays ?? DEFAULT_STALE_DAYS).find((record) => record.id === id) ?? null;

export const getKnowledgeTimeline = (
  projectRoot: string,
  options: KnowledgeTimelineOptions = {}
): KnowledgeRecord[] =>
  applyKnowledgeFilters(collectKnowledgeRecords(projectRoot, options.staleDays ?? DEFAULT_STALE_DAYS), {
    ...options,
    order: options.order ?? 'desc'
  });

export const getKnowledgeProvenance = (
  projectRoot: string,
  id: string,
  options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}
): KnowledgeProvenanceResult | null => {
  const records = collectKnowledgeRecords(projectRoot, options.staleDays ?? DEFAULT_STALE_DAYS);
  const record = records.find((entry) => entry.id === id);
  if (!record) {
    return null;
  }

  const evidenceIds = new Set(record.provenance.evidenceIds);
  const relatedRecordIds = new Set(record.provenance.relatedRecordIds);

  return {
    record,
    evidence: sortRecords(records.filter((entry) => entry.type === 'evidence' && evidenceIds.has(entry.id)), 'desc'),
    relatedRecords: sortRecords(records.filter((entry) => entry.id !== id && relatedRecordIds.has(entry.id)), 'desc')
  };
};

export const getStaleKnowledge = (
  projectRoot: string,
  options: Pick<KnowledgeQueryOptions, 'limit' | 'order' | 'staleDays'> = {}
): KnowledgeRecord[] =>
  applyKnowledgeFilters(collectKnowledgeRecords(projectRoot, options.staleDays ?? DEFAULT_STALE_DAYS), {
    ...options,
    order: options.order ?? 'desc'
  }).filter((record) => record.status === 'stale' || record.status === 'retired' || record.status === 'superseded');

export const compareKnowledge = (
  projectRoot: string,
  leftId: string,
  rightId: string,
  options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}
): KnowledgeCompareResult | null => {
  const records = collectKnowledgeRecords(projectRoot, options.staleDays ?? DEFAULT_STALE_DAYS);
  const left = records.find((record) => record.id === leftId);
  const right = records.find((record) => record.id === rightId);
  if (!left || !right) return null;
  const intersect = (a: string[], b: string[]) => a.filter((entry) => new Set(b).has(entry)).sort((x, y) => x.localeCompare(y));
  return {
    left,
    right,
    common: {
      evidenceIds: intersect(left.provenance.evidenceIds, right.provenance.evidenceIds),
      fingerprints: intersect(left.provenance.fingerprints, right.provenance.fingerprints),
      relatedRecordIds: intersect(left.provenance.relatedRecordIds, right.provenance.relatedRecordIds)
    }
  };
};

export const getKnowledgeSupersession = (
  projectRoot: string,
  id: string,
  options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}
): KnowledgeSupersessionResult | null => {
  const records = collectKnowledgeRecords(projectRoot, options.staleDays ?? DEFAULT_STALE_DAYS);
  const record = records.find((entry) => entry.id === id);
  if (!record) return null;
  const byId = new Map(records.map((entry) => [entry.id, entry]));
  return {
    record,
    supersedes: record.lifecycle.supersedes.map((entry) => byId.get(entry)).filter((entry): entry is KnowledgeRecord => Boolean(entry)),
    supersededBy: record.lifecycle.supersededBy.map((entry) => byId.get(entry)).filter((entry): entry is KnowledgeRecord => Boolean(entry))
  };
};
