import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolveTargetRepoRoot, stripGlobalRepoOption } from './repoRoot.js';

describe('stripGlobalRepoOption', () => {
  it('removes --repo before positional command dispatch', () => {
    const result = stripGlobalRepoOption(['--repo', '../fixture', 'query', 'modules', '--json']);

    expect(result.repo).toBe('../fixture');
    expect(result.args).toEqual(['query', 'modules', '--json']);
  });

  it('keeps command-scoped --repo options after the command token', () => {
    const result = stripGlobalRepoOption(['diagram', '--repo', '.', '--out', 'docs/diagram.md']);

    expect(result.repo).toBeUndefined();
    expect(result.args).toEqual(['diagram', '--repo', '.', '--out', 'docs/diagram.md']);
  });

  it('removes --repo before nested commands and preserves nested argv', () => {
    const result = stripGlobalRepoOption(['--repo', '../demo', 'query', 'modules']);

    expect(result.repo).toBe('../demo');
    expect(result.args).toEqual(['query', 'modules']);
  });

  it('leaves argv unchanged when --repo is not present', () => {
    const result = stripGlobalRepoOption(['verify']);

    expect(result.repo).toBeUndefined();
    expect(result.args).toEqual(['verify']);
  });
});

describe('resolveTargetRepoRoot', () => {
  it('returns a canonical absolute path when repo is provided', () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-repo-root-'));

    try {
      const resolved = resolveTargetRepoRoot('/workspace/playbook', fixtureRoot);
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(resolved).toBe(fs.realpathSync(fixtureRoot));
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });


  it('normalizes Windows absolute repo paths to WSL-style paths on non-Windows platforms', () => {
    const windowsPath = 'C:\\Users\\example\\project';
    const expectedRoot = process.platform === 'win32' ? windowsPath : '/mnt/c/Users/example/project';

    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((candidate) => String(candidate) === expectedRoot);
    const realpathSpy = vi.spyOn(fs, 'realpathSync').mockImplementation(() => expectedRoot);
    const statSpy = vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as fs.Stats);

    try {
      const resolved = resolveTargetRepoRoot('/workspace/playbook', windowsPath);
      expect(resolved).toBe(expectedRoot);
      expect(existsSpy).toHaveBeenCalledWith(expectedRoot);
    } finally {
      existsSpy.mockRestore();
      realpathSpy.mockRestore();
      statSpy.mockRestore();
    }
  });

});
