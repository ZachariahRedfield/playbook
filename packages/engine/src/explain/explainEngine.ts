import { readRepositoryGraph, summarizeGraphNeighborhood, type GraphNeighborhoodSummary } from '../graph/repoGraph.js';
import { explainArtifactFromArchitecture, explainSubsystemFromArchitecture } from '../architecture/introspection.js';
import { queryRepositoryIndex } from '../query/repoQuery.js';
import type { RepositoryModule } from '../indexer/repoIndexer.js';
import { getRuleMetadata } from './ruleRegistry.js';
import { resolveRepositoryTarget, type ResolvedTarget } from '../intelligence/targetResolver.js';
import { readModuleContextDigest } from '../context/moduleContext.js';
import { readRuntimeMemoryEnvelope, type RuntimeMemoryEnvelope } from '../intelligence/runtimeMemory.js';
import {
  expandMemoryProvenance,
  lookupMemoryCandidateKnowledge,
  lookupPromotedMemoryKnowledge,
  type ExpandedMemoryProvenance
} from '../memory/inspection.js';
import type { MemoryKnowledgeEntry } from '../memory/knowledge.js';
import type { MemoryReplayCandidate } from '../schema/memoryReplay.js';

const toModuleNames = (modules: string[] | RepositoryModule[]): string[] => {
  if (modules.length === 0) {
    return [];
  }

  const first = modules[0];
  if (typeof first === 'string') {
    return modules as string[];
  }

  return (modules as RepositoryModule[]).map((moduleEntry) => moduleEntry.name);
};

type ExplainContext = {
  architecture: string;
  modules: string[];
  framework: string;
  rules: string[];
};

type ExplainMemoryFields = {
  memorySummary?: RuntimeMemoryEnvelope['memorySummary'];
  memorySources?: RuntimeMemoryEnvelope['memorySources'];
  knowledgeHits?: RuntimeMemoryEnvelope['knowledgeHits'];
  recentRelevantEvents?: RuntimeMemoryEnvelope['recentRelevantEvents'];
  memoryKnowledge?: {
    promoted: MemoryKnowledgeExplanation[];
    candidates: MemoryCandidateExplanation[];
  };
};

type MemoryKnowledgeExplanation = {
  knowledgeId: string;
  kind: MemoryKnowledgeEntry['kind'];
  title: string;
  summary: string;
  promotedAt: string;
  provenance: ExpandedMemoryProvenance[];
};

type MemoryCandidateExplanation = {
  candidateId: string;
  kind: MemoryReplayCandidate['kind'];
  title: string;
  summary: string;
  lastSeenAt?: string;
  provenance: ExpandedMemoryProvenance[];
};

