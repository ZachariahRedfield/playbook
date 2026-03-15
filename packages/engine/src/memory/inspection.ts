import fs from 'node:fs';
import path from 'node:path';
import type { MemoryReplayCandidate, MemoryReplayCandidateProvenance, MemoryReplayResult } from '../schema/memoryReplay.js';
import type { MemoryKnowledgeArtifact, MemoryKnowledgeEntry, MemoryKnowledgeKind } from './knowledge.js';
import type { MemoryEvent, MemoryIndex } from './types.js';

const MEMORY_ROOT = ['.playbook', 'memory'] as const;
const MEMORY_EVENTS_DIR = [...MEMORY_ROOT, 'events'] as const;
const MEMORY_INDEX_PATH = [...MEMORY_ROOT, 'index.json'] as const;
const MEMORY_CANDIDATES_PATH = [...MEMORY_ROOT, 'candidates.json'] as const;

const KNOWLEDGE_PATHS: Record<MemoryKnowledgeKind, string> = {
  decision: path.join(...MEMORY_ROOT, 'knowledge', 'decisions.json'),
  pattern: path.join(...MEMORY_ROOT, 'knowledge', 'patterns.json'),
  failure_mode: path.join(...MEMORY_ROOT, 'knowledge', 'failure-modes.json'),
  invariant: path.join(...MEMORY_ROOT, 'knowledge', 'invariants.json')
};

const toComparableTimestamp = (value: string | undefined): number => {
  if (typeof value !== 'string') {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const readJsonIfExists = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

const resolveEventPath = (projectRoot: string, relativePath: string): string =>
  path.join(projectRoot, ...MEMORY_ROOT, relativePath.replace(/^\/?(?:\.playbook\/memory\/)?/, ''));

const readMemoryIndex = (projectRoot: string): MemoryIndex | null =>
  readJsonIfExists<MemoryIndex>(path.join(projectRoot, ...MEMORY_INDEX_PATH));

const listAllEventPaths = (projectRoot: string): string[] => {
  const eventsDir = path.join(projectRoot, ...MEMORY_EVENTS_DIR);
  if (!fs.existsSync(eventsDir)) {
    return [];
  }

  return fs
    .readdirSync(eventsDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.posix.join('events', entry));
};

const readEventByRelativePath = (projectRoot: string, relativePath: string): MemoryEvent | null => {
  const payload = readJsonIfExists<unknown>(resolveEventPath(projectRoot, relativePath));
  return isLegacyMemoryEvent(payload) ? payload : null;
};

const isLegacyMemoryEvent = (value: unknown): value is MemoryEvent => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.eventInstanceId === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.eventFingerprint === 'string' &&
    Array.isArray(candidate.subjectModules) &&
    Array.isArray(candidate.ruleIds)
  );
};

const sortTimeline = (events: MemoryEvent[], order: 'asc' | 'desc'): MemoryEvent[] => {
  const sorted = [...events].sort((left, right) => {
    const timestampDelta = toComparableTimestamp(left.createdAt) - toComparableTimestamp(right.createdAt);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }
    return left.eventInstanceId.localeCompare(right.eventInstanceId);
  });

  return order === 'desc' ? sorted.reverse() : sorted;
};

export type MemoryTimelineLookupOptions = {
  module?: string;
  ruleId?: string;
  fingerprint?: string;
  order?: 'asc' | 'desc';
  limit?: number;
};

export const lookupMemoryEventTimeline = (projectRoot: string, options: MemoryTimelineLookupOptions = {}): MemoryEvent[] => {
  const refs = new Set<string>();
  const index = readMemoryIndex(projectRoot);

  const addRefs = (values: string[] | undefined): void => {
    for (const value of values ?? []) {
      refs.add(value);
    }
  };

  if (index) {
    if (options.module) {
      addRefs(index.byModule?.[options.module]);
    }
    if (options.ruleId) {
      addRefs(index.byRule?.[options.ruleId]);
    }
    if (options.fingerprint) {
      addRefs(index.byFingerprint?.[options.fingerprint]);
    }
  }

  const relativePaths = refs.size > 0 ? [...refs] : listAllEventPaths(projectRoot);
  const timeline = relativePaths
    .map((relativePath) => readEventByRelativePath(projectRoot, relativePath))
    .filter((entry): entry is MemoryEvent => entry !== null)
    .filter((entry) => (options.module ? entry.subjectModules.includes(options.module) : true))
    .filter((entry) => (options.ruleId ? entry.ruleIds.includes(options.ruleId) : true))
    .filter((entry) => (options.fingerprint ? entry.eventFingerprint === options.fingerprint : true));

  const sorted = sortTimeline(timeline, options.order ?? 'desc');
  if (typeof options.limit === 'number' && options.limit >= 0) {
    return sorted.slice(0, options.limit);
  }
  return sorted;
};

