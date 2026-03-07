import { readRepositoryGraph, summarizeGraphNeighborhood, type GraphNeighborhoodSummary } from '../graph/repoGraph.js';
import { queryRepositoryIndex } from '../query/repoQuery.js';
import type { RepositoryModule } from '../indexer/repoIndexer.js';
import { getRuleMetadata } from './ruleRegistry.js';

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

type ExplainTargetType = 'rule' | 'module' | 'architecture' | 'unknown';

export type RuleExplanation = {
  type: 'rule';
  id: string;
  purpose: string;
  fix: string[];
  reason: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ModuleExplanation = {
  type: 'module';
  name: string;
  responsibilities: string[];
  dependencies: string[];
  architecture: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ArchitectureExplanation = {
  type: 'architecture';
  architecture: string;
  structure: string;
  reasoning: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type UnknownExplanation = {
  type: 'unknown';
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

const determineTargetType = (target: string, context: ExplainContext): ExplainTargetType => {
  if (target.startsWith('pb') || Boolean(getRuleMetadata(target))) {
    return 'rule';
  }

  if (target === 'architecture') {
    return 'architecture';
  }

  if (context.modules.some((moduleName) => moduleName.toLowerCase() === target)) {
    return 'module';
  }

  return 'unknown';
};

const readGraphNeighborhood = (projectRoot: string, nodeId: string): GraphNeighborhoodSummary | undefined => {
  try {
    const graph = readRepositoryGraph(projectRoot);
    return summarizeGraphNeighborhood(graph, nodeId) ?? undefined;
  } catch {
    return undefined;
  }
};

const explainRule = (projectRoot: string, context: ExplainContext, normalizedTarget: string): RuleExplanation | UnknownExplanation => {
  const metadata = getRuleMetadata(normalizedTarget);

  if (!metadata) {
    return {
      type: 'unknown',
      target: normalizedTarget,
      message: `No rule metadata found for ${normalizedTarget} in rule registry.`
    };
  }

  return {
    type: 'rule',
    id: metadata.id,
    purpose: metadata.purpose,
    fix: metadata.fix,
    reason: `Rule registry metadata for ${metadata.id}. Indexed rules: ${context.rules.join(', ') || 'none'}.`,
    graphNeighborhood: readGraphNeighborhood(projectRoot, `rule:${metadata.id}`)
  };
};

export const explainTarget = (projectRoot: string, target: string): ExplainTargetResult => {
  const normalizedTarget = normalizeTarget(target);
  const context = gatherContext(projectRoot);
  const targetType = determineTargetType(normalizedTarget, context);

  if (targetType === 'rule') {
    return explainRule(projectRoot, context, normalizedTarget);
  }

  if (targetType === 'module') {
    const moduleName = context.modules.find((name) => name.toLowerCase() === normalizedTarget) ?? normalizedTarget;
    return {
      type: 'module',
      name: moduleName,
      responsibilities: inferModuleResponsibilities(moduleName),
      dependencies: [],
      architecture: context.architecture,
      graphNeighborhood: readGraphNeighborhood(projectRoot, `module:${moduleName}`)
    };
  }

  if (targetType === 'architecture') {
    return {
      type: 'architecture',
      architecture: context.architecture,
      structure: architectureStructure(context.architecture),
      reasoning: architectureReasoning(context.architecture, context.framework, context.modules),
      graphNeighborhood: readGraphNeighborhood(projectRoot, 'repository:root')
    };
  }

  return {
    type: 'unknown',
    target,
    message: `Unable to explain "${target}" from repository intelligence. Try: playbook query modules | playbook rules.`
  };
};
