import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExitCode } from '../lib/cliContract.js';

const lookupMemoryEventTimeline = vi.fn();
const queryRepositoryEvents = vi.fn();
const listRecentRouteDecisions = vi.fn();
const listLaneTransitionsForRun = vi.fn();
const listWorkerAssignmentsForRun = vi.fn();
const listImprovementSignalsForArtifact = vi.fn();
const lookupMemoryCandidateKnowledge = vi.fn();
const lookupPromotedMemoryKnowledge = vi.fn();
const lookupMemoryCompactionReview = vi.fn();
const reviewMemoryCompaction = vi.fn();
const expandMemoryProvenance = vi.fn();
const loadCandidateKnowledgeById = vi.fn();
const promoteMemoryCandidate = vi.fn();
const retirePromotedKnowledge = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  lookupMemoryEventTimeline,
  queryRepositoryEvents,
  listRecentRouteDecisions,
  listLaneTransitionsForRun,
  listWorkerAssignmentsForRun,
  listImprovementSignalsForArtifact,
  lookupMemoryCandidateKnowledge,
  lookupPromotedMemoryKnowledge,
  lookupMemoryCompactionReview,
  reviewMemoryCompaction,
  expandMemoryProvenance,
  loadCandidateKnowledgeById,
  promoteMemoryCandidate,
  retirePromotedKnowledge
}));

