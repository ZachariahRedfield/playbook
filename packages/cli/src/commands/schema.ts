import { CLI_SCHEMA_COMMANDS, getCliSchema, getCliSchemas, isCliSchemaCommand } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type SchemaOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

const firstPositionalArg = (args: string[]): string | undefined => args.find((arg) => !arg.startsWith('-'));

const printUsage = (): void => {
  console.error('Usage: playbook schema [rules|explain|index|graph|verify|plan|context|ai-context|ai-contract|doctor|analyze-pr|query|knowledge|docs|contracts|ignore|learn] [--json]');
};

const renderTextSummary = (command?: string): void => {
  if (command) {
    console.log(`Schema for playbook ${command} --json`);
    return;
  }

  console.log('Playbook CLI output schemas');
  console.log('──────────────────────────');
  console.log(`Commands: ${CLI_SCHEMA_COMMANDS.join(', ')}`);
};

const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

const withQueryAdditiveMemoryFields = (schema: Record<string, unknown>): void => {
  const oneOf = schema.oneOf;
  if (!Array.isArray(oneOf)) return;
  oneOf.push({
    type: 'object',
    additionalProperties: false,
    required: ['command', 'field', 'result', 'memoryKnowledge'],
    properties: {
      command: { const: 'query' },
      field: { type: 'string' },
      result: {},
      memorySummary: { type: 'string' },
      memorySources: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } },
      knowledgeHits: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } },
      recentRelevantEvents: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } },
      memoryKnowledge: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['source', 'candidateId', 'kind', 'title', 'summary', 'module', 'ruleId', 'failureShape', 'provenance'],
          properties: {
            source: { enum: ['promoted', 'candidate'] },
            knowledgeId: { type: 'string' },
            candidateId: { type: 'string' },
            kind: { type: 'string' },
            title: { type: 'string' },
            summary: { type: 'string' },
            module: { type: 'string' },
            ruleId: { type: 'string' },
            failureShape: { type: 'string' },
            provenance: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } }
          }
        }
      }
    }
  });
};

const withExplainMemoryKnowledgeFields = (schema: Record<string, unknown>): void => {
  const oneOf = schema.oneOf;
  if (!Array.isArray(oneOf)) return;
  for (const entry of oneOf) {
    const record = asRecord(entry);
    const properties = asRecord(record.properties ?? {});
    const explanation = asRecord(properties.explanation ?? {});
    if (explanation.type === 'object') {
      explanation.properties = {
        ...(asRecord(explanation.properties ?? {})),
        artifact_lineage: {
          type: 'object',
          additionalProperties: false,
          required: ['ownerSubsystem', 'upstreamSubsystem', 'downstreamConsumers'],
          properties: {
            ownerSubsystem: { type: 'string' },
            upstreamSubsystem: { type: ['string', 'null'] },
            downstreamConsumers: { type: 'array', items: { type: 'string' } }
          }
        },
        memoryKnowledge: {
          type: 'object',
          additionalProperties: false,
          required: ['promoted', 'candidates'],
          properties: {
            promoted: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } },
            candidates: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } }
          }
        }
      };
    }
  }
};

const withPlanAdvisoryFields = (schema: Record<string, unknown>): void => {
  const properties = asRecord(schema.properties ?? {});
  const tasks = asRecord(properties.tasks ?? {});
  const items = asRecord(tasks.items ?? {});
  items.properties = {
    ...(asRecord(items.properties ?? {})),
    advisory: {
      type: 'object',
      additionalProperties: true,
      properties: {
        outcomeLearning: {
          type: 'object',
          additionalProperties: true,
          required: ['influencedByKnowledgeIds', 'rationale', 'scope', 'support', 'confidence'],
          properties: {
            influencedByKnowledgeIds: { type: 'array', items: { type: 'string' } },
            rationale: { type: 'string' },
            scope: {
              type: 'object',
              additionalProperties: true,
              properties: {
                ruleIdMatched: { type: 'boolean' },
                moduleMatched: { type: 'boolean' },
                failureShapeMatched: { type: 'boolean' }
              }
            },
            support: {
              type: 'object',
              additionalProperties: true,
              properties: {
                sourceCandidateCount: { type: 'integer' },
                provenanceCount: { type: 'integer' },
                eventFingerprintCount: { type: 'integer' }
              }
            },
            confidence: { type: 'number' }
          }
        }
      }
    }
  };
};

const withAnalyzePrAdditions = (schema: Record<string, unknown>): void => {
  const oneOf = schema.oneOf;
  if (!Array.isArray(oneOf) || oneOf.length < 2) return;
  const success = asRecord(oneOf[1]);
  const required = success.required;
  if (Array.isArray(required) && !required.includes('preventionGuidance')) required.push('preventionGuidance');
  const properties = asRecord(success.properties ?? {});
  properties.preventionGuidance = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['target', 'guidance', 'provenance'],
      properties: {
        target: {
          type: 'object',
          additionalProperties: false,
          required: ['module', 'ruleId', 'failureShape'],
          properties: {
            module: { type: 'string' },
            ruleId: { type: 'string' },
            failureShape: { type: 'string' }
          }
        },
        guidance: { type: 'string' },
        provenance: {
          type: 'object',
          additionalProperties: false,
          required: ['knowledgeId', 'evidenceChain'],
          properties: {
            knowledgeId: { type: 'string' },
            evidenceChain: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } }
          }
        }
      }
    }
  };
};


const withContractsSchemaRegistry = (schema: Record<string, unknown>): void => {
  const required = schema.required;
  if (Array.isArray(required) && !required.includes('schemas')) required.push('schemas');
  const properties = asRecord(schema.properties ?? {});
  properties.schemas = {
    type: 'object',
    additionalProperties: false,
    required: ['memoryArtifacts', 'commandOutputs'],
    properties: {
      memoryArtifacts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'version', 'path'],
          properties: { id: { type: 'string' }, version: { type: 'string' }, path: { type: 'string' } }
        }
      },
      commandOutputs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'version', 'path'],
          properties: { id: { type: 'string' }, version: { type: 'string' }, path: { type: 'string' } }
        }
      }
    }
  };
};

const applySchemaAdditions = (target: string | undefined, payload: unknown): unknown => {
  const cloned = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  if (target) {
    if (target === 'query') withQueryAdditiveMemoryFields(cloned);
    if (target === 'explain') withExplainMemoryKnowledgeFields(cloned);
    if (target === 'plan') withPlanAdvisoryFields(cloned);
    if (target === 'analyze-pr') withAnalyzePrAdditions(cloned);
    if (target === 'contracts') withContractsSchemaRegistry(cloned);
    return cloned;
  }

  const all = cloned;
  withQueryAdditiveMemoryFields(asRecord(all.query));
  withExplainMemoryKnowledgeFields(asRecord(all.explain));
  withPlanAdvisoryFields(asRecord(all.plan));
  withAnalyzePrAdditions(asRecord(all['analyze-pr']));
  withContractsSchemaRegistry(asRecord(all.contracts));
  return all;
};

export const runSchema = async (_cwd: string, commandArgs: string[], options: SchemaOptions): Promise<number> => {
  const target = firstPositionalArg(commandArgs);

  if (target && !isCliSchemaCommand(target)) {
    console.error(`playbook schema: unknown schema target "${target}"`);
    printUsage();
    return ExitCode.Failure;
  }

  const basePayload = target ? getCliSchema(target) : getCliSchemas();
  const payload = applySchemaAdditions(target, basePayload);

  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderTextSummary(target);
    console.log(JSON.stringify(payload, null, 2));
  }

  return ExitCode.Success;
};
