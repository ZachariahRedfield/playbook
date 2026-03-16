import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const knowledgeList = vi.fn();
const knowledgeQuery = vi.fn();
const knowledgeInspect = vi.fn();
const knowledgeTimeline = vi.fn();
const knowledgeProvenance = vi.fn();
const knowledgeStale = vi.fn();
const readCrossRepoPatternsArtifact = vi.fn();
const getPortabilityOutcomeSummary = vi.fn();
const findPortabilityOutcomes = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  knowledgeList,
  knowledgeQuery,
  knowledgeInspect,
  knowledgeTimeline,
  knowledgeProvenance,
  knowledgeStale,
  readCrossRepoPatternsArtifact,
  getPortabilityOutcomeSummary,
  findPortabilityOutcomes
}));


beforeEach(() => {
  getPortabilityOutcomeSummary.mockReturnValue({
    decision_status_counts: { accepted: 0, proposed: 0, reviewed: 0, rejected: 0, superseded: 0 },
    by_pattern: {}
  });
  findPortabilityOutcomes.mockReturnValue([]);
});
describe('runKnowledge', () => {
  it('supports list and emits json output', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    knowledgeList.mockReturnValue({
      schemaVersion: '1.0',
      command: 'knowledge-list',
      filters: {},
      summary: { total: 1, byType: {}, byStatus: {} },
      knowledge: [{ id: 'event-1' }]
    });

    const exitCode = await runKnowledge('/repo', ['list'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-list');
    expect(payload.knowledge).toHaveLength(1);
    logSpy.mockRestore();
  });

  it('supports query filters', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    knowledgeQuery.mockReturnValue({
      schemaVersion: '1.0',
      command: 'knowledge-query',
      filters: { type: 'candidate' },
      summary: { total: 1, byType: {}, byStatus: {} },
      knowledge: [{ id: 'cand-1', type: 'candidate' }]
    });

    const exitCode = await runKnowledge('/repo', ['query', '--type', 'candidate'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(knowledgeQuery).toHaveBeenCalledWith('/repo', expect.objectContaining({ type: 'candidate' }));

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-query');
    logSpy.mockRestore();
  });

  it('supports inspect and provenance subcommands', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    knowledgeInspect.mockReturnValue({
      schemaVersion: '1.0',
      command: 'knowledge-inspect',
      id: 'pattern-1',
      knowledge: { id: 'pattern-1', type: 'promoted' }
    });

    let exitCode = await runKnowledge('/repo', ['inspect', 'pattern-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    let payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-inspect');

    knowledgeProvenance.mockReturnValue({
      schemaVersion: '1.0',
      command: 'knowledge-provenance',
      id: 'pattern-1',
      provenance: { record: { id: 'pattern-1' }, evidence: [{ id: 'event-1' }], relatedRecords: [{ id: 'cand-1' }] }
    });

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['provenance', 'pattern-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-provenance');
    logSpy.mockRestore();
  });

  it('supports portability with deterministic text output when artifact exists', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    getPortabilityOutcomeSummary.mockReturnValue({ decision_status_counts: { accepted: 0, proposed: 0, reviewed: 0, rejected: 0, superseded: 0 }, by_pattern: { 'lane-split-validation': 1 } });
    findPortabilityOutcomes.mockReturnValue([{ decision_status: 'accepted', observed_outcome: 'successful' }]);
    readCrossRepoPatternsArtifact.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'cross-repo-patterns',
      generatedAt: '2026-01-01T00:00:00.000Z',
      repositories: [
        {
          id: 'ZachariahRedfield/playbook',
          repoPath: '/tmp/playbook',
          patternCount: 1,
          patterns: [
            {
              pattern_id: 'lane-split-validation',
              attractor: 0.81,
              fitness: 0.84,
              strength: 0.83,
              instance_count: 7,
              governance_stable: true
            }
          ]
        }
      ],
      aggregates: [
        {
          pattern_id: 'lane-split-validation',
          repo_count: 7,
          instance_count: 18,
          mean_attractor: 0.81,
          mean_fitness: 0.84,
          portability_score: 0.82,
          outcome_consistency: 0.79,
          instance_diversity: 0.9,
          governance_stability: 0.89
        }
      ]
    });

    const exitCode = await runKnowledge('/repo', ['portability'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Pattern: lane-split-validation');
    expect(rendered).toContain('Source Repo:\nZachariahRedfield/playbook');
    expect(rendered).toContain('Portability Score:\n0.82');
    expect(rendered).toContain('Evidence Runs:\n7');
    expect(rendered).toContain('Compatible Subsystems:\nrouting_engine');
    expect(rendered).toContain('Risk Signals:\ndependency mismatch');

    logSpy.mockRestore();
  });

  it('returns failure for portability when cross-repo artifact is missing', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    readCrossRepoPatternsArtifact.mockImplementation(() => {
      throw new Error('playbook patterns: missing artifact at .playbook/cross-repo-patterns.json. Run "playbook patterns cross-repo" first.');
    });

    const exitCode = await runKnowledge('/repo', ['portability'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('missing artifact at .playbook/cross-repo-patterns.json');

    errorSpy.mockRestore();
  });

  it('emits machine-readable portability json shape', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    getPortabilityOutcomeSummary.mockReturnValue({ decision_status_counts: { accepted: 0, proposed: 0, reviewed: 0, rejected: 0, superseded: 0 }, by_pattern: { 'lane-split-validation': 1 } });
    findPortabilityOutcomes.mockReturnValue([{ decision_status: 'accepted', observed_outcome: 'successful' }]);
    readCrossRepoPatternsArtifact.mockReturnValue({
      schemaVersion: '1.0',
      kind: 'cross-repo-patterns',
      generatedAt: '2026-01-01T00:00:00.000Z',
      repositories: [
        {
          id: 'ZachariahRedfield/playbook',
          repoPath: '/tmp/playbook',
          patternCount: 1,
          patterns: [
            {
              pattern_id: 'lane-split-validation',
              attractor: 0.81,
              fitness: 0.84,
              strength: 0.83,
              instance_count: 7,
              governance_stable: true
            }
          ]
        }
      ],
      aggregates: [
        {
          pattern_id: 'lane-split-validation',
          repo_count: 7,
          instance_count: 18,
          mean_attractor: 0.81,
          mean_fitness: 0.84,
          portability_score: 0.82,
          outcome_consistency: 0.79,
          instance_diversity: 0.9,
          governance_stability: 0.89
        }
      ]
    });

    const exitCode = await runKnowledge('/repo', ['portability'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-portability');
    expect(payload.portability[0]).toEqual({
      pattern_id: 'lane-split-validation',
      source_repo: 'ZachariahRedfield/playbook',
      portability_score: 0.82,
      evidence_runs: 7,
      compatible_subsystems: ['routing_engine'],
      risk_signals: ['dependency mismatch'],
      portability_outcomes: {
        total_records: 1,
        accepted: 1,
        rejected: 0,
        successful: 1,
        unsuccessful: 0,
        inconclusive: 0
      }
    });

    logSpy.mockRestore();
  });

});
