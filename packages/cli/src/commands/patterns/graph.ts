import type { PatternGraphArtifact } from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import path from 'node:path';

export type PatternKnowledgeEntry = {
  knowledgeId: string;
  title: string;
  summary: string;
  module: string;
  ruleId: string;
  failureShape: string;
  status: 'active' | 'retired' | 'superseded';
  promotedAt: string;
  supersedes: string[];
  supersededBy: string[];
};

type PatternKnowledgeArtifact = {
  schemaVersion: '1.0';
  artifact: 'memory-knowledge';
  kind: 'pattern';
  generatedAt: string;
  entries: PatternKnowledgeEntry[];
};

export type PatternRelation = 'supersedes' | 'superseded-by' | 'same-module' | 'same-rule' | 'same-failure-shape';

export type PatternGraphEdge = {
  from: string;
  to: string;
  relation: PatternRelation;
};

export type PatternGraph = {
  nodes: PatternKnowledgeEntry[];
  edges: PatternGraphEdge[];
};

const PATTERNS_PATH = ['.playbook', 'memory', 'knowledge', 'patterns.json'] as const;


const CONTRACT_PATTERN_GRAPH_PATH = ['.playbook', 'pattern-graph.json'] as const;

export const readContractPatternGraph = (cwd: string): PatternGraphArtifact => {
  const artifactPath = path.join(cwd, ...CONTRACT_PATTERN_GRAPH_PATH);
  if (!fs.existsSync(artifactPath)) {
    throw new Error('playbook patterns: missing artifact at .playbook/pattern-graph.json.');
  }

  return JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as PatternGraphArtifact;
};


export const readPatternKnowledgeGraph = (cwd: string): PatternGraph => {
  const artifactPath = path.join(cwd, ...PATTERNS_PATH);
  if (!fs.existsSync(artifactPath)) {
    throw new Error('playbook patterns: missing artifact at .playbook/memory/knowledge/patterns.json.');
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as Partial<PatternKnowledgeArtifact>;
  if (artifact.kind !== 'pattern' || !Array.isArray(artifact.entries)) {
    throw new Error('playbook patterns: invalid pattern knowledge artifact shape.');
  }

  const nodes = [...artifact.entries].sort((left, right) => left.knowledgeId.localeCompare(right.knowledgeId));
  const edges: PatternGraphEdge[] = [];

  for (const node of nodes) {
    for (const target of node.supersedes ?? []) {
      edges.push({ from: node.knowledgeId, to: target, relation: 'supersedes' });
    }
    for (const target of node.supersededBy ?? []) {
      edges.push({ from: node.knowledgeId, to: target, relation: 'superseded-by' });
    }
  }

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.module && a.module === b.module) {
        edges.push({ from: a.knowledgeId, to: b.knowledgeId, relation: 'same-module' });
      }
      if (a.ruleId && a.ruleId === b.ruleId) {
        edges.push({ from: a.knowledgeId, to: b.knowledgeId, relation: 'same-rule' });
      }
      if (a.failureShape && a.failureShape === b.failureShape) {
        edges.push({ from: a.knowledgeId, to: b.knowledgeId, relation: 'same-failure-shape' });
      }
    }
  }

  edges.sort((left, right) =>
    left.relation.localeCompare(right.relation) || left.from.localeCompare(right.from) || left.to.localeCompare(right.to)
  );

  return { nodes, edges };
};

export const findPatternNode = (graph: PatternGraph, id: string): PatternKnowledgeEntry => {
  const node = graph.nodes.find((entry) => entry.knowledgeId === id);
  if (!node) {
    throw new Error(`playbook patterns: pattern not found: ${id}`);
  }

  return node;
};

export const findRelatedPatterns = (graph: PatternGraph, id: string): Array<{ relation: PatternRelation; pattern: PatternKnowledgeEntry }> => {
  const byId = new Map(graph.nodes.map((node) => [node.knowledgeId, node]));
  const related = graph.edges.flatMap((edge) => {
    if (edge.from === id) {
      const pattern = byId.get(edge.to);
      return pattern ? [{ relation: edge.relation, pattern }] : [];
    }

    if (edge.to === id) {
      const pattern = byId.get(edge.from);
      return pattern ? [{ relation: edge.relation, pattern }] : [];
    }

    return [];
  });

  return related.sort((left, right) =>
    left.relation.localeCompare(right.relation) || left.pattern.knowledgeId.localeCompare(right.pattern.knowledgeId)
  );
};

export const summarizePatternLayers = (graph: PatternGraph) => {
  const summarize = (values: string[]) =>
    Object.entries(values.reduce<Record<string, number>>((acc, value) => {
      const key = value || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}))
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));

  return {
    status: summarize(graph.nodes.map((node) => node.status)),
    module: summarize(graph.nodes.map((node) => node.module)),
    rule: summarize(graph.nodes.map((node) => node.ruleId)),
    failureShape: summarize(graph.nodes.map((node) => node.failureShape))
  };
};
