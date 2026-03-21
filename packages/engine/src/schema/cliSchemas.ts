const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema' as const;

export type CliSchemaCommand =
  | 'rules'
  | 'explain'
  | 'index'
  | 'graph'
  | 'verify'
  | 'plan'
  | 'context'
  | 'ai-context'
  | 'ai-contract'
  | 'doctor'
  | 'analyze-pr'
  | 'query'
  | 'knowledge'
  | 'docs'
  | 'contracts'
  | 'ignore'
  | 'learn'
  | 'test-triage'
  | 'test-fix-plan'
  | 'test-autofix'
  | 'remediation-status';

export type JsonSchema = {
  [key: string]: unknown;
};

const knowledgeRecordSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'type', 'createdAt', 'repo', 'source', 'confidence', 'status', 'lifecycle', 'provenance', 'metadata'],
  properties: {
    id: { type: 'string' },
    type: { enum: ['evidence', 'candidate', 'promoted', 'superseded'] },
    createdAt: { type: 'string' },
    repo: { type: 'string' },
    source: {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'path', 'command'],
      properties: {
        kind: { enum: ['memory-event', 'memory-candidate', 'memory-knowledge', 'global-pattern-memory'] },
        path: { type: 'string' },
        command: { type: ['string', 'null'] }
      }
    },
    confidence: { type: ['number', 'null'] },
    status: { enum: ['observed', 'active', 'stale', 'retired', 'superseded'] },
    lifecycle: {
      type: 'object',
      additionalProperties: false,
      required: ['state', 'warnings', 'supersedes', 'supersededBy'],
      properties: {
        state: { enum: ['observed', 'candidate', 'active', 'stale', 'retired', 'superseded', 'demoted'] },
        warnings: { type: 'array', items: { type: 'string' } },
        supersedes: { type: 'array', items: { type: 'string' } },
        supersededBy: { type: 'array', items: { type: 'string' } }
      }
    },
    provenance: {
      type: 'object',
      additionalProperties: false,
      required: ['repo', 'sourceCommand', 'runId', 'sourcePath', 'eventIds', 'evidenceIds', 'fingerprints', 'relatedRecordIds'],
      properties: {
        repo: { type: 'string' },
        sourceCommand: { type: ['string', 'null'] },
        runId: { type: ['string', 'null'] },
        sourcePath: { type: 'string' },
        eventIds: { type: 'array', items: { type: 'string' } },
        evidenceIds: { type: 'array', items: { type: 'string' } },
        fingerprints: { type: 'array', items: { type: 'string' } },
        relatedRecordIds: { type: 'array', items: { type: 'string' } }
      }
    },
    metadata: {
      type: 'object',
      additionalProperties: true
    }
  }
};

const knowledgeSummarySchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['total', 'byType', 'byStatus', 'byLifecycle'],
  properties: {
    total: { type: 'integer' },
    byType: {
      type: 'object',
      additionalProperties: false,
      required: ['evidence', 'candidate', 'promoted', 'superseded'],
      properties: {
        evidence: { type: 'integer' },
        candidate: { type: 'integer' },
        promoted: { type: 'integer' },
        superseded: { type: 'integer' }
      }
    },
    byStatus: {
      type: 'object',
      additionalProperties: false,
      required: ['observed', 'active', 'stale', 'retired', 'superseded'],
      properties: {
        observed: { type: 'integer' },
        active: { type: 'integer' },
        stale: { type: 'integer' },
        retired: { type: 'integer' },
        superseded: { type: 'integer' }
      }
    },
    byLifecycle: {
      type: 'object',
      additionalProperties: false,
      required: ['observed', 'candidate', 'active', 'stale', 'retired', 'superseded', 'demoted'],
      properties: {
        observed: { type: 'integer' },
        candidate: { type: 'integer' },
        active: { type: 'integer' },
        stale: { type: 'integer' },
        retired: { type: 'integer' },
        superseded: { type: 'integer' },
        demoted: { type: 'integer' }
      }
    }
  }
};

const knowledgeFiltersSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { enum: ['evidence', 'candidate', 'promoted', 'superseded'] },
    status: { enum: ['observed', 'active', 'stale', 'retired', 'superseded'] },
    lifecycle: { enum: ['observed', 'candidate', 'active', 'stale', 'retired', 'superseded', 'demoted'] },
    module: { type: 'string' },
    ruleId: { type: 'string' },
    text: { type: 'string' },
    limit: { type: 'integer' },
    order: { enum: ['asc', 'desc'] },
    staleDays: { type: 'integer' }
  }
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
          type: { enum: ['rule', 'module', 'architecture', 'subsystem', 'artifact', 'unknown'] },
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
    required: ['command', 'ok', 'indexFile', 'graphFile', 'systemMapFile', 'contextDir', 'framework', 'architecture', 'modules'],
    properties: {
      command: { const: 'index' },
      ok: { const: true },
      indexFile: { const: '.playbook/repo-index.json' },
      graphFile: { const: '.playbook/repo-graph.json' },
      systemMapFile: { const: '.playbook/system-map.json' },
      contextDir: { const: '.playbook/context/modules' },
      framework: { type: 'string' },
      architecture: { type: 'string' },
      modules: { type: 'array', items: { type: 'string' } }
    }
  },
  graph: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookGraphOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { const: '1.1' },
          command: { const: 'graph' },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'graph'],
        properties: {
          schemaVersion: { const: '1.1' },
          command: { const: 'graph' },
          graph: {
            type: 'object',
            additionalProperties: false,
            required: ['schemaVersion', 'kind', 'stats', 'nodeKinds', 'edgeKinds', 'topDependencyHubs'],
            properties: {
              schemaVersion: { const: '1.1' },
              kind: { const: 'playbook-repo-graph' },
              generatedAt: { type: 'string' },
              stats: {
                type: 'object',
                additionalProperties: false,
                required: ['nodeCount', 'edgeCount', 'nodeKinds', 'edgeKinds'],
                properties: {
                  nodeCount: { type: 'integer' },
                  edgeCount: { type: 'integer' },
                  nodeKinds: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      module: { type: 'integer' },
                      repository: { type: 'integer' },
                      rule: { type: 'integer' }
                    }
                  },
                  edgeKinds: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      contains: { type: 'integer' },
                      depends_on: { type: 'integer' },
                      governed_by: { type: 'integer' }
                    }
                  }
                }
              },
              nodeKinds: {
                type: 'array',
                items: { enum: ['module', 'repository', 'rule'] }
              },
              edgeKinds: {
                type: 'array',
                items: { enum: ['contains', 'depends_on', 'governed_by'] }
              },
              topDependencyHubs: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['module', 'incomingDependencies'],
                  properties: {
                    module: { type: 'string' },
                    incomingDependencies: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    ]
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
    required: ['schemaVersion', 'command', 'architecture', 'workflow', 'repositoryIntelligence', 'controlPlaneArtifacts', 'cli'],
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
      controlPlaneArtifacts: {
        type: 'object',
        additionalProperties: false,
        required: ['policyEvaluation', 'policyApplyResult', 'session', 'cycleState', 'cycleHistory', 'improvementCandidates', 'prReview'],
        properties: {
          policyEvaluation: { const: '.playbook/policy-evaluation.json' },
          policyApplyResult: { const: '.playbook/policy-apply-result.json' },
          session: { const: '.playbook/session.json' },
          cycleState: { const: '.playbook/cycle-state.json' },
          cycleHistory: { const: '.playbook/cycle-history.json' },
          improvementCandidates: { const: '.playbook/improvement-candidates.json' },
          prReview: { const: '.playbook/pr-review.json' }
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

  'ai-contract': {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookAiContractOutput',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'command', 'source', 'contract'],
    properties: {
      schemaVersion: { const: '1.0' },
      command: { const: 'ai-contract' },
      source: { enum: ['file', 'generated'] },
      contract: {
        type: 'object',
        additionalProperties: false,
        required: [
          'schemaVersion',
          'kind',
          'ai_runtime',
          'workflow',
          'intelligence_sources',
          'queries',
          'remediation',
          'rules',
          'memory'
        ],
        properties: {
          schemaVersion: { const: '1.0' },
          kind: { const: 'playbook-ai-contract' },
          ai_runtime: { const: 'playbook-agent' },
          workflow: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
          intelligence_sources: {
            type: 'object',
            additionalProperties: false,
            required: ['repoIndex', 'moduleOwners'],
            properties: {
              repoIndex: { const: '.playbook/repo-index.json' },
              moduleOwners: { const: '.playbook/module-owners.json' }
            }
          },
          queries: { type: 'array', items: { type: 'string' }, minItems: 7, maxItems: 7 },
          remediation: {
            type: 'object',
            additionalProperties: false,
            required: ['canonicalFlow', 'diagnosticAugmentation'],
            properties: {
              canonicalFlow: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
              diagnosticAugmentation: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 1 }
            }
          },
          rules: {
            type: 'object',
            additionalProperties: false,
            required: [
              'requireIndexBeforeQuery',
              'preferPlaybookCommandsOverAdHocInspection',
              'allowDirectEditsWithoutPlan'
            ],
            properties: {
              requireIndexBeforeQuery: { type: 'boolean' },
              preferPlaybookCommandsOverAdHocInspection: { type: 'boolean' },
              allowDirectEditsWithoutPlan: { type: 'boolean' }
            }
          },
          memory: {
            type: 'object',
            additionalProperties: false,
            required: ['artifactLocations', 'promotedKnowledgePolicy', 'retrieval'],
            properties: {
              artifactLocations: {
                type: 'object',
                additionalProperties: false,
                required: ['events', 'candidates', 'policyEvaluation', 'policyApplyResult', 'promotedKnowledge'],
                properties: {
                  events: { const: '.playbook/memory/events' },
                  candidates: { const: '.playbook/memory/candidates.json' },
                  policyEvaluation: { const: '.playbook/policy-evaluation.json' },
                  policyApplyResult: { const: '.playbook/policy-apply-result.json' },
                  promotedKnowledge: {
                    type: 'array',
                    prefixItems: [
                      { const: '.playbook/memory/knowledge/decisions.json' },
                      { const: '.playbook/memory/knowledge/patterns.json' },
                      { const: '.playbook/memory/knowledge/failure-modes.json' },
                      { const: '.playbook/memory/knowledge/invariants.json' }
                    ],
                    items: false,
                    minItems: 4,
                    maxItems: 4
                  }
                }
              },
              promotedKnowledgePolicy: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'preferPromotedKnowledgeForRetrieval',
                  'candidatesAreAdvisoryOnlyUntilReviewedPromotion',
                  'reviewedPromotionRequired',
                  'noHiddenMutation'
                ],
                properties: {
                  preferPromotedKnowledgeForRetrieval: { const: true },
                  candidatesAreAdvisoryOnlyUntilReviewedPromotion: { const: true },
                  reviewedPromotionRequired: { const: true },
                  noHiddenMutation: { const: true }
                }
              },
              retrieval: {
                type: 'object',
                additionalProperties: false,
                required: ['requireProvenance', 'provenanceFields'],
                properties: {
                  requireProvenance: { const: true },
                  provenanceFields: {
                    type: 'array',
                    prefixItems: [
                      { const: 'knowledgeId' },
                      { const: 'eventId' },
                      { const: 'sourcePath' },
                      { const: 'fingerprint' }
                    ],
                    items: false,
                    minItems: 4,
                    maxItems: 4
                  }
                }
              }
            }
          },
          ownership: {
            type: 'object',
            additionalProperties: false,
            required: ['ruleOwnersQuery', 'moduleOwnersQuery'],
            properties: {
              ruleOwnersQuery: { type: 'string' },
              moduleOwnersQuery: { type: 'string' }
            }
          }
        }
      }
    }
  },


  'analyze-pr': {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookAnalyzePrOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'analyze-pr' },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: [
          'schemaVersion',
          'command',
          'baseRef',
          'changedFiles',
          'summary',
          'affectedModules',
          'impact',
          'architecture',
          'risk',
          'docs',
          'rules',
          'moduleOwners',
          'findings',
          'reviewGuidance',
          'context'
        ],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'analyze-pr' },
          baseRef: { type: 'string' },
          changedFiles: { type: 'array', items: { type: 'string' } },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: ['changedFileCount', 'affectedModuleCount', 'riskLevel'],
            properties: {
              changedFileCount: { type: 'integer' },
              affectedModuleCount: { type: 'integer' },
              riskLevel: { enum: ['low', 'medium', 'high'] }
            }
          },
          affectedModules: { type: 'array', items: { type: 'string' } },
          impact: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['module', 'dependencies', 'directDependents', 'dependents'],
              properties: {
                module: { type: 'string' },
                dependencies: { type: 'array', items: { type: 'string' } },
                directDependents: { type: 'array', items: { type: 'string' } },
                dependents: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          architecture: {
            type: 'object',
            additionalProperties: false,
            required: ['boundariesTouched'],
            properties: {
              boundariesTouched: { type: 'array', items: { type: 'string' } }
            }
          },
          risk: {
            type: 'object',
            additionalProperties: false,
            required: ['level', 'signals', 'moduleRisk'],
            properties: {
              level: { enum: ['low', 'medium', 'high'] },
              signals: { type: 'array', items: { type: 'string' } },
              moduleRisk: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['module', 'level', 'score', 'signals'],
                  properties: {
                    module: { type: 'string' },
                    level: { enum: ['low', 'medium', 'high'] },
                    score: { type: 'number' },
                    signals: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          docs: {
            type: 'object',
            additionalProperties: false,
            required: ['changed', 'recommendedReview'],
            properties: {
              changed: { type: 'array', items: { type: 'string' } },
              recommendedReview: { type: 'array', items: { type: 'string' } }
            }
          },
          rules: {
            type: 'object',
            additionalProperties: false,
            required: ['related', 'owners'],
            properties: {
              related: { type: 'array', items: { type: 'string' } },
              owners: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['ruleId', 'area', 'owners', 'remediationType'],
                  properties: {
                    ruleId: { type: 'string' },
                    area: { type: 'string' },
                    owners: { type: 'array', items: { type: 'string' } },
                    remediationType: { type: 'string' }
                  }
                }
              }
            }
          },
          moduleOwners: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['module', 'owners', 'area'],
              properties: {
                module: { type: 'string' },
                owners: { type: 'array', items: { type: 'string' } },
                area: { type: 'string' }
              }
            }
          },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['ruleId', 'severity', 'message'],
              properties: {
                ruleId: { type: 'string' },
                severity: { enum: ['info', 'warning', 'error'] },
                message: { type: 'string' },
                recommendation: { type: 'string' },
                file: { type: 'string' },
                line: { type: 'integer' }
              }
            }
          },
          reviewGuidance: { type: 'array', items: { type: 'string' } },
          context: {
            type: 'object',
            additionalProperties: false,
            required: ['sources'],
            properties: {
              sources: { type: 'array', items: { type: 'object', minProperties: 1, additionalProperties: true } }
            }
          }
        }
      }
    ]
  },


  doctor: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookDoctorOutput',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'command', 'status', 'summary', 'findings', 'artifactHygiene', 'memoryDiagnostics'],
    properties: {
      schemaVersion: { const: '1.0' },
      command: { const: 'doctor' },
      status: { enum: ['ok', 'warning', 'error'] },
      summary: {
        type: 'object',
        additionalProperties: false,
        required: ['errors', 'warnings', 'info'],
        properties: {
          errors: { type: 'integer' },
          warnings: { type: 'integer' },
          info: { type: 'integer' }
        }
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'severity', 'id', 'message'],
          properties: {
            category: { enum: ['Architecture', 'Docs', 'Testing', 'Risk', 'Memory'] },
            severity: { enum: ['error', 'warning', 'info'] },
            id: { type: 'string' },
            message: { type: 'string' }
          }
        }
      },
      artifactHygiene: {
        type: 'object',
        additionalProperties: false,
        required: ['classification', 'findings', 'suggestions'],
        properties: {
          classification: {
            type: 'object',
            additionalProperties: false,
            required: ['runtime', 'automation', 'contract'],
            properties: {
              runtime: { type: 'array', items: { type: 'string' } },
              automation: { type: 'array', items: { type: 'string' } },
              contract: { type: 'array', items: { type: 'string' } }
            }
          },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'message', 'recommendation'],
              properties: {
                type: {
                  enum: ['runtime-artifact-committed', 'large-generated-json', 'frequently-modified-generated-artifact', 'missing-playbookignore']
                },
                path: { type: 'string' },
                message: { type: 'string' },
                recommendation: { type: 'string' }
              }
            }
          },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'title'],
              properties: {
                id: { enum: ['PB012', 'PB013', 'PB014'] },
                title: { type: 'string' },
                entries: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      memoryDiagnostics: {
        type: 'object',
        additionalProperties: false,
        required: ['findings', 'suggestions'],
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'severity', 'message', 'recommendation'],
              properties: {
                code: {
                  enum: [
                    'memory-artifacts-absent',
                    'memory-artifacts-missing',
                    'memory-artifacts-malformed',
                    'candidate-hoarding-risk',
                    'superseded-knowledge-lingering',
                    'replay-output-inconsistent',
                    'promoted-knowledge-provenance-gap',
                    'memory-lifecycle-healthy'
                  ]
                },
                severity: { enum: ['info', 'warning'] },
                message: { type: 'string' },
                recommendation: { type: 'string' }
              }
            }
          },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'title', 'actions'],
              properties: {
                id: { enum: ['PB015', 'PB016', 'PB017', 'PB018'] },
                title: { type: 'string' },
                actions: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }

    }
  },

  docs: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookDocsOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'ok', 'status', 'summary', 'findings'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'docs audit' },
          ok: { type: 'boolean' },
          status: { enum: ['pass', 'warn', 'fail'] },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: ['errors', 'warnings', 'checksRun'],
            properties: {
              errors: { type: 'integer' },
              warnings: { type: 'integer' },
              checksRun: { type: 'integer' }
            }
          },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['ruleId', 'level', 'message', 'path'],
              properties: {
                ruleId: { type: 'string' },
                level: { enum: ['error', 'warning'] },
                message: { type: 'string' },
                path: { type: 'string' },
                suggestedDestination: { type: 'string' },
                recommendation: { enum: ['historical keep', 'merge into workflow', 'archive', 'delete after migration'] }
              }
            }
          }
        }
      },

      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'ok', 'artifactPath', 'artifact'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'docs consolidate-plan' },
          ok: { type: 'boolean' },
          artifactPath: { const: '.playbook/docs-consolidation-plan.json' },
          artifact: {
            type: 'object',
            additionalProperties: false,
            required: ['schemaVersion', 'kind', 'command', 'source', 'tasks', 'excluded', 'summary'],
            properties: {
              schemaVersion: { const: '1.0' },
              kind: { const: 'docs-consolidation-plan' },
              command: { const: 'docs-consolidate-plan' },
              source: {
                type: 'object',
                additionalProperties: false,
                required: ['path', 'command'],
                properties: {
                  path: { const: '.playbook/docs-consolidation.json' },
                  command: { const: 'docs consolidate' }
                }
              },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                  required: ['id', 'ruleId', 'file', 'action', 'autoFix', 'task_kind', 'write', 'provenance'],
                  properties: {
                    id: { type: 'string' },
                    ruleId: { const: 'docs-consolidation.managed-write' },
                    file: { type: 'string' },
                    action: { type: 'string' },
                    autoFix: { const: true },
                    task_kind: { const: 'docs-managed-write' },
                    write: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['operation', 'blockId', 'startMarker', 'endMarker', 'content'],
                      properties: {
                        operation: { enum: ['replace-managed-block', 'append-managed-block', 'insert-under-anchor'] },
                        blockId: { type: 'string' },
                        startMarker: { type: 'string' },
                        endMarker: { type: 'string' },
                        anchor: { type: 'string' },
                        content: { type: 'string' }
                      }
                    },
                    provenance: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['source_artifact_path', 'fragment_ids', 'lane_ids', 'target_doc', 'section_keys'],
                      properties: {
                        source_artifact_path: { const: '.playbook/docs-consolidation.json' },
                        fragment_ids: { type: 'array', items: { type: 'string' } },
                        lane_ids: { type: 'array', items: { type: 'string' } },
                        target_doc: { type: 'string' },
                        section_keys: { type: 'array', items: { type: 'string' } }
                      }
                    }
                  }
                }
              },
              excluded: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['exclusion_id', 'target_doc', 'section_keys', 'fragment_ids', 'lane_ids', 'reason', 'message'],
                  properties: {
                    exclusion_id: { type: 'string' },
                    target_doc: { type: 'string' },
                    section_keys: { type: 'array', items: { type: 'string' } },
                    fragment_ids: { type: 'array', items: { type: 'string' } },
                    lane_ids: { type: 'array', items: { type: 'string' } },
                    reason: { enum: ['issue-blocked', 'missing-write-seam', 'missing-target-file', 'missing-anchor', 'invalid-fragment-content', 'mixed-write-strategies', 'mixed-block-markers', 'mixed-anchor-values'] },
                    message: { type: 'string' }
                  }
                }
              },
              summary: {
                type: 'object',
                additionalProperties: false,
                required: ['total_targets', 'executable_targets', 'excluded_targets', 'auto_fix_tasks'],
                properties: {
                  total_targets: { type: 'integer' },
                  executable_targets: { type: 'integer' },
                  excluded_targets: { type: 'integer' },
                  auto_fix_tasks: { type: 'integer' }
                }
              }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'ok', 'artifactPath', 'artifact'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'docs consolidate' },
          ok: { type: 'boolean' },
          artifactPath: { const: '.playbook/docs-consolidation.json' },
          artifact: {
            type: 'object',
            additionalProperties: false,
            required: ['schemaVersion', 'command', 'mode', 'artifactPath', 'protectedSurfaceRegistry', 'summary', 'fragments', 'consolidatedTargets', 'issues', 'brief'],
            properties: {
              schemaVersion: { const: '1.0' },
              command: { const: 'docs consolidate' },
              mode: { const: 'proposal-only' },
              artifactPath: { const: '.playbook/docs-consolidation.json' },
              protectedSurfaceRegistry: {
                type: 'object',
                additionalProperties: false,
                required: ['source', 'targets'],
                properties: {
                  source: { type: 'string' },
                  targets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['targetDoc', 'consolidationStrategy', 'rationale'],
                      properties: {
                        targetDoc: { type: 'string' },
                        consolidationStrategy: { type: 'string' },
                        rationale: { type: 'string' }
                      }
                    }
                  }
                }
              },
              summary: {
                type: 'object',
                additionalProperties: false,
                required: ['protectedTargetCount', 'fragmentCount', 'consolidatedTargetCount', 'issueCount', 'duplicateCount', 'conflictCount'],
                properties: {
                  protectedTargetCount: { type: 'integer' },
                  fragmentCount: { type: 'integer' },
                  consolidatedTargetCount: { type: 'integer' },
                  issueCount: { type: 'integer' },
                  duplicateCount: { type: 'integer' },
                  conflictCount: { type: 'integer' }
                }
              },
              fragments: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                  required: ['fragment_id', 'lane_id', 'target_doc', 'section_key', 'conflict_key', 'ordering_key', 'summary', 'content']
                }
              },
              consolidatedTargets: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['targetDoc', 'fragmentCount', 'fragmentIds', 'laneIds', 'sectionKeys', 'summaries'],
                  properties: {
                    targetDoc: { type: 'string' },
                    fragmentCount: { type: 'integer' },
                    fragmentIds: { type: 'array', items: { type: 'string' } },
                    laneIds: { type: 'array', items: { type: 'string' } },
                    sectionKeys: { type: 'array', items: { type: 'string' } },
                    summaries: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              issues: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['issueKey', 'type', 'targetDoc', 'sectionKey', 'conflictKey', 'fragmentIds', 'laneIds', 'message'],
                  properties: {
                    issueKey: { type: 'string' },
                    type: { enum: ['duplicate', 'conflict'] },
                    targetDoc: { type: 'string' },
                    sectionKey: { type: 'string' },
                    conflictKey: { type: 'string' },
                    fragmentIds: { type: 'array', items: { type: 'string' } },
                    laneIds: { type: 'array', items: { type: 'string' } },
                    message: { type: 'string' }
                  }
                }
              },
              brief: { type: 'string' }
            }
          }
        }
      }
    ]
  },

  contracts: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookContractsOutput',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'command', 'cliSchemas', 'artifacts', 'roadmap'],
    properties: {
      schemaVersion: { const: '1.0' },
      command: { const: 'contracts' },
      cliSchemas: {
        type: 'object',
        additionalProperties: false,
        required: ['draft', 'schemaCommand', 'commands'],
        properties: {
          draft: { const: '2020-12' },
          schemaCommand: { const: 'playbook schema --json' },
          commands: { type: 'array', minItems: 5, items: { type: 'string' } }
        }
      },
      artifacts: {
        type: 'object',
        additionalProperties: false,
        required: ['runtimeDefaults', 'contracts'],
        properties: {
          runtimeDefaults: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['path', 'producer'],
              properties: {
                path: { type: 'string' },
                producer: { type: 'string' }
              }
            }
          },
          contracts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['path', 'availability'],
              properties: {
                path: { type: 'string' },
                availability: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: ['available'],
                      properties: {
                        available: { const: true }
                      }
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: ['available', 'reason'],
                      properties: {
                        available: { const: false },
                        reason: { enum: ['missing', 'not_applicable', 'parse_error', 'not_initialized'] }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      roadmap: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'availability', 'schemaVersion', 'trackedFeatures'],
        properties: {
          path: { const: 'docs/roadmap/ROADMAP.json' },
          availability: {
            oneOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['available'],
                properties: {
                  available: { const: true }
                }
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['available', 'reason'],
                properties: {
                  available: { const: false },
                  reason: { enum: ['missing', 'not_applicable', 'parse_error', 'not_initialized'] }
                }
              }
            ]
          },
          schemaVersion: { type: ['string', 'null'] },
          trackedFeatures: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['featureId', 'status'],
              properties: {
                featureId: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  ignore: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookIgnoreOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: [
          'schemaVersion',
          'command',
          'recommendationSource',
          'recommendations',
          'safe_defaults',
          'review_required',
          'summary'
        ],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'ignore suggest' },
          repoRoot: { type: 'string' },
          recommendationSource: { type: 'string' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'path',
                'rank',
                'class',
                'rationale',
                'confidence',
                'expected_scan_impact',
                'safety_level',
                'already_covered',
                'eligible_for_safe_apply'
              ],
              properties: {
                path: { type: 'string' },
                rank: { type: 'integer' },
                class: { type: 'string' },
                rationale: { type: 'string' },
                confidence: { type: 'number' },
                expected_scan_impact: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['estimated_files_reduced', 'estimated_bytes_reduced', 'impact_level'],
                  properties: {
                    estimated_files_reduced: { type: 'integer' },
                    estimated_bytes_reduced: { type: 'integer' },
                    impact_level: { enum: ['low', 'medium', 'high'] }
                  }
                },
                safety_level: { enum: ['safe-default', 'likely-safe', 'review-first'] },
                already_covered: { type: 'boolean' },
                eligible_for_safe_apply: { type: 'boolean' }
              }
            }
          },
          safe_defaults: { type: 'array', items: { type: 'object', additionalProperties: true } },
          review_required: { type: 'array', items: { type: 'object', additionalProperties: true } },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: ['total_recommendations', 'safe_default_count', 'review_required_count', 'already_covered_count'],
            properties: {
              total_recommendations: { type: 'integer' },
              safe_default_count: { type: 'integer' },
              review_required_count: { type: 'integer' },
              already_covered_count: { type: 'integer' }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: [
          'schemaVersion',
          'command',
          'recommendationSource',
          'targetFile',
          'changed',
          'created',
          'applied_entries',
          'retained_entries',
          'already_covered_entries',
          'deferred_entries',
          'removed_entries',
          'summary'
        ],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'ignore apply' },
          repoRoot: { type: 'string' },
          recommendationSource: { type: 'string' },
          targetFile: { const: '.playbookignore' },
          changed: { type: 'boolean' },
          created: { type: 'boolean' },
          applied_entries: { type: 'array', items: { type: 'string' } },
          retained_entries: { type: 'array', items: { type: 'string' } },
          already_covered_entries: { type: 'array', items: { type: 'string' } },
          deferred_entries: { type: 'array', items: { type: 'string' } },
          removed_entries: { type: 'array', items: { type: 'string' } },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: ['applied_count', 'retained_count', 'already_covered_count', 'deferred_count', 'removed_count'],
            properties: {
              applied_count: { type: 'integer' },
              retained_count: { type: 'integer' },
              already_covered_count: { type: 'integer' },
              deferred_count: { type: 'integer' },
              removed_count: { type: 'integer' }
            }
          }
        }
      }
    ]
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
        required: ['schemaVersion', 'command', 'type', 'modules', 'summary'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { const: 'docs-coverage' },
          modules: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['module', 'documented', 'sources'],
              properties: {
                module: { type: 'string' },
                documented: { type: 'boolean' },
                sources: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: ['totalModules', 'documentedModules', 'undocumentedModules'],
            properties: {
              totalModules: { type: 'integer', minimum: 0 },
              documentedModules: { type: 'integer', minimum: 0 },
              undocumentedModules: { type: 'integer', minimum: 0 }
            }
          }
        }
      },

      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'rules'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { const: 'rule-owners' },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['ruleId', 'area', 'owners', 'remediationType'],
              properties: {
                ruleId: { type: 'string' },
                area: { type: 'string' },
                owners: { type: 'array', items: { type: 'string' } },
                remediationType: { type: 'string' }
              }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'rule'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { const: 'rule-owners' },
          rule: {
            type: 'object',
            additionalProperties: false,
            required: ['ruleId', 'area', 'owners', 'remediationType'],
            properties: {
              ruleId: { type: 'string' },
              area: { type: 'string' },
              owners: { type: 'array', items: { type: 'string' } },
              remediationType: { type: 'string' }
            }
          }
        }
      },

      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'modules'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { const: 'module-owners' },
          modules: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'owners', 'area'],
              properties: {
                name: { type: 'string' },
                owners: { type: 'array', items: { type: 'string' } },
                area: { type: 'string' }
              }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'module'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { const: 'module-owners' },
          module: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'owners', 'area'],
            properties: {
              name: { type: 'string' },
              owners: { type: 'array', items: { type: 'string' } },
              area: { type: 'string' }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'ruleId', 'error'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { const: 'rule-owners' },
          ruleId: { type: ['string', 'null'] },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'type', 'module', 'error'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'query' },
          type: { enum: ['dependencies', 'impact', 'risk', 'docs-coverage', 'module-owners'] },
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


  knowledge: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookKnowledgeOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { enum: ['knowledge-list', 'knowledge-query', 'knowledge-inspect', 'knowledge-compare', 'knowledge-timeline', 'knowledge-provenance', 'knowledge-supersession', 'knowledge-stale'] },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'filters', 'summary', 'knowledge'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { enum: ['knowledge-list', 'knowledge-query', 'knowledge-timeline', 'knowledge-stale'] },
          filters: knowledgeFiltersSchema,
          summary: knowledgeSummarySchema,
          knowledge: {
            type: 'array',
            items: knowledgeRecordSchema
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'leftId', 'rightId', 'comparison'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'knowledge-compare' },
          leftId: { type: 'string' },
          rightId: { type: 'string' },
          comparison: {
            type: 'object',
            additionalProperties: false,
            required: ['left', 'right', 'common'],
            properties: {
              left: knowledgeRecordSchema,
              right: knowledgeRecordSchema,
              common: {
                type: 'object',
                additionalProperties: false,
                required: ['evidenceIds', 'fingerprints', 'relatedRecordIds'],
                properties: {
                  evidenceIds: { type: 'array', items: { type: 'string' } },
                  fingerprints: { type: 'array', items: { type: 'string' } },
                  relatedRecordIds: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'id', 'knowledge'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'knowledge-inspect' },
          id: { type: 'string' },
          knowledge: knowledgeRecordSchema
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'id', 'provenance'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'knowledge-provenance' },
          id: { type: 'string' },
          provenance: {
            type: 'object',
            additionalProperties: false,
            required: ['record', 'evidence', 'relatedRecords'],
            properties: {
              record: knowledgeRecordSchema,
              evidence: { type: 'array', items: knowledgeRecordSchema },
              relatedRecords: { type: 'array', items: knowledgeRecordSchema }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'id', 'supersession'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'knowledge-supersession' },
          id: { type: 'string' },
          supersession: {
            type: 'object',
            additionalProperties: false,
            required: ['record', 'supersedes', 'supersededBy'],
            properties: {
              record: knowledgeRecordSchema,
              supersedes: { type: 'array', items: knowledgeRecordSchema },
              supersededBy: { type: 'array', items: knowledgeRecordSchema }
            }
          }
        }
      }
    ]
  },


  learn: {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookLearnDraftOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { enum: ['learn-draft', 'learn-doctrine', 'learn'] },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'baseRef', 'baseSha', 'headSha', 'diffContext', 'changedFiles', 'candidates'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'learn-draft' },
          baseRef: { type: 'string' },
          baseSha: { type: 'string' },
          headSha: { type: 'string' },
          diffContext: { type: 'boolean' },
          changedFiles: { type: 'array', items: { type: 'string' } },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['candidateId', 'theme', 'evidence', 'dedupe'],
              properties: {
                candidateId: { type: 'string' },
                theme: { type: 'string' },
                evidence: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['path'],
                    properties: {
                      path: { type: 'string' }
                    }
                  }
                },
                dedupe: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['kind'],
                  properties: {
                    kind: { const: 'none' },
                    hint: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'mode', 'source', 'conciseChangeSummary', 'learned', 'suggestedNotesUpdate', 'candidateFutureChecks'],
        properties: {
          schemaVersion: { const: '1.0' },
          command: { const: 'learn-doctrine' },
          mode: { const: 'report-only' },
          source: {
            type: 'object',
            additionalProperties: false,
            required: ['changedFiles'],
            properties: {
              inputPath: { type: 'string' },
              title: { type: 'string' },
              changedFiles: { type: 'array', items: { type: 'string' } }
            }
          },
          conciseChangeSummary: { type: 'array', items: { type: 'string' } },
          learned: {
            type: 'object',
            additionalProperties: false,
            required: ['rules', 'patterns', 'failureModes'],
            properties: {
              rules: { '$ref': '#/$defs/doctrineEntries' },
              patterns: { '$ref': '#/$defs/doctrineEntries' },
              failureModes: { '$ref': '#/$defs/doctrineEntries' }
            }
          },
          suggestedNotesUpdate: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['target', 'summary', 'rationale'],
              properties: {
                target: { enum: ['notes', 'patterns-docs', 'changelog', 'verification'] },
                summary: { type: 'string' },
                rationale: { type: 'string' }
              }
            }
          },
          candidateFutureChecks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'summary', 'scope'],
              properties: {
                name: { type: 'string' },
                summary: { type: 'string' },
                scope: { enum: ['docs', 'artifacts', 'command-contract', 'architecture'] }
              }
            }
          }
        }
      }
    ],
    $defs: {
      doctrineEntries: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'title', 'statement', 'rationale', 'confidence', 'sourceSignals'],
          properties: {
            kind: { enum: ['rule', 'pattern', 'failure-mode'] },
            title: { type: 'string' },
            statement: { type: 'string' },
            rationale: { type: 'string' },
            confidence: { enum: ['high', 'medium'] },
            sourceSignals: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
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
      'controlPlaneArtifacts',
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
      controlPlaneArtifacts: {
        type: 'object',
        additionalProperties: false,
        required: ['policyEvaluation', 'policyApplyResult', 'session', 'cycleState', 'cycleHistory', 'improvementCandidates', 'prReview'],
        properties: {
          policyEvaluation: { const: '.playbook/policy-evaluation.json' },
          policyApplyResult: { const: '.playbook/policy-apply-result.json' },
          session: { const: '.playbook/session.json' },
          cycleState: { const: '.playbook/cycle-state.json' },
          cycleHistory: { const: '.playbook/cycle-history.json' },
          improvementCandidates: { const: '.playbook/improvement-candidates.json' },
          prReview: { const: '.playbook/pr-review.json' }
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
            minItems: 10,
            maxItems: 10
          },
          recommendedBootstrap: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 3
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
        required: [
          'preferPlaybookCommands',
          'authorityRule',
          'localExecutionRule',
          'failureMode',
          'memoryCommandFamily',
          'promotedKnowledgeGuidance',
          'candidateKnowledgeGuidance'
        ],
        properties: {
          preferPlaybookCommands: { const: true },
          authorityRule: { type: 'string' },
          localExecutionRule: { type: 'string' },
          failureMode: { type: 'string' },
          memoryCommandFamily: {
            type: 'object',
            additionalProperties: false,
            required: ['available', 'preferredCommands'],
            properties: {
              available: { type: 'boolean' },
              preferredCommands: {
                type: 'array',
                prefixItems: [
                  { const: 'memory events --json' },
                  { const: 'memory knowledge --json' },
                  { const: 'memory candidates --json' }
                ],
                items: false,
                minItems: 3,
                maxItems: 3
              }
            }
          },
          promotedKnowledgeGuidance: { type: 'string' },
          candidateKnowledgeGuidance: { type: 'string' }
        }
      }
    }
  },

  'test-fix-plan': {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookTestFixPlanOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { type: 'string' },
          command: { const: 'test-fix-plan' },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'kind', 'command', 'generatedAt', 'source', 'tasks', 'excluded', 'summary'],
        properties: {
          schemaVersion: { const: '1.0' },
          kind: { const: 'test-fix-plan' },
          command: { const: 'test-fix-plan' },
          generatedAt: { type: 'string' },
          source: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'command', 'generatedAt', 'path', 'input'],
            properties: {
              kind: { const: 'test-triage' },
              command: { const: 'test-triage' },
              generatedAt: { type: 'string' },
              path: { type: ['string', 'null'] },
              input: { enum: ['file', 'stdin'] }
            }
          },
          tasks: { type: 'array', items: { type: 'object', additionalProperties: true } },
          excluded: { type: 'array', items: { type: 'object', additionalProperties: true } },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: ['total_findings', 'eligible_findings', 'excluded_findings', 'auto_fix_tasks'],
            properties: {
              total_findings: { type: 'integer' },
              eligible_findings: { type: 'integer' },
              excluded_findings: { type: 'integer' },
              auto_fix_tasks: { type: 'integer' }
            }
          }
        }
      }
    ]
  },
  'remediation-status': {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookRemediationStatusOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { type: 'string' },
          command: { const: 'remediation-status' },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'kind', 'command', 'generatedAt', 'source', 'latest_run', 'blocked_signatures', 'review_required_signatures', 'safe_to_retry_signatures', 'stable_failure_signatures', 'repeat_policy_decisions', 'preferred_repair_classes', 'recent_final_statuses', 'telemetry', 'remediation_history', 'latest_result'],
        properties: {
          schemaVersion: { const: '1.0' },
          kind: { const: 'remediation-status' },
          command: { const: 'remediation-status' },
          generatedAt: { type: 'string' },
          source: { type: 'object', additionalProperties: false, required: ['latest_result_path', 'remediation_history_path'], properties: { latest_result_path: { type: 'string' }, remediation_history_path: { type: 'string' } } },
          latest_run: { type: 'object', additionalProperties: true },
          blocked_signatures: { type: 'array', items: { type: 'string' } },
          review_required_signatures: { type: 'array', items: { type: 'string' } },
          safe_to_retry_signatures: { type: 'array', items: { type: 'string' } },
          stable_failure_signatures: { type: 'array', items: { type: 'object', additionalProperties: true } },
          repeat_policy_decisions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          preferred_repair_classes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          recent_final_statuses: { type: 'array', items: { type: 'object', additionalProperties: true } },
          telemetry: {
            type: 'object',
            additionalProperties: true,
            required: ['confidence_buckets', 'failure_classes', 'blocked_low_confidence_runs', 'top_repeated_blocked_signatures', 'dry_run_runs', 'apply_runs', 'dry_run_to_apply_ratio', 'repeat_policy_block_counts', 'conservative_confidence_signal', 'failure_class_rollup', 'repair_class_rollup', 'blocked_signature_rollup', 'threshold_counterfactuals', 'dry_run_vs_apply_delta', 'manual_review_pressure'],
            properties: {
              confidence_buckets: { type: 'array', items: { type: 'object', additionalProperties: true } },
              failure_classes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              blocked_low_confidence_runs: { type: 'integer' },
              top_repeated_blocked_signatures: { type: 'array', items: { type: 'object', additionalProperties: true } },
              dry_run_runs: { type: 'integer' },
              apply_runs: { type: 'integer' },
              dry_run_to_apply_ratio: { type: 'string' },
              repeat_policy_block_counts: { type: 'array', items: { type: 'object', additionalProperties: true } },
              conservative_confidence_signal: { type: 'object', additionalProperties: true },
              failure_class_rollup: { type: 'array', items: { type: 'object', additionalProperties: true } },
              repair_class_rollup: { type: 'array', items: { type: 'object', additionalProperties: true } },
              blocked_signature_rollup: { type: 'array', items: { type: 'object', additionalProperties: true } },
              threshold_counterfactuals: { type: 'array', items: { type: 'object', additionalProperties: true } },
              dry_run_vs_apply_delta: { type: 'object', additionalProperties: true },
              manual_review_pressure: { type: 'object', additionalProperties: true }
            }
          },
          remediation_history: { type: 'array', items: { type: 'object', additionalProperties: true } },
          latest_result: { type: 'object', additionalProperties: true }
        }
      }
    ]
  },
  'test-autofix': {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookTestAutofixOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { type: 'string' },
          command: { const: 'test-autofix' },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'kind', 'command', 'generatedAt', 'input', 'source_triage', 'source_fix_plan', 'source_apply', 'remediation_history_path', 'mode', 'would_apply', 'confidence_threshold', 'apply_result', 'verification_result', 'executed_verification_commands', 'applied_task_ids', 'excluded_finding_summary', 'final_status', 'reason', 'failure_signatures', 'history_summary', 'preferred_repair_class', 'autofix_confidence', 'confidence_reasoning', 'retry_policy_decision', 'retry_policy_reason'],
        properties: {
          schemaVersion: { const: '1.0' },
          kind: { const: 'test-autofix' },
          command: { const: 'test-autofix' },
          generatedAt: { type: 'string' },
          input: { type: 'string' },
          source_triage: { type: 'object', additionalProperties: false, required: ['path', 'command'], properties: { path: { type: ['string', 'null'] }, command: { const: 'test-triage' } } },
          source_fix_plan: { type: 'object', additionalProperties: false, required: ['path', 'command'], properties: { path: { type: ['string', 'null'] }, command: { const: 'test-fix-plan' } } },
          source_apply: { type: 'object', additionalProperties: false, required: ['path', 'command'], properties: { path: { type: ['string', 'null'] }, command: { const: 'apply' } } },
          remediation_history_path: { type: 'string' },
          mode: { enum: ['dry_run', 'apply'] },
          would_apply: { type: 'boolean' },
          confidence_threshold: { type: 'number' },
          failure_signatures: { type: 'array', items: { type: 'string' } },
          history_summary: { type: 'object', additionalProperties: false, required: ['matched_signatures', 'matching_run_ids', 'prior_final_statuses', 'prior_applied_repair_classes', 'prior_successful_repair_classes', 'repeated_failed_repair_attempts', 'provenance_run_ids'], properties: { matched_signatures: { type: 'array', items: { type: 'string' } }, matching_run_ids: { type: 'array', items: { type: 'string' } }, prior_final_statuses: { type: 'array', items: { type: 'string' } }, prior_applied_repair_classes: { type: 'array', items: { type: 'string' } }, prior_successful_repair_classes: { type: 'array', items: { type: 'string' } }, repeated_failed_repair_attempts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['failure_signature', 'repair_class', 'count', 'run_ids'], properties: { failure_signature: { type: 'string' }, repair_class: { type: 'string' }, count: { type: 'integer' }, run_ids: { type: 'array', items: { type: 'string' } } } } }, provenance_run_ids: { type: 'array', items: { type: 'string' } } } },
          preferred_repair_class: { type: ['string', 'null'] },
          autofix_confidence: { type: 'number' },
          confidence_reasoning: { type: 'array', items: { type: 'string' } },
          retry_policy_decision: { enum: ['allow_repair', 'allow_with_preferred_repair_class', 'blocked_repeat_failure', 'review_required_repeat_failure', 'no_history'] },
          retry_policy_reason: { type: 'string' },
          apply_result: { type: 'object', additionalProperties: false, required: ['attempted', 'ok', 'exitCode', 'applied', 'skipped', 'unsupported', 'failed', 'message'], properties: { attempted: { type: 'boolean' }, ok: { type: 'boolean' }, exitCode: { type: 'integer' }, applied: { type: 'integer' }, skipped: { type: 'integer' }, unsupported: { type: 'integer' }, failed: { type: 'integer' }, message: { type: ['string', 'null'] } } },
          verification_result: { type: 'object', additionalProperties: false, required: ['attempted', 'ok', 'total', 'passed', 'failed'], properties: { attempted: { type: 'boolean' }, ok: { type: 'boolean' }, total: { type: 'integer' }, passed: { type: 'integer' }, failed: { type: 'integer' } } },
          executed_verification_commands: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['command', 'exitCode', 'ok'], properties: { command: { type: 'string' }, exitCode: { type: 'integer' }, ok: { type: 'boolean' } } } },
          applied_task_ids: { type: 'array', items: { type: 'string' } },
          excluded_finding_summary: { type: 'object', additionalProperties: false, required: ['total', 'review_required', 'by_reason'], properties: { total: { type: 'integer' }, review_required: { type: 'integer' }, by_reason: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['reason', 'count'], properties: { reason: { type: 'string' }, count: { type: 'integer' } } } } } },
          final_status: { enum: ['fixed', 'partially_fixed', 'not_fixed', 'blocked', 'blocked_low_confidence', 'review_required_only'] },
          reason: { type: 'string' }
        }
      }
    ]
  },
  'test-triage': {
    $schema: JSON_SCHEMA_DRAFT,
    title: 'PlaybookTestTriageOutput',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'command', 'error'],
        properties: {
          schemaVersion: { type: 'string' },
          command: { const: 'test-triage' },
          error: { type: 'string' }
        }
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'kind', 'command', 'generatedAt', 'source', 'findings', 'rerun_plan', 'repair_plan'],
        properties: {
          schemaVersion: { const: '1.0' },
          kind: { const: 'test-triage' },
          command: { const: 'test-triage' },
          generatedAt: { type: 'string' },
          source: {
            type: 'object',
            additionalProperties: false,
            required: ['input', 'path'],
            properties: {
              input: { enum: ['file', 'stdin'] },
              path: { type: ['string', 'null'] }
            }
          },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['failure_kind', 'confidence', 'package', 'test_file', 'test_name', 'likely_files_to_modify', 'suggested_fix_strategy', 'verification_commands', 'docs_update_recommendation', 'rule_pattern_failure_mode', 'repair_class', 'summary', 'evidence'],
              properties: {
                failure_kind: { enum: ['snapshot_drift', 'stale_assertion', 'fixture_drift', 'ordering_drift', 'missing_artifact', 'environment_limitation', 'likely_regression'] },
                confidence: { type: 'number' },
                package: { type: ['string', 'null'] },
                test_file: { type: ['string', 'null'] },
                test_name: { type: ['string', 'null'] },
                likely_files_to_modify: { type: 'array', items: { type: 'string' } },
                suggested_fix_strategy: { type: 'string' },
                verification_commands: { type: 'array', items: { type: 'string' } },
                docs_update_recommendation: { type: 'string' },
                rule_pattern_failure_mode: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['rule', 'pattern', 'failure_mode'],
                  properties: {
                    rule: { type: 'string' },
                    pattern: { type: 'string' },
                    failure_mode: { type: 'string' }
                  }
                },
                repair_class: { enum: ['autofix_plan_only', 'review_required'] },
                summary: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          rerun_plan: {
            type: 'object',
            additionalProperties: false,
            required: ['strategy', 'commands'],
            properties: {
              strategy: { const: 'file_first_then_package_then_workspace' },
              commands: { type: 'array', items: { type: 'string' } }
            }
          },
          repair_plan: {
            type: 'object',
            additionalProperties: false,
            required: ['summary', 'codex_prompt', 'suggested_actions'],
            properties: {
              summary: { type: 'string' },
              codex_prompt: { type: 'string' },
              suggested_actions: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    ]
  },

};

