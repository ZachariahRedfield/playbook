import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { answerRepositoryQuestion } from '../src/ask/askEngine.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

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

describe('answerRepositoryQuestion', () => {
  it('returns deterministic feature-location guidance for modular-monolith repos', () => {
    const repo = createRepo('playbook-ask-engine-feature');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: ['users', 'workouts'],
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
});
