import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInit } from './init.js';

describe('runInit', () => {
  it('seeds version policy for publishable pnpm workspace repos', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-init-'));
    try {
      fs.mkdirSync(path.join(repoRoot, 'packages', 'pkg-a'), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, 'packages', 'pkg-b'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
      fs.writeFileSync(
        path.join(repoRoot, 'package.json'),
        JSON.stringify({ name: 'repo-root', private: true, packageManager: 'pnpm@9.0.0' }, null, 2)
      );
      fs.writeFileSync(path.join(repoRoot, 'packages', 'pkg-a', 'package.json'), JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2));
      fs.writeFileSync(path.join(repoRoot, 'packages', 'pkg-b', 'package.json'), JSON.stringify({ name: 'pkg-b', version: '1.0.0' }, null, 2));

      const exitCode = runInit(repoRoot, { format: 'json', quiet: false, ci: false, force: false, help: false });

      expect(exitCode).toBe(0);
      const versionPolicy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.playbook', 'version-policy.json'), 'utf8')) as {
        enabled: boolean;
        groups: Array<{ name: string; strategy: string; packages: string[] }>;
      };
      expect(versionPolicy.enabled).toBe(true);
      expect(versionPolicy.groups).toEqual([
        {
          name: 'default',
          strategy: 'lockstep',
          packages: ['packages/pkg-a', 'packages/pkg-b']
        }
      ]);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
