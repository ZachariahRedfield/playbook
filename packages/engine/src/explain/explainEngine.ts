import { readRepositoryGraph, summarizeGraphNeighborhood, type GraphNeighborhoodSummary } from '../graph/repoGraph.js';
import { queryRepositoryIndex } from '../query/repoQuery.js';
import type { RepositoryModule } from '../indexer/repoIndexer.js';
import { getRuleMetadata } from './ruleRegistry.js';
import { resolveRepositoryTarget, type ResolvedTarget } from '../intelligence/targetResolver.js';
import { readModuleContextDigest } from '../context/moduleContext.js';

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

export type RuleExplanation = {
  type: 'rule';
  resolvedTarget: ResolvedTarget;
  id: string;
  purpose: string;
  fix: string[];
  reason: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ModuleExplanation = {
  type: 'module';
  resolvedTarget: ResolvedTarget;
  name: string;
  responsibilities: string[];
  dependencies: string[];
  architecture: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ArchitectureExplanation = {
  type: 'architecture';
  resolvedTarget: ResolvedTarget;
  architecture: string;
  structure: string;
  reasoning: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type UnknownExplanation = {
  type: 'unknown';
  resolvedTarget: ResolvedTarget;
  target: string;
  message: string;
};

export type ExplainTargetResult = RuleExplanation | ModuleExplanation | ArchitectureExplanation | UnknownExplanation;

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

export const explainTarget = (projectRoot: string, target: string): ExplainTargetResult => {
  const context = gatherContext(projectRoot);
  const resolvedTarget = resolveRepositoryTarget(projectRoot, normalizeTarget(target));

  if (resolvedTarget.kind === 'rule') {
    return explainRule(projectRoot, context, resolvedTarget);
  }

  if (resolvedTarget.kind === 'module') {
    const moduleName = resolvedTarget.selector;
    const digest = readModuleContextDigest(projectRoot, moduleName);
    return {
      type: 'module',
      resolvedTarget,
      name: moduleName,
      responsibilities: inferModuleResponsibilities(moduleName),
      dependencies: digest?.dependencies ?? [],
      architecture: context.architecture,
      graphNeighborhood: readGraphNeighborhood(projectRoot, `module:${moduleName}`)
    };
  }

  if (resolvedTarget.kind === 'architecture') {
    return {
      type: 'architecture',
      resolvedTarget,
      architecture: context.architecture,
      structure: architectureStructure(context.architecture),
      reasoning: architectureReasoning(context.architecture, context.framework, context.modules),
      graphNeighborhood: readGraphNeighborhood(projectRoot, 'repository:root')
    };
  }

  return {
    type: 'unknown',
    resolvedTarget,
    target,
    message: `Unable to explain "${target}" from repository intelligence. Try: playbook query modules | playbook rules.`
  };
};
