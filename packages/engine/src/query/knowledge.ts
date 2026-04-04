import {
  buildKnowledgeSummary,
  compareKnowledge,
  getKnowledgeById,
  getKnowledgeProvenance,
  getKnowledgeSupersession,
  getKnowledgeTimeline,
  getStaleKnowledge,
  listKnowledge,
  queryKnowledge,
  type KnowledgeCompareResult,
  type KnowledgeProvenanceResult,
  type KnowledgeQueryOptions,
  type KnowledgeRecord,
  type KnowledgeSummary,
  type KnowledgeSupersessionResult,
  type KnowledgeTimelineOptions
} from '@zachariahredfield/playbook-core';

export const knowledgeInspectionCategories = [
  'session-evidence',
  'repo-longitudinal-memory',
  'candidate-knowledge',
  'promoted-governance-knowledge',
  'upstream-promotable-reusable-patterns'
] as const;

export type KnowledgeInspectionCategory = (typeof knowledgeInspectionCategories)[number];
export type KnowledgeInspectionRecord = KnowledgeRecord & {
  inspectionCategory: KnowledgeInspectionCategory;
};

type KnowledgeCategoryMap = Record<KnowledgeInspectionCategory, string[]>;

const createEmptyCategoryMap = (): KnowledgeCategoryMap => ({
  'session-evidence': [],
  'repo-longitudinal-memory': [],
  'candidate-knowledge': [],
  'promoted-governance-knowledge': [],
  'upstream-promotable-reusable-patterns': []
});

const toInspectionCategory = (record: KnowledgeRecord): KnowledgeInspectionCategory => {
  if (record.source.kind === 'memory-event') {
    return 'session-evidence';
  }
  if (record.source.kind === 'lifecycle-candidate') {
    return 'repo-longitudinal-memory';
  }
  if (record.source.kind === 'global-pattern-memory') {
    return 'upstream-promotable-reusable-patterns';
  }
  if (record.source.kind === 'memory-knowledge' || record.type === 'promoted' || record.type === 'superseded') {
    return 'promoted-governance-knowledge';
  }
  return 'candidate-knowledge';
};

const withInspectionCategory = (record: KnowledgeRecord): KnowledgeInspectionRecord => ({
  ...record,
  inspectionCategory: toInspectionCategory(record)
});

const buildKnowledgeInspection = (records: KnowledgeInspectionRecord[]) => {
  const byCategory = createEmptyCategoryMap();
  for (const record of records) {
    byCategory[record.inspectionCategory].push(record.id);
  }
  for (const category of knowledgeInspectionCategories) {
    byCategory[category].sort((left, right) => left.localeCompare(right));
  }
  return {
    byCategory,
    totals: {
      'session-evidence': byCategory['session-evidence'].length,
      'repo-longitudinal-memory': byCategory['repo-longitudinal-memory'].length,
      'candidate-knowledge': byCategory['candidate-knowledge'].length,
      'promoted-governance-knowledge': byCategory['promoted-governance-knowledge'].length,
      'upstream-promotable-reusable-patterns': byCategory['upstream-promotable-reusable-patterns'].length
    }
  };
};

const filterPayload = (options: Partial<KnowledgeQueryOptions>): Record<string, string | number> => {
  const payload: Record<string, string | number> = {};
  if (options.type) payload.type = options.type;
  if (options.status) payload.status = options.status;
  if (options.module) payload.module = options.module;
  if (options.ruleId) payload.ruleId = options.ruleId;
  if (options.text) payload.text = options.text;
  if (typeof options.limit === 'number') payload.limit = options.limit;
  if (options.order) payload.order = options.order;
  if (typeof options.staleDays === 'number') payload.staleDays = options.staleDays;
  return payload;
};

const createListPayload = (
  command: 'knowledge-list' | 'knowledge-query' | 'knowledge-timeline' | 'knowledge-stale',
  knowledge: KnowledgeRecord[],
  filters: Record<string, string | number>
) => ({
  schemaVersion: '1.0' as const,
  command,
  filters,
  summary: buildKnowledgeSummary(knowledge),
  inspection: buildKnowledgeInspection(knowledge.map(withInspectionCategory)),
  knowledge: knowledge.map(withInspectionCategory)
});