describe('runMemory', () => {
  it('supports events subcommand and emits json output', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    lookupMemoryEventTimeline.mockReturnValue([{ eventId: 'evt-1' }]);

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
    expandMemoryProvenance.mockReturnValue([{ eventId: 'evt-1', sourcePath: 'events/evt-1.json', fingerprint: 'f', event: { eventId: 'evt-1' } }]);

    const exitCode = await runMemory('/repo', ['show', 'cand-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-show');
    expect(payload.type).toBe('candidate');
    logSpy.mockRestore();
  });

  it('adds deterministic source metadata to candidates, including interop-derived records', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-candidates-'));

    fs.mkdirSync(path.join(repoRoot, '.playbook', 'memory'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, '.playbook', 'memory', 'candidates.json'),
      `${JSON.stringify({
        interopDerivedCandidates: [
          {
            candidateId: 'cand-interop',
            source: { requestId: 'interop-1', receiptId: 'receipt-1' },
            confidence: { score: 0.82 },
            sourceHash: 'hash-1',
            sourceContractFingerprint: 'contract-fp-1',
            interopFollowupId: 'followup-1',
            eligibilityReason: 'repeated-blocked-runtime-outcome'
          }
        ]
      }, null, 2)}\n`,
      'utf8'
    );
    lookupMemoryCandidateKnowledge.mockReturnValue([
      { candidateId: 'cand-replay', title: 'Replay Candidate' },
      { candidateId: 'cand-interop', title: 'Interop Candidate' }
    ]);

    const exitCode = await runMemory(repoRoot, ['candidates'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-candidates');
    expect(payload.candidates).toHaveLength(2);
    expect(payload.candidates[0].source_metadata).toEqual({ source: 'replay', derived_from_interop_followup: false });
    expect(payload.candidates[1].source_metadata).toMatchObject({
      source: 'interop-followup',
      derived_from_interop_followup: true,
      interop_followup: {
        followup_id: 'followup-1',
        request_id: 'interop-1',
        receipt_id: 'receipt-1',
        eligibility_reason: 'repeated-blocked-runtime-outcome',
        confidence_score: 0.82,
        source_hash: 'hash-1',
        source_contract_fingerprint: 'contract-fp-1'
      }
    });
    logSpy.mockRestore();
  });

  it('supports memory candidates source filtering for interop-derived candidates', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-candidates-source-'));

    fs.mkdirSync(path.join(repoRoot, '.playbook', 'memory'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, '.playbook', 'memory', 'candidates.json'),
      `${JSON.stringify({
        interopDerivedCandidates: [{ candidateId: 'cand-interop', source: { requestId: 'interop-2', receiptId: 'receipt-2' } }]
      }, null, 2)}\n`,
      'utf8'
    );
    lookupMemoryCandidateKnowledge.mockReturnValue([
      { candidateId: 'cand-replay', title: 'Replay Candidate' },
      { candidateId: 'cand-interop', title: 'Interop Candidate' }
    ]);

    const exitCode = await runMemory(repoRoot, ['candidates', '--source', 'interop-followup'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.filters).toEqual({ source: 'interop-followup' });
    expect(payload.candidates).toHaveLength(1);
    expect(payload.candidates[0].candidateId).toBe('cand-interop');
    expect(payload.candidates[0].source_metadata.source).toBe('interop-followup');
    logSpy.mockRestore();
  });

  it('supports query subcommand filters and emits json output', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    queryRepositoryEvents.mockReturnValue([{ event_id: 'evt-1', run_id: 'run-1', event_type: 'lane_transition' }]);

    const exitCode = await runMemory(
      '/repo',
      ['query', '--event-type', 'lane_transition', '--run-id', 'run-1', '--related-artifact', '.playbook/workset-plan.json'],
      { format: 'json', quiet: false }
    );
    expect(exitCode).toBe(ExitCode.Success);

    expect(queryRepositoryEvents).toHaveBeenCalledWith(
      '/repo',
      expect.objectContaining({ event_type: 'lane_transition', run_id: 'run-1', related_artifact: '.playbook/workset-plan.json' })
    );

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-query');
    expect(payload.events).toHaveLength(1);
    logSpy.mockRestore();
  });

  it('supports query summary views', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    listRecentRouteDecisions.mockReturnValue([{ event_id: 'evt-route-1' }]);
    const routesExit = await runMemory('/repo', ['query', '--view', 'recent-routes', '--limit', '1'], { format: 'json', quiet: false });
    expect(routesExit).toBe(ExitCode.Success);

    listLaneTransitionsForRun.mockReturnValue([]);
    const transitionsExit = await runMemory('/repo', ['query', '--view', 'lane-transitions', '--run-id', 'run-1'], { format: 'json', quiet: false });
    expect(transitionsExit).toBe(ExitCode.Success);

    listWorkerAssignmentsForRun.mockReturnValue([]);
    const workersExit = await runMemory('/repo', ['query', '--view', 'worker-assignments', '--run-id', 'run-1'], { format: 'json', quiet: false });
    expect(workersExit).toBe(ExitCode.Success);

    listImprovementSignalsForArtifact.mockReturnValue([]);
    const improvementsExit = await runMemory(
      '/repo',
      ['query', '--view', 'artifact-improvements', '--related-artifact', '.playbook/workset-plan.json'],
      { format: 'json', quiet: false }
    );
    expect(improvementsExit).toBe(ExitCode.Success);

    logSpy.mockRestore();
  });


  it('supports compaction subcommand and emits json output', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    reviewMemoryCompaction.mockReturnValue({ summary: { totalEntries: 1, discard: 0, attach: 1, merge: 0, newCandidate: 0, explicitPromotionRequired: 1 } });
    lookupMemoryCompactionReview.mockReturnValue([{ reviewId: 'review-1', decision: { decision: 'attach' } }]);

    const exitCode = await runMemory('/repo', ['compaction', '--decision', 'attach'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(reviewMemoryCompaction).toHaveBeenCalledWith('/repo');
    expect(lookupMemoryCompactionReview).toHaveBeenCalledWith('/repo', { decision: 'attach', kind: undefined });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-compaction-review');
    expect(payload.artifactPath).toBe('.playbook/memory/compaction-review.json');
    expect(payload.entries).toHaveLength(1);
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

  it('supports outcome-feedback subcommand and emits deterministic read-only summary', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-outcome-feedback-'));

    fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, '.playbook', 'outcome-feedback.json'),
      `${JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-outcome-feedback',
        command: 'outcome-feedback',
        outcomeCounts: { success: 1, 'bounded-failure': 1, 'blocked-policy': 0, 'rollback-deactivation': 0, 'later-regression': 0 },
        outcomes: [
          {
            outcomeId: 'outcome-1',
            outcomeClass: 'success',
            sourceType: 'execution-receipt',
            sourceRef: 'prompt_results/prompt-1',
            observedAt: '2026-04-03T00:00:00.000Z',
            provenanceRefs: ['.playbook/execution-receipt.json', 'receipt:prompt-1'],
            candidateSignals: {
              confidenceUpdate: { direction: 'up', magnitude: 0.1, rationale: 'success' },
              triggerQualityNotes: ['good trigger'],
              staleKnowledgeFlags: [],
              trendUpdates: ['success trend']
            }
          },
          {
            outcomeId: 'outcome-2',
            outcomeClass: 'bounded-failure',
            sourceType: 'remediation-history',
            sourceRef: 'runs/run-2',
            observedAt: '2026-04-03T01:00:00.000Z',
            provenanceRefs: ['.playbook/test-autofix-history.json', 'run:run-2'],
            candidateSignals: {
              confidenceUpdate: { direction: 'down', magnitude: 0.2, rationale: 'bounded failure' },
              triggerQualityNotes: ['review trigger'],
              staleKnowledgeFlags: ['possible stale rule'],
              trendUpdates: ['failure trend']
            }
          }
        ],
        governance: { candidateOnly: true, autoPromotion: false, autoMutation: false, reviewRequired: true }
      }, null, 2)}\n`,
      'utf8'
    );

    const exitCode = await runMemory(repoRoot, ['outcome-feedback'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-outcome-feedback');
    expect(payload.outcome_counts.success).toBe(1);
    expect(payload.signals.stale_knowledge).toEqual(['possible stale rule']);
    expect(payload.provenance_refs).toEqual([
      '.playbook/execution-receipt.json',
      '.playbook/test-autofix-history.json',
      'receipt:prompt-1',
      'run:run-2'
    ]);
    expect(payload.next_review_action).toContain('stale-knowledge');
    expect(payload.governance).toEqual({
      candidate_only: true,
      auto_promotion: false,
      auto_mutation: false,
      review_required: true
    });
    logSpy.mockRestore();
  });

  it('returns deterministic failure envelope when outcome-feedback artifact is missing', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-outcome-feedback-missing-'));

    const exitCode = await runMemory(repoRoot, ['outcome-feedback'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-outcome-feedback');
    expect(payload.error).toContain('missing required artifact .playbook/outcome-feedback.json');
    logSpy.mockRestore();
  });

  it('supports pressure subcommand and emits filtered recommended actions', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-pressure-'));

    fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, '.playbook', 'memory-pressure.json'),
      `${JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-memory-pressure-status',
        command: 'memory-pressure-evaluate',
        score: { normalized: 0.82 },
        band: 'pressure',
        policy: { watermarks: { warm: 0.6, pressure: 0.8, critical: 0.95 }, hysteresis: 0.05 },
        usage: { usedBytes: 2048, fileCount: 11, eventCount: 7 },
        classes: { canonical: ['a'], compactable: ['b', 'c'], disposable: ['d', 'e', 'f'] }
      }, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(repoRoot, '.playbook', 'memory-pressure-plan.json'),
      `${JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-memory-pressure-plan',
        command: 'memory-pressure-plan',
        recommendedByBand: {
          warm: [{ action: 'dedupe' }],
          pressure: [{ action: 'summarize', reason: 'r1', targets: ['.playbook/memory/events/1.json'] }, { action: 'compact', reason: 'r2', targets: ['.playbook/memory/index.json'] }],
          critical: [{ action: 'evict', reason: 'r3', targets: ['.playbook/memory/events/2.json'], requiresSummary: true }]
        }
      }, null, 2)}\n`,
      'utf8'
    );

    const exitCode = await runMemory(repoRoot, ['pressure', '--action', 'compact'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-pressure');
    expect(payload.band).toBe('pressure');
    expect(payload.ordered_recommended_actions).toEqual([{ action: 'compact', reason: 'r2', targets: ['.playbook/memory/index.json'] }]);
    expect(payload.retention_classes_summary).toEqual({ canonical: 1, compactable: 2, disposable: 3 });
    logSpy.mockRestore();
  });

  it('returns deterministic failure envelope when pressure artifacts are missing', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-pressure-missing-'));

    const exitCode = await runMemory(repoRoot, ['pressure'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-pressure');
    expect(payload.error).toContain('missing required artifact .playbook/memory-pressure.json');
    logSpy.mockRestore();
  });

  it('supports pressure followups subcommand with deterministic filters', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-pressure-followups-'));

    fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, '.playbook', 'memory-pressure-followups.json'),
      `${JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-memory-pressure-followups',
        command: 'memory-pressure-followups',
        currentBand: 'pressure',
        retentionClasses: {
          canonical: ['.playbook/memory/knowledge/decisions.json'],
          compactable: ['.playbook/memory/events/1.json', '.playbook/memory/index.json'],
          disposable: ['.playbook/tmp/a.json']
        },
        rowsByBand: {
          warm: [{ followupId: 'f-w-1', action: 'dedupe', priority: 'P3', reason: 'w', targets: ['.playbook/memory/events/1.json'], excludedCanonicalTargets: [] }],
          pressure: [
            {
              followupId: 'f-p-1',
              action: 'summarize',
              priority: 'P1',
              reason: 'p1',
              targets: ['.playbook/memory/events/1.json'],
              excludedCanonicalTargets: ['.playbook/memory/knowledge/decisions.json']
            },
            { followupId: 'f-p-2', action: 'compact', priority: 'P2', reason: 'p2', targets: ['.playbook/memory/index.json'], excludedCanonicalTargets: [] }
          ],
          critical: [{ followupId: 'f-c-1', action: 'evict-disposable', priority: 'P4', reason: 'c', targets: ['.playbook/tmp/a.json'], excludedCanonicalTargets: [] }]
        }
      }, null, 2)}\n`,
      'utf8'
    );

    const exitCode = await runMemory(
      repoRoot,
      ['pressure', 'followups', '--band', 'pressure', '--action', 'compact', '--class', 'compactable'],
      { format: 'json', quiet: false }
    );
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-pressure-followups');
    expect(payload.current_band).toBe('pressure');
    expect(payload.followups).toHaveLength(1);
    expect(payload.followups[0].followupId).toBe('f-p-2');
    expect(payload.top_recommended_actions).toEqual([{ action: 'compact', count: 1 }]);
    expect(payload.affected_targets).toEqual(['.playbook/memory/index.json']);
    logSpy.mockRestore();
  });

  it('returns deterministic failure envelope when pressure followups artifact is missing', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-pressure-followups-missing-'));

    const exitCode = await runMemory(repoRoot, ['pressure', 'followups'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-pressure');
    expect(payload.error).toContain('missing required artifact .playbook/memory-pressure-followups.json');
    logSpy.mockRestore();
  });

  it('returns deterministic failure envelope for unsupported subcommands', async () => {
    const { runMemory } = await import('./memory.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runMemory('/repo', ['unknown-subcommand'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('memory-unknown-subcommand');
    expect(payload.error).toContain('unsupported subcommand');
    logSpy.mockRestore();
  });

});
