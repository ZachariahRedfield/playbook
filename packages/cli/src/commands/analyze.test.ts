import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { buildRepoIndex, runAnalyze } from './analyze.js';

const createFile = (filePath: string, content = ''): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

describe('analyze repository index', () => {
  it('builds a machine-readable repository index', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-analyze-index-'));
    createFile(path.join(repoRoot, 'package.json'), '{"name":"test"}\n');
    createFile(path.join(repoRoot, 'tsconfig.json'), '{"compilerOptions":{}}\n');
    createFile(path.join(repoRoot, 'ARCHITECTURE.md'), '# Architecture\n');
    createFile(path.join(repoRoot, 'CHANGELOG.md'), '# Changelog\n');
    createFile(path.join(repoRoot, 'src/features/workouts/index.ts'), '');
    createFile(path.join(repoRoot, 'src/features/users/index.ts'), '');
    createFile(path.join(repoRoot, 'src/shared/logger/index.ts'), '');

    const index = buildRepoIndex(repoRoot);

    expect(index.framework).toBe('node');
    expect(index.language).toBe('typescript');
    expect(index.modules).toEqual(['src/features/users', 'src/features/workouts']);
    expect(index.shared_modules).toEqual(['src/shared', 'src/shared/logger']);
    expect(index.docs).toEqual(['ARCHITECTURE.md', 'CHANGELOG.md']);
    expect(index.rules.length).toBeGreaterThan(0);
    expect(index.architecture).toEqual({
      features: ['users', 'workouts'],
      shared: ['logger', 'shared']
    });
  });

  it('writes .playbook/repo-index.json during analyze', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-analyze-run-'));
    createFile(path.join(cwd, 'package.json'), '{"name":"test","dependencies":{"next":"latest"}}\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyze(cwd, { ci: false, explain: false, format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);

    const outFile = path.join(cwd, '.playbook', 'repo-index.json');
    expect(fs.existsSync(outFile)).toBe(true);

    const payload = JSON.parse(fs.readFileSync(outFile, 'utf8')) as {
      framework: string;
      language: string;
      modules: string[];
      shared_modules: string[];
      docs: string[];
      rules: string[];
      architecture: {
        features: string[];
        shared: string[];
      };
    };

    expect(payload.framework).toBe('node');
    expect(typeof payload.language).toBe('string');
    expect(Array.isArray(payload.modules)).toBe(true);
    expect(Array.isArray(payload.shared_modules)).toBe(true);
    expect(Array.isArray(payload.docs)).toBe(true);
    expect(Array.isArray(payload.rules)).toBe(true);
    expect(Array.isArray(payload.architecture.features)).toBe(true);
    expect(Array.isArray(payload.architecture.shared)).toBe(true);

    logSpy.mockRestore();
  });
});
