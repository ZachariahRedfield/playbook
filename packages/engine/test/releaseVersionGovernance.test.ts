import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { verifyReleaseGovernance } from '../src/release/index.js';

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
    breakingChangeMarkers: ['BREAKING CHANGE'],
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

  it('fails deterministically for lockstep mismatch', () => {
    const { repoRoot, baseSha } = createRepo();
    writeJson(path.join(repoRoot, 'packages', 'alpha', 'package.json'), { name: '@scope/alpha', version: '1.2.4' });

    const failures = verifyReleaseGovernance(repoRoot, { baseRef: 'HEAD~0', baseSha });

    expect(failures).toEqual([
      expect.objectContaining({ id: 'release.versionGroup.inconsistent' })
    ]);
  });
});
