import fs from 'node:fs';
import path from 'node:path';
import { queryRepositoryIndex } from '../query/repoQuery.js';
import type { RepositoryModule } from '../indexer/repoIndexer.js';
import { buildModuleAskContext, resolveIndexedModuleContext, type IndexedModuleContext } from '../query/moduleIntelligence.js';
import { readModuleContextDigest, type ModuleContextDigest } from '../context/moduleContext.js';
import { resolveDiffAskContext, type DiffAskContext } from './diffContext.js';

type AskContext = {
  architecture: string;
  framework: string;
  modules: string[];
  rules: string[];
};

export type AskAnswerabilityState = 'answered-from-trusted-artifact' | 'artifact-missing' | 'artifact-stale' | 'unsupported-question';

export type AskEngineResult = {
  question: string;
  answer: string;
  reason: string;
  answerability: {
    state: AskAnswerabilityState;
    artifact?: string;
  };
  context: {
    architecture: string;
    framework: string;
    modules: string[];
    module?: IndexedModuleContext;
    moduleDigest?: ModuleContextDigest;
    diff?: DiffAskContext;
  };
};

type AskEngineOptions = {
  module?: string;
  diffContext?: boolean;
  baseRef?: string;
};

const AI_CONTRACT_PATH = '.playbook/ai-contract.json' as const;

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

const hasAiContractArtifact = (projectRoot: string): boolean => fs.existsSync(path.join(projectRoot, AI_CONTRACT_PATH));

