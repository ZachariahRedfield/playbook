import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const replayMemoryToCandidates = vi.fn();
const promoteMemoryCandidate = vi.fn();
const pruneMemoryKnowledge = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ replayMemoryToCandidates, promoteMemoryCandidate, pruneMemoryKnowledge }));

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

  it('supports promote subcommand with from-candidate', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    promoteMemoryCandidate.mockReturnValue({
      schemaVersion: '1.0',
      command: 'memory-promote',
      promoted: { knowledgeId: 'decision-1' },
      supersededIds: ['decision-0'],
      artifactPath: '.playbook/memory/knowledge/decisions.json'
    });

    const exitCode = await runMemory('/repo', ['promote', '--from-candidate', 'cand-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(promoteMemoryCandidate).toHaveBeenCalledWith('/repo', 'cand-1');

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-promote');
    logSpy.mockRestore();
  });

  it('supports prune subcommand', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    pruneMemoryKnowledge.mockReturnValue({
      schemaVersion: '1.0',
      command: 'memory-prune',
      staleCandidatesPruned: 1,
      supersededKnowledgePruned: 1,
      duplicateKnowledgeCollapsed: 2,
      duplicateCandidatesCollapsed: 1,
      updatedArtifacts: []
    });

    const exitCode = await runMemory('/repo', ['prune'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-prune');
    logSpy.mockRestore();
  });
});
