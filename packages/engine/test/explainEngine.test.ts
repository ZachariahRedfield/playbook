import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { explainTarget } from '../src/explain/explainEngine.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeRepoIndex = (repo: string, payload: Record<string, unknown>): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2));
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
            name: 'routing_engine',
            purpose: 'Task classification and execution strategy',
            commands: ['route'],
            artifacts: ['.playbook/execution-plan.json'],
            downstream: ['orchestration_planner']
          },
          {
            name: 'orchestration_planner',
            purpose: 'Parallel work decomposition',
            commands: ['orchestrate'],
            artifacts: ['.playbook/workset-plan.json'],
            upstream: ['routing_engine']
          }
        ]
      },
      null,
      2
    )
  );
};

const writeMemoryFixtures = (repo: string): void => {
  const memoryRoot = path.join(repo, '.playbook', 'memory');
  fs.mkdirSync(path.join(memoryRoot, 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(memoryRoot, 'events'), { recursive: true });

  const event = {
    schemaVersion: '1.0',
    eventInstanceId: 'evt-001',
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    eventFingerprint: 'fp-evt-001',
    subjectModules: ['workouts'],
    ruleIds: ['PB001'],
    category: 'verify-finding',
    title: 'Workouts module missing tests',
    summary: 'PB001 surfaced missing tests in workouts',
    severity: 'high'
  };
  fs.writeFileSync(path.join(memoryRoot, 'events', 'evt-001.json'), `${JSON.stringify(event, null, 2)}\n`);

  fs.writeFileSync(
    path.join(memoryRoot, 'index.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0',
        generatedAt: '2026-01-01T00:00:00.000Z',
        eventsIndexed: 1,
        byModule: { workouts: ['events/evt-001.json'] },
        byRule: { PB001: ['events/evt-001.json'] },
        byFingerprint: { 'fp-evt-001': ['events/evt-001.json'] },
        latestEventAt: '2026-01-01T00:00:00.000Z'
      },
      null,
      2
    )}\n`
  );

  fs.writeFileSync(
    path.join(memoryRoot, 'candidates.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0',
        command: 'memory-replay',
        sourceIndex: '.playbook/memory/index.json',
        generatedAt: '2026-01-03T00:00:00.000Z',
        totalEvents: 1,
        clustersEvaluated: 1,
        candidates: [
          {
            candidateId: 'cand-workouts-stable',
            kind: 'pattern',
            title: 'Workouts test coverage drift',
            summary: 'Recurring test coverage drift in workouts module.',
            clusterKey: 'cluster-workouts',
            salienceScore: 0.8,
            salienceFactors: {
              severity: 0.7,
              recurrenceCount: 0.8,
              blastRadius: 0.6,
              crossModuleSpread: 0.2,
              ownershipDocsGap: 0.3,
              novelSuccessfulRemediationSignal: 0.5
            },
            fingerprint: 'fp-candidate-1',
            module: 'workouts',
            ruleId: 'PB001',
            failureShape: 'missing-tests',
            eventCount: 3,
            provenance: [
              {
                eventId: 'evt-001',
                sourcePath: 'events/evt-001.json',
                fingerprint: 'fp-evt-001',
                runId: 'run-1'
              }
            ],
            lastSeenAt: '2099-01-03T00:00:00.000Z',
            supersession: {
              evolutionOrdinal: 1,
              priorCandidateIds: [],
              supersedesCandidateIds: []
            }
          },
          {
            candidateId: 'cand-workouts-stale',
            kind: 'pattern',
            title: 'Stale candidate should be hidden',
            summary: 'Old candidate expected to be filtered out.',
            clusterKey: 'cluster-stale',
            salienceScore: 0.4,
            salienceFactors: {
              severity: 0.2,
              recurrenceCount: 0.2,
              blastRadius: 0.1,
              crossModuleSpread: 0.1,
              ownershipDocsGap: 0.1,
              novelSuccessfulRemediationSignal: 0.1
            },
            fingerprint: 'fp-candidate-stale',
            module: 'workouts',
            ruleId: 'PB001',
            failureShape: 'stale-shape',
            eventCount: 1,
            provenance: [
              {
                eventId: 'evt-001',
                sourcePath: 'events/evt-001.json',
                fingerprint: 'fp-evt-001',
                runId: 'run-1'
              }
            ],
            lastSeenAt: '2000-01-01T00:00:00.000Z',
            supersession: {
              evolutionOrdinal: 1,
              priorCandidateIds: [],
              supersedesCandidateIds: []
            }
          }
        ]
      },
      null,
      2
    )}\n`
  );

  const promotedPatternArtifact = {
    schemaVersion: '1.0',
    artifact: 'memory-knowledge',
    kind: 'pattern',
    generatedAt: '2026-01-03T00:00:00.000Z',
    entries: [
      {
        knowledgeId: 'k-workouts-active',
        candidateId: 'cand-workouts-stable',
        sourceCandidateIds: ['cand-workouts-stable'],
        sourceEventFingerprints: ['fp-evt-001'],
        kind: 'pattern',
        title: 'Active workouts pattern',
        summary: 'Promoted pattern for workouts reliability behavior.',
        fingerprint: 'fp-knowledge-active',
        module: 'workouts',
        ruleId: 'PB001',
        failureShape: 'missing-tests',
        promotedAt: '2026-01-04T00:00:00.000Z',
        provenance: [
          {
            eventId: 'evt-001',
            sourcePath: 'events/evt-001.json',
            fingerprint: 'fp-evt-001',
            runId: 'run-1'
          }
        ],
        status: 'active',
        supersedes: [],
        supersededBy: []
      },
      {
        knowledgeId: 'k-workouts-superseded',
        candidateId: 'cand-workouts-old',
        sourceCandidateIds: ['cand-workouts-old'],
        sourceEventFingerprints: ['fp-evt-001'],
        kind: 'pattern',
        title: 'Superseded workouts pattern',
        summary: 'This should be filtered out by default.',
        fingerprint: 'fp-knowledge-old',
        module: 'workouts',
        ruleId: 'PB001',
        failureShape: 'missing-tests',
        promotedAt: '2025-01-04T00:00:00.000Z',
        provenance: [
          {
            eventId: 'evt-001',
            sourcePath: 'events/evt-001.json',
            fingerprint: 'fp-evt-001',
            runId: 'run-1'
          }
        ],
        status: 'superseded',
        supersedes: [],
        supersededBy: ['k-workouts-active']
      }
    ]
  };

  fs.writeFileSync(path.join(memoryRoot, 'knowledge', 'patterns.json'), `${JSON.stringify(promotedPatternArtifact, null, 2)}\n`);

  for (const file of ['decisions.json', 'failure-modes.json', 'invariants.json']) {
    fs.writeFileSync(
      path.join(memoryRoot, 'knowledge', file),
      `${JSON.stringify({ schemaVersion: '1.0', artifact: 'memory-knowledge', kind: 'decision', generatedAt: '2026-01-03T00:00:00.000Z', entries: [] }, null, 2)}\n`
    );
  }
};

