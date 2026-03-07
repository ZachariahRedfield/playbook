import { queryRepositoryIndex } from '../query/repoQuery.js';
import type { RepositoryModule } from '../indexer/repoIndexer.js';
import { buildModuleAskContext, resolveIndexedModuleContext, type IndexedModuleContext } from '../query/moduleIntelligence.js';
import { resolveDiffAskContext, type DiffAskContext } from './diffContext.js';


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


const ASK_USER_QUESTION_PREFIX = 'User question:';

const extractUserQuestion = (question: string): string => {
  const markerIndex = question.lastIndexOf(ASK_USER_QUESTION_PREFIX);
  if (markerIndex === -1) {
    return question;
  }

  const extracted = question.slice(markerIndex + ASK_USER_QUESTION_PREFIX.length).trim();
  return extracted.length > 0 ? extracted : question;
};

type AskContext = {
  architecture: string;
  framework: string;
  modules: string[];
  rules: string[];
};

export type AskEngineResult = {
  question: string;
  answer: string;
  reason: string;
  context: {
    architecture: string;
    framework: string;
    modules: string[];
    module?: IndexedModuleContext;
    diff?: DiffAskContext;
  };
};

type AskEngineOptions = {
  module?: string;
  diffContext?: boolean;
  baseRef?: string;
};

const normalizeQuestion = (question: string): string => extractUserQuestion(question).trim().toLowerCase();

const gatherContext = (projectRoot: string): AskContext => {
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

const formatRulesHint = (rules: string[]): string => {
  if (rules.length === 0) {
    return 'No repository rules were detected in the current index.';
  }

  return `Rule registry signals in the index: ${rules.join(', ')}.`;
};

const includesAny = (question: string, values: string[]): boolean => values.some((value) => question.includes(value));

export const answerRepositoryQuestion = (projectRoot: string, question: string, options?: AskEngineOptions): AskEngineResult => {
  const userQuestion = extractUserQuestion(question);
  const normalizedQuestion = normalizeQuestion(userQuestion);
  const context = gatherContext(projectRoot);
  if (options?.module && options.diffContext) {
    throw new Error('playbook ask: --module and --diff-context cannot be used together. Choose one deterministic scope.');
  }

  const moduleContext = options?.module
    ? resolveIndexedModuleContext(projectRoot, options.module, { unknownModulePrefix: 'playbook ask --module' })
    : undefined;
  const diffContext = options?.diffContext ? resolveDiffAskContext(projectRoot, { baseRef: options.baseRef }) : undefined;

  if (diffContext && includesAny(normalizedQuestion, ['module', 'modules', 'affected'])) {
    return {
      question: userQuestion,
      answer:
        diffContext.affectedModules.length > 0
          ? `Affected modules: ${diffContext.affectedModules.join(', ')}`
          : 'Affected modules: none (changed files are outside indexed module roots)',
      reason:
        'Derived from playbook-diff-context by mapping git changed files to indexed modules in .playbook/repo-index.json.',
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        diff: diffContext
      }
    };
  }

  if (diffContext && includesAny(normalizedQuestion, ['risk', 'risky'])) {
    const riskyModules = diffContext.risk.moduleRisk.map((entry) => `${entry.module}(${entry.level})`);

    return {
      question: userQuestion,
      answer: `Diff risk level: ${diffContext.risk.highestLevel}. ${riskyModules.length > 0 ? `Module risk: ${riskyModules.join(', ')}` : 'No indexed modules were affected.'}`,
      reason:
        'Derived from change-scoped module risk signals by combining git diff files with indexed module risk intelligence.',
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        diff: diffContext
      }
    };
  }

  if (diffContext && includesAny(normalizedQuestion, ['verify', 'review', 'merge', 'ship'])) {
    const impactedDependents = Array.from(new Set(diffContext.impact.flatMap((entry) => entry.dependents))).sort((a, b) =>
      a.localeCompare(b)
    );
    const checks = [
      `changed files: ${diffContext.changedFiles.length}`,
      `affected modules: ${diffContext.affectedModules.length > 0 ? diffContext.affectedModules.join(', ') : 'none'}`,
      `impacted dependents: ${impactedDependents.length > 0 ? impactedDependents.join(', ') : 'none'}`,
      `docs touched: ${diffContext.docs.length > 0 ? diffContext.docs.join(', ') : 'none'}`,
      `risk level: ${diffContext.risk.highestLevel}`
    ];

    return {
      question: userQuestion,
      answer: `Verify checklist (${diffContext.baseRef}): ${checks.join('; ')}`,
      reason:
        'Derived from playbook-diff-context using git changed files plus indexed module impact/risk metadata without full-repo fallback.',
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        diff: diffContext
      }
    };
  }

  if (moduleContext && includesAny(normalizedQuestion, ['how', 'work', 'works', 'module'])) {
    const moduleSummary = buildModuleAskContext(moduleContext).split('\n').slice(0, 5).join('; ');

    return {
      question: userQuestion,
      answer: moduleSummary,
      reason:
        'Derived from module-scoped repository intelligence in .playbook/repo-index.json using indexed module and dependency metadata.',
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        module: moduleContext,
        diff: diffContext
      }
    };
  }

  if (normalizedQuestion.includes('where') && includesAny(normalizedQuestion, ['feature', 'features'])) {
    if (context.architecture === 'modular-monolith') {
      return {
        question: userQuestion,
        answer: 'Recommended location: src/features/<feature>',
        reason:
          'Playbook detected modular-monolith architecture with feature boundaries under src/features. ' +
          formatRulesHint(context.rules),
        context: {
          architecture: context.architecture,
          framework: context.framework,
          modules: context.modules
        }
      };
    }

    return {
      question: userQuestion,
      answer: 'Recommended location: src/<feature>',
      reason: `Playbook did not detect a modular-monolith layout. ${formatRulesHint(context.rules)}`,
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        module: moduleContext,
        diff: diffContext
      }
    };
  }

  if (normalizedQuestion.includes('architecture')) {
    return {
      question: userQuestion,
      answer: `Architecture: ${context.architecture}`,
      reason: `Derived from repository index architecture signal. ${formatRulesHint(context.rules)}`,
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        module: moduleContext,
        diff: diffContext
      }
    };
  }

  if (includesAny(normalizedQuestion, ['module', 'modules'])) {
    return {
      question: userQuestion,
      answer: context.modules.length > 0 ? `Modules: ${context.modules.join(', ')}` : 'Modules: none',
      reason: `Derived from repository index module graph. ${formatRulesHint(context.rules)}`,
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        module: moduleContext
      }
    };
  }

  return {
    question: userQuestion,
    answer: 'Playbook cannot answer this question yet.',
    reason: 'Suggested commands:\nplaybook query modules\nplaybook query architecture',
    context: {
      architecture: context.architecture,
      framework: context.framework,
      modules: context.modules,
      module: moduleContext,
      diff: diffContext
    }
  };
};
