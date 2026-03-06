const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema' as const;

export type CliSchemaCommand = 'rules' | 'explain' | 'index' | 'verify' | 'plan';

export type JsonSchema = {
  [key: string]: unknown;
};

const cliSchemas: Record<CliSchemaCommand, JsonSchema> = {
  rules: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookRulesOutput',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'command', 'verify', 'analyze'],
    properties: {
      schemaVersion: { type: 'string' },
      command: { const: 'rules' },
      verify: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'description'],
          properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            explanation: { type: 'string' }
          }
        }
      },
      analyze: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'description'],
          properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            explanation: { type: 'string' }
          }
        }
      }
    }
  },
  explain: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookExplainOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'target', 'error'],
        properties: {
          command: { const: 'explain' },
          target: { type: 'string' },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'target', 'type', 'explanation'],
        properties: {
          command: { const: 'explain' },
          target: { type: 'string' },
          type: { enum: ['rule', 'module', 'architecture', 'unknown'] },
          explanation: {
            type: 'object',
            minProperties: 1,
            additionalProperties: true
          }
        }
      }
    ]
  },
  index: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookIndexOutput',
    type: 'object',
    additionalProperties: false,
    required: ['command', 'ok', 'indexFile', 'framework', 'architecture', 'modules'],
    properties: {
      command: { const: 'index' },
      ok: { const: true },
      indexFile: { const: '.playbook/repo-index.json' },
      framework: { type: 'string' },
      architecture: { type: 'string' },
      modules: { type: 'array', items: { type: 'string' } }
    }
  },
  verify: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookVerifyOutput',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'command', 'ok', 'exitCode', 'summary', 'findings', 'nextActions'],
    properties: {
      schemaVersion: { type: 'string' },
      command: { const: 'verify' },
      ok: { type: 'boolean' },
      exitCode: { type: 'integer' },
      summary: { type: 'string' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'level', 'message'],
          properties: {
            id: { type: 'string' },
            level: { enum: ['info', 'warning', 'error'] },
            message: { type: 'string' },
            explanation: { type: 'string' },
            remediation: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      nextActions: {
        type: 'array',
        items: { type: 'string' }
      },
      policyViolations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['policyId', 'ruleId', 'message'],
          properties: {
            policyId: { type: 'string' },
            ruleId: { type: 'string' },
            message: { type: 'string' },
            remediation: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  },
  plan: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookPlanOutput',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'command', 'ok', 'exitCode', 'verify', 'remediation', 'tasks'],
    properties: {
      schemaVersion: { type: 'string' },
      command: { const: 'plan' },
      ok: { type: 'boolean' },
      exitCode: { type: 'integer' },
      verify: {
        type: 'object',
        required: ['ok'],
        additionalProperties: true,
        properties: {
          ok: { type: 'boolean' }
        }
      },
      remediation: {
        type: 'object',
        additionalProperties: true,
        required: ['status', 'totalSteps', 'unresolvedFailures'],
        properties: {
          status: { enum: ['ready', 'not_needed', 'unavailable'] },
          totalSteps: { type: 'integer' },
          unresolvedFailures: { type: 'integer' },
          reason: { type: 'string' }
        }
      },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
          required: ['id', 'ruleId', 'action'],
          properties: {
            id: { type: 'string' },
            ruleId: { type: 'string' },
            file: { type: ['string', 'null'] },
            action: { type: 'string' },
            autoFix: { type: 'boolean' }
          }
        }
      }
    }
  }
};

export const CLI_SCHEMA_COMMANDS: readonly CliSchemaCommand[] = Object.freeze(Object.keys(cliSchemas) as CliSchemaCommand[]);

export const getCliSchemas = (): Record<CliSchemaCommand, JsonSchema> => ({
  rules: cliSchemas.rules,
  explain: cliSchemas.explain,
  index: cliSchemas.index,
  verify: cliSchemas.verify,
  plan: cliSchemas.plan
});

export const getCliSchema = (command: CliSchemaCommand): JsonSchema => cliSchemas[command];

export const isCliSchemaCommand = (value: string): value is CliSchemaCommand =>
  (CLI_SCHEMA_COMMANDS as readonly string[]).includes(value);
