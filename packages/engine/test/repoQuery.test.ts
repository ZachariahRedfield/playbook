import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { queryRepositoryIndex } from '../src/query/repoQuery.js';
import { queryDependencies } from '../src/query/dependencies.js';
import { queryImpact } from '../src/query/impact.js';
import { queryRisk } from '../src/query/risk.js';
import { queryDocsCoverage } from '../src/query/docsCoverage.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeRepoIndex = (repo: string, payload: Record<string, unknown>): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2));
};

describe('queryRepositoryIndex', () => {
  it('reads .playbook/repo-index.json and returns requested fields', () => {
    const repo = createRepo('playbook-repo-query');
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

    expect(queryRepositoryIndex(repo, 'architecture')).toEqual({ field: 'architecture', result: 'modular-monolith' });
    expect(queryRepositoryIndex(repo, 'modules')).toEqual({
      field: 'modules',
      result: [
        { name: 'users', dependencies: [] },
        { name: 'workouts', dependencies: ['users'] }
      ]
    });
  });

  it('normalizes natural language query field requests to supported fields', () => {
    const repo = createRepo('playbook-repo-query-natural-language');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [{ name: 'api', dependencies: [] }],
      database: 'none',
      rules: ['notes.missing']
    });

    expect(queryRepositoryIndex(repo, 'list modules')).toEqual({ field: 'modules', result: [{ name: 'api', dependencies: [] }] });
  });

  it('returns dependencies query payloads', () => {
    const repo = createRepo('playbook-repo-query-dependencies');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] }
      ],
      database: 'none',
      rules: []
    });

    expect(queryDependencies(repo)).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'dependencies',
      module: null,
      dependencies: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] }
      ]
    });

    expect(queryDependencies(repo, 'workouts')).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'dependencies',
      module: 'workouts',
      dependencies: ['auth']
    });
  });


  it('returns impact query payloads including transitive dependents', () => {
    const repo = createRepo('playbook-repo-query-impact');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'db', dependencies: [] },
        { name: 'workouts', dependencies: ['auth', 'db'] },
        { name: 'analytics', dependencies: ['workouts'] }
      ],
      database: 'none',
      rules: []
    });

    expect(queryImpact(repo, 'workouts')).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'impact',
      module: 'workouts',
      affectedModules: ['analytics']
    });

    expect(queryImpact(repo, 'db')).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'impact',
      module: 'db',
      affectedModules: ['workouts', 'analytics']
    });

    expect(queryImpact(repo, 'analytics')).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'impact',
      module: 'analytics',
      affectedModules: []
    });
  });



  it('returns low risk payloads for isolated modules', () => {
    const repo = createRepo('playbook-repo-query-risk-low');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] },
        { name: 'billing', dependencies: [] }
      ],
      database: 'none',
      rules: []
    });

    const result = queryRisk(repo, 'billing');

    expect(result.module).toBe('billing');
    expect(result.riskLevel).toBe('low');
    expect(result.signals.dependents).toBe(0);
    expect(result.signals.transitiveImpact).toBe(0);
    expect(result.signals.verifyFailures).toBe(0);
    expect(result.warnings).toEqual([
      'Verify failure signal unavailable; no .playbook/verify-report.json, .playbook/verify.json, or .playbook/plan.json verify payload found.'
    ]);
  });

  it('returns high risk payloads for architectural hubs with verify failures', () => {
    const repo = createRepo('playbook-repo-query-risk-high');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] },
        { name: 'analytics', dependencies: ['auth'] },
        { name: 'billing', dependencies: ['auth'] },
        { name: 'notifications', dependencies: ['workouts'] }
      ],
      database: 'none',
      rules: []
    });

    const verifyPath = path.join(repo, '.playbook', 'verify-report.json');
    fs.writeFileSync(
      verifyPath,
      JSON.stringify({
        schemaVersion: '1.0',
        command: 'verify',
        failures: [
          { id: 'verify.failure.auth.config', message: 'auth module has policy gaps' },
          { id: 'verify.failure.auth.routes', message: 'auth routes are missing notes' }
        ]
      })
    );

    const result = queryRisk(repo, 'auth');

    expect(result.riskLevel).toBe('high');
    expect(result.signals.isArchitecturalHub).toBe(true);
    expect(result.signals.verifyFailures).toBe(2);
    expect(result.reasons).toContain('High reverse dependency fan-in');
    expect(result.reasons).toContain('Large transitive impact radius');
    expect(result.reasons).toContain('Active verify failures associated with this module');
  });


  it('returns docs coverage for mixed documentation states', () => {
    const repo = createRepo('playbook-repo-query-docs-coverage');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] },
        { name: 'analytics', dependencies: ['workouts'] }
      ],
      database: 'none',
      rules: []
    });

    fs.mkdirSync(path.join(repo, 'docs', 'modules'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'ARCHITECTURE.md'), '# Architecture\n\n## Auth\nAuth module owns access control.\n');
    fs.writeFileSync(path.join(repo, 'docs', 'modules', 'workouts.md'), '# Workouts\nDetails\n');

    expect(queryDocsCoverage(repo)).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'docs-coverage',
      modules: [
        { module: 'analytics', documented: false, sources: [] },
        { module: 'auth', documented: true, sources: ['docs/ARCHITECTURE.md'] },
        { module: 'workouts', documented: true, sources: ['docs/modules/workouts.md'] }
      ],
      summary: {
        totalModules: 3,
        documentedModules: 2,
        undocumentedModules: 1
      }
    });
  });

  it('returns docs coverage for a specific module', () => {
    const repo = createRepo('playbook-repo-query-docs-coverage-single');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] }
      ],
      database: 'none',
      rules: []
    });

    fs.mkdirSync(path.join(repo, 'docs', 'modules'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'modules', 'workouts.md'), '# Workouts\nDetails\n');

    expect(queryDocsCoverage(repo, 'workouts')).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'docs-coverage',
      modules: [{ module: 'workouts', documented: true, sources: ['docs/modules/workouts.md'] }],
      summary: {
        totalModules: 1,
        documentedModules: 1,
        undocumentedModules: 0
      }
    });
  });

  it('throws deterministic errors for unsupported fields', () => {
    const repo = createRepo('playbook-repo-query-unsupported-field');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'javascript',
      architecture: 'modular-monolith',
      modules: [],
      database: 'none',
      rules: []
    });

    expect(() => queryRepositoryIndex(repo, 'docs')).toThrow(
      'playbook query: unsupported field "docs". Supported fields: architecture, framework, language, modules, database, rules.'
    );
  });

  it('throws deterministic errors for unknown dependency modules', () => {
    const repo = createRepo('playbook-repo-query-unknown-module');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'javascript',
      architecture: 'modular-monolith',
      modules: [{ name: 'api', dependencies: [] }],
      database: 'none',
      rules: []
    });

    expect(() => queryDependencies(repo, 'worker')).toThrow('playbook query dependencies: unknown module "worker".');
    expect(() => queryImpact(repo, 'worker')).toThrow('playbook query impact: unknown module "worker".');
    expect(() => queryRisk(repo, 'worker')).toThrow('playbook query risk: unknown module "worker".');
    expect(() => queryDocsCoverage(repo, 'worker')).toThrow('playbook query docs-coverage: unknown module "worker".');
  });

  it('throws deterministic errors when index file is missing', () => {
    const repo = createRepo('playbook-repo-query-missing-index');

    expect(() => queryRepositoryIndex(repo, 'modules')).toThrow(
      'playbook query: missing repository index at .playbook/repo-index.json. Run "playbook index" first.'
    );
  });

  it('throws deterministic errors for unsupported schema version', () => {
    const repo = createRepo('playbook-repo-query-invalid-schema');
    writeRepoIndex(repo, {
      schemaVersion: '2.0',
      framework: 'node',
      language: 'javascript',
      architecture: 'modular-monolith',
      modules: [],
      database: 'none',
      rules: []
    });

    expect(() => queryRepositoryIndex(repo, 'modules')).toThrow(
      'playbook query: unsupported repository index schemaVersion "2.0". Expected "1.0".'
    );
  });
});
