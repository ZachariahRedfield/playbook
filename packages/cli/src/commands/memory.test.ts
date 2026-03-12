import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const replayMemoryToCandidates = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ replayMemoryToCandidates }));

describe('runMemory', () => {
  it('supports replay subcommand and emits json output', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    replayMemoryToCandidates.mockReturnValue({
      schemaVersion: '1.0',
      command: 'memory-replay',
      sourceIndex: '.playbook/memory/index.json',
      generatedAt: '1970-01-01T00:00:00.000Z',
      totalEvents: 2,
      clustersEvaluated: 1,
      candidates: []
    });

    const exitCode = await runMemory('/repo', ['replay'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-replay');
    expect(payload.totalEvents).toBe(2);

    logSpy.mockRestore();
  });
});
