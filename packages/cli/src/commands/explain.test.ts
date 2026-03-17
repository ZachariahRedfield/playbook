import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runExplain } from './explain.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));


const writePromotedPatterns = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'patterns-promoted.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'playbook-promoted-patterns',
        promotedPatterns: [
          {
            id: 'MODULE_TEST_ABSENCE',
            sourceCandidateId: 'candidate-module_test_absence',
            canonicalPatternName: 'module test absence',
            whyItExists: 'Pattern MODULE_TEST_ABSENCE is relevant to module testing coverage.',
            examples: ['module lacks tests'],
            confidence: 0.9,
            reusableEngineeringMeaning: 'testing governance signal',
            promotedAt: '2026-01-02T00:00:00.000Z',
            reviewRecord: {
              candidateId: 'candidate-module_test_absence',
              canonicalPatternName: 'module test absence',
              whyItExists: 'Pattern MODULE_TEST_ABSENCE is relevant to module testing coverage.',
              examples: ['module lacks tests'],
              confidence: 0.9,
              reusableEngineeringMeaning: 'testing governance signal',
              decision: {
                candidateId: 'candidate-module_test_absence',
                decision: 'approve',
                decidedBy: 'human-reviewed-local',
                decidedAt: '2026-01-02T00:00:00.000Z',
                rationale: 'approved'
              }
            }
          }
        ]
      },
      null,
      2
    )
  );
};


const writeArchitectureRegistry = (repo: string): void => {
  const registryPath = path.join(repo, '.playbook', 'architecture', 'subsystems.json');
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(
    registryPath,
    JSON.stringify(
      {
        version: 1,
        subsystems: [
          {
            name: 'observation_engine',
            purpose: 'Deterministic repository understanding',
            commands: ['index', 'query', 'explain'],
            artifacts: ['.playbook/repo-index.json'],
            downstream: ['knowledge_lifecycle']
          },
          {
            name: 'orchestration_planner',
            purpose: 'Parallel work decomposition',
            commands: ['orchestrate'],
            artifacts: ['.playbook/workset-plan.json']
          },
          {
            name: 'lane_lifecycle',
            purpose: 'Track orchestration progress',
            commands: ['lanes'],
            artifacts: ['.playbook/lane-state.json']
          },
          {
            name: 'worker_coordination',
            purpose: 'Worker assignment and prompt materialization',
            commands: ['workers'],
            artifacts: ['.playbook/worker-assignments.json']
          },
          {
            name: 'routing_engine',
            purpose: 'Task classification and execution strategy',
            commands: ['route'],
            artifacts: ['.playbook/execution-plan.json'],
            downstream: ['orchestration_planner']
          },
          {
            name: 'telemetry_learning',
            purpose: 'Execution telemetry and learning state',
            commands: ['telemetry'],
            artifacts: ['.playbook/outcome-telemetry.json', '.playbook/learning-state.json']
          },
          {
            name: 'knowledge_lifecycle',
            purpose: 'Promote durable patterns',
            commands: ['learn', 'knowledge', 'patterns'],
            artifacts: [],
            upstream: ['observation_engine']
          },
          {
            name: 'execution_supervisor',
            purpose: 'Run workers and monitor execution',
            commands: ['execute', 'cycle'],
            artifacts: ['.playbook/execution-state.json', '.playbook/cycle-state.json', '.playbook/cycle-history.json'],
            upstream: ['orchestration_planner'],
            downstream: ['telemetry_learning', 'lane_lifecycle', 'worker_coordination']
          }
        ]
      },
      null,
      2
    )
  );
};

const writeRepoIndex = (repo: string): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        framework: 'nextjs',
        language: 'typescript',
        architecture: 'modular-monolith',
        modules: ['users', 'workouts'],
        database: 'supabase',
        rules: ['PB001']
      },
      null,
      2
    )
  );
};