const governanceQuestionAnswer = (
  normalizedQuestion: string,
  projectRoot: string
): { answer: string; reason: string; state: AskAnswerabilityState; artifact: string } | undefined => {
  if (
    includesAny(normalizedQuestion, ['operating ladder', 'preferred command order']) ||
    (normalizedQuestion.includes('ladder') && normalizedQuestion.includes('ai'))
  ) {
    if (!hasAiContractArtifact(projectRoot)) {
      return {
        answer: 'Repository AI contract artifact is missing.',
        reason: 'Run `playbook ai-contract --json` to generate .playbook/ai-contract.json, then retry deterministic repository-context ask.',
        state: 'artifact-missing',
        artifact: AI_CONTRACT_PATH
      };
    }

    return {
      answer: 'Preferred AI operating ladder: ai-context -> ai-contract -> context -> index/query/explain/ask --repo-context -> verify/plan/apply',
      reason: 'Derived from managed AGENTS.md governance contract.',
      state: 'answered-from-trusted-artifact',
      artifact: 'AGENTS.md'
    };
  }

  if (includesAny(normalizedQuestion, ['remediation workflow', 'verify -> plan -> apply -> verify', 'canonical remediation'])) {
    return {
      answer: 'Canonical remediation workflow: verify -> plan -> apply -> verify (optional diagnostic augmentation: explain between verify and plan).',
      reason: 'Derived from managed AGENTS.md governance contract and AI contract remediation flow.',
      state: 'answered-from-trusted-artifact',
      artifact: 'AGENTS.md'
    };
  }

  if (includesAny(normalizedQuestion, ['command authority', 'authority order'])) {
    return {
      answer:
        'Command authority order: ai-context -> ai-contract -> context -> index -> query -> explain -> ask --repo-context -> rules -> verify -> direct file inspection only when command coverage is insufficient.',
      reason: 'Derived from managed AGENTS.md command authority section.',
      state: 'answered-from-trusted-artifact',
      artifact: 'AGENTS.md'
    };
  }

  if (
    includesAny(normalizedQuestion, ['documentation placement', 'governance boundaries']) ||
    (normalizedQuestion.includes('where') && normalizedQuestion.includes('documentation'))
  ) {
    return {
      answer:
        'Governance documentation surfaces: README.md, docs/commands/README.md, docs/PLAYBOOK_PRODUCT_ROADMAP.md, demo docs/contracts, and docs/CHANGELOG.md should stay aligned when command/workflow state changes.',
      reason: 'Derived from managed AGENTS.md documentation expectations section.',
      state: 'answered-from-trusted-artifact',
      artifact: 'AGENTS.md'
    };
  }

  return undefined;
};

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

  const governanceAnswer = governanceQuestionAnswer(normalizedQuestion, projectRoot);
  if (governanceAnswer) {
    return {
      question: userQuestion,
      answer: governanceAnswer.answer,
      reason: governanceAnswer.reason,
      answerability: {
        state: governanceAnswer.state,
        artifact: governanceAnswer.artifact
      },
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        module: moduleContext,
        diff: diffContext
      }
    };
  }

  if (diffContext && includesAny(normalizedQuestion, ['module', 'modules', 'affected'])) {
    return {
      question: userQuestion,
      answer:
        diffContext.affectedModules.length > 0
          ? `Affected modules: ${diffContext.affectedModules.join(', ')}`
          : 'Affected modules: none (changed files are outside indexed module roots)',
      reason:
        'Derived from playbook-diff-context by mapping git changed files to indexed modules in .playbook/repo-index.json.',
      answerability: {
        state: 'answered-from-trusted-artifact',
        artifact: '.playbook/repo-index.json'
      },
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
      answerability: {
        state: 'answered-from-trusted-artifact',
        artifact: '.playbook/repo-index.json'
      },
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
      answerability: {
        state: 'answered-from-trusted-artifact',
        artifact: '.playbook/repo-index.json'
      },
      context: {
        architecture: context.architecture,
        framework: context.framework,
        modules: context.modules,
        diff: diffContext
      }
    };
  }

  if (moduleContext && includesAny(normalizedQuestion, ['how', 'work', 'works', 'module'])) {
    const moduleDigest = readModuleContextDigest(projectRoot, moduleContext.module.name);

    if (moduleDigest) {
      const digestSummary = [
        `Module scope: ${moduleDigest.module.name}`,
        `Dependencies: ${moduleDigest.dependencies.length > 0 ? moduleDigest.dependencies.join(', ') : 'none'}`,
        `Direct dependents: ${moduleDigest.directDependents.length > 0 ? moduleDigest.directDependents.join(', ') : 'none'}`,
        `Risk: ${moduleDigest.risk.level} (${moduleDigest.risk.score.toFixed(2)})`,
        `Graph neighborhood kinds: out[${moduleDigest.graphNeighborhood.outgoingKinds.join(', ') || 'none'}], in[${moduleDigest.graphNeighborhood.incomingKinds.join(', ') || 'none'}]`
      ].join('; ');

      return {
        question: userQuestion,
        answer: digestSummary,
        reason:
          'Derived from module-scoped compressed context in .playbook/context/modules plus graph/index intelligence artifacts.',
        answerability: {
          state: 'answered-from-trusted-artifact',
          artifact: `.playbook/context/modules/${moduleDigest.module.name.replace(/[\\/]/g, '__')}.json`
        },
        context: {
          architecture: context.architecture,
          framework: context.framework,
          modules: context.modules,
          module: moduleContext,
          moduleDigest,
          diff: diffContext
        }
      };
    }

    const moduleSummary = buildModuleAskContext(moduleContext).split('\n').slice(0, 5).join('; ');

    return {
      question: userQuestion,
      answer: moduleSummary,
      reason:
        'Derived from module-scoped repository intelligence in .playbook/repo-index.json using indexed module and dependency metadata.',
      answerability: {
        state: 'answered-from-trusted-artifact',
        artifact: '.playbook/repo-index.json'
      },
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
        answerability: {
          state: 'answered-from-trusted-artifact',
          artifact: '.playbook/repo-index.json'
        },
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
      answerability: {
        state: 'answered-from-trusted-artifact',
        artifact: '.playbook/repo-index.json'
      },
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
      answerability: {
        state: 'answered-from-trusted-artifact',
        artifact: '.playbook/repo-index.json'
      },
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
      answerability: {
        state: 'answered-from-trusted-artifact',
        artifact: '.playbook/repo-index.json'
      },
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
    answerability: {
      state: 'unsupported-question'
    },
    context: {
      architecture: context.architecture,
      framework: context.framework,
      modules: context.modules,
      module: moduleContext,
      diff: diffContext
    }
  };
};