describe('explainTarget', () => {
  it('returns rule explanations from rule registry metadata', () => {
    const repo = createRepo('playbook-explain-engine-rule');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'supabase',
      rules: ['PB001']
    });

    const result = explainTarget(repo, 'PB001');

    expect(result.type).toBe('rule');
    expect(result).toMatchObject({
      type: 'rule',
      id: 'PB001'
    });
  });

  it('returns module explanations using indexed module list', () => {
    const repo = createRepo('playbook-explain-engine-module');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'supabase',
      rules: []
    });

    const result = explainTarget(repo, 'workouts');

    expect(result).toEqual({
      type: 'module',
      resolvedTarget: { input: 'workouts', kind: 'module', selector: 'workouts', canonical: 'module:workouts', matched: true },
      name: 'workouts',
      responsibilities: [
        'Owns workouts feature behavior and boundaries.',
        'Encapsulates workouts domain logic and module-level policies.'
      ],
      dependencies: [],
      architecture: 'modular-monolith'
    });
  });

  it('resolves explicit module:<name> targets for indexed modules', () => {
    const repo = createRepo('playbook-explain-engine-module-explicit');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'supabase',
      rules: []
    });

    const result = explainTarget(repo, 'module:workouts');

    expect(result.type).toBe('module');
    if (result.type === 'module') {
      expect(result.resolvedTarget).toEqual({
        input: 'module:workouts',
        kind: 'module',
        selector: 'workouts',
        canonical: 'module:workouts',
        matched: true
      });
      expect(result.name).toBe('workouts');
    }
  });

  it('returns architecture explanations from repository intelligence', () => {
    const repo = createRepo('playbook-explain-engine-architecture');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'supabase',
      rules: []
    });

    const result = explainTarget(repo, 'architecture');

    expect(result.type).toBe('architecture');
    if (result.type === 'architecture') {
      expect(result.reasoning).toContain('modular-monolith architecture organizes code into isolated feature modules under src/features.');
    }
  });

  it('returns unknown for unsupported targets', () => {
    const repo = createRepo('playbook-explain-engine-unknown');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'supabase',
      rules: []
    });

    const result = explainTarget(repo, 'payments');

    expect(result).toEqual({
      type: 'unknown',
      resolvedTarget: { input: 'payments', kind: 'unknown', selector: 'payments', canonical: 'payments', matched: false },
      target: 'payments',
      message: 'Unable to explain "payments" from repository intelligence. Try: playbook query modules | playbook rules.'
    });
  });

  it('keeps default explain behavior unchanged without withMemory option', () => {
    const repo = createRepo('playbook-explain-engine-no-memory-default');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['workouts'],
      database: 'supabase',
      rules: []
    });
    writeMemoryFixtures(repo);

    const result = explainTarget(repo, 'workouts');
    expect(result.type).toBe('module');
    expect(result).not.toHaveProperty('memoryKnowledge');
    expect(result).not.toHaveProperty('memorySummary');
  });

  it('adds promoted memory enrichment with provenance only when opt-in is enabled', () => {
    const repo = createRepo('playbook-explain-engine-memory-opt-in');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['workouts'],
      database: 'supabase',
      rules: ['PB001']
    });
    writeMemoryFixtures(repo);

    const result = explainTarget(repo, 'workouts', { withMemory: true });
    expect(result.type).toBe('module');
    if (result.type !== 'module') {
      return;
    }

    expect(result.memoryKnowledge?.promoted).toHaveLength(1);
    expect(result.memoryKnowledge?.promoted[0]).toMatchObject({
      knowledgeId: 'k-workouts-active',
      title: 'Active workouts pattern'
    });
    expect(result.memoryKnowledge?.promoted[0]?.provenance[0]?.event?.eventInstanceId).toBe('evt-001');

    expect(result.memoryKnowledge?.candidates).toHaveLength(1);
    expect(result.memoryKnowledge?.candidates[0]).toMatchObject({
      candidateId: 'cand-workouts-stable'
    });
  });

  it('returns deterministic memory ordering for the same repo and memory state', () => {
    const repo = createRepo('playbook-explain-engine-memory-deterministic');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['workouts'],
      database: 'supabase',
      rules: ['PB001']
    });
    writeMemoryFixtures(repo);

    const first = explainTarget(repo, 'workouts', { withMemory: true });
    const second = explainTarget(repo, 'workouts', { withMemory: true });

    expect(first).toEqual(second);
  });
  it('inspects known command ownership with deterministic JSON shape', () => {
    const repo = createRepo('playbook-explain-engine-command-known');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['workouts'],
      database: 'supabase',
      rules: []
    });
    writeArchitectureRegistry(repo);

    const result = explainTarget(repo, 'command route');
    expect(result.type).toBe('command');
    if (result.type !== 'command') return;

    expect(result).toEqual({
      type: 'command',
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
      ]
    });
  });


  it('keeps command ownership consistent with subsystem explain surface', () => {
    const repo = createRepo('playbook-explain-engine-command-consistency');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['workouts'],
      database: 'supabase',
      rules: []
    });
    writeArchitectureRegistry(repo);

    const commandResult = explainTarget(repo, 'command route');
    const subsystemResult = explainTarget(repo, 'subsystem routing_engine');

    expect(commandResult.type).toBe('command');
    expect(subsystemResult.type).toBe('subsystem');
    if (commandResult.type !== 'command' || subsystemResult.type !== 'subsystem') return;

    expect(commandResult.subsystemOwnership).toBe(subsystemResult.name);
  });

  it('fails deterministically for missing command lookup', () => {
    const repo = createRepo('playbook-explain-engine-command-missing');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['workouts'],
      database: 'supabase',
      rules: []
    });
    writeArchitectureRegistry(repo);

    expect(() => explainTarget(repo, 'command missing')).toThrowError('playbook explain command: unknown command "missing".');
  });

});
