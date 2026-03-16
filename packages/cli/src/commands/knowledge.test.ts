import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const knowledgeList = vi.fn();
const knowledgeQuery = vi.fn();
const knowledgeInspect = vi.fn();
const knowledgeTimeline = vi.fn();
const knowledgeProvenance = vi.fn();
const knowledgeStale = vi.fn();
const readCrossRepoPatternsArtifact = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  knowledgeList,
  knowledgeQuery,
  knowledgeInspect,
  knowledgeTimeline,
  knowledgeProvenance,
  knowledgeStale,
  readCrossRepoPatternsArtifact
}));

const crossRepoArtifactFixture = () => ({
  schemaVersion: '1.0',
  kind: 'cross-repo-patterns',
  generatedAt: '2026-01-01T00:00:00.000Z',
  repositories: [
    {
      id: 'source/repo',
      repoPath: '/tmp/source-repo',
      patternCount: 2,
      patterns: [
        {
          pattern_id: 'knowledge-contract-portability',
          attractor: 0.81,
          fitness: 0.84,
          strength: 0.83,
          instance_count: 7,
          governance_stable: true
        },
        {
          pattern_id: 'bootstrap-rule-normalization',
          attractor: 0.75,
          fitness: 0.78,
          strength: 0.77,
          instance_count: 6,
          governance_stable: true
        }
      ]
    },
    {
      id: 'target/repo',
      repoPath: '/tmp/target-repo',
      patternCount: 0,
      patterns: []
    }
  ],
  aggregates: [
    {
      pattern_id: 'knowledge-contract-portability',
      repo_count: 7,
      instance_count: 18,
      mean_attractor: 0.81,
      mean_fitness: 0.84,
      portability_score: 0.82,
      outcome_consistency: 0.79,
      instance_diversity: 0.9,
      governance_stability: 0.89
    },
    {
      pattern_id: 'bootstrap-rule-normalization',
      repo_count: 5,
      instance_count: 13,
      mean_attractor: 0.75,
      mean_fitness: 0.78,
      portability_score: 0.68,
      outcome_consistency: 0.72,
      instance_diversity: 0.64,
      governance_stability: 0.91
    }
  ]
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

  it('supports portability overview with deterministic text output when artifact exists', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    readCrossRepoPatternsArtifact.mockReturnValue(crossRepoArtifactFixture());

    const exitCode = await runKnowledge('/repo', ['portability'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    const rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Pattern: knowledge-contract-portability');
    expect(rendered).toContain('Source Repo:\nsource/repo');
    expect(rendered).toContain('Portability Score:\n0.82');
    expect(rendered).toContain('Evidence Runs:\n7');
    expect(rendered).toContain('Compatible Subsystems:\nbootstrap_contract_surface\nknowledge_lifecycle');
    expect(rendered).toContain('Risk Signals:\ndependency mismatch');

    logSpy.mockRestore();
  });

  it('surfaces portability recommendations, outcomes, and recalibration views in text mode', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    readCrossRepoPatternsArtifact.mockReturnValue(crossRepoArtifactFixture());

    let exitCode = await runKnowledge('/repo', ['portability', '--view', 'recommendations'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    let rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Pattern: knowledge-contract-portability');
    expect(rendered).toContain('Source Repo: source/repo');
    expect(rendered).toContain('Target Repo: target/repo');
    expect(rendered).toContain('Initial Portability Score: 0.82');
    expect(rendered).toContain('Decision Status: recommended');
    expect(rendered).toContain('Evidence Count: 7');

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['portability', '--view', 'outcomes'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Adoption Status: adopted');
    expect(rendered).toContain('Observed Outcome: positive');
    expect(rendered).toContain('Sample Size: 7');

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['portability', '--view', 'recalibration'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    rendered = String(logSpy.mock.calls[0]?.[0]);
    expect(rendered).toContain('Recalibrated Confidence:');
    expect(rendered).toContain('Evidence Count: 7');
    expect(rendered).toContain('Sample Size: 7');

    logSpy.mockRestore();
  });

  it('returns failure for portability when cross-repo artifact is missing', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    readCrossRepoPatternsArtifact.mockImplementation(() => {
      throw new Error('playbook patterns: missing artifact at .playbook/cross-repo-patterns.json. Run "playbook patterns cross-repo" first.');
    });

    const exitCode = await runKnowledge('/repo', ['portability', '--view', 'outcomes'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('missing artifact at .playbook/cross-repo-patterns.json');

    errorSpy.mockRestore();
  });

  it('emits machine-readable portability json shapes for deterministic parsing', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    readCrossRepoPatternsArtifact.mockReturnValue(crossRepoArtifactFixture());

    let exitCode = await runKnowledge('/repo', ['portability'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    let payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-portability');
    expect(payload.portability[0]).toEqual({
      pattern_id: 'knowledge-contract-portability',
      source_repo: 'source/repo',
      portability_score: 0.82,
      evidence_runs: 7,
      compatible_subsystems: ['bootstrap_contract_surface', 'knowledge_lifecycle'],
      risk_signals: ['dependency mismatch']
    });

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['portability', '--view', 'recommendations'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-portability-recommendations');
    expect(payload.recommendations[0]).toMatchObject({
      pattern: 'knowledge-contract-portability',
      source_repo: 'source/repo',
      target_repo: 'target/repo',
      initial_portability_score: 0.82,
      decision_status: 'recommended',
      evidence_count: 7
    });

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['portability', '--view', 'outcomes'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-portability-outcomes');
    expect(payload.outcomes[0]).toMatchObject({
      pattern: 'knowledge-contract-portability',
      source_repo: 'source/repo',
      target_repo: 'target/repo',
      initial_portability_score: 0.82,
      adoption_status: 'adopted',
      observed_outcome: 'positive',
      sample_size: 7
    });

    logSpy.mockClear();
    exitCode = await runKnowledge('/repo', ['portability', '--view', 'recalibration'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('knowledge-portability-recalibration');
    expect(payload.recalibration[0]).toMatchObject({
      pattern: 'knowledge-contract-portability',
      source_repo: 'source/repo',
      target_repo: 'target/repo',
      initial_portability_score: 0.82,
      evidence_count: 7,
      sample_size: 7
    });

    logSpy.mockRestore();
  });

  it('supports side-effect-free portability help without artifact reads', async () => {
    const { runKnowledge } = await import('./knowledge.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    readCrossRepoPatternsArtifact.mockClear();
    const exitCode = await runKnowledge('/repo', ['portability', '--help'], { format: 'text', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    expect(readCrossRepoPatternsArtifact).not.toHaveBeenCalled();
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Usage: playbook knowledge portability');

    logSpy.mockRestore();
  });
});
