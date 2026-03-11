import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { queryRepositoryIndex } from '../src/query/repoQuery.js';
import { queryDependencies } from '../src/query/dependencies.js';
import { queryImpact } from '../src/query/impact.js';
import { queryRisk } from '../src/query/risk.js';
import { queryDocsCoverage } from '../src/query/docsCoverage.js';
import { queryRuleOwners } from '../src/query/ruleOwners.js';
import { queryModuleOwners } from '../src/query/moduleOwners.js';
import { queryTestHotspots } from '../src/query/testHotspots.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeRepoIndex = (repo: string, payload: Record<string, unknown>): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2));
};


const writeModuleOwners = (repo: string, payload: Record<string, unknown>): void => {
  const ownersPath = path.join(repo, '.playbook', 'module-owners.json');
  fs.mkdirSync(path.dirname(ownersPath), { recursive: true });
  fs.writeFileSync(ownersPath, JSON.stringify(payload, null, 2));
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
      resolvedTarget: { input: 'workouts', kind: 'module', selector: 'workouts', canonical: 'module:workouts', matched: true },
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

    const workoutsImpact = queryImpact(repo, 'workouts');
    expect(workoutsImpact.query).toBe('impact');
    expect(workoutsImpact.target).toBe('workouts');
    expect(workoutsImpact.module).toEqual({ name: 'workouts', path: 'src/workouts', type: 'module' });
    expect(workoutsImpact.impact.dependencies).toEqual(['auth', 'db']);
    expect(workoutsImpact.impact.directDependents).toEqual(['analytics']);
    expect(workoutsImpact.impact.dependents).toEqual(['analytics']);
    expect(workoutsImpact.impact.docs).toEqual([]);
    expect(workoutsImpact.impact.rules).toEqual([]);

    const dbImpact = queryImpact(repo, 'db');
    expect(dbImpact.impact.dependencies).toEqual([]);
    expect(dbImpact.impact.directDependents).toEqual(['workouts']);
    expect(dbImpact.impact.dependents).toEqual(['analytics', 'workouts']);

    const analyticsImpact = queryImpact(repo, 'analytics');
    expect(analyticsImpact.impact.dependencies).toEqual(['workouts']);
    expect(analyticsImpact.impact.directDependents).toEqual([]);
    expect(analyticsImpact.impact.dependents).toEqual([]);
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
    expect(result.signals.dependents).toBe(0);
    expect(result.signals.transitiveImpact).toBe(0);
    expect(result.signals.verifyFailures).toBe(0);
    expect(result.warnings).toEqual([
      'Verify failure signal unavailable; no .playbook/verify-report.json, .playbook/verify.json, .playbook/findings.json, or .playbook/plan.json verify payload found.'
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



  it('degrades gracefully with deterministic warning when verify artifacts contain invalid JSON wrappers', () => {
    const repo = createRepo('playbook-repo-query-risk-corrupt-artifact');
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

    const verifyPath = path.join(repo, '.playbook', 'findings.json');
    fs.mkdirSync(path.dirname(verifyPath), { recursive: true });
    fs.writeFileSync(verifyPath, 'wrapper contamination\n{\n  "command": "verify"\n}\n', 'utf8');

    const result = queryRisk(repo, 'auth');

    expect(result.signals.verifyFailures).toBe(0);
    expect(result.warnings?.[0]).toContain('optional artifact');
    expect(result.warnings?.[0]).toContain('.playbook/findings.json');
    expect(result.warnings?.[0]).toContain('Regenerate artifacts with CLI-owned output flags');
  });


  it('degrades gracefully when verify artifacts contain UTF-16/BOM-like malformed content', () => {
    const repo = createRepo('playbook-repo-query-risk-corrupt-utf16');
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

    const verifyPath = path.join(repo, '.playbook', 'plan.json');
    fs.mkdirSync(path.dirname(verifyPath), { recursive: true });
    fs.writeFileSync(verifyPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"command":"plan"}', 'utf16le')]));

    const result = queryRisk(repo, 'auth');

    expect(result.signals.verifyFailures).toBe(0);
    expect(result.warnings?.[0]).toContain('.playbook/plan.json');
    expect(result.warnings?.[0]).toContain('optional artifact');
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



  it('returns deterministic test hotspot findings for broad retrieval patterns', () => {
    const repo = createRepo('playbook-repo-query-test-hotspots');
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

    const testFilePath = path.join(repo, 'packages', 'cli', 'src', 'commands', 'query.hotspot.test.ts');
    fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
    fs.writeFileSync(
      testFilePath,
      [
        "import { queryDependencies } from '@zachariahredfield/playbook-engine';",
        '',
        "it('detects broad retrieval', () => {",
        '  const dependencies = queryDependencies(repo);',
        "  const workouts = dependencies.dependencies.find((entry) => entry.name === 'workouts');",
        '  expect(workouts).toBeDefined();',
        '});'
      ].join('\n')
    );

    expect(queryTestHotspots(repo)).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'test-hotspots',
      hotspots: [
        {
          type: 'broad-retrieval',
          file: 'packages/cli/src/commands/query.hotspot.test.ts',
          line: 4,
          confidence: 'high',
          currentPattern:
            'const dependencies = queryDependencies(repo); followed by dependencies.dependencies.find/filter(...)',
          suggestedReplacementHelper: 'queryDependencies(<repo>, <module>)',
          automationSafety: 'safe-mechanical-refactor'
        }
      ],
      summary: {
        totalHotspots: 1,
        byType: [{ type: 'broad-retrieval', count: 1 }]
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



  it('returns rule owner mappings for all rules', () => {
    const result = queryRuleOwners();

    expect(result).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'rule-owners',
      rules: [
        {
          ruleId: 'notes.empty',
          area: 'governance',
          owners: ['governance'],
          remediationType: 'notes-maintenance'
        },
        {
          ruleId: 'notes.missing',
          area: 'governance',
          owners: ['governance'],
          remediationType: 'notes-maintenance'
        },
        {
          ruleId: 'PB001',
          area: 'documentation',
          owners: ['docs'],
          remediationType: 'docs-sync'
        },
        {
          ruleId: 'requireNotesOnChanges',
          area: 'governance',
          owners: ['governance'],
          remediationType: 'notes-maintenance'
        },
        {
          ruleId: 'verify.rule.tests.required',
          area: 'quality',
          owners: ['cli', 'testing'],
          remediationType: 'test-coverage'
        }
      ]
    });
  });

  it('returns a single rule ownership mapping', () => {
    expect(queryRuleOwners('PB001')).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'rule-owners',
      rule: {
        ruleId: 'PB001',
        area: 'documentation',
        owners: ['docs'],
        remediationType: 'docs-sync'
      }
    });
  });

  it('throws deterministic errors for unknown rule owner queries', () => {
    expect(() => queryRuleOwners('PB404')).toThrow('playbook query rule-owners: unknown rule "PB404".');
  });


  it('returns module owner mappings for all modules with deterministic fallback values', () => {
    const repo = createRepo('playbook-repo-query-module-owners-all');
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
    writeModuleOwners(repo, {
      workouts: { owners: ['fitness'], area: 'product' }
    });

    expect(queryModuleOwners(repo)).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: {
        minimumFields: ['owners', 'area', 'sourceLocation'],
        metadataPath: '.playbook/module-owners.json'
      },
      diagnostics: [
        'Some indexed modules are missing ownership mappings and are marked unresolved-mapping.',
        'Ownership metadata is configured without sourceLocation for one or more modules.'
      ],
      modules: [
        {
          name: 'auth',
          owners: [],
          area: 'unassigned',
          ownership: { status: 'unresolved-mapping', source: '.playbook/module-owners.json', sourceLocation: undefined }
        },
        {
          name: 'workouts',
          owners: ['fitness'],
          area: 'product',
          ownership: { status: 'configured', source: '.playbook/module-owners.json', sourceLocation: undefined }
        }
      ]
    });
  });

  it('returns a single module ownership mapping', () => {
    const repo = createRepo('playbook-repo-query-module-owners-single');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'workouts', dependencies: [] }
      ],
      database: 'none',
      rules: []
    });
    writeModuleOwners(repo, {
      workouts: { owners: ['fitness'], area: 'product' }
    });

    expect(queryModuleOwners(repo, 'workouts')).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: {
        minimumFields: ['owners', 'area', 'sourceLocation'],
        metadataPath: '.playbook/module-owners.json'
      },
      diagnostics: ['Ownership metadata is configured without sourceLocation for one or more modules.'],
      module: {
        name: 'workouts',
        owners: ['fitness'],
        area: 'product',
        ownership: { status: 'configured', source: '.playbook/module-owners.json', sourceLocation: undefined }
      }
    });
  });

  it('throws deterministic errors for unknown module owner queries', () => {
    const repo = createRepo('playbook-repo-query-module-owners-unknown');
    writeRepoIndex(repo, {
      schemaVersion: '1.0',
      framework: 'node',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [{ name: 'workouts', dependencies: [] }],
      database: 'none',
      rules: []
    });

    expect(() => queryModuleOwners(repo, 'missing')).toThrow('playbook query module-owners: unknown module "missing".');
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
