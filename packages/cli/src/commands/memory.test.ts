import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const lookupMemoryEventTimeline = vi.fn();
const lookupMemoryCandidateKnowledge = vi.fn();
const lookupPromotedMemoryKnowledge = vi.fn();
const expandMemoryProvenance = vi.fn();
const loadCandidateKnowledgeById = vi.fn();
const promoteMemoryCandidate = vi.fn();
const retirePromotedKnowledge = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  lookupMemoryEventTimeline,
  lookupMemoryCandidateKnowledge,
  lookupPromotedMemoryKnowledge,
  expandMemoryProvenance,
  loadCandidateKnowledgeById,
  promoteMemoryCandidate,
  retirePromotedKnowledge
}));

describe('runMemory', () => {
  it('supports events subcommand and emits json output', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    lookupMemoryEventTimeline.mockReturnValue([{ eventInstanceId: 'evt-1' }]);

    const exitCode = await runMemory('/repo', ['events', '--limit', '1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-events');
    expect(payload.events).toHaveLength(1);

    logSpy.mockRestore();
  });

  it('supports show for candidate ids', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    lookupMemoryCandidateKnowledge.mockReturnValue([
      { candidateId: 'cand-1', title: 'Candidate 1', provenance: [{ eventId: 'evt-1', sourcePath: 'events/evt-1.json', fingerprint: 'f' }] }
    ]);
    expandMemoryProvenance.mockReturnValue([{ eventId: 'evt-1', sourcePath: 'events/evt-1.json', fingerprint: 'f', event: { eventInstanceId: 'evt-1' } }]);

    const exitCode = await runMemory('/repo', ['show', 'cand-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-show');
    expect(payload.type).toBe('candidate');
    logSpy.mockRestore();
  });

  it('supports promote subcommand with positional candidate id', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    promoteMemoryCandidate.mockReturnValue({
      schemaVersion: '1.0',
      command: 'memory-promote',
      promoted: { knowledgeId: 'decision-1' },
      supersededIds: ['decision-0'],
      artifactPath: '.playbook/memory/knowledge/decisions.json'
    });

    const exitCode = await runMemory('/repo', ['promote', 'cand-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(loadCandidateKnowledgeById).toHaveBeenCalledWith('/repo', 'cand-1');
    expect(promoteMemoryCandidate).toHaveBeenCalledWith('/repo', 'cand-1');

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-promote');
    logSpy.mockRestore();
  });

  it('supports retire subcommand', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    retirePromotedKnowledge.mockReturnValue({
      schemaVersion: '1.0',
      command: 'memory-retire',
      retired: { knowledgeId: 'decision-1' },
      artifactPath: '.playbook/memory/knowledge/decisions.json'
    });

    const exitCode = await runMemory('/repo', ['retire', 'decision-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-retire');
    logSpy.mockRestore();
  });
});
