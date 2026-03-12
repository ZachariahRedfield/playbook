import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runQuery } from './query.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

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
        modules: [
          { name: 'auth', dependencies: [] },
          { name: 'workouts', dependencies: ['auth'] },
          { name: 'analytics', dependencies: ['workouts'] }
        ],
        database: 'supabase',
        rules: ['requireNotesOnChanges']
      },
      null,
      2
    )
  );
};


const writeDocsCoverageFixtures = (repo: string): void => {
  fs.mkdirSync(path.join(repo, 'docs', 'modules'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs', 'ARCHITECTURE.md'), '# Architecture\n\n## Auth\nAuth module details\n');
  fs.writeFileSync(path.join(repo, 'docs', 'modules', 'workouts.md'), '# Workouts\nDetails\n');
};


const writeModuleOwners = (repo: string): void => {
  const ownersPath = path.join(repo, '.playbook', 'module-owners.json');
  fs.mkdirSync(path.dirname(ownersPath), { recursive: true });
  fs.writeFileSync(
    ownersPath,
    JSON.stringify(
      {
        workouts: { owners: ['fitness'], area: 'product' },
        analytics: { owners: ['data'], area: 'platform' }
      },
      null,
      2
    )
  );
};

const writeVerifyReport = (repo: string): void => {
  const verifyPath = path.join(repo, '.playbook', 'verify-report.json');
  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });
  fs.writeFileSync(
    verifyPath,
    JSON.stringify({
      schemaVersion: '1.0',
      command: 'verify',
      failures: [{ id: 'verify.failure.auth.config', message: 'auth module has policy gaps' }]
    })
  );
};

