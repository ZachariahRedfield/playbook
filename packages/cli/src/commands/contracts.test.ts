import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runContracts } from './contracts.js';

describe('runContracts', () => {
  it('includes memory artifact and additive command output schema registrations', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runContracts(process.cwd(), { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const schemas = payload.schemas as Record<string, unknown>;
    expect(Array.isArray(schemas.memoryArtifacts)).toBe(true);
    expect(Array.isArray(schemas.commandOutputs)).toBe(true);
    expect((schemas.memoryArtifacts as Array<{ id: string; path: string }>).find((entry) => entry.id === 'repository-memory-event')?.path).toBe(
      '.playbook/memory/events/*.json'
    );
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('query.memoryKnowledge');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('knowledge');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('pattern-graph');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('cross-repo-candidates');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('task-execution-profile');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('execution-plan');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('outcome-telemetry');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('learning-state');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('lane-state');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('worker-assignments');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('repository-events');
  });

  it('keeps schema registration identifiers and paths stable', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runContracts(process.cwd(), { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const schemas = payload.schemas as Record<string, unknown>;
    expect(schemas).toEqual({
      memoryArtifacts: [
        { id: 'repository-memory-event', version: '1.0', path: '.playbook/memory/events/*.json' },
        { id: 'repository-memory-index', version: '1.0', path: '.playbook/memory/index.json' },
        { id: 'memory-event', version: '1.0.0', path: '.playbook/memory/events/runtime/*.json' },
        { id: 'candidate-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/candidates/*.json' },
        { id: 'promoted-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/promoted/*.json' },
        { id: 'retired-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/promoted/*.json' },
        { id: 'memory-replay-result', version: '1.0', path: '.playbook/memory/replay/*.json' },
        { id: 'knowledge-candidate-output', version: '1.0', path: '.playbook/knowledge/candidates.json' }
      ],
      commandOutputs: [
        { id: 'query.memoryKnowledge', version: '1.0', path: 'schema://cli/query' },
        { id: 'knowledge', version: '1.0', path: 'packages/contracts/src/knowledge.schema.json' },
        { id: 'pattern-graph', version: '1.0', path: 'packages/contracts/src/pattern-graph.schema.json' },
        { id: 'cross-repo-candidates', version: '1.0', path: 'packages/contracts/src/cross-repo-candidates.schema.json' },
        { id: 'task-execution-profile', version: '1.0', path: 'packages/contracts/src/task-execution-profile.schema.json' },
        { id: 'execution-plan', version: '1.0', path: 'packages/contracts/src/execution-plan.schema.json' },
  { id: 'workset-plan', version: '1.0', path: 'packages/contracts/src/workset-plan.schema.json' },
        { id: 'outcome-telemetry', version: '1.0', path: 'packages/contracts/src/outcome-telemetry.schema.json' },
        { id: 'learning-state', version: '1.0', path: 'packages/contracts/src/learning-state.schema.json' },
        { id: 'lane-state', version: '1.0', path: 'packages/contracts/src/lane-state.schema.json' },
        { id: 'worker-assignments', version: '1.0', path: 'packages/contracts/src/worker-assignments.schema.json' },
        { id: 'repository-events', version: '1.0', path: 'packages/contracts/src/repository-events.schema.json' },
        { id: 'explain.memoryKnowledge', version: '1.0', path: 'schema://cli/explain' },
        { id: 'plan.tasks[].advisory.outcomeLearning', version: '1.0', path: 'schema://cli/plan' },
        { id: 'analyze-pr.preventionGuidance', version: '1.0', path: 'schema://cli/analyze-pr' },
        { id: 'analyze-pr.context.sources[].promoted-knowledge', version: '1.0', path: 'schema://cli/analyze-pr' }
      ]
    });

    logSpy.mockRestore();
  });
});