export type RuleExplanation = ExplainMemoryFields & {
  type: 'rule';
  resolvedTarget: ResolvedTarget;
  id: string;
  purpose: string;
  fix: string[];
  reason: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ModuleExplanation = ExplainMemoryFields & {
  type: 'module';
  resolvedTarget: ResolvedTarget;
  name: string;
  responsibilities: string[];
  dependencies: string[];
  architecture: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ArchitectureExplanation = ExplainMemoryFields & {
  type: 'architecture';
  resolvedTarget: ResolvedTarget;
  architecture: string;
  structure: string;
  reasoning: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type SubsystemExplanation = ExplainMemoryFields & {
  type: 'subsystem';
  resolvedTarget: ResolvedTarget;
  name: string;
  purpose: string;
  commands: string[];
  artifacts: string[];
  upstream?: string[];
  downstream?: string[];
};

export type ArtifactExplanation = ExplainMemoryFields & {
  type: 'artifact';
  resolvedTarget: ResolvedTarget;
  artifact: string;
  ownerSubsystem: string;
  purpose: string;
  upstreamSubsystem: string | null;
  downstreamConsumers: string[];
};

export type UnknownExplanation = ExplainMemoryFields & {
  type: 'unknown';
  resolvedTarget: ResolvedTarget;
  target: string;
  message: string;
};

export type ExplainTargetResult = RuleExplanation | ModuleExplanation | ArchitectureExplanation | SubsystemExplanation | ArtifactExplanation | UnknownExplanation;

const normalizeTarget = (target: string): string => target.trim().toLowerCase();

const gatherContext = (projectRoot: string): ExplainContext => {
  const architecture = queryRepositoryIndex(projectRoot, 'architecture').result as string;
  const modules = toModuleNames(queryRepositoryIndex(projectRoot, 'modules').result as string[] | RepositoryModule[]);
  const framework = queryRepositoryIndex(projectRoot, 'framework').result as string;
  const rules = queryRepositoryIndex(projectRoot, 'rules').result as string[];

  return {
    architecture,
    modules,
    framework,
    rules
  };
};

const inferModuleResponsibilities = (name: string): string[] => [
  `Owns ${name} feature behavior and boundaries.`,
  `Encapsulates ${name} domain logic and module-level policies.`
];

const architectureStructure = (architecture: string): string => {
  if (architecture === 'modular-monolith') {
    return 'Feature modules are isolated and commonly organized under src/features.';
  }

  return `Repository structure follows ${architecture} conventions derived from indexed signals.`;
};

const architectureReasoning = (architecture: string, framework: string, modules: string[]): string => {
  if (architecture === 'modular-monolith') {
    return `modular-monolith architecture organizes code into isolated feature modules under src/features. Indexed framework: ${framework}. Indexed modules: ${modules.join(', ') || 'none'}.`;
  }

  return `Architecture is inferred as ${architecture} from repository intelligence signals. Indexed framework: ${framework}. Indexed modules: ${modules.join(', ') || 'none'}.`;
};

const readGraphNeighborhood = (projectRoot: string, nodeId: string): GraphNeighborhoodSummary | undefined => {
  try {
    const graph = readRepositoryGraph(projectRoot);
    return summarizeGraphNeighborhood(graph, nodeId) ?? undefined;
  } catch {
    return undefined;
  }
};

const explainRule = (projectRoot: string, context: ExplainContext, resolvedTarget: ResolvedTarget): RuleExplanation | UnknownExplanation => {
  const metadata = getRuleMetadata(resolvedTarget.selector);

  if (!metadata) {
    return {
      type: 'unknown',
      resolvedTarget,
      target: resolvedTarget.input,
      message: `No rule metadata found for ${resolvedTarget.selector} in rule registry.`
    };
  }

  return {
    type: 'rule',
    resolvedTarget,
    id: metadata.id,
    purpose: metadata.purpose,
    fix: metadata.fix,
    reason: `Rule registry metadata for ${metadata.id}. Indexed rules: ${context.rules.join(', ') || 'none'}.`,
    graphNeighborhood: readGraphNeighborhood(projectRoot, `rule:${metadata.id}`)
  };
};

export type ExplainTargetOptions = {
  withMemory?: boolean;
};

const withMemory = <T extends Record<string, unknown>>(
  projectRoot: string,
  enabled: boolean | undefined,
  input: T,
  options?: { target?: string }
): T & ExplainMemoryFields => {
  if (!enabled) {
    return input;
  }

  const memory = readRuntimeMemoryEnvelope(projectRoot, { target: options?.target });

  const memoryKnowledge = resolveMemoryKnowledge(projectRoot, options?.target);
  return {
    ...input,
    memorySummary: memory.memorySummary,
    memorySources: memory.memorySources,
    knowledgeHits: memory.knowledgeHits,
    recentRelevantEvents: memory.recentRelevantEvents,
    memoryKnowledge
  };
};

const toComparableTimestamp = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeRelevanceTokens = (target: string | undefined): string[] =>
  (target ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

const scoreTokenRelevance = (tokens: string[], value: string): number => {
  if (tokens.length === 0) {
    return 0;
  }

  const normalized = value.toLowerCase();
  return tokens.reduce((score, token) => (normalized.includes(token) ? score + 1 : score), 0);
};

const rankPromotedKnowledge = (entries: MemoryKnowledgeEntry[], target: string | undefined): MemoryKnowledgeEntry[] => {
  const tokens = normalizeRelevanceTokens(target);
  return [...entries]
    .map((entry) => {
      const content = [entry.knowledgeId, entry.kind, entry.title, entry.summary, entry.module, entry.ruleId, entry.failureShape].join(' ');
      return {
        entry,
        relevance: scoreTokenRelevance(tokens, content)
      };
    })
    .filter((item) => tokens.length === 0 || item.relevance > 0)
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      const promotedDelta = toComparableTimestamp(right.entry.promotedAt) - toComparableTimestamp(left.entry.promotedAt);
      if (promotedDelta !== 0) {
        return promotedDelta;
      }
      return left.entry.knowledgeId.localeCompare(right.entry.knowledgeId);
    })
    .map((item) => item.entry);
};

const rankCandidateKnowledge = (entries: MemoryReplayCandidate[], target: string | undefined): MemoryReplayCandidate[] => {
  const tokens = normalizeRelevanceTokens(target);
  return [...entries]
    .map((entry) => {
      const content = [entry.candidateId, entry.kind, entry.title, entry.summary, entry.module, entry.ruleId, entry.failureShape].join(' ');
      return {
        entry,
        relevance: scoreTokenRelevance(tokens, content)
      };
    })
    .filter((item) => tokens.length === 0 || item.relevance > 0)
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      const seenDelta = toComparableTimestamp(right.entry.lastSeenAt) - toComparableTimestamp(left.entry.lastSeenAt);
      if (seenDelta !== 0) {
        return seenDelta;
      }
      return left.entry.candidateId.localeCompare(right.entry.candidateId);
    })
    .map((item) => item.entry);
};

