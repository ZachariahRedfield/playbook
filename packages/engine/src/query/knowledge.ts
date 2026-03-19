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
  knowledge
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
    knowledge
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
    provenance
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
    comparison
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
    supersession
  };
};

export type {
  KnowledgeRecord, KnowledgeQueryOptions, KnowledgeTimelineOptions, KnowledgeSummary, KnowledgeProvenanceResult, KnowledgeCompareResult, KnowledgeSupersessionResult
};
