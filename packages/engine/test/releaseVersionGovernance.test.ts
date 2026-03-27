import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { assessReleaseSync, verifyReleaseGovernance } from '../src/release/index.js';

const BREAKING_CHANGE_MARKER = ['BREAKING', 'CHANGE'].join(' ');

const run = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const writeJson = (filePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
};

const write = (filePath: string, value: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
};

const createRepo = (): { repoRoot: string; baseSha: string } => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-verify-'));
  run(repoRoot, 'init');
  run(repoRoot, 'config', 'user.email', 'playbook@example.com');
  run(repoRoot, 'config', 'user.name', 'Playbook');

  writeJson(path.join(repoRoot, 'packages', 'alpha', 'package.json'), { name: '@scope/alpha', version: '1.2.3' });
  writeJson(path.join(repoRoot, 'packages', 'beta', 'package.json'), { name: '@scope/beta', version: '1.2.3' });
  writeJson(path.join(repoRoot, '.playbook', 'version-policy.json'), {
    schemaVersion: '1.0',
    kind: 'playbook-version-policy',
    breakingChangeMarkers: [BREAKING_CHANGE_MARKER],
    versionGroups: [{ name: 'lockstep', packages: ['@scope/alpha', '@scope/beta'] }]
  });
  write(path.join(repoRoot, 'docs', 'CHANGELOG.md'), `# Changelog\n\n<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->\n- Existing release note.\n<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->\n`);
  write(path.join(repoRoot, 'docs', 'commands', 'verify.md'), '# verify\n');
  run(repoRoot, 'add', '.');
  run(repoRoot, 'commit', '-m', 'baseline');
  const baseSha = run(repoRoot, 'rev-parse', 'HEAD');
  return { repoRoot, baseSha };
};