const resolveMemoryKnowledge = (projectRoot: string, target: string | undefined): ExplainMemoryFields['memoryKnowledge'] => {
  const promoted = rankPromotedKnowledge(lookupPromotedMemoryKnowledge(projectRoot), target)
    .slice(0, 3)
    .map((entry) => ({
      knowledgeId: entry.knowledgeId,
      kind: entry.kind,
      title: entry.title,
      summary: entry.summary,
      promotedAt: entry.promotedAt,
      provenance: expandMemoryProvenance(projectRoot, entry.provenance)
    }));

  const candidates = rankCandidateKnowledge(lookupMemoryCandidateKnowledge(projectRoot), target)
    .slice(0, 3)
    .map((entry) => ({
      candidateId: entry.candidateId,
      kind: entry.kind,
      title: entry.title,
      summary: entry.summary,
      lastSeenAt: entry.lastSeenAt,
      provenance: expandMemoryProvenance(projectRoot, entry.provenance)
    }));

  return {
    promoted,
    candidates
  };
};

const explainSubsystem = (projectRoot: string, target: string): SubsystemExplanation => {
  const details = explainSubsystemFromArchitecture(projectRoot, target);
  return {
    type: 'subsystem',
    resolvedTarget: {
      input: `subsystem ${target}`,
      kind: 'unknown',
      selector: target,
      canonical: `subsystem:${target}`,
      matched: true
    },
    name: details.subsystem.name,
    purpose: details.subsystem.purpose,
    commands: details.subsystem.commands,
    artifacts: details.subsystem.artifacts,
    upstream: details.subsystem.upstream,
    downstream: details.subsystem.downstream
  };
};

const explainArtifact = (projectRoot: string, target: string): ArtifactExplanation => {
  const details = explainArtifactFromArchitecture(projectRoot, target);
  return {
    type: 'artifact',
    resolvedTarget: {
      input: `artifact ${target}`,
      kind: 'unknown',
      selector: target,
      canonical: `artifact:${target}`,
      matched: true
    },
    artifact: details.artifact,
    ownerSubsystem: details.lineage.ownerSubsystem,
    purpose: details.subsystem.purpose,
    upstreamSubsystem: details.lineage.upstreamSubsystem,
    downstreamConsumers: details.lineage.downstreamConsumers
  };
};

export const explainTarget = (projectRoot: string, target: string, options?: ExplainTargetOptions): ExplainTargetResult => {
  const trimmed = target.trim();
  const subsystemMatch = trimmed.match(/^subsystem\s+(.+)$/i);
  if (subsystemMatch) {
    const subsystemName = subsystemMatch[1].trim();
    if (!subsystemName) {
      throw new Error('playbook explain subsystem: missing required <name> argument');
    }
    return withMemory(projectRoot, options?.withMemory, explainSubsystem(projectRoot, subsystemName), { target: subsystemName });
  }

  const artifactMatch = trimmed.match(/^artifact\s+(.+)$/i);
  if (artifactMatch) {
    const artifactPath = artifactMatch[1].trim();
    if (!artifactPath) {
      throw new Error('playbook explain artifact: missing required <path> argument');
    }
    return withMemory(projectRoot, options?.withMemory, explainArtifact(projectRoot, artifactPath), { target: artifactPath });
  }
  const context = gatherContext(projectRoot);
  const resolvedTarget = resolveRepositoryTarget(projectRoot, normalizeTarget(target));

  if (resolvedTarget.kind === 'rule') {
    return withMemory(projectRoot, options?.withMemory, explainRule(projectRoot, context, resolvedTarget), { target: resolvedTarget.selector });
  }

  if (resolvedTarget.kind === 'module') {
    const moduleName = resolvedTarget.selector;
    const digest = readModuleContextDigest(projectRoot, moduleName);
    return withMemory(projectRoot, options?.withMemory, {
      type: 'module',
      resolvedTarget,
      name: moduleName,
      responsibilities: inferModuleResponsibilities(moduleName),
      dependencies: digest?.dependencies ?? [],
      architecture: context.architecture,
      graphNeighborhood: readGraphNeighborhood(projectRoot, `module:${moduleName}`)
    }, { target: moduleName });
  }

  if (resolvedTarget.kind === 'architecture') {
    return withMemory(projectRoot, options?.withMemory, {
      type: 'architecture',
      resolvedTarget,
      architecture: context.architecture,
      structure: architectureStructure(context.architecture),
      reasoning: architectureReasoning(context.architecture, context.framework, context.modules),
      graphNeighborhood: readGraphNeighborhood(projectRoot, 'repository:root')
    }, { target: 'architecture' });
  }

  return withMemory(projectRoot, options?.withMemory, {
    type: 'unknown',
    resolvedTarget,
    target,
    message: `Unable to explain "${target}" from repository intelligence. Try: playbook query modules | playbook rules.`
  }, { target });
};
