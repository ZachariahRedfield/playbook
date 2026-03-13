export const PATTERN_KNOWLEDGE_GRAPH_SCHEMA_VERSION = '1.0' as const;

export type PatternKnowledgeLayer = 'signal' | 'mechanism' | 'governance' | 'outcome';

export type PatternKnowledgePattern = {
  patternId: string;
  title: string;
  summary: string;
  layer: PatternKnowledgeLayer;
  mechanism: string;
  evidenceRefs: string[];
};

export type PatternKnowledgeRelation = {
  relationId: string;
  fromPatternId: string;
  toPatternId: string;
  relationType: 'depends_on' | 'enables' | 'supersedes' | 'related_to';
  evidenceRefs: string[];
};

export type PatternKnowledgeInstance = {
  instanceId: string;
  patternId: string;
  sourceArtifactPath: string;
  evidenceRefs: string[];
};

export type PatternKnowledgeGraphArtifact = {
  schemaVersion: typeof PATTERN_KNOWLEDGE_GRAPH_SCHEMA_VERSION;
  kind: 'playbook-pattern-knowledge-graph';
  createdAt: string;
  patterns: PatternKnowledgePattern[];
  relations: PatternKnowledgeRelation[];
  instances: PatternKnowledgeInstance[];
};