export const CLI_SCHEMA_COMMANDS: readonly CliSchemaCommand[] = Object.freeze(Object.keys(cliSchemas) as CliSchemaCommand[]);

export const getCliSchemas = (): Record<CliSchemaCommand, JsonSchema> => ({
  rules: cliSchemas.rules,
  explain: cliSchemas.explain,
  index: cliSchemas.index,
  graph: cliSchemas.graph,
  verify: cliSchemas.verify,
  plan: cliSchemas.plan,
  context: cliSchemas.context,
  'ai-context': cliSchemas['ai-context'],
  'ai-contract': cliSchemas['ai-contract'],
  doctor: cliSchemas.doctor,
  'analyze-pr': cliSchemas['analyze-pr'],
  knowledge: cliSchemas.knowledge,
  docs: cliSchemas.docs,
  contracts: cliSchemas.contracts,
  ignore: cliSchemas.ignore,
  learn: cliSchemas.learn,
  query: cliSchemas.query,
  'test-triage': cliSchemas['test-triage'],
  'test-fix-plan': cliSchemas['test-fix-plan'],
  'test-autofix': cliSchemas['test-autofix'],
  'remediation-status': cliSchemas['remediation-status']
});

export const getCliSchema = (command: CliSchemaCommand): JsonSchema => cliSchemas[command];

export const isCliSchemaCommand = (value: string): value is CliSchemaCommand =>
  (CLI_SCHEMA_COMMANDS as readonly string[]).includes(value);
