import { queryRepositoryIndex } from '../query/repoQuery.js';

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
  };
};

const normalizeQuestion = (question: string): string => question.trim().toLowerCase();

const gatherContext = (projectRoot: string): AskContext => {
  const architecture = queryRepositoryIndex(projectRoot, 'architecture').result as string;
  const modules = queryRepositoryIndex(projectRoot, 'modules').result as string[];
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

export const answerRepositoryQuestion = (projectRoot: string, question: string): AskEngineResult => {
  const normalizedQuestion = normalizeQuestion(question);
  const context = gatherContext(projectRoot);

  if (normalizedQuestion.includes('where') && includesAny(normalizedQuestion, ['feature', 'features'])) {
    if (context.architecture === 'modular-monolith') {
      return {
        question,
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
      question,
      answer: 'Recommended location: src/<feature>',
      reason: `Playbook did not detect a modular-monolith layout. ${formatRulesHint(context.rules)}`,
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules
      }
    };
  }

  if (normalizedQuestion.includes('architecture')) {
    return {
      question,
      answer: `Architecture: ${context.architecture}`,
      reason: `Derived from repository index architecture signal. ${formatRulesHint(context.rules)}`,
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules
      }
    };
  }

  if (includesAny(normalizedQuestion, ['module', 'modules'])) {
    return {
      question,
      answer: context.modules.length > 0 ? `Modules: ${context.modules.join(', ')}` : 'Modules: none',
      reason: `Derived from repository index module graph. ${formatRulesHint(context.rules)}`,
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules
      }
    };
  }

  return {
    question,
    answer: 'Playbook cannot answer this question yet.',
    reason: 'Suggested commands:\nplaybook query modules\nplaybook query architecture',
    context: {
      architecture: context.architecture,
      framework: context.framework,
      modules: context.modules
    }
  };
};
