import fs from 'node:fs';
import path from 'node:path';
import { loadAiContract } from '@zachariahredfield/playbook-engine';

const REPO_INDEX_PATH = '.playbook/repo-index.json' as const;
const AI_CONTRACT_PATH = '.playbook/ai-contract.json' as const;

type AskRepoContextOptions = {
  cwd: string;
  enabled: boolean;
};

type RepoIndexModule = {
  name?: unknown;
  dependencies?: unknown;
};

type RepoIndexPayload = {
  schemaVersion?: unknown;
  architecture?: unknown;
  framework?: unknown;
  language?: unknown;
  modules?: unknown;
  rules?: unknown;
};

export type AskRepoContextResult = {
  enabled: boolean;
  sources: string[];
  promptContext: string;
};

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const toModuleSummary = (modules: unknown): { names: string[]; edges: string[] } => {
  if (!Array.isArray(modules)) {
    return { names: [], edges: [] };
  }

  const names: string[] = [];
  const edges: string[] = [];

  for (const moduleEntry of modules) {
    if (typeof moduleEntry === 'string') {
      names.push(moduleEntry);
      continue;
    }

    if (!moduleEntry || typeof moduleEntry !== 'object' || Array.isArray(moduleEntry)) {
      continue;
    }

    const record = moduleEntry as RepoIndexModule;
    if (typeof record.name !== 'string') {
      continue;
    }

    names.push(record.name);
    const dependencies = ensureStringArray(record.dependencies);
    for (const dependency of dependencies) {
      edges.push(`${record.name} -> ${dependency}`);
    }
  }

  return {
    names: names.sort((left, right) => left.localeCompare(right)),
    edges: edges.sort((left, right) => left.localeCompare(right))
  };
};

const loadRepoIndex = (cwd: string): RepoIndexPayload => {
  const indexPath = path.join(cwd, REPO_INDEX_PATH);
  if (!fs.existsSync(indexPath)) {
    throw new Error('Repository context is not available yet.\nRun `playbook index` to generate .playbook/repo-index.json and retry.');
  }

  const payload = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as RepoIndexPayload;

  if (payload.schemaVersion !== '1.0') {
    throw new Error(
      `Repository context could not be loaded from ${REPO_INDEX_PATH}: unsupported schemaVersion "${String(payload.schemaVersion)}". Expected "1.0".`
    );
  }

  return payload;
};

type AskAiContract = ReturnType<typeof loadAiContract>['contract'];

const renderAiContractSummary = (contract: AskAiContract): string[] => [
  `AI contract runtime: ${contract.ai_runtime}`,
  `AI contract workflow: ${contract.workflow.join(' -> ')}`,
  `AI contract intelligence sources: repoIndex=${contract.intelligence_sources.repoIndex}, moduleOwners=${contract.intelligence_sources.moduleOwners}`,
  `AI contract rule: prefer Playbook commands over ad-hoc inspection = ${contract.rules.preferPlaybookCommandsOverAdHocInspection ? 'true' : 'false'}`
];

const renderRepoIndexSummary = (repoIndex: RepoIndexPayload): string[] => {
  const modules = toModuleSummary(repoIndex.modules);
  const rules = ensureStringArray(repoIndex.rules);

  const sections = [
    `Repository architecture: ${typeof repoIndex.architecture === 'string' ? repoIndex.architecture : 'unknown'}`,
    `Repository framework: ${typeof repoIndex.framework === 'string' ? repoIndex.framework : 'unknown'}`,
    `Repository language: ${typeof repoIndex.language === 'string' ? repoIndex.language : 'unknown'}`,
    `Repository modules (${modules.names.length}): ${modules.names.length > 0 ? modules.names.join(', ') : 'none'}`,
    `Repository module dependencies (${modules.edges.length}): ${modules.edges.length > 0 ? modules.edges.join('; ') : 'none'}`,
    `Repository rule registry (${rules.length}): ${rules.length > 0 ? rules.join(', ') : 'none'}`
  ];

  return sections;
};

export const loadAskRepoContext = (options: AskRepoContextOptions): AskRepoContextResult => {
  if (!options.enabled) {
    return {
      enabled: false,
      sources: [],
      promptContext: ''
    };
  }

  const repoIndex = loadRepoIndex(options.cwd);
  const contract = loadAiContract(options.cwd);

  const promptContext = [
    'Trusted repository context:',
    ...renderRepoIndexSummary(repoIndex),
    ...renderAiContractSummary(contract.contract),
    `AI contract source: ${contract.source === 'file' ? AI_CONTRACT_PATH : 'generated fallback (run `playbook ai-contract --json` to inspect/commit explicit contract)'}`,
    'End trusted repository context.'
  ].join('\n');

  return {
    enabled: true,
    sources: [REPO_INDEX_PATH, contract.source === 'file' ? AI_CONTRACT_PATH : 'generated-ai-contract-fallback'],
    promptContext
  };
};

