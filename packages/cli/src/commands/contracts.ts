import fs from 'node:fs';
import path from 'node:path';
import { buildContractRegistry } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type ContractsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  out?: string;
};

const DEFAULT_OUTPUT_PATH = '.playbook/contracts-registry.json';


type RegisteredSchema = {
  id: string;
  version: string;
  path: string;
};

const memoryArtifactSchemas: RegisteredSchema[] = [
  { id: 'repository-memory-event', version: '1.0', path: '.playbook/memory/events/*.json' },
  { id: 'repository-memory-index', version: '1.0', path: '.playbook/memory/index.json' },
  { id: 'memory-event', version: '1.0.0', path: '.playbook/memory/events/runtime/*.json' },
  { id: 'candidate-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/candidates/*.json' },
  { id: 'promoted-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/promoted/*.json' },
  { id: 'retired-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/promoted/*.json' },
  { id: 'memory-replay-result', version: '1.0', path: '.playbook/memory/replay/*.json' },
  { id: 'knowledge-candidate-output', version: '1.0', path: '.playbook/knowledge/candidates.json' }
];

const additiveCommandOutputSchemas: RegisteredSchema[] = [
  { id: 'query.memoryKnowledge', version: '1.0', path: 'schema://cli/query' },
  { id: 'knowledge', version: '1.0', path: 'packages/contracts/src/knowledge.schema.json' },
  { id: 'pattern-graph', version: '1.0', path: 'packages/contracts/src/pattern-graph.schema.json' },
  { id: 'cross-repo-candidates', version: '1.0', path: 'packages/contracts/src/cross-repo-candidates.schema.json' },
  { id: 'task-execution-profile', version: '1.0', path: 'packages/contracts/src/task-execution-profile.schema.json' },
  { id: 'execution-plan', version: '1.0', path: 'packages/contracts/src/execution-plan.schema.json' },
  { id: 'workset-plan', version: '1.0', path: 'packages/contracts/src/workset-plan.schema.json' },
  { id: 'outcome-telemetry', version: '1.0', path: 'packages/contracts/src/outcome-telemetry.schema.json' },
  { id: 'learning-state', version: '1.0', path: 'packages/contracts/src/learning-state.schema.json' },
  { id: 'improvement-candidates', version: '1.0', path: 'packages/contracts/src/improvement-candidates.schema.json' },
  { id: 'lane-state', version: '1.0', path: 'packages/contracts/src/lane-state.schema.json' },
  { id: 'worker-assignments', version: '1.0', path: 'packages/contracts/src/worker-assignments.schema.json' },
  { id: 'repository-events', version: '1.0', path: 'packages/contracts/src/repository-events.schema.json' },
  { id: 'cycle-state', version: '1.0', path: 'packages/contracts/src/cycle-state.schema.json' },
  { id: 'explain.memoryKnowledge', version: '1.0', path: 'schema://cli/explain' },
  { id: 'plan.tasks[].advisory.outcomeLearning', version: '1.0', path: 'schema://cli/plan' },
  { id: 'analyze-pr.preventionGuidance', version: '1.0', path: 'schema://cli/analyze-pr' },
  { id: 'analyze-pr.context.sources[].promoted-knowledge', version: '1.0', path: 'schema://cli/analyze-pr' }
];

const printText = (outPath: string): void => {
  console.log('Playbook Contracts Registry');
  console.log('');
  console.log(`Wrote contract registry: ${outPath}`);
  console.log('Use --json for machine-readable output.');
};

export const runContracts = async (cwd: string, options: ContractsOptions): Promise<number> => {
  const payload = {
    ...buildContractRegistry(cwd),
    schemas: {
      memoryArtifacts: [...memoryArtifactSchemas],
      commandOutputs: [...additiveCommandOutputSchemas]
    }
  };
  const outputPath = options.out ?? DEFAULT_OUTPUT_PATH;
  const absoluteOutputPath = path.resolve(cwd, outputPath);
  const outputJson = `${JSON.stringify(payload, null, 2)}\n`;
  const shouldWriteArtifact = options.out !== undefined || options.format !== 'json';

  if (shouldWriteArtifact) {
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, outputJson, 'utf8');
  }

  if (options.format === 'json') {
    console.log(outputJson.trimEnd());
    return ExitCode.Success;
  }

  if (!options.quiet) {
    if (shouldWriteArtifact) {
      printText(outputPath);
    } else {
      console.log('Playbook Contracts Registry');
      console.log('');
      console.log('Use --json --out <path> to write the contract registry artifact.');
    }
  }

  return ExitCode.Success;
};
