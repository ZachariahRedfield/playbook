import fs from 'node:fs';
import path from 'node:path';

export const AI_CONTRACT_SCHEMA_VERSION = '1.0' as const;
export const AI_CONTRACT_FILE = '.playbook/ai-contract.json' as const;

export type AiContract = {
  schemaVersion: typeof AI_CONTRACT_SCHEMA_VERSION;
  kind: 'playbook-ai-contract';
  ai_runtime: 'playbook-agent';
  workflow: ['index', 'query', 'plan', 'apply', 'verify'];
  intelligence_sources: {
    repoIndex: '.playbook/repo-index.json';
    moduleOwners: '.playbook/module-owners.json';
  };
  queries: ['architecture', 'dependencies', 'impact', 'risk', 'docs-coverage', 'rule-owners', 'module-owners'];
  remediation: {
    canonicalFlow: ['verify', 'plan', 'apply', 'verify'];
    diagnosticAugmentation: ['explain'];
  };
  rules: {
    requireIndexBeforeQuery: true;
    preferPlaybookCommandsOverAdHocInspection: true;
    allowDirectEditsWithoutPlan: false;
  };
  ownership?: {
    ruleOwnersQuery: 'query rule-owners';
    moduleOwnersQuery: 'query module-owners';
  };
};

export type AiContractSource = 'file' | 'generated';

export type LoadedAiContract = {
  source: AiContractSource;
  contract: AiContract;
  contractFile: string;
};

const defaultAiContract = (): AiContract => ({
  schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
  kind: 'playbook-ai-contract',
  ai_runtime: 'playbook-agent',
  workflow: ['index', 'query', 'plan', 'apply', 'verify'],
  intelligence_sources: {
    repoIndex: '.playbook/repo-index.json',
    moduleOwners: '.playbook/module-owners.json'
  },
  queries: ['architecture', 'dependencies', 'impact', 'risk', 'docs-coverage', 'rule-owners', 'module-owners'],
  remediation: {
    canonicalFlow: ['verify', 'plan', 'apply', 'verify'],
    diagnosticAugmentation: ['explain']
  },
  rules: {
    requireIndexBeforeQuery: true,
    preferPlaybookCommandsOverAdHocInspection: true,
    allowDirectEditsWithoutPlan: false
  },
  ownership: {
    ruleOwnersQuery: 'query rule-owners',
    moduleOwnersQuery: 'query module-owners'
  }
});

const ensureString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`AI contract field "${field}" must be a string.`);
  }

  return value;
};

const ensureStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`AI contract field "${field}" must be an array of strings.`);
  }

  return value;
};

const ensureBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`AI contract field "${field}" must be a boolean.`);
  }

  return value;
};

export const getDefaultAiContract = (): AiContract => defaultAiContract();

export const validateAiContract = (value: unknown): AiContract => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI contract must be a JSON object.');
  }

  const record = value as Record<string, unknown>;

  const schemaVersion = ensureString(record.schemaVersion, 'schemaVersion');
  if (schemaVersion !== AI_CONTRACT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported AI contract schemaVersion "${schemaVersion}". Expected "${AI_CONTRACT_SCHEMA_VERSION}".`
    );
  }

  if (ensureString(record.kind, 'kind') !== 'playbook-ai-contract') {
    throw new Error('AI contract field "kind" must be "playbook-ai-contract".');
  }

  if (ensureString(record.ai_runtime, 'ai_runtime') !== 'playbook-agent') {
    throw new Error('AI contract field "ai_runtime" must be "playbook-agent".');
  }

  const workflow = ensureStringArray(record.workflow, 'workflow');
  const intelligenceSources = record.intelligence_sources;
  const queries = ensureStringArray(record.queries, 'queries');
  const remediation = record.remediation;
  const rules = record.rules;

  if (!intelligenceSources || typeof intelligenceSources !== 'object' || Array.isArray(intelligenceSources)) {
    throw new Error('AI contract field "intelligence_sources" must be an object.');
  }

  if (!remediation || typeof remediation !== 'object' || Array.isArray(remediation)) {
    throw new Error('AI contract field "remediation" must be an object.');
  }

  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error('AI contract field "rules" must be an object.');
  }

  const intelligenceSourcesRecord = intelligenceSources as Record<string, unknown>;
  const remediationRecord = remediation as Record<string, unknown>;
  const rulesRecord = rules as Record<string, unknown>;

  const contract: AiContract = {
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    kind: 'playbook-ai-contract',
    ai_runtime: 'playbook-agent',
    workflow: workflow as AiContract['workflow'],
    intelligence_sources: {
      repoIndex: ensureString(intelligenceSourcesRecord.repoIndex, 'intelligence_sources.repoIndex') as '.playbook/repo-index.json',
      moduleOwners: ensureString(
        intelligenceSourcesRecord.moduleOwners,
        'intelligence_sources.moduleOwners'
      ) as '.playbook/module-owners.json'
    },
    queries: queries as AiContract['queries'],
    remediation: {
      canonicalFlow: ensureStringArray(remediationRecord.canonicalFlow, 'remediation.canonicalFlow') as AiContract['remediation']['canonicalFlow'],
      diagnosticAugmentation: ensureStringArray(
        remediationRecord.diagnosticAugmentation,
        'remediation.diagnosticAugmentation'
      ) as AiContract['remediation']['diagnosticAugmentation']
    },
    rules: {
      requireIndexBeforeQuery: ensureBoolean(rulesRecord.requireIndexBeforeQuery, 'rules.requireIndexBeforeQuery') as true,
      preferPlaybookCommandsOverAdHocInspection: ensureBoolean(
        rulesRecord.preferPlaybookCommandsOverAdHocInspection,
        'rules.preferPlaybookCommandsOverAdHocInspection'
      ) as true,
      allowDirectEditsWithoutPlan: ensureBoolean(
        rulesRecord.allowDirectEditsWithoutPlan,
        'rules.allowDirectEditsWithoutPlan'
      ) as false
    }
  };

  if (record.ownership !== undefined) {
    if (!record.ownership || typeof record.ownership !== 'object' || Array.isArray(record.ownership)) {
      throw new Error('AI contract field "ownership" must be an object when present.');
    }

    const ownershipRecord = record.ownership as Record<string, unknown>;
    contract.ownership = {
      ruleOwnersQuery: ensureString(ownershipRecord.ruleOwnersQuery, 'ownership.ruleOwnersQuery') as 'query rule-owners',
      moduleOwnersQuery: ensureString(ownershipRecord.moduleOwnersQuery, 'ownership.moduleOwnersQuery') as 'query module-owners'
    };
  }

  return contract;
};

export const loadAiContract = (cwd: string): LoadedAiContract => {
  const contractFile = path.join(cwd, AI_CONTRACT_FILE);

  if (!fs.existsSync(contractFile)) {
    return {
      source: 'generated',
      contract: defaultAiContract(),
      contractFile: AI_CONTRACT_FILE
    };
  }

  try {
    const raw = fs.readFileSync(contractFile, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    return {
      source: 'file',
      contract: validateAiContract(parsed),
      contractFile: AI_CONTRACT_FILE
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load AI contract from ${AI_CONTRACT_FILE}: ${message}`);
  }
};