describe('runExplain', () => {
  it('returns JSON output contract for modules', async () => {
    const repo = createRepo('playbook-cli-explain-module-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['workouts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'workouts',
      type: 'module',
      explanation: {
        resolvedTarget: {
          input: 'workouts',
          kind: 'module',
          selector: 'workouts',
          canonical: 'module:workouts',
          matched: true
        },
        name: 'workouts',
        responsibilities: [
          'Owns workouts feature behavior and boundaries.',
          'Encapsulates workouts domain logic and module-level policies.'
        ],
        dependencies: [],
        architecture: 'modular-monolith'
      }
    });

    logSpy.mockRestore();
  });

  it('renders architecture explanation in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-architecture-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['architecture'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines[0]).toBe('Architecture: modular-monolith');
    expect(lines[2]).toBe('Structure');
    expect(lines[5]).toBe('Reasoning');

    logSpy.mockRestore();
  });

  it('returns failure and JSON error shape for unknown targets', async () => {
    const repo = createRepo('playbook-cli-explain-unknown-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['payments', '--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'payments',
      type: 'unknown',
      explanation: {
        resolvedTarget: {
          input: 'payments',
          kind: 'unknown',
          selector: 'payments',
          canonical: 'payments',
          matched: false
        },
        message: 'Unable to explain "payments" from repository intelligence. Try: playbook query modules | playbook rules.'
      }
    });

    logSpy.mockRestore();
  });


  it('includes memory-aware fields when --with-memory is set', async () => {
    const repo = createRepo('playbook-cli-explain-memory-json');
    writeRepoIndex(repo);
    writePromotedPatterns(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['workouts', '--with-memory'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.type).toBe('module');
    expect(typeof payload.explanation.memorySummary).toBe('string');
    expect(Array.isArray(payload.explanation.memorySources)).toBe(true);
    expect(Array.isArray(payload.explanation.knowledgeHits)).toBe(true);
    expect(Array.isArray(payload.explanation.recentRelevantEvents)).toBe(true);

    logSpy.mockRestore();
  });



  it('returns subsystem ownership details for registered subsystem lookups', async () => {
    const repo = createRepo('playbook-cli-explain-subsystem-json');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['subsystem', 'observation_engine'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'subsystem observation_engine',
      type: 'subsystem',
      explanation: {
        resolvedTarget: {
          input: 'subsystem observation_engine',
          kind: 'unknown',
          selector: 'observation_engine',
          canonical: 'subsystem:observation_engine',
          matched: true
        },
        name: 'observation_engine',
        purpose: 'Deterministic repository understanding',
        commands: ['index', 'query', 'explain'],
        artifacts: ['.playbook/repo-index.json'],
        downstream: ['knowledge_lifecycle'],
        subsystem_dependencies: {
          upstream: [],
          downstream: ['knowledge_lifecycle']
        }
      }
    });

    logSpy.mockRestore();
  });

  it('renders subsystem dependency flow in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-subsystem-text');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['subsystem', 'execution_supervisor'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain('Upstream');
    expect(lines).toContain('- orchestration_planner');
    expect(lines).toContain('Downstream');
    expect(lines).toContain('- telemetry_learning');

    logSpy.mockRestore();
  });

  it('fails deterministically for missing subsystem lookups', async () => {
    const repo = createRepo('playbook-cli-explain-subsystem-missing');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['subsystem', 'missing_subsystem'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'subsystem missing_subsystem',
      error: 'playbook explain subsystem: unknown subsystem "missing_subsystem".'
    });

    logSpy.mockRestore();
  });

  it('returns artifact ownership details for registered artifacts', async () => {
    const repo = createRepo('playbook-cli-explain-artifact-json');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['artifact', '.playbook/execution-state.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'artifact .playbook/execution-state.json',
      type: 'artifact',
      explanation: {
        resolvedTarget: {
          input: 'artifact .playbook/execution-state.json',
          kind: 'unknown',
          selector: '.playbook/execution-state.json',
          canonical: 'artifact:.playbook/execution-state.json',
          matched: true
        },
        artifact: '.playbook/execution-state.json',
        ownerSubsystem: 'execution_supervisor',
        purpose: 'Run workers and monitor execution',
        upstreamSubsystem: 'orchestration_planner',
        downstreamConsumers: ['telemetry_learning', 'lane_lifecycle', 'worker_coordination'],
        artifact_lineage: {
          ownerSubsystem: 'execution_supervisor',
          upstreamSubsystem: 'orchestration_planner',
          downstreamConsumers: ['telemetry_learning', 'lane_lifecycle', 'worker_coordination']
        }
      }
    });

    logSpy.mockRestore();
  });


  it('renders artifact lineage in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-artifact-text');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['artifact', '.playbook/execution-state.json'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain('Owner Subsystem:');
    expect(lines).toContain('orchestration_planner');
    expect(lines).toContain('- telemetry_learning');

    logSpy.mockRestore();
  });

  it('fails deterministically for missing artifact ownership lookups', async () => {
    const repo = createRepo('playbook-cli-explain-artifact-missing');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['artifact', '.playbook/unknown.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'artifact .playbook/unknown.json',
      error: 'playbook explain artifact: unknown artifact ".playbook/unknown.json".'
    });

    logSpy.mockRestore();
  });


  it('returns command inspection details for known command lookups', async () => {
    const repo = createRepo('playbook-cli-explain-command-json');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['command', 'route'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'command route',
      type: 'command',
      explanation: {
        resolvedTarget: {
          input: 'command route',
          kind: 'unknown',
          selector: 'route',
          canonical: 'command:route',
          matched: true
        },
        command: 'route',
        subsystemOwnership: 'routing_engine',
        artifactsRead: [],
        artifactsWritten: ['.playbook/execution-plan.json'],
        rationaleSummary: 'Task classification and execution strategy',
        downstreamConsumers: ['orchestration_planner'],
        commonFailurePrerequisites: [
          'Architecture registry contains subsystem "routing_engine" and command mappings.',
          'Required artifact available: .playbook/execution-plan.json.'
        ],
        command_inspection: {
          subsystemOwnership: 'routing_engine',
          artifactsRead: [],
          artifactsWritten: ['.playbook/execution-plan.json'],
          rationaleSummary: 'Task classification and execution strategy',
          downstreamConsumers: ['orchestration_planner'],
          commonFailurePrerequisites: [
            'Architecture registry contains subsystem "routing_engine" and command mappings.',
            'Required artifact available: .playbook/execution-plan.json.'
          ]
        }
      }
    });

    logSpy.mockRestore();
  });

  it('fails deterministically for missing command lookups', async () => {
    const repo = createRepo('playbook-cli-explain-command-missing');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['command', 'unknown'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'command unknown',
      error: 'playbook explain command: unknown command "unknown".'
    });

    logSpy.mockRestore();
  });


  it('explains cycle-state artifacts in JSON mode preserving step order and failed step', async () => {
    const repo = createRepo('playbook-cli-explain-cycle-artifact-json');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'cycle-state.json'),
      JSON.stringify(
        {
          cycle_version: 1,
          repo,
          cycle_id: 'cycle-123',
          started_at: '2026-01-01T00:00:00.000Z',
          steps: [
            { name: 'verify', status: 'success', duration_ms: 1 },
            { name: 'route', status: 'failure', duration_ms: 2 }
          ],
          artifacts_written: ['.playbook/execution-plan.json', '.playbook/cycle-state.json'],
          result: 'failed',
          failed_step: 'route'
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/cycle-state.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.explanation.cycle_state).toMatchObject({
      artifactType: 'cycle-state',
      cycle_id: 'cycle-123',
      result: 'failed',
      failed_step: 'route',
      artifacts_written: ['.playbook/execution-plan.json', '.playbook/cycle-state.json']
    });
    expect(payload.explanation.cycle_state.steps.map((step: { name: string }) => step.name)).toEqual(['verify', 'route']);

    logSpy.mockRestore();
  });

  it('explains successful cycle-state artifacts without failed_step', async () => {
    const repo = createRepo('playbook-cli-explain-cycle-artifact-success');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'cycle-state.json'),
      JSON.stringify(
        {
          cycle_version: 1,
          repo,
          cycle_id: 'cycle-124',
          started_at: '2026-01-01T00:00:00.000Z',
          steps: [{ name: 'verify', status: 'success', duration_ms: 1 }],
          artifacts_written: ['.playbook/cycle-state.json'],
          result: 'success'
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/cycle-state.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.explanation.cycle_state.result).toBe('success');
    expect(payload.explanation.cycle_state).not.toHaveProperty('failed_step');

    logSpy.mockRestore();
  });

  it('renders cycle-state artifact summaries in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-cycle-artifact-text');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'cycle-state.json'),
      JSON.stringify(
        {
          cycle_version: 1,
          repo,
          cycle_id: 'cycle-125',
          started_at: '2026-01-01T00:00:00.000Z',
          steps: [{ name: 'verify', status: 'success', duration_ms: 12 }],
          artifacts_written: ['.playbook/cycle-state.json'],
          result: 'success'
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/cycle-state.json'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain('Artifact type: cycle-state');
    expect(lines).toContain('Cycle ID: cycle-125');
    expect(lines).toContain('- verify: success (12ms)');

    logSpy.mockRestore();
  });

  it('fails deterministically when cycle-history artifact is missing', async () => {
    const repo = createRepo('playbook-cli-explain-cycle-history-missing');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['artifact', '.playbook/cycle-history.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'artifact .playbook/cycle-history.json',
      error: 'playbook explain artifact: missing artifact ".playbook/cycle-history.json".'
    });

    logSpy.mockRestore();
  });

  it('explains cycle-history artifacts in JSON mode', async () => {
    const repo = createRepo('playbook-cli-explain-cycle-history-json');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'cycle-history.json'),
      JSON.stringify(
        {
          history_version: 1,
          repo,
          cycles: [
            {
              cycle_id: 'cycle-200',
              started_at: '2026-01-01T00:00:00.000Z',
              result: 'success',
              duration_ms: 4
            },
            {
              cycle_id: 'cycle-201',
              started_at: '2026-01-01T00:01:00.000Z',
              result: 'failed',
              failed_step: 'execute',
              duration_ms: 9
            }
          ]
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/cycle-history.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.explanation.cycle_history).toMatchObject({
      artifactType: 'cycle-history',
      history_version: 1,
      repo
    });
    expect(payload.explanation.cycle_history.cycles.map((cycle: { cycle_id: string }) => cycle.cycle_id)).toEqual(['cycle-200', 'cycle-201']);

    logSpy.mockRestore();
  });

  it('renders cycle-history artifact summaries in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-cycle-history-text');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'cycle-history.json'),
      JSON.stringify(
        {
          history_version: 1,
          repo,
          cycles: [
            {
              cycle_id: 'cycle-300',
              started_at: '2026-01-01T00:00:00.000Z',
              result: 'success',
              duration_ms: 12
            }
          ]
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/cycle-history.json'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain('Artifact type: cycle-history');
    expect(lines).toContain('History version: 1');
    expect(lines.some((line) => line.includes('cycle-300'))).toBe(true);

    logSpy.mockRestore();
  });

  it('fails deterministically when policy-evaluation artifact is missing', async () => {
    const repo = createRepo('playbook-cli-explain-policy-evaluation-missing');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['artifact', '.playbook/policy-evaluation.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'artifact .playbook/policy-evaluation.json',
      error: 'playbook explain artifact: missing artifact ".playbook/policy-evaluation.json".'
    });

    logSpy.mockRestore();
  });

  it('explains policy-evaluation artifacts in JSON mode with deterministic evaluation order', async () => {
    const repo = createRepo('playbook-cli-explain-policy-evaluation-json');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'policy-evaluation.json'),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          kind: 'policy-evaluation',
          generatedAt: '2026-01-01T00:00:00.000Z',
          summary: { safe: 1, requires_review: 1, blocked: 0, total: 2 },
          evaluations: [
            {
              proposal_id: 'proposal-z',
              decision: 'requires_review',
              reason: 'Requires review for governance reasons.',
              evidence: { signals: ['impact_scope:broad'] }
            },
            {
              proposal_id: 'proposal-a',
              decision: 'safe',
              reason: 'Strong evidence.',
              evidence: { signals: ['evidence_strength:high'] }
            }
          ]
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/policy-evaluation.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.explanation.policy_evaluation).toMatchObject({
      artifactType: 'policy-evaluation',
      schemaVersion: '1.0',
      kind: 'policy-evaluation',
      summary: { safe: 1, requires_review: 1, blocked: 0, total: 2 }
    });
    expect(payload.explanation.policy_evaluation.evaluations.map((entry: { proposal_id: string }) => entry.proposal_id)).toEqual([
      'proposal-a',
      'proposal-z'
    ]);

    logSpy.mockRestore();
  });

  it('renders policy-evaluation artifact summaries in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-policy-evaluation-text');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'policy-evaluation.json'),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          kind: 'policy-evaluation',
          summary: { safe: 1, requires_review: 0, blocked: 1, total: 2 },
          evaluations: [
            {
              proposal_id: 'proposal-1',
              decision: 'safe',
              reason: 'strong evidence',
              evidence: { signals: ['evidence_strength:high'] }
            },
            {
              proposal_id: 'proposal-2',
              decision: 'blocked',
              reason: 'insufficient evidence',
              evidence: { signals: ['evidence_strength:low'] }
            }
          ]
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/policy-evaluation.json'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain('Policy evaluation summary');
    expect(lines).toContain('Safe: 1');
    expect(lines).toContain('Requires review: 0');
    expect(lines).toContain('Blocked: 1');
    expect(lines).toContain('Proposal proposal-1 → safe');
    expect(lines).toContain('Reason: strong evidence');
    expect(lines).toContain('Evidence signals: evidence_strength:high');

    logSpy.mockRestore();
  });

  it('fails deterministically when policy-apply-result artifact is missing', async () => {
    const repo = createRepo('playbook-cli-explain-policy-apply-result-missing');
    writeArchitectureRegistry(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, ['artifact', '.playbook/policy-apply-result.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'explain',
      target: 'artifact .playbook/policy-apply-result.json',
      error: 'playbook explain artifact: missing artifact ".playbook/policy-apply-result.json".'
    });

    logSpy.mockRestore();
  });

  it('explains policy-apply-result artifacts in JSON mode with deterministic ordering', async () => {
    const repo = createRepo('playbook-cli-explain-policy-apply-result-json');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'policy-apply-result.json'),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          kind: 'policy-apply-result',
          executed: [
            { proposal_id: 'proposal-z', decision: 'safe', reason: 'safe z' },
            { proposal_id: 'proposal-a', decision: 'safe', reason: 'safe a' }
          ],
          skipped_requires_review: [{ proposal_id: 'review-z', decision: 'requires_review', reason: 'review z' }],
          skipped_blocked: [{ proposal_id: 'blocked-a', decision: 'blocked', reason: 'blocked a' }],
          failed_execution: [{ proposal_id: 'fail-z', decision: 'safe', reason: 'safe but failed', error: 'deterministic failure' }],
          summary: { executed: 2, skipped_requires_review: 1, skipped_blocked: 1, failed_execution: 1, total: 5 }
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/policy-apply-result.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.explanation.policy_apply_result.summary).toEqual({
      executed: 2,
      skipped_requires_review: 1,
      skipped_blocked: 1,
      failed_execution: 1,
      total: 5
    });
    expect(payload.explanation.policy_apply_result.executed.map((entry: { proposal_id: string }) => entry.proposal_id)).toEqual([
      'proposal-a',
      'proposal-z'
    ]);

    logSpy.mockRestore();
  });

  it('renders policy-apply-result artifact summaries in text mode', async () => {
    const repo = createRepo('playbook-cli-explain-policy-apply-result-text');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'policy-apply-result.json'),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          kind: 'policy-apply-result',
          executed: [{ proposal_id: 'proposal-1', decision: 'safe', reason: 'safe' }],
          skipped_requires_review: [{ proposal_id: 'proposal-2', decision: 'requires_review', reason: 'needs review' }],
          skipped_blocked: [{ proposal_id: 'proposal-3', decision: 'blocked', reason: 'blocked' }],
          failed_execution: [],
          summary: { executed: 1, skipped_requires_review: 1, skipped_blocked: 1, failed_execution: 0, total: 3 }
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/policy-apply-result.json'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain('Execution result summary');
    expect(lines).toContain('Executed: 1');
    expect(lines).toContain('Skipped (requires review): 1');
    expect(lines).toContain('Skipped (blocked): 1');
    expect(lines).toContain('Failed execution: 0');
    expect(lines).toContain('Executed proposals:');
    expect(lines).toContain('- proposal-1');

    logSpy.mockRestore();
  });

  it('explains session evidence envelope artifact in json mode', async () => {
    const repo = createRepo('playbook-cli-explain-session-evidence-json');
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'session.json'),
      JSON.stringify(
        {
          version: 1,
          sessionId: 'session-abc',
          repoRoot: repo,
          activeGoal: 'trace evidence envelope',
          selectedRunId: 'run-123',
          pinnedArtifacts: [],
          currentStep: 'resume',
          unresolvedQuestions: [],
          constraints: [],
          lastUpdatedTime: '2026-01-01T00:00:00.000Z',
          evidenceEnvelope: {
            version: 1,
            session_id: 'session-abc',
            selected_run_id: 'run-123',
            cycle_id: 'cycle-1',
            generated_from_last_updated_time: '2026-01-01T00:00:00.000Z',
            artifacts: [{ path: '.playbook/session.json', kind: 'session', present: true }],
            proposal_ids: ['proposal-1'],
            policy_decisions: [{ proposal_id: 'proposal-1', decision: 'safe', reason: 'deterministic evidence', source: 'policy-evaluation' }],
            execution_result: {
              executed: ['proposal-1'],
              skipped_requires_review: [],
              skipped_blocked: [],
              failed_execution: []
            },
            lineage: [{ order: 1, stage: 'session', artifact: '.playbook/session.json', present: true }]
          }
        },
        null,
        2
      )
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runExplain(repo, ['artifact', '.playbook/session.json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.explanation.session_evidence_envelope.session_id).toBe('session-abc');
    expect(payload.explanation.session_evidence_envelope.proposal_ids).toEqual(['proposal-1']);
    expect(payload.explanation.session_evidence_envelope.lineage[0]).toEqual({
      order: 1,
      stage: 'session',
      artifact: '.playbook/session.json',
      present: true
    });

    logSpy.mockRestore();
  });


  it('fails when target argument is missing', async () => {
    const repo = createRepo('playbook-cli-explain-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runExplain(repo, [], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook explain: missing required <target> argument');

    errorSpy.mockRestore();
  });
});
