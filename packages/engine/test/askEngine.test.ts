import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { answerRepositoryQuestion } from '../src/ask/askEngine.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const runGit = (repo: string, args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const initGitRepo = (repo: string): void => {
  runGit(repo, ['init']);
  runGit(repo, ['config', 'user.email', 'bot@example.com']);
  runGit(repo, ['config', 'user.name', 'Playbook Bot']);
  runGit(repo, ['checkout', '-b', 'main']);
};

const writeRepoIndex = (repo: string, payload: Record<string, unknown>): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2));
};

const writeModuleDigest = (repo: string, moduleName: string): void => {
  const digestPath = path.join(repo, '.playbook', 'context', 'modules', `${moduleName}.json`);
  fs.mkdirSync(path.dirname(digestPath), { recursive: true });
  fs.writeFileSync(
    digestPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'playbook-module-context-digest',
        generatedAt: '2026-01-01T00:00:00.000Z',
        module: { name: moduleName, path: `src/${moduleName}`, type: 'module' },
        files: { count: 1, representative: [] },
        dependencies: ['auth'],
        directDependents: [],
        dependents: [],
        rules: [],
        docs: [],
        tests: [],
        risk: { level: 'low', score: 0, signals: ['Low fan-in and limited transitive impact'] },
        graphNeighborhood: { nodeId: `module:${moduleName}`, outgoingKinds: ['depends_on', 'governed_by'], incomingKinds: ['contains'] },
        provenance: { indexArtifact: '.playbook/repo-index.json', graphArtifact: '.playbook/repo-graph.json' }
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

  fs.writeFileSync(
    path.join(memoryRoot, 'events', 'evt-001.json'),
    `${JSON.stringify(
      {
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
      },
      null,
      2
    )}\n`
  );

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

  fs.writeFileSync(
    path.join(memoryRoot, 'knowledge', 'patterns.json'),
    `${JSON.stringify(
      {
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
      },
      null,
      2
    )}\n`
  );

  for (const file of ['decisions.json', 'failure-modes.json', 'invariants.json']) {
    fs.writeFileSync(
      path.join(memoryRoot, 'knowledge', file),
      `${JSON.stringify({ schemaVersion: '1.0', artifact: 'memory-knowledge', kind: 'decision', generatedAt: '2026-01-03T00:00:00.000Z', entries: [] }, null, 2)}\n`
    );
  }
};

describe('answerRepositoryQuestion', () => {
  it('returns deterministic feature-location guidance for modular-monolith repos', () => {
    const repo = createRepo('playbook-ask-engine-feature');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'users', dependencies: [] },
        { name: 'workouts', dependencies: ['users'] }
      ],
      database: 'supabase',
      rules: ['requireNotesOnChanges']
    });

    const result = answerRepositoryQuestion(repo, 'where should a new feature live?');

    expect(result.answer).toBe('Recommended location: src/features/<feature>');
    expect(result.answerability.state).toBe('answered-from-trusted-artifact');
    expect(result.reason).toContain('modular-monolith architecture');
    expect(result.context).toEqual({
      architecture: 'modular-monolith',
      framework: 'nextjs',
      modules: ['users', 'workouts']
    });
  });

  it('answers preferred operating ladder from managed governance artifact', () => {
    const repo = createRepo('playbook-ask-engine-ladder');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'layered',
      modules: ['api'],
      database: 'postgres',
      rules: []
    });

    const result = answerRepositoryQuestion(repo, 'what is the preferred ai operating ladder?');

    expect(result.answerability).toEqual({
      state: 'artifact-missing',
      artifact: '.playbook/ai-contract.json'
    });
  });

  it('returns architecture from repository intelligence', () => {
    const repo = createRepo('playbook-ask-engine-architecture');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'layered',
      modules: ['api'],
      database: 'postgres',
      rules: []
    });

    const result = answerRepositoryQuestion(repo, 'what architecture does this repo use?');

    expect(result.answer).toBe('Architecture: layered');
    expect(result.context.architecture).toBe('layered');
  });

  it('returns module list from repository intelligence', () => {
    const repo = createRepo('playbook-ask-engine-modules');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'postgres',
      rules: []
    });

    const result = answerRepositoryQuestion(repo, 'what modules exist?');

    expect(result.answer).toBe('Modules: users, workouts');
  });

  it('returns module-scoped context when ask is scoped to a module', () => {
    const repo = createRepo('playbook-ask-engine-module-scope');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] }
      ],
      database: 'postgres',
      rules: []
    });

    const result = answerRepositoryQuestion(repo, 'how does this module work?', { module: 'module:workouts' });

    expect(result.answer).toContain('Module scope: workouts');
    expect(result.context.module?.module.name).toBe('workouts');
    expect(result.context.module?.impact.dependencies).toEqual(['auth']);
  });


  it('prefers module digest context when available for module-scoped questions', () => {
    const repo = createRepo('playbook-ask-engine-module-digest');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] }
      ],
      database: 'postgres',
      rules: []
    });
    writeModuleDigest(repo, 'workouts');

    const result = answerRepositoryQuestion(repo, 'how does this module work?', { module: 'workouts' });

    expect(result.answer).toContain('Graph neighborhood kinds');
    expect(result.answerability.artifact).toBe('.playbook/context/modules/workouts.json');
    expect(result.context.moduleDigest?.module.name).toBe('workouts');
  });

  it('fails deterministically when module scope is unknown', () => {
    const repo = createRepo('playbook-ask-engine-module-missing');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [{ name: 'auth', dependencies: [] }],
      database: 'postgres',
      rules: []
    });

    expect(() => answerRepositoryQuestion(repo, 'how does this module work?', { module: 'missing' })).toThrow(
      'playbook ask --module: unknown module "missing".'
    );
  });

  it('throws deterministic index errors when repository intelligence is missing', () => {
    const repo = createRepo('playbook-ask-engine-missing-index');

    expect(() => answerRepositoryQuestion(repo, 'what modules exist?')).toThrow(
      'playbook query: missing repository index at .playbook/repo-index.json. Run "playbook index" first.'
    );
  });

  it('keeps default ask behavior unchanged without memory opt-in', () => {
    const repo = createRepo('playbook-ask-engine-no-memory-opt-in');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'postgres',
      rules: []
    });
    writeMemoryFixtures(repo);

    const result = answerRepositoryQuestion(repo, 'what modules exist?');

    expect(result.context.knowledgeHits).toBeUndefined();
    expect((result.context as { memoryKnowledge?: unknown }).memoryKnowledge).toBeUndefined();
  });

  it('hydrates memory knowledge for repo-context only when opted in', () => {
    const repo = createRepo('playbook-ask-engine-repo-memory-opt-in');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
      database: 'postgres',
      rules: []
    });
    writeMemoryFixtures(repo);

    const result = answerRepositoryQuestion(repo, 'what do we know about workouts PB001 missing-tests patterns?', { withRepoContextMemory: true });
    const memoryKnowledge = (result.context as { memoryKnowledge?: Array<{ source: string; title: string; provenance: Array<{ event: unknown }> }> }).memoryKnowledge;

    expect(Array.isArray(result.context.knowledgeHits)).toBe(true);
    expect(memoryKnowledge?.length).toBe(1);
    expect(memoryKnowledge?.[0]?.source).toBe('promoted');
    expect(memoryKnowledge?.[0]?.title).toBe('Active workouts pattern');
    expect(memoryKnowledge?.[0]?.provenance?.[0]?.event).toBeTruthy();
  });

  it('hydrates memory knowledge for diff-context only when opted in', () => {
    const repo = createRepo('playbook-ask-engine-diff-memory-opt-in');
    initGitRepo(repo);
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'users', dependencies: [] },
        { name: 'workouts', dependencies: ['users'] }
      ],
      database: 'postgres',
      rules: []
    });
    writeMemoryFixtures(repo);
    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const result = answerRepositoryQuestion(repo, 'what modules are affected?', { withDiffContextMemory: true, diffContext: true });
    const memoryKnowledge = (result.context as { memoryKnowledge?: Array<{ source: string }> }).memoryKnowledge;

    expect(Array.isArray(result.context.knowledgeHits)).toBe(true);
    expect(memoryKnowledge?.[0]?.source).toBe('promoted');
  });
});