const staleCutoffMs = (staleDays: number): number => Date.now() - staleDays * 24 * 60 * 60 * 1000;

export type MemoryCandidateLookupOptions = {
  kind?: MemoryReplayCandidate['kind'];
  includeStale?: boolean;
  staleDays?: number;
};

const readCandidatesArtifact = (projectRoot: string): MemoryReplayResult | null =>
  readJsonIfExists<MemoryReplayResult>(path.join(projectRoot, ...MEMORY_CANDIDATES_PATH));

export const filterStaleCandidates = (
  candidates: MemoryReplayCandidate[],
  options: Pick<MemoryCandidateLookupOptions, 'includeStale' | 'staleDays'> = {}
): MemoryReplayCandidate[] => {
  if (options.includeStale) {
    return [...candidates];
  }

  const cutoff = staleCutoffMs(options.staleDays ?? 30);
  return candidates.filter((candidate) => {
    if (!candidate.lastSeenAt) {
      return true;
    }
    return toComparableTimestamp(candidate.lastSeenAt) >= cutoff;
  });
};

export const lookupMemoryCandidateKnowledge = (
  projectRoot: string,
  options: MemoryCandidateLookupOptions = {}
): MemoryReplayCandidate[] => {
  const artifact = readCandidatesArtifact(projectRoot);
  if (!artifact) {
    return [];
  }

  const filtered = artifact.candidates.filter((candidate) => (options.kind ? candidate.kind === options.kind : true));
  return filterStaleCandidates(filtered, options);
};

export type MemoryKnowledgeLookupOptions = {
  kind?: MemoryKnowledgeKind;
  includeSuperseded?: boolean;
};

const readKnowledgeArtifact = (projectRoot: string, kind: MemoryKnowledgeKind): MemoryKnowledgeArtifact | null =>
  readJsonIfExists<MemoryKnowledgeArtifact>(path.join(projectRoot, KNOWLEDGE_PATHS[kind]));

export const filterSupersededKnowledge = (
  entries: MemoryKnowledgeEntry[],
  options: Pick<MemoryKnowledgeLookupOptions, 'includeSuperseded'> = {}
): MemoryKnowledgeEntry[] => {
  if (options.includeSuperseded) {
    return [...entries];
  }

  return entries.filter((entry) => entry.status !== 'superseded' && entry.supersededBy.length === 0);
};

export const lookupPromotedMemoryKnowledge = (
  projectRoot: string,
  options: MemoryKnowledgeLookupOptions = {}
): MemoryKnowledgeEntry[] => {
  const kinds: MemoryKnowledgeKind[] = options.kind
    ? [options.kind]
    : ['decision', 'pattern', 'failure_mode', 'invariant'];

  const entries = kinds.flatMap((kind) => readKnowledgeArtifact(projectRoot, kind)?.entries ?? []);

  return filterSupersededKnowledge(entries, options).sort((left, right) => {
    const promotedDelta = toComparableTimestamp(right.promotedAt) - toComparableTimestamp(left.promotedAt);
    if (promotedDelta !== 0) {
      return promotedDelta;
    }
    return left.knowledgeId.localeCompare(right.knowledgeId);
  });
};

const buildTimelineLookup = (timeline: MemoryEvent[]): Map<string, MemoryEvent> => {
  const table = new Map<string, MemoryEvent>();
  for (const event of timeline) {
    table.set(event.eventInstanceId, event);
    const inferredId = path.basename(event.eventInstanceId, '.json');
    table.set(inferredId, event);
  }
  return table;
};

export type ExpandedMemoryProvenance = MemoryReplayCandidateProvenance & {
  event: MemoryEvent | null;
};

export const expandMemoryProvenance = (
  projectRoot: string,
  provenance: MemoryReplayCandidateProvenance[]
): ExpandedMemoryProvenance[] => {
  const timeline = lookupMemoryEventTimeline(projectRoot, { order: 'asc' });
  const byId = buildTimelineLookup(timeline);

  return provenance.map((entry) => {
    const eventFromSource = readEventByRelativePath(projectRoot, entry.sourcePath);
    const eventFromId = byId.get(entry.eventId) ?? null;

    return {
      ...entry,
      event: eventFromSource ?? eventFromId
    };
  });
};
