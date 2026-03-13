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
    expect((schemas.memoryArtifacts as Array<{ id: string; path: string }>).find((entry) => entry.id === 'memory-event')?.path).toBe(
      '.playbook/memory/events/runtime/*.json'
    );
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('query.memoryKnowledge');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('knowledge');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('pattern-graph');
  });

  it('keeps schema registration identifiers and paths stable', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runContracts(process.cwd(), { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const schemas = payload.schemas as Record<string, unknown>;
    expect(schemas).toEqual({
      memoryArtifacts: [
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
        { id: 'explain.memoryKnowledge', version: '1.0', path: 'schema://cli/explain' },
        { id: 'plan.tasks[].advisory.outcomeLearning', version: '1.0', path: 'schema://cli/plan' },
        { id: 'analyze-pr.preventionGuidance', version: '1.0', path: 'schema://cli/analyze-pr' },
        { id: 'analyze-pr.context.sources[].promoted-knowledge', version: '1.0', path: 'schema://cli/analyze-pr' }
      ]
    });

    logSpy.mockRestore();
  });
});