describe('runQuery', () => {
  it('prints text output for list fields', async () => {
    const repo = createRepo('playbook-cli-query-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual(['Modules', '───────', 'auth: none', 'workouts: auth', 'analytics: workouts']);

    logSpy.mockRestore();
  });

  it('prints JSON output contract', async () => {
    const repo = createRepo('playbook-cli-query-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'query',
      field: 'modules',
      result: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] },
        { name: 'analytics', dependencies: ['workouts'] }
      ]
    });

    logSpy.mockRestore();
  });



  it('writes deterministic query JSON output with --out', async () => {
    const repo = createRepo('playbook-cli-query-out');
    writeRepoIndex(repo);
    const outPath = path.join(repo, '.playbook', 'query-modules.json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'json', quiet: false, outFile: outPath });

    expect(exitCode).toBe(ExitCode.Success);
    const stdoutPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const artifactPayload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(artifactPayload.data).toEqual(stdoutPayload);
    expect(artifactPayload.artifact).toBe('playbook.artifact');
    expect(artifactPayload.version).toBe(1);
    expect(typeof artifactPayload.generated_at).toBe('string');
    expect(typeof artifactPayload.checksum).toBe('string');

    logSpy.mockRestore();
  });

  it('degrades risk query with deterministic corruption guidance when findings.json is invalid', async () => {
    const repo = createRepo('playbook-cli-query-risk-corrupt-artifact');
    writeRepoIndex(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'findings.json'), 'wrapper contamination\n{\n  "command": "verify"\n}', 'utf8');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.type).toBe('risk');
    expect(payload.signals.verifyFailures).toBe(0);
    expect(payload.warnings[0]).toContain('optional artifact');
    expect(payload.warnings[0]).toContain('Regenerate artifacts with CLI-owned output flags');

    logSpy.mockRestore();
  });

  it('degrades risk query when plan.json contains UTF-16/BOM-like malformed content', async () => {
    const repo = createRepo('playbook-cli-query-risk-corrupt-utf16');
    writeRepoIndex(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'plan.json'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"command":"plan"}', 'utf16le')]));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.warnings[0]).toContain('.playbook/plan.json');
    expect(payload.warnings[0]).toContain('optional artifact');

    logSpy.mockRestore();
  });


  it('prints dependency query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-dependencies');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['dependencies', 'workouts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'dependencies',
      module: 'workouts',
      resolvedTarget: { input: 'workouts', kind: 'module', selector: 'workouts', canonical: 'module:workouts', matched: true },
      dependencies: ['auth']
    });

    logSpy.mockRestore();
  });


  it('prints impact query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-impact');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.query).toBe('impact');
    expect(payload.target).toBe('auth');
    expect(payload.module).toEqual({ name: 'auth', path: 'src/auth', type: 'module' });
    expect(payload.impact.dependencies).toEqual([]);
    expect(payload.impact.directDependents).toEqual(['workouts']);
    expect(payload.impact.dependents).toEqual(['analytics', 'workouts']);

    logSpy.mockRestore();
  });

  it('prints impact query text output', async () => {
    const repo = createRepo('playbook-cli-query-impact-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'auth'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Impact Analysis',
      '───────────────',
      '',
      'Target module: auth',
      'Module path: src/auth',
      '',
      'Dependencies: none',
      'Direct dependents: workouts',
      'Transitive dependents: analytics, workouts',
      'Risk: medium (0.53)'
    ]);

    logSpy.mockRestore();
  });

  it('fails impact query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-impact-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query impact: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails impact query when module argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-impact-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query impact: missing required <module> argument');

    errorSpy.mockRestore();
  });




  it('prints rule-owners query JSON output for all rules', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-all');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
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

    logSpy.mockRestore();
  });

  it('prints rule-owners query JSON output for a single rule', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-single');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners', 'PB001'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
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

    logSpy.mockRestore();
  });

  it('prints rule-owners query text output for a single rule', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners', 'PB001'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Rule Ownership',
      '──────────────',
      '',
      'Rule: PB001',
      'Area: documentation',
      'Owners: docs',
      'Remediation type: docs-sync'
    ]);

    logSpy.mockRestore();
  });

  it('fails rule-owners query for unknown rules', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-unknown');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners', 'PB404'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query rule-owners: unknown rule "PB404".');

    errorSpy.mockRestore();
  });


  it('prints module-owners query JSON output for all modules', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-all');
    writeRepoIndex(repo);
    writeModuleOwners(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: { minimumFields: ['owners', 'area', 'sourceLocation'], metadataPath: '.playbook/module-owners.json' },
      diagnostics: [
        'Some indexed modules are missing ownership mappings and are marked unresolved-mapping.',
        'Ownership metadata is configured without sourceLocation for one or more modules.'
      ],
      modules: [
        { name: 'analytics', owners: ['data'], area: 'platform', ownership: { status: 'configured', source: '.playbook/module-owners.json' } },
        { name: 'auth', owners: [], area: 'unassigned', ownership: { status: 'unresolved-mapping', source: '.playbook/module-owners.json' } },
        { name: 'workouts', owners: ['fitness'], area: 'product', ownership: { status: 'configured', source: '.playbook/module-owners.json' } }
      ]
    });

    logSpy.mockRestore();
  });

  it('prints module-owners query JSON output for a single module', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-single');
    writeRepoIndex(repo);
    writeModuleOwners(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'workouts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: { minimumFields: ['owners', 'area', 'sourceLocation'], metadataPath: '.playbook/module-owners.json' },
      diagnostics: [
        'Some indexed modules are missing ownership mappings and are marked unresolved-mapping.',
        'Ownership metadata is configured without sourceLocation for one or more modules.'
      ],
      module: {
        name: 'workouts',
        owners: ['fitness'],
        area: 'product',
        ownership: { status: 'configured', source: '.playbook/module-owners.json' }
      }
    });

    logSpy.mockRestore();
  });

  it('prints module-owners query text output for a single module', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-text');
    writeRepoIndex(repo);
    writeModuleOwners(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'workouts'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Module Ownership',
      '────────────────',
      '',
      'Module: workouts',
      'Owners: fitness',
      'Area: product',
      'Ownership status: configured',
      'Ownership source: .playbook/module-owners.json'
    ]);

    logSpy.mockRestore();
  });

  it('falls back deterministically when ownership mapping is missing', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-fallback');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: { minimumFields: ['owners', 'area', 'sourceLocation'], metadataPath: '.playbook/module-owners.json' },
      diagnostics: ['No ownership metadata configured at .playbook/module-owners.json.'],
      module: {
        name: 'auth',
        owners: [],
        area: 'unassigned',
        ownership: { status: 'no-metadata-configured', source: 'generated-default' }
      }
    });

    logSpy.mockRestore();
  });

  it('fails module-owners query for unknown modules', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-unknown');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query module-owners: unknown module "missing".');

    errorSpy.mockRestore();
  });



  it('prints test-hotspots query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-test-hotspots-json');
    writeRepoIndex(repo);
    const hotspotFixturePath = path.join(repo, 'packages', 'cli', 'src', 'commands', 'query.hotspot.test.ts');
    fs.mkdirSync(path.dirname(hotspotFixturePath), { recursive: true });
    fs.writeFileSync(
      hotspotFixturePath,
      [
        "import { queryDependencies } from '@zachariahredfield/playbook-engine';",
        '',
        "it('uses broad retrieval', () => {",
        '  const dependencies = queryDependencies(repo);',
        "  const workouts = dependencies.dependencies.find((entry) => entry.name === 'workouts');",
        '  expect(workouts).toBeDefined();',
        '});'
      ].join('\n')
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['test-hotspots'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
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

    logSpy.mockRestore();
  });

  it('prints test-hotspots query text output', async () => {
    const repo = createRepo('playbook-cli-query-test-hotspots-text');
    writeRepoIndex(repo);
    const hotspotFixturePath = path.join(repo, 'packages', 'cli', 'src', 'commands', 'query.hotspot.test.ts');
    fs.mkdirSync(path.dirname(hotspotFixturePath), { recursive: true });
    fs.writeFileSync(
      hotspotFixturePath,
      [
        "import { queryDependencies } from '@zachariahredfield/playbook-engine';",
        '',
        "it('uses broad retrieval', () => {",
        '  const dependencies = queryDependencies(repo);',
        "  const workouts = dependencies.dependencies.find((entry) => entry.name === 'workouts');",
        '  expect(workouts).toBeDefined();',
        '});'
      ].join('\n')
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['test-hotspots'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Test Hotspots',
      '─────────────',
      '',
      'packages/cli/src/commands/query.hotspot.test.ts:4',
      '  Type: broad-retrieval',
      '  Confidence: high',
      '  Current pattern: const dependencies = queryDependencies(repo); followed by dependencies.dependencies.find/filter(...)',
      '  Suggested helper: queryDependencies(<repo>, <module>)',
      '  Automation safety: safe-mechanical-refactor',
      '',
      'Summary',
      '  Total hotspots: 1',
      '  broad-retrieval: 1'
    ]);

    logSpy.mockRestore();
  });
  it('prints risk query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-risk');
    writeRepoIndex(repo);
    writeVerifyReport(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      schemaVersion: '1.0',
      command: 'query',
      type: 'risk',
      module: 'auth',
      riskLevel: 'medium',
      signals: {
        directDependencies: 0,
        dependents: 1,
        transitiveImpact: 2,
        verifyFailures: 1,
        isArchitecturalHub: false
      }
    });

    logSpy.mockRestore();
  });

  it('prints risk query text output', async () => {
    const repo = createRepo('playbook-cli-query-risk-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toContain('Risk Analysis');
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toContain('Module: auth');

    logSpy.mockRestore();
  });

  it('fails risk query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-risk-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query risk: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('prints docs-coverage query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-docs-coverage-json');
    writeRepoIndex(repo);
    writeDocsCoverageFixtures(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs-coverage'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
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

    logSpy.mockRestore();
  });

  it('prints docs-coverage query text output', async () => {
    const repo = createRepo('playbook-cli-query-docs-coverage-text');
    writeRepoIndex(repo);
    writeDocsCoverageFixtures(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs-coverage'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Documentation Coverage',
      '──────────────────────',
      '',
      'Documented modules',
      '  auth',
      '  workouts',
      '',
      'Undocumented modules',
      '  analytics',
      '',
      'Summary',
      '  2 / 3 modules documented'
    ]);

    logSpy.mockRestore();
  });

  it('fails docs-coverage query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-docs-coverage-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs-coverage', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query docs-coverage: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails risk query when module argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-risk-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query risk: missing required <module> argument');

    errorSpy.mockRestore();
  });

  it('fails dependency query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-dependencies-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['dependencies', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query dependencies: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails with clear error for unsupported fields', async () => {
    const repo = createRepo('playbook-cli-query-unsupported');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith(
      'playbook query: unsupported field "docs". Supported fields: architecture, framework, language, modules, database, rules.'
    );

    errorSpy.mockRestore();
  });

  it('fails when required field argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, [], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query: missing required <field> argument');

    errorSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the query command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'query');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Query machine-readable repository intelligence from .playbook/repo-index.json');
  });
});