export type KnowledgeListResult = ReturnType<typeof knowledgeList>;
export type KnowledgeQueryResult = ReturnType<typeof knowledgeQuery>;
export type KnowledgeInspectResult = ReturnType<typeof knowledgeInspect>;
export type KnowledgeTimelineResult = ReturnType<typeof knowledgeTimeline>;
export type KnowledgeProvenanceQueryResult = ReturnType<typeof knowledgeProvenance>;
export type KnowledgeStaleResult = ReturnType<typeof knowledgeStale>;
export type KnowledgeCompareQueryResult = ReturnType<typeof knowledgeCompareQuery>;
export type KnowledgeSupersessionQueryResult = ReturnType<typeof knowledgeSupersession>;

export const knowledgeList = (projectRoot: string, options: KnowledgeQueryOptions = {}) =>
  createListPayload('knowledge-list', listKnowledge(projectRoot, options), filterPayload(options));

export const knowledgeQuery = (projectRoot: string, options: KnowledgeQueryOptions = {}) =>
  createListPayload('knowledge-query', queryKnowledge(projectRoot, options), filterPayload(options));

export const knowledgeInspect = (projectRoot: string, id: string, options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}) => {
  const knowledge = getKnowledgeById(projectRoot, id, options);
  if (!knowledge) {
    throw new Error(`playbook knowledge inspect: record not found: ${id}`);
  }

  return {
    schemaVersion: '1.0' as const,
    command: 'knowledge-inspect' as const,
    id,
    inspection: {
      category: toInspectionCategory(knowledge),
      staleOrSuperseded: knowledge.status === 'stale' || knowledge.status === 'superseded' || knowledge.status === 'retired'
    },
    knowledge: withInspectionCategory(knowledge)
  };
};

export const knowledgeTimeline = (projectRoot: string, options: KnowledgeTimelineOptions = {}) =>
  createListPayload('knowledge-timeline', getKnowledgeTimeline(projectRoot, options), filterPayload(options));

export const knowledgeProvenance = (
  projectRoot: string,
  id: string,
  options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}
) => {
  const provenance = getKnowledgeProvenance(projectRoot, id, options);
  if (!provenance) {
    throw new Error(`playbook knowledge provenance: record not found: ${id}`);
  }

  return {
    schemaVersion: '1.0' as const,
    command: 'knowledge-provenance' as const,
    id,
    inspection: {
      category: toInspectionCategory(provenance.record)
    },
    provenance: {
      ...provenance,
      record: withInspectionCategory(provenance.record),
      evidence: provenance.evidence.map(withInspectionCategory),
      relatedRecords: provenance.relatedRecords.map(withInspectionCategory)
    }
  };
};

export const knowledgeStale = (
  projectRoot: string,
  options: Pick<KnowledgeQueryOptions, 'limit' | 'order' | 'staleDays'> = {}
) => createListPayload('knowledge-stale', getStaleKnowledge(projectRoot, options), filterPayload(options));

export const knowledgeCompareQuery = (
  projectRoot: string,
  leftId: string,
  rightId: string,
  options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}
) => {
  const comparison = compareKnowledge(projectRoot, leftId, rightId, options);
  if (!comparison) {
    throw new Error(`playbook knowledge compare: record not found: ${leftId} or ${rightId}`);
  }
  return {
    schemaVersion: '1.0' as const,
    command: 'knowledge-compare' as const,
    leftId,
    rightId,
    comparison: {
      ...comparison,
      left: withInspectionCategory(comparison.left),
      right: withInspectionCategory(comparison.right)
    },
    inspection: {
      leftCategory: toInspectionCategory(comparison.left),
      rightCategory: toInspectionCategory(comparison.right),
      categoryMatch: toInspectionCategory(comparison.left) === toInspectionCategory(comparison.right)
    }
  };
};

export const knowledgeSupersession = (
  projectRoot: string,
  id: string,
  options: Pick<KnowledgeQueryOptions, 'staleDays'> = {}
) => {
  const supersession = getKnowledgeSupersession(projectRoot, id, options);
  if (!supersession) {
    throw new Error(`playbook knowledge supersession: record not found: ${id}`);
  }
  return {
    schemaVersion: '1.0' as const,
    command: 'knowledge-supersession' as const,
    id,
    inspection: {
      category: toInspectionCategory(supersession.record)
    },
    supersession: {
      ...supersession,
      record: withInspectionCategory(supersession.record),
      supersedes: supersession.supersedes.map(withInspectionCategory),
      supersededBy: supersession.supersededBy.map(withInspectionCategory)
    }
  };
};

export type {
  KnowledgeRecord, KnowledgeQueryOptions, KnowledgeTimelineOptions, KnowledgeSummary, KnowledgeProvenanceResult, KnowledgeCompareResult, KnowledgeSupersessionResult
};
