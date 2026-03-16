import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const lookupMemoryEventTimeline = vi.fn();
const lookupMemoryCandidateKnowledge = vi.fn();
const lookupPromotedMemoryKnowledge = vi.fn();
const expandMemoryProvenance = vi.fn();
const loadCandidateKnowledgeById = vi.fn();
const promoteMemoryCandidate = vi.fn();
const retirePromotedKnowledge = vi.fn();
const queryRepositoryEvents = vi.fn();
const summarizeRecentRouteDecisions = vi.fn();
const summarizeLaneTransitionsForRun = vi.fn();
const summarizeWorkerAssignmentsForRun = vi.fn();
const summarizeImprovementSignalsForArtifact = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  lookupMemoryEventTimeline,
  lookupMemoryCandidateKnowledge,
  lookupPromotedMemoryKnowledge,
  expandMemoryProvenance,
  loadCandidateKnowledgeById,
  promoteMemoryCandidate,
  queryRepositoryEvents,
  summarizeRecentRouteDecisions,
  summarizeLaneTransitionsForRun,
  summarizeWorkerAssignmentsForRun,
  summarizeImprovementSignalsForArtifact,
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

  it('supports query subcommand filtering by event type and run id', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    queryRepositoryEvents.mockReturnValue([{ event_id: 'evt-1', event_type: 'lane_transition', run_id: 'run-1' }]);

    const exitCode = await runMemory(
      '/repo',
      ['query', '--event-type', 'lane_transition', '--run-id', 'run-1', '--related-artifact', '.playbook/plan.json'],
      { format: 'json', quiet: false }
    );

    expect(exitCode).toBe(ExitCode.Success);
    expect(queryRepositoryEvents).toHaveBeenCalledWith(
      '/repo',
      expect.objectContaining({
        eventType: 'lane_transition',
        runId: 'run-1',
        relatedArtifact: '.playbook/plan.json'
      })
    );

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-query');
    expect(payload.events).toHaveLength(1);
    logSpy.mockRestore();
  });

  it('supports query summary for route decisions', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    summarizeRecentRouteDecisions.mockReturnValue({ events: [{ event_id: 'route-1' }] });

    const exitCode = await runMemory('/repo', ['query', '--summary', 'recent-route-decisions'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(summarizeRecentRouteDecisions).toHaveBeenCalled();

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.events[0].event_id).toBe('route-1');
    logSpy.mockRestore();
  });

  it('returns failure when query summary requirements are missing', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runMemory('/repo', ['query', '--summary', 'lane-transitions'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.error).toContain('requires --run-id');
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
