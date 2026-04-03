import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRepositoryIndex } from '../src/indexer/repoIndexer.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe('generateRepositoryIndex', () => {
  it('builds deterministic repository intelligence from simple heuristics', () => {
    const repo = createRepo('playbook-repo-index');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2.0.0' } }, null, 2));
    fs.writeFileSync(path.join(repo, 'next.config.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(repo, 'tsconfig.json'), '{}');
    fs.mkdirSync(path.join(repo, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'api', 'index.ts'), "import { card } from '../ui/card';\nexport const api = card;\n");

    const index = generateRepositoryIndex(repo);

    expect(index).toEqual({
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'api', dependencies: ['ui'] },
        { name: 'ui', dependencies: [] }
      ],
      dependencies: [],
      workspace: [],
      tests: [
        { module: 'api', tests_present: false, coverage_estimate: 'unknown' },
        { module: 'ui', tests_present: false, coverage_estimate: 'unknown' }
      ],
      configs: expect.arrayContaining([
        expect.objectContaining({ name: 'tsconfig', path: 'tsconfig.json', present: true }),
        expect.objectContaining({ name: 'command-inventory', path: 'package.json#scripts' })
      ]),
      database: 'supabase',
      rules: expect.arrayContaining([
        'protected-doc.governance',
        'release.version-governance',
        'requireNotesFileWhenGovernanceExists',
        'requireNotesOnChanges',
        'verify.rule.tests.required'
      ]),
      architectureRoleInference: {
        classificationMode: 'observation-only',
        classifierVersion: 'role-heuristic-v1',
        policyEnforcement: 'none',
        dependencyMatrix: {
          interface: ['foundation', 'adapter'],
          orchestration: ['interface', 'foundation', 'adapter'],
          foundation: ['foundation'],
          adapter: ['interface', 'foundation']
        },
        nodes: [],
        dependencyObservations: []
      }
    });

    expect(index.rules).toEqual([...index.rules].sort((left, right) => left.localeCompare(right)));
    expect(new Set(index.rules).size).toBe(index.rules.length);
  });

  it('indexes src/features/* directories as first-class modules for modular-monolith repos', () => {
    const repo = createRepo('playbook-repo-index-features');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.writeFileSync(path.join(repo, 'playbook.config.json'), JSON.stringify({ architecture: 'modular-monolith' }, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'features', 'users'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'features', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'features', 'users', 'index.ts'), "export const users = true;\n");
    fs.writeFileSync(
      path.join(repo, 'src', 'features', 'workouts', 'index.ts'),
      "import { users } from '@/features/users';\nexport const workouts = users;\n"
    );

    const index = generateRepositoryIndex(repo);

    expect(index.modules).toEqual([
      { name: 'users', dependencies: [] },
      { name: 'workouts', dependencies: ['users'] }
    ]);
  });

  it('falls back to src/* module detection when src/features/* is absent', () => {
    const repo = createRepo('playbook-repo-index-fallback');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.writeFileSync(path.join(repo, 'playbook.config.json'), JSON.stringify({ architecture: 'modular-monolith' }, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'api', 'index.ts'), "import { ui } from '../ui';\nexport const api = ui;\n");
    fs.writeFileSync(path.join(repo, 'src', 'ui', 'index.ts'), 'export const ui = true;\n');

    const index = generateRepositoryIndex(repo);

    expect(index.modules).toEqual([
      { name: 'api', dependencies: ['ui'] },
      { name: 'ui', dependencies: [] }
    ]);
  });

  it('respects architecture override from playbook config', () => {
    const repo = createRepo('playbook-repo-index-architecture');
    fs.writeFileSync(path.join(repo, 'playbook.config.json'), JSON.stringify({ architecture: 'microservices' }, null, 2));

    const index = generateRepositoryIndex(repo);

    expect(index.architecture).toBe('microservices');
  });

  it('respects .playbookignore when scanning source modules', () => {
    const repo = createRepo('playbook-repo-index-ignore');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'generated'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbookignore'), 'src/generated\n');
    fs.writeFileSync(path.join(repo, 'src', 'api', 'index.ts'), "export const api = true;\n");
    fs.writeFileSync(path.join(repo, 'src', 'generated', 'index.ts'), "export const generated = true;\n");

    const index = generateRepositoryIndex(repo);

    expect(index.modules).toEqual([{ name: 'api', dependencies: [] }]);
  });

  it('respects .playbookignore when scanning feature modules and module files', () => {
    const repo = createRepo('playbook-repo-index-feature-ignore');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'features', 'users'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'features', 'workouts'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'features', 'generated'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbookignore'), 'src/features/generated\nsrc/features/workouts/internal\n');
    fs.writeFileSync(path.join(repo, 'src', 'features', 'users', 'index.ts'), 'export const users = true;\n');
    fs.mkdirSync(path.join(repo, 'src', 'features', 'workouts', 'internal'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'features', 'workouts', 'internal', 'secret.ts'), "import { users } from '@/features/users';\n");
    fs.writeFileSync(path.join(repo, 'src', 'features', 'workouts', 'index.ts'), 'export const workouts = true;\n');

    const index = generateRepositoryIndex(repo);

    expect(index.modules).toEqual([
      { name: 'users', dependencies: [] },
      { name: 'workouts', dependencies: [] }
    ]);
  });

  it('extracts workspace topology, dependency edges, tests, and config surface for monorepos', () => {
    const repo = createRepo('playbook-repo-index-monorepo');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
      private: true,
      workspaces: ['packages/*'],
      scripts: { build: 'pnpm -r build', test: 'vitest' }
    }, null, 2));
    fs.writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    fs.writeFileSync(path.join(repo, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(repo, 'vitest.config.ts'), 'export default {};\n');
    fs.mkdirSync(path.join(repo, 'packages', 'engine', 'src'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'packages', 'engine', 'tests'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'packages', 'core', 'src'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'packages', 'engine', 'package.json'), JSON.stringify({
      name: '@acme/engine',
      dependencies: { '@acme/core': '^1.0.0' }
    }, null, 2));
    fs.writeFileSync(path.join(repo, 'packages', 'core', 'package.json'), JSON.stringify({ name: '@acme/core' }, null, 2));
    fs.writeFileSync(path.join(repo, 'packages', 'engine', 'src', 'index.ts'), "import { core } from '@acme/core';\nexport const engine = core;\n");

    const index = generateRepositoryIndex(repo);

    expect(index.workspace).toEqual([
      { name: '@acme/core', path: 'packages/core', role: 'core', dependsOn: [] },
      { name: '@acme/engine', path: 'packages/engine', role: 'engine', dependsOn: ['@acme/core'] }
    ]);
    expect(index.architectureRoleInference).toEqual({
      classificationMode: 'observation-only',
      classifierVersion: 'role-heuristic-v1',
      policyEnforcement: 'none',
      dependencyMatrix: {
        interface: ['foundation', 'adapter'],
        orchestration: ['interface', 'foundation', 'adapter'],
        foundation: ['foundation'],
        adapter: ['interface', 'foundation']
      },
      nodes: [
        { workspace: '@acme/core', inferredRole: 'foundation', evidence: ['workspace-role:core'] },
        { workspace: '@acme/engine', inferredRole: 'orchestration', evidence: ['workspace-role:engine'] }
      ],
      dependencyObservations: [
        {
          from: '@acme/engine',
          to: '@acme/core',
          fromRole: 'orchestration',
          toRole: 'foundation',
          status: 'allowed'
        }
      ]
    });
    expect(index.dependencies).toEqual([
      { from: '@acme/engine', to: '@acme/core', type: 'source-import' },
      { from: '@acme/engine', to: '@acme/core', type: 'workspace-manifest' }
    ]);
    expect(index.tests).toEqual([
      { module: '@acme/core', tests_present: false, coverage_estimate: 'unknown' },
      { module: '@acme/engine', tests_present: true, coverage_estimate: 'unknown' }
    ]);
    expect(index.configs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'tsconfig', path: 'tsconfig.json', present: true }),
      expect.objectContaining({ name: 'vitest', path: 'vitest.config.ts', present: true }),
      expect.objectContaining({ name: 'command-inventory', commands: ['build', 'test'] })
    ]));
  });

  it('classifies package workspaces deterministically and reports out-of-direction observations without enforcement', () => {
    const repo = createRepo('playbook-repo-index-role-inference');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
      private: true,
      workspaces: ['packages/*']
    }, null, 2));
    fs.writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    fs.mkdirSync(path.join(repo, 'packages', 'foundation-lib'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'packages', 'api'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'packages', 'sdk-adapter'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'packages', 'foundation-lib', 'package.json'), JSON.stringify({
      name: '@acme/foundation-lib',
      dependencies: { '@acme/api': '^1.0.0' }
    }, null, 2));
    fs.writeFileSync(path.join(repo, 'packages', 'api', 'package.json'), JSON.stringify({ name: '@acme/api' }, null, 2));
    fs.writeFileSync(path.join(repo, 'packages', 'sdk-adapter', 'package.json'), JSON.stringify({
      name: '@acme/sdk-adapter',
      dependencies: { '@acme/foundation-lib': '^1.0.0' }
    }, null, 2));

    const index = generateRepositoryIndex(repo);

    expect(index.architectureRoleInference.nodes).toEqual([
      { workspace: '@acme/api', inferredRole: 'interface', evidence: ['name-heuristic:interface'] },
      { workspace: '@acme/foundation-lib', inferredRole: 'foundation', evidence: ['name-heuristic:foundation'] },
      { workspace: '@acme/sdk-adapter', inferredRole: 'adapter', evidence: ['name-heuristic:adapter'] }
    ]);
    expect(index.architectureRoleInference.dependencyObservations).toEqual([
      {
        from: '@acme/foundation-lib',
        to: '@acme/api',
        fromRole: 'foundation',
        toRole: 'interface',
        status: 'out_of_direction'
      },
      {
        from: '@acme/sdk-adapter',
        to: '@acme/foundation-lib',
        fromRole: 'adapter',
        toRole: 'foundation',
        status: 'allowed'
      }
    ]);
    expect(index.architectureRoleInference.policyEnforcement).toBe('none');
  });
});
