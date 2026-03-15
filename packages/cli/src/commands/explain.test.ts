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
            commands: ['execute'],
            artifacts: ['.playbook/execution-state.json'],
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
