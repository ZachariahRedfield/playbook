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
    expect(result.reason).toContain('modular-monolith architecture');
    expect(result.context).toEqual({
      architecture: 'modular-monolith',
      framework: 'nextjs',
      modules: ['users', 'workouts']
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

  it('throws deterministic index errors when repository intelligence is missing', () => {
    const repo = createRepo('playbook-ask-engine-missing-index');

    expect(() => answerRepositoryQuestion(repo, 'what modules exist?')).toThrow(
      'playbook query: missing repository index at .playbook/repo-index.json. Run "playbook index" first.'
    );
  });
});