describe('verifyReleaseGovernance', () => {
  it('fails when public contract expansion lands without version governance updates', () => {
    const { repoRoot, baseSha } = createRepo();
    const contractPath = path.join(repoRoot, 'packages', 'contracts', 'src', 'new-contract.schema.json');
    write(contractPath, '{"type":"object"}\n');
    run(repoRoot, 'add', 'packages/contracts/src/new-contract.schema.json');

    const failures = verifyReleaseGovernance(repoRoot, { baseRef: 'HEAD~0', baseSha });

    expect(failures.map((failure) => failure.id)).toContain('release.contractExpansion.releasePlan.required');
    expect(failures.map((failure) => failure.id)).toContain('release.requiredVersionBump.missing');
  });

  it('does not fail for docs-only changes', () => {
    const { repoRoot, baseSha } = createRepo();
    const releaseDocPath = path.join(repoRoot, 'docs', 'commands', 'release.md');
    write(releaseDocPath, '# release\nupdated\n');
    run(repoRoot, 'add', 'docs/commands/release.md');

    const failures = verifyReleaseGovernance(repoRoot, { baseRef: 'HEAD~0', baseSha });

    expect(failures).toEqual([]);
  });


  it('ignores the tracked release-plan artifact when classifying release bumps', () => {
    const { repoRoot, baseSha } = createRepo();
    writeJson(path.join(repoRoot, '.playbook', 'release-plan.json'), {
      schemaVersion: '1.0',
      kind: 'playbook-release-plan',
      summary: {
        recommendedBump: 'major',
        reasons: [BREAKING_CHANGE_MARKER]
      }
    });
    run(repoRoot, 'add', '.playbook/release-plan.json');

    const failures = verifyReleaseGovernance(repoRoot, { baseRef: 'HEAD~0', baseSha });

    expect(failures).toEqual([]);
  });

  it('fails deterministically for lockstep mismatch', () => {
    const { repoRoot, baseSha } = createRepo();
    writeJson(path.join(repoRoot, 'packages', 'alpha', 'package.json'), { name: '@scope/alpha', version: '1.2.4' });

    const failures = verifyReleaseGovernance(repoRoot, { baseRef: 'HEAD~0', baseSha });

    expect(failures).toEqual([
      expect.objectContaining({ id: 'release.versionGroup.inconsistent' })
    ]);
  });

  it('keeps release sync idempotent by deriving next version from baseRef version', () => {
    const { repoRoot, baseSha } = createRepo();
    const featurePath = path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts');
    write(featurePath, 'export const value = 1;\n');
    run(repoRoot, 'add', featurePath);

    const initial = assessReleaseSync(repoRoot, { baseRef: baseSha, mode: 'check' });
    const alphaTask = initial.plan.tasks.find((task) => task.task_kind === 'release-package-version' && task.file === 'packages/alpha/package.json');
    expect(alphaTask?.provenance.next_version).toBe('1.2.4');
    expect(initial.hasDrift).toBe(true);
    const initialChangelogTask = initial.plan.tasks.find((task) => task.task_kind === 'docs-managed-write');
    const initialManagedBlock = initialChangelogTask?.write?.content ?? '';
    expect((initialManagedBlock.match(/## 1\.2\.4 - 2026-03-27/g) ?? []).length).toBe(1);

    writeJson(path.join(repoRoot, 'packages', 'alpha', 'package.json'), { name: '@scope/alpha', version: '1.2.4' });
    writeJson(path.join(repoRoot, 'packages', 'beta', 'package.json'), { name: '@scope/beta', version: '1.2.4' });
    const changelogTask = initial.plan.tasks.find((task) => task.task_kind === 'docs-managed-write');
    const changelogContent = changelogTask?.write?.content;
    if (!changelogContent) {
      throw new Error('Expected docs-managed-write release task for changelog.');
    }
    write(path.join(repoRoot, 'docs', 'CHANGELOG.md'), changelogContent);
    run(repoRoot, 'add', 'packages/alpha/package.json', 'packages/beta/package.json', 'docs/CHANGELOG.md');
    run(repoRoot, 'commit', '-m', 'apply release sync once');

    const afterApply = assessReleaseSync(repoRoot, { baseRef: baseSha, mode: 'check' });
    const afterApplyAlphaTask = afterApply.plan.tasks.find((task) => task.task_kind === 'release-package-version' && task.file === 'packages/alpha/package.json');
    expect(afterApplyAlphaTask?.provenance.base_version).toBe('1.2.3');
    expect(afterApplyAlphaTask?.provenance.next_version).toBe('1.2.4');
    expect(afterApply.hasDrift).toBe(false);
    expect(afterApply.drift).toEqual([]);
    expect(afterApply.actionableTasks).toEqual([]);

    const changelogTaskAfterApply = afterApply.plan.tasks.find((task) => task.task_kind === 'docs-managed-write');
    const updatedManagedBlock = changelogTaskAfterApply?.write?.content ?? '';
    expect((updatedManagedBlock.match(/## 1\.2\.4 - 2026-03-27/g) ?? []).length).toBe(1);
  });

  it('passes generated-artifact mode when release-plan file is absent and durable outputs are aligned', () => {
    const { repoRoot, baseSha } = createRepo();
    const featurePath = path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts');
    write(featurePath, 'export const value = 1;\n');
    run(repoRoot, 'add', featurePath);

    const initial = assessReleaseSync(repoRoot, { baseRef: baseSha, mode: 'check' });
    writeJson(path.join(repoRoot, 'packages', 'alpha', 'package.json'), { name: '@scope/alpha', version: '1.2.4' });
    writeJson(path.join(repoRoot, 'packages', 'beta', 'package.json'), { name: '@scope/beta', version: '1.2.4' });
    const changelogTask = initial.plan.tasks.find((task) => task.task_kind === 'docs-managed-write');
    if (!changelogTask?.write?.content) {
      throw new Error('Expected changelog task content.');
    }
    write(path.join(repoRoot, 'docs', 'CHANGELOG.md'), changelogTask.write.content);
    const releasePlanPath = path.join(repoRoot, '.playbook', 'release-plan.json');
    if (fs.existsSync(releasePlanPath)) {
      fs.rmSync(releasePlanPath);
    }
    run(repoRoot, 'add', 'packages/alpha/package.json', 'packages/beta/package.json', 'docs/CHANGELOG.md');
    run(repoRoot, 'commit', '-m', 'align durable release outputs');

    const assessed = assessReleaseSync(repoRoot, { baseRef: baseSha, mode: 'check' });
    expect(assessed.hasDrift).toBe(false);
  });

  it('fails generated-artifact mode when versions/changelog are not aligned', () => {
    const { repoRoot, baseSha } = createRepo();
    const featurePath = path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts');
    write(featurePath, 'export const value = 1;\n');
    run(repoRoot, 'add', featurePath);

    const releasePlanPath = path.join(repoRoot, '.playbook', 'release-plan.json');
    if (fs.existsSync(releasePlanPath)) {
      fs.rmSync(releasePlanPath);
    }

    const assessed = assessReleaseSync(repoRoot, { baseRef: baseSha, mode: 'check' });
    expect(assessed.hasDrift).toBe(true);
    expect(assessed.governanceFailures.map((failure) => failure.id)).toContain('release.requiredVersionBump.missing');
  });

  it('keeps legacy committed-plan mode backward compatible by ignoring repo copy parity', () => {
    const { repoRoot, baseSha } = createRepo();
    const featurePath = path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts');
    write(featurePath, 'export const value = 1;\n');
    run(repoRoot, 'add', featurePath);
    const initial = assessReleaseSync(repoRoot, { baseRef: baseSha, mode: 'check' });

    writeJson(path.join(repoRoot, 'packages', 'alpha', 'package.json'), { name: '@scope/alpha', version: '1.2.4' });
    writeJson(path.join(repoRoot, 'packages', 'beta', 'package.json'), { name: '@scope/beta', version: '1.2.4' });
    const changelogTask = initial.plan.tasks.find((task) => task.task_kind === 'docs-managed-write');
    if (!changelogTask?.write?.content) {
      throw new Error('Expected changelog task content.');
    }
    write(path.join(repoRoot, 'docs', 'CHANGELOG.md'), changelogTask.write.content);
    writeJson(path.join(repoRoot, '.playbook', 'release-plan.json'), { stale: true, reason: 'legacy committed-plan mode test' });
    run(repoRoot, 'add', 'packages/alpha/package.json', 'packages/beta/package.json', 'docs/CHANGELOG.md', '.playbook/release-plan.json');
    run(repoRoot, 'commit', '-m', 'align outputs with legacy plan present');

    const assessed = assessReleaseSync(repoRoot, { baseRef: baseSha, mode: 'check' });
    expect(assessed.hasDrift).toBe(false);
  });
});
