import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrationRegistry } from './migrations.js';

describe('version policy migration', () => {
  const migration = migrationRegistry.find((entry) => entry.id === 'policy.version.lockstep-default');

  it('retrofits eligible repos without clobbering an existing custom policy', async () => {
    expect(migration).toBeDefined();
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-migration-'));
    try {
      fs.mkdirSync(path.join(repoRoot, 'packages', 'pkg-a'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
      fs.writeFileSync(
        path.join(repoRoot, 'package.json'),
        JSON.stringify({ private: true, packageManager: 'pnpm@9.0.0', devDependencies: { '@fawxzzy/playbook': '^0.1.8' } }, null, 2)
      );
      fs.writeFileSync(path.join(repoRoot, 'packages', 'pkg-a', 'package.json'), JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2));

      const check = await migration!.check({ repoRoot, toVersion: '0.1.8' });
      expect(check.needed).toBe(true);

      const applied = await migration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
      expect(applied.changed).toBe(true);

      const seededPolicy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.playbook', 'version-policy.json'), 'utf8')) as {
        enabled: boolean;
        groups: Array<{ packages: string[] }>;
      };
      expect(seededPolicy.enabled).toBe(true);
      expect(seededPolicy.groups[0]?.packages).toEqual(['packages/pkg-a']);

      fs.writeFileSync(
        path.join(repoRoot, '.playbook', 'version-policy.json'),
        JSON.stringify({ version: 1, enabled: false, optOutAllowed: true, defaultStrategy: 'lockstep', groups: [{ name: 'custom', strategy: 'lockstep', packages: ['custom/path'] }] }, null, 2) + '\n'
      );

      const secondCheck = await migration!.check({ repoRoot, toVersion: '0.1.8' });
      expect(secondCheck.needed).toBe(false);

      const secondApply = await migration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
      expect(secondApply.changed).toBe(false);

      const retainedPolicy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.playbook', 'version-policy.json'), 'utf8')) as {
        groups: Array<{ packages: string[] }>;
      };
      expect(retainedPolicy.groups[0]?.packages).toEqual(['custom/path']);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
