import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
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
});
