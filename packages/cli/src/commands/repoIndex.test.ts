import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runIndex } from './repoIndex.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeArchitectureRegistry = (repo: string): void => {
  const architecturePath = path.join(repo, '.playbook', 'architecture', 'subsystems.json');
  fs.mkdirSync(path.dirname(architecturePath), { recursive: true });
  fs.writeFileSync(
    architecturePath,
    JSON.stringify(
      {
        version: 1,
        subsystems: [
          {
            name: 'execution_supervisor',
            purpose: 'test fixture',
            commands: ['index'],
            artifacts: ['.playbook/session.json']
          }
        ]
      },
      null,
      2
    )
  );
};

describe('runIndex', () => {
  it('creates .playbook/repo-index.json and prints a JSON contract', async () => {
    const repo = createRepo('playbook-cli-index');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'features'), { recursive: true });
    writeArchitectureRegistry(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runIndex(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'index',
      ok: true,
      indexFile: '.playbook/repo-index.json',
      graphFile: '.playbook/repo-graph.json',
      systemMapFile: '.playbook/system-map.json',
      contextDir: '.playbook/context/modules',
      framework: 'node',
      architecture: 'modular-monolith',
      modules: ['features']
    });

    const indexFile = path.join(repo, '.playbook', 'repo-index.json');
    const graphFile = path.join(repo, '.playbook', 'repo-graph.json');
    const contextFile = path.join(repo, '.playbook', 'context', 'modules', 'features.json');
    const systemMapFile = path.join(repo, '.playbook', 'system-map.json');
    expect(fs.existsSync(indexFile)).toBe(true);
    expect(fs.existsSync(graphFile)).toBe(true);
    expect(fs.existsSync(systemMapFile)).toBe(true);
    expect(fs.existsSync(contextFile)).toBe(true);

    const indexPayload = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    const graphPayload = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
    expect(indexPayload.schemaVersion).toBe('1.0');
    expect(indexPayload.modules).toEqual([{ name: 'features', dependencies: [] }]);
    expect(graphPayload.kind).toBe('playbook-repo-graph');
    expect(graphPayload.stats.nodeCount).toBeGreaterThan(0);

    logSpy.mockRestore();
  });


  it('continues index generation when optional verify artifacts are malformed and reports deterministic warnings', async () => {
    const repo = createRepo('playbook-cli-index-corrupt-optional-artifacts');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'features', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'features', 'workouts'), { recursive: true });
    writeArchitectureRegistry(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'findings.json'), 'wrapper contamination\n{\n  "command": "verify"\n}\n', 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'plan.json'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"command":"plan"}', 'utf16le')]));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runIndex(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('index');
    expect(payload.ok).toBe(true);
    const contextFile = path.join(repo, '.playbook', 'context', 'modules', 'auth.json');
    expect(fs.existsSync(contextFile)).toBe(true);
    const contextPayload = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
    expect(Array.isArray(contextPayload.risk.signals)).toBe(true);
    expect(contextPayload.risk.signals.some((signal: string) => signal.includes('warning: playbook query risk: optional artifact'))).toBe(true);

    logSpy.mockRestore();
  });




  it('rewrites .playbook/system-map.json deterministically when index runs', async () => {
    const repo = createRepo('playbook-cli-index-system-map-refresh');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'features'), { recursive: true });
    writeArchitectureRegistry(repo);

    const artifactPath = path.join(repo, '.playbook', 'system-map.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify({ kind: 'stale' }, null, 2));

    const firstExitCode = await runIndex(repo, { format: 'json', quiet: false });
    expect(firstExitCode).toBe(ExitCode.Success);
    const firstArtifact = fs.readFileSync(artifactPath, 'utf8');

    const secondExitCode = await runIndex(repo, { format: 'json', quiet: false });
    expect(secondExitCode).toBe(ExitCode.Success);
    const secondArtifact = fs.readFileSync(artifactPath, 'utf8');

    expect(secondArtifact).toBe(firstArtifact);
    const parsed = JSON.parse(firstArtifact) as { kind: string; schemaVersion: string };
    expect(parsed.kind).toBe('system-map');
    expect(parsed.schemaVersion).toBe('1.0');
  });

  it('writes deterministic command JSON output with --out', async () => {
    const repo = createRepo('playbook-cli-index-out');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'features'), { recursive: true });
    writeArchitectureRegistry(repo);

    const outPath = path.join(repo, '.playbook', 'index-command-output.json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runIndex(repo, { format: 'json', quiet: false, outFile: outPath });

    expect(exitCode).toBe(ExitCode.Success);
    const stdoutPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const artifactPayload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(artifactPayload.data).toEqual(stdoutPayload);
    expect(typeof artifactPayload.checksum).toBe('string');
    expect(artifactPayload.version).toBe(1);

    logSpy.mockRestore();
  });

});

describe('command registry', () => {
  it('registers the index command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'index');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Generate machine-readable repository intelligence index');
  });
});
