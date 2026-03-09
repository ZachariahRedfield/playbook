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
});
