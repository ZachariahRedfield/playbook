import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReleasePlanFromInputs } from '../src/release/index.js';

const createFixtureRepo = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-plan-'));
  fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'packages', 'alpha', 'src'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'packages', 'beta', 'src'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'docs', 'commands'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), `# Changelog

<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->
- Existing release note.
<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->
`);
  fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'package.json'), JSON.stringify({ name: '@scope/alpha', version: '1.2.3' }, null, 2));
  fs.writeFileSync(path.join(repoRoot, 'packages', 'beta', 'package.json'), JSON.stringify({ name: '@scope/beta', version: '1.2.3' }, null, 2));
  fs.writeFileSync(path.join(repoRoot, '.playbook', 'version-policy.json'), JSON.stringify({
    schemaVersion: '1.0',
    kind: 'playbook-version-policy',
    breakingChangeMarkers: ['BREAKING CHANGE'],
    versionGroups: [{ name: 'lockstep', packages: ['@scope/alpha', '@scope/beta'] }]
  }, null, 2));
  return repoRoot;
};

const buildPlan = (repoRoot: string, changedFiles: Array<{ path: string; status: string }>) =>
  buildReleasePlanFromInputs(repoRoot, {
    generatedAt: '2026-03-22T00:00:00.000Z',
    baseRef: 'origin/main',
    baseSha: 'base',
    headSha: 'head',
    changedFiles
  });

describe('buildReleasePlanFromInputs', () => {
  it('is deterministic for the same input diff', () => {
    const repoRoot = createFixtureRepo();
    fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts'), 'export const value = 1;\n');

    const changedFiles = [{ path: 'packages/alpha/src/feature.ts', status: 'A' }];
    expect(buildPlan(repoRoot, changedFiles)).toEqual(buildPlan(repoRoot, changedFiles));
  });

  it('keeps lockstep version groups aligned deterministically', () => {
    const repoRoot = createFixtureRepo();
    fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts'), 'export const value = 1;\n');

    const plan = buildPlan(repoRoot, [{ path: 'packages/alpha/src/feature.ts', status: 'A' }]);
    expect(plan.summary.recommendedBump).toBe('patch');
    expect(plan.versionGroups[0]?.recommendedBump).toBe('patch');
    expect(plan.packages.map((pkg) => pkg.recommendedBump)).toEqual(['patch', 'patch']);
  });

  it('treats public contract expansion as a minor bump', () => {
    const repoRoot = createFixtureRepo();
    fs.writeFileSync(path.join(repoRoot, 'packages', 'contracts-note.txt'), 'schema changed\n');

    const plan = buildPlan(repoRoot, [{ path: 'packages/contracts/src/new-contract.schema.json', status: 'A' }]);
    expect(plan.summary.recommendedBump).toBe('minor');
    expect(plan.diff.changedFiles[0]?.reasons).toContain('stable contract expansion changed');
  });

  it('does not inflate internal runtime artifacts', () => {
    const repoRoot = createFixtureRepo();
    fs.mkdirSync(path.join(repoRoot, '.playbook', 'memory', 'events'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, '.playbook', 'memory', 'events', 'event.json'), '{\n  "schemaVersion": "1.0"\n}\n');

    const plan = buildPlan(repoRoot, [{ path: '.playbook/memory/events/event.json', status: 'A' }]);
    expect(plan.summary.recommendedBump).toBe('none');
    expect(plan.diff.changedFiles[0]?.reasons).toContain('non-shipping repository change');
  });

  it('treats docs-only changes as none', () => {
    const repoRoot = createFixtureRepo();
    fs.writeFileSync(path.join(repoRoot, 'docs', 'commands', 'release.md'), '# release\n');

    const plan = buildPlan(repoRoot, [{ path: 'docs/commands/release.md', status: 'M' }]);
    expect(plan.summary.recommendedBump).toBe('none');
    expect(plan.diff.changedFiles[0]?.reasons).toContain('docs/tests/CI-only surface changed');
  });

  it('emits apply-compatible package and changelog tasks', () => {
    const repoRoot = createFixtureRepo();
    fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts'), 'export const value = 1;\n');

    const plan = buildPlan(repoRoot, [{ path: 'packages/alpha/src/feature.ts', status: 'A' }]);
    expect(plan.tasks.map((task) => task.ruleId)).toEqual([
      'release.package-json.version',
      'release.package-json.version',
      'docs-consolidation.managed-write'
    ]);
    expect(plan.tasks[0]?.file).toBe('packages/alpha/package.json');
    expect(plan.tasks[1]?.file).toBe('packages/beta/package.json');
    expect(plan.tasks[2]?.file).toBe('docs/CHANGELOG.md');
  });

  it('fails clearly when the managed changelog block is missing', () => {
    const repoRoot = createFixtureRepo();
    fs.writeFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), '# Changelog\n');
    fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts'), 'export const value = 1;\n');

    expect(() => buildPlan(repoRoot, [{ path: 'packages/alpha/src/feature.ts', status: 'A' }])).toThrow(
      'Release plan cannot be created: changelog target docs/CHANGELOG.md is unmanaged.'
    );
  });

  it('fails clearly when a lockstep group is only partially present', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-release-plan-partial-'));
    fs.mkdirSync(path.join(repoRoot, '.playbook'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'packages', 'alpha', 'src'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'package.json'), JSON.stringify({ name: '@scope/alpha', version: '1.2.3' }, null, 2));
    fs.writeFileSync(path.join(repoRoot, 'docs', 'CHANGELOG.md'), `# Changelog

<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->
- Existing release note.
<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->
`);
    fs.writeFileSync(path.join(repoRoot, '.playbook', 'version-policy.json'), JSON.stringify({
      schemaVersion: '1.0',
      kind: 'playbook-version-policy',
      breakingChangeMarkers: ['BREAKING CHANGE'],
      versionGroups: [{ name: 'lockstep', packages: ['@scope/alpha', '@scope/beta'] }]
    }, null, 2));
    fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'src', 'feature.ts'), 'export const value = 1;\n');

    expect(() => buildPlan(repoRoot, [{ path: 'packages/alpha/src/feature.ts', status: 'A' }])).toThrow(
      'Release plan cannot be created: lockstep version group lockstep is partial.'
    );
  });

  it('requires an explicit breaking marker for a major bump', () => {
    const repoRoot = createFixtureRepo();
    fs.writeFileSync(path.join(repoRoot, 'packages', 'alpha', 'src', 'breaking.ts'), '// BREAKING CHANGE\nexport const value = 2;\n');

    const plan = buildPlan(repoRoot, [{ path: 'packages/alpha/src/breaking.ts', status: 'A' }]);
    expect(plan.summary.recommendedBump).toBe('major');
    expect(plan.diff.changedFiles[0]?.reasons[0]).toContain('explicit breaking marker detected');
  });
});
