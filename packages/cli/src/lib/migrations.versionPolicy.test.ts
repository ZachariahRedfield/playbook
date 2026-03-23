import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrationRegistry } from './migrations.js';

describe('release governance migrations', () => {
  const manifestMigration = migrationRegistry.find((entry) => entry.id === 'contract.managed-surface-manifest.installable');
  const versionPolicyMigration = migrationRegistry.find((entry) => entry.id === 'policy.version.lockstep-default');
  const workflowMigration = migrationRegistry.find((entry) => entry.id === 'workflow.release-prep.installable');
  const changelogMigration = migrationRegistry.find((entry) => entry.id === 'docs.changelog.release-notes-seam');


  it('seeds the managed surface manifest contract for installable repos', async () => {
    expect(manifestMigration).toBeDefined();
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-managed-surface-'));
    try {
      const check = await manifestMigration!.check({ repoRoot, toVersion: '0.1.8' });
      expect(check.needed).toBe(true);
      expect(check.safeToAutoApply).toBe(true);

      const applied = await manifestMigration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
      expect(applied.changed).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, '.playbook', 'managed-surfaces.json'), 'utf8')) as {
        kind: string;
        entries: Array<{ path: string; category: string }>;
      };
      expect(manifest.kind).toBe('playbook-managed-surface-manifest');
      expect(manifest.entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '.playbook/**', category: 'managed_by_playbook' }),
        expect.objectContaining({ path: 'AGENTS.md', category: 'repo_local_protected' })
      ]));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('retrofits eligible repos without clobbering an existing custom policy', async () => {
    expect(versionPolicyMigration).toBeDefined();
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

      const check = await versionPolicyMigration!.check({ repoRoot, toVersion: '0.1.8' });
      expect(check.needed).toBe(true);

      const applied = await versionPolicyMigration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
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

      const secondCheck = await versionPolicyMigration!.check({ repoRoot, toVersion: '0.1.8' });
      expect(secondCheck.needed).toBe(false);

      const secondApply = await versionPolicyMigration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
      expect(secondApply.changed).toBe(false);

      const retainedPolicy = JSON.parse(fs.readFileSync(path.join(repoRoot, '.playbook', 'version-policy.json'), 'utf8')) as {
        groups: Array<{ packages: string[] }>;
      };
      expect(retainedPolicy.groups[0]?.packages).toEqual(['custom/path']);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });


  it('marks mixed changelog repos as explicit review required instead of auto-applying', async () => {
    expect(changelogMigration).toBeDefined();
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-mixed-changelog-'));
    try {
      fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, 'packages', 'pkg-a'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
      fs.writeFileSync(
        path.join(repoRoot, 'package.json'),
        JSON.stringify({ private: true, packageManager: 'pnpm@9.0.0', devDependencies: { '@fawxzzy/playbook': '^0.1.8' } }, null, 2)
      );
      fs.writeFileSync(path.join(repoRoot, 'packages', 'pkg-a', 'package.json'), JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2));
      fs.writeFileSync(path.join(repoRoot, '.playbook', 'managed-surfaces.json'), JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-managed-surface-manifest',
        entries: [
          { path: '.playbook/**', category: 'managed_by_playbook', mutationScope: 'file', owner: 'playbook' },
          { path: '.github/workflows/release-prep.yml', category: 'managed_by_playbook', mutationScope: 'file', owner: 'playbook' },
          { path: 'docs/CHANGELOG.md', category: 'managed_by_playbook', mutationScope: 'managed_block', owner: 'playbook', managedMarkers: ['<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->', '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->'] }
        ]
      }, null, 2) + '\n');
      fs.writeFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n\n- local product truth\n');

      const check = await changelogMigration!.check({ repoRoot, toVersion: '0.1.8' });
      expect(check.needed).toBe(true);
      expect(check.safeToAutoApply).toBe(false);
      expect(check.boundaryCategory).toBe('explicit_migration_required');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('retrofits missing workflow and changelog seam without overwriting existing content', async () => {
    expect(workflowMigration).toBeDefined();
    expect(changelogMigration).toBeDefined();
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-governance-'));
    try {
      fs.mkdirSync(path.join(repoRoot, 'packages', 'pkg-a'), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
      fs.writeFileSync(
        path.join(repoRoot, 'package.json'),
        JSON.stringify({ private: true, packageManager: 'pnpm@9.0.0', devDependencies: { '@fawxzzy/playbook': '^0.1.8' } }, null, 2)
      );
      fs.writeFileSync(path.join(repoRoot, 'packages', 'pkg-a', 'package.json'), JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2));
      fs.writeFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n\n- Existing notes stay intact.\n');

      const workflowCheck = await workflowMigration!.check({ repoRoot, toVersion: '0.1.8' });
      const changelogCheck = await changelogMigration!.check({ repoRoot, toVersion: '0.1.8' });
      expect(workflowCheck.needed).toBe(true);
      expect(changelogCheck.needed).toBe(true);

      const workflowApplied = await workflowMigration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
      const changelogApplied = await changelogMigration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
      expect(workflowApplied.changed).toBe(true);
      expect(changelogApplied.changed).toBe(true);

      const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'release-prep.yml'), 'utf8');
      expect(workflow).toContain('workflow_dispatch');
      expect(workflow).toContain('pnpm playbook release plan --json --out .playbook/release-plan.json');

      const changelog = fs.readFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), 'utf8');
      expect(changelog).toContain('- Existing notes stay intact.');
      expect(changelog).toContain('<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->');
      expect(changelog).toContain('<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->');

      fs.writeFileSync(path.join(repoRoot, '.github', 'workflows', 'release-prep.yml'), '# custom workflow\n');
      const secondWorkflowApply = await workflowMigration!.apply!({ repoRoot, fromVersion: '0.1.8', toVersion: '0.1.8', dryRun: false });
      expect(secondWorkflowApply.changed).toBe(false);
      expect(fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'release-prep.yml'), 'utf8')).toBe('# custom workflow\n');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
