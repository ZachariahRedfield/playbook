const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema' as const;

export type CliSchemaCommand = 'rules' | 'explain' | 'index' | 'verify' | 'plan' | 'context' | 'ai-context' | 'query';

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
  },
  context: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookContextOutput',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'command', 'architecture', 'workflow', 'repositoryIntelligence', 'cli'],
    properties: {
      schemaVersion: { type: 'string' },
      command: { const: 'context' },
      architecture: { const: 'modular-monolith' },
      workflow: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 3
      },
      repositoryIntelligence: {
        type: 'object',
        additionalProperties: false,
        required: ['artifact', 'commands'],
        properties: {
          artifact: { const: '.playbook/repo-index.json' },
          commands: {
            type: 'array',
            items: { type: 'string' },
            minItems: 4,
            maxItems: 4
          }
        }
      },
      cli: {
        type: 'object',
        additionalProperties: false,
        required: ['commands'],
        properties: {
          commands: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1
          }
        }
      }
    }
  },


  query: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookQueryOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'field', 'result'],
        properties: {
          command: { const: 'query' },
          field: { type: 'string' },
          result: {}
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'module', 'riskScore', 'riskLevel', 'signals', 'contributions', 'reasons'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { const: 'risk' },
          module: { type: 'string' },
          riskScore: { type: 'number' },
          riskLevel: { enum: ['low', 'medium', 'high'] },
          signals: {
            type: 'object',
            additionalProperties: false,
            required: ['directDependencies', 'dependents', 'transitiveImpact', 'verifyFailures', 'isArchitecturalHub'],
            properties: {
              directDependencies: { type: 'integer', minimum: 0 },
              dependents: { type: 'integer', minimum: 0 },
              transitiveImpact: { type: 'integer', minimum: 0 },
              verifyFailures: { type: 'integer', minimum: 0 },
              isArchitecturalHub: { type: 'boolean' }
            }
          },
          contributions: {
            type: 'object',
            additionalProperties: false,
            required: ['fanIn', 'impact', 'verifyFailures', 'hub'],
            properties: {
              fanIn: { type: 'number' },
              impact: { type: 'number' },
              verifyFailures: { type: 'number' },
              hub: { type: 'number' }
            }
          },
          reasons: { type: 'array', items: { type: 'string' }, minItems: 1 },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'module', 'error'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { enum: ['dependencies', 'impact', 'risk'] },
          module: { type: ['string', 'null'] },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'field', 'error', 'supportedFields'],
        properties: {
          command: { const: 'query' },
          field: { type: 'string' },
          error: { type: 'string' },
          supportedFields: { type: 'array', items: { type: 'string' } }
        }
      }
    ]
  },

  'ai-context': {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookAiContextOutput',
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'command',
      'repo',
      'repositoryIntelligence',
      'operatingLadder',
      'productCommands',
      'guidance'
    ],
    properties: {
      schemaVersion: { type: 'string' },
      command: { const: 'ai-context' },
      repo: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'architecture', 'localCliPreferred'],
        properties: {
          summary: { type: 'string' },
          architecture: { const: 'modular-monolith' },
          localCliPreferred: { type: 'boolean' }
        }
      },
      repositoryIntelligence: {
        type: 'object',
        additionalProperties: false,
        required: ['artifact', 'available', 'commands'],
        properties: {
          artifact: { const: '.playbook/repo-index.json' },
          available: { type: 'boolean' },
          commands: {
            type: 'array',
            items: { type: 'string' },
            minItems: 5,
            maxItems: 5
          }
        }
      },
      operatingLadder: {
        type: 'object',
        additionalProperties: false,
        required: ['preferredCommandOrder', 'recommendedBootstrap', 'remediationWorkflow'],
        properties: {
          preferredCommandOrder: {
            type: 'array',
            items: { type: 'string' },
            minItems: 8,
            maxItems: 8
          },
          recommendedBootstrap: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2
          },
          remediationWorkflow: {
            type: 'array',
            items: { type: 'string' },
            minItems: 5,
            maxItems: 5
          }
        }
      },
      productCommands: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'example'],
          properties: {
            name: { type: 'string' },
            example: { type: 'string' }
          }
        }
      },
      guidance: {
        type: 'object',
        additionalProperties: false,
        required: ['preferPlaybookCommands', 'authorityRule', 'localExecutionRule', 'failureMode'],
        properties: {
          preferPlaybookCommands: { const: true },
          authorityRule: { type: 'string' },
          localExecutionRule: { type: 'string' },
          failureMode: { type: 'string' }
        }
      }
    }
  },
};

export const CLI_SCHEMA_COMMANDS: readonly CliSchemaCommand[] = Object.freeze(Object.keys(cliSchemas) as CliSchemaCommand[]);

export const getCliSchemas = (): Record<CliSchemaCommand, JsonSchema> => ({
  rules: cliSchemas.rules,
  explain: cliSchemas.explain,
  index: cliSchemas.index,
  verify: cliSchemas.verify,
  plan: cliSchemas.plan,
  context: cliSchemas.context,
  'ai-context': cliSchemas['ai-context'],
  query: cliSchemas.query
});

export const getCliSchema = (command: CliSchemaCommand): JsonSchema => cliSchemas[command];

export const isCliSchemaCommand = (value: string): value is CliSchemaCommand =>
  (CLI_SCHEMA_COMMANDS as readonly string[]).includes(value);
