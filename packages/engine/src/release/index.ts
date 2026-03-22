import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolveScmDiffBase } from '../git/context.js';

export type ReleaseBump = 'none' | 'patch' | 'minor' | 'major';

type VersionPolicy = {
  schemaVersion: '1.0';
  kind: 'playbook-version-policy';
  breakingChangeMarkers: string[];
  versionGroups: Array<{
    name: string;
    packages: string[];
  }>;
};

export type ChangedFileEvidence = {
  path: string;
  status: string;
  bump: ReleaseBump;
  reasons: string[];
};

type WorkspacePackage = {
  name: string;
  path: string;
  currentVersion: string;
  versionGroup: string | null;
};

type ReleasePlanTask = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: true;
  task_kind: 'release-package-version' | 'docs-managed-write';
  provenance: Record<string, unknown>;
  write?: {
    operation: 'replace-managed-block';
    blockId: string;
    startMarker: string;
    endMarker: string;
    content: string;
  };
  preconditions?: {
    target_path: string;
    target_file_fingerprint: string;
    managed_block_fingerprint?: string;
    approved_fragment_ids: string[];
    planned_operation: 'replace-managed-block';
  };
};


export type ReleaseGovernanceFailure = {
  id: string;
  message: string;
  evidence?: string;
  fix?: string;
};

export type ReleasePlan = {
  schemaVersion: '1.0';
  kind: 'playbook-release-plan';
  generatedAt: string;
  policy: {
    path: string;
    breakingChangeMarkers: string[];
    versionGroups: Array<{ name: string; packages: string[] }>;
  };
  diff: {
    baseRef: string;
    baseSha: string;
    headSha: string;
    changedFiles: ChangedFileEvidence[];
  };
  summary: {
    recommendedBump: ReleaseBump;
    reasons: string[];
  };
  packages: Array<{
    name: string;
    path: string;
    currentVersion: string;
    recommendedBump: ReleaseBump;
    versionGroup: string | null;
    reasons: string[];
    evidence: ChangedFileEvidence[];
  }>;
  versionGroups: Array<{
    name: string;
    packages: string[];
    recommendedBump: ReleaseBump;
    reasons: string[];
  }>;
  tasks: ReleasePlanTask[];
};

const VERSION_POLICY_PATH = '.playbook/version-policy.json';
const CHANGELOG_PATH = 'docs/CHANGELOG.md';
const CHANGELOG_BLOCK_ID = 'changelog-release-notes';
const CHANGELOG_START_MARKER = '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->';
const CHANGELOG_END_MARKER = '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->';
const DEFAULT_BREAKING_MARKERS = ['BREAKING CHANGE', 'PLAYBOOK_BREAKING_CHANGE'];
const bumpRank: Record<ReleaseBump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

const compareBumps = (left: ReleaseBump, right: ReleaseBump): ReleaseBump =>
  bumpRank[left] >= bumpRank[right] ? left : right;

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const fingerprint = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const bumpVersion = (version: string, bump: ReleaseBump): string => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    throw new Error(`Unsupported version format for release plan mutation: ${version}. Expected x.y.z.`);
  }

  const major = Number.parseInt(match[1] ?? '0', 10);
  const minor = Number.parseInt(match[2] ?? '0', 10);
  const patch = Number.parseInt(match[3] ?? '0', 10);

  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  return version;
};

const validateVersionGroupCompleteness = (workspacePackages: WorkspacePackage[], policy: VersionPolicy): void => {
  const workspaceByName = new Map(workspacePackages.map((pkg) => [pkg.name, pkg] as const));

  for (const group of policy.versionGroups) {
    const members = group.packages.map((packageName) => workspaceByName.get(packageName)).filter((value): value is WorkspacePackage => value !== undefined);
    const missingPackages = group.packages.filter((packageName) => !workspaceByName.has(packageName));
    if (missingPackages.length > 0) {
      throw new Error(`Release plan cannot be created: lockstep version group ${group.name} is partial. Missing workspace packages: ${missingPackages.join(', ')}.`);
    }

    const distinctVersions = uniqueSorted(members.map((member) => member.currentVersion));
    if (distinctVersions.length > 1) {
      throw new Error(`Release plan cannot be created: lockstep version group ${group.name} is partial. Current versions diverge: ${distinctVersions.join(', ')}.`);
    }
  }
};

const buildReleaseTaskId = (parts: string[]): string => parts.join('::').replace(/[^a-zA-Z0-9:._-]+/gu, '-');

const buildChangelogTask = (
  repoRoot: string,
  generatedAt: string,
  recommendedBump: ReleaseBump,
  packagesToUpdate: Array<{ name: string; path: string; currentVersion: string; nextVersion: string; versionGroup: string | null }>,
  nextVersionByPackage: Map<string, string>
): ReleasePlanTask => {
  const changelogPath = path.join(repoRoot, CHANGELOG_PATH);
  if (!fs.existsSync(changelogPath)) {
    throw new Error(`Release plan cannot be created: managed changelog target ${CHANGELOG_PATH} does not exist.`);
  }

  const current = fs.readFileSync(changelogPath, 'utf8');
  const startIndex = current.indexOf(CHANGELOG_START_MARKER);
  const endIndex = startIndex >= 0 ? current.indexOf(CHANGELOG_END_MARKER, startIndex + CHANGELOG_START_MARKER.length) : -1;
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error(`Release plan cannot be created: changelog target ${CHANGELOG_PATH} is unmanaged. Expected ${CHANGELOG_START_MARKER} and ${CHANGELOG_END_MARKER}.`);
  }

  const currentBlock = current.slice(startIndex, endIndex + CHANGELOG_END_MARKER.length);
  const existingBody = current.slice(startIndex + CHANGELOG_START_MARKER.length, endIndex).trim();
  const releaseLabel = uniqueSorted(Array.from(new Set(packagesToUpdate.map((pkg) => pkg.nextVersion)))).join(', ');
  const packageLines = packagesToUpdate
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((pkg) => `- ${pkg.name}: ${pkg.currentVersion} -> ${pkg.nextVersion}${pkg.versionGroup ? ` (${pkg.versionGroup})` : ''}`);
  const entryLines = [
    `## ${releaseLabel} - ${generatedAt.slice(0, 10)}`,
    `- Recommended bump: ${recommendedBump}`,
    ...packageLines
  ];
  const contentParts = [CHANGELOG_START_MARKER, ...entryLines, ...(existingBody ? ['', existingBody] : []), CHANGELOG_END_MARKER];
  const content = contentParts.join('\n');

  return {
    id: buildReleaseTaskId(['release-changelog', generatedAt.slice(0, 10), releaseLabel || recommendedBump]),
    ruleId: 'docs-consolidation.managed-write',
    file: CHANGELOG_PATH,
    action: `Update managed changelog block for release ${releaseLabel || recommendedBump}`,
    autoFix: true,
    task_kind: 'docs-managed-write',
    write: {
      operation: 'replace-managed-block',
      blockId: CHANGELOG_BLOCK_ID,
      startMarker: CHANGELOG_START_MARKER,
      endMarker: CHANGELOG_END_MARKER,
      content
    },
    preconditions: {
      target_path: CHANGELOG_PATH,
      target_file_fingerprint: fingerprint(current),
      managed_block_fingerprint: fingerprint(currentBlock),
      approved_fragment_ids: packagesToUpdate.map((pkg) => `release:${pkg.name}:${nextVersionByPackage.get(pkg.name) ?? pkg.currentVersion}`),
      planned_operation: 'replace-managed-block'
    },
    provenance: {
      release_plan_kind: 'playbook-release-plan',
      recommended_bump: recommendedBump,
      packages: packagesToUpdate.map((pkg) => ({
        name: pkg.name,
        path: pkg.path,
        currentVersion: pkg.currentVersion,
        nextVersion: pkg.nextVersion,
        versionGroup: pkg.versionGroup
      }))
    }
  };
};

const listWorkspacePackageJsonPaths = (repoRoot: string): string[] => {
  const packagesDir = path.join(repoRoot, 'packages');
  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  return fs.readdirSync(packagesDir)
    .map((entry) => path.join(packagesDir, entry, 'package.json'))
    .filter((filePath) => fs.existsSync(filePath))
    .sort((left, right) => left.localeCompare(right));
};

export const readVersionPolicy = (repoRoot: string): VersionPolicy => {
  const absolutePath = path.join(repoRoot, VERSION_POLICY_PATH);
  if (!fs.existsSync(absolutePath)) {
    return {
      schemaVersion: '1.0',
      kind: 'playbook-version-policy',
      breakingChangeMarkers: [...DEFAULT_BREAKING_MARKERS],
      versionGroups: []
    };
  }

  const parsed = readJson<VersionPolicy>(absolutePath);
  return {
    schemaVersion: '1.0',
    kind: 'playbook-version-policy',
    breakingChangeMarkers: uniqueSorted(parsed.breakingChangeMarkers ?? DEFAULT_BREAKING_MARKERS),
    versionGroups: [...(parsed.versionGroups ?? [])]
      .map((group) => ({ name: group.name, packages: uniqueSorted(group.packages) }))
      .sort((left, right) => left.name.localeCompare(right.name))
  };
};

export const readWorkspacePackages = (repoRoot: string, policy: VersionPolicy): WorkspacePackage[] => {
  const groupByPackage = new Map<string, string>();
  for (const group of policy.versionGroups) {
    for (const packageName of group.packages) {
      groupByPackage.set(packageName, group.name);
    }
  }

  return listWorkspacePackageJsonPaths(repoRoot)
    .map((packageJsonPath) => {
      const parsed = readJson<{ name?: string; version?: string }>(packageJsonPath);
      const relativeDir = path.relative(repoRoot, path.dirname(packageJsonPath)).split(path.sep).join('/');
      return {
        name: String(parsed.name ?? relativeDir),
        path: relativeDir,
        currentVersion: String(parsed.version ?? '0.0.0'),
        versionGroup: groupByPackage.get(String(parsed.name ?? relativeDir)) ?? null
      } satisfies WorkspacePackage;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
};

const resolveHeadSha = (repoRoot: string): string =>
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();

export const readChangedFiles = (repoRoot: string, baseSha: string): Array<{ path: string; status: string }> => {
  const output = execFileSync('git', ['diff', '--name-status', '--find-renames', baseSha, '--'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split(/\s+/u);
      const filePath = rest.at(-1);
      return filePath ? { path: filePath, status } : null;
    })
    .filter((value): value is { path: string; status: string } => value !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
};

const readFileText = (repoRoot: string, relativePath: string): string => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
};

const isStableContractExpansionPath = (normalizedPath: string): boolean =>
  normalizedPath === '.playbook/version-policy.json'
  || (normalizedPath.startsWith('packages/contracts/src/') && normalizedPath.endsWith('.schema.json'));

export const classifyFileChange = (file: { path: string; status: string }, repoRoot: string, policy: VersionPolicy): ChangedFileEvidence => {
  const filePath = file.path;
  const reasons: string[] = [];
  const normalized = filePath.replace(/\\/gu, '/');
  const text = readFileText(repoRoot, normalized);

  const matchingMarkers = policy.breakingChangeMarkers.filter((marker) => text.includes(marker)).sort((left, right) => left.localeCompare(right));
  if (matchingMarkers.length > 0) {
    reasons.push(`explicit breaking marker detected (${matchingMarkers.join(', ')})`);
    return { path: normalized, status: file.status, bump: 'major', reasons };
  }

  const docsOnly = normalized.startsWith('docs/')
    || normalized.startsWith('tests/')
    || normalized.startsWith('.github/')
    || normalized === 'README.md'
    || normalized.endsWith('.md')
    || normalized.includes('.test.')
    || normalized.includes('.spec.')
    || normalized.includes('/__tests__/');

  if (docsOnly) {
    reasons.push('docs/tests/CI-only surface changed');
    return { path: normalized, status: file.status, bump: 'none', reasons };
  }

  if (normalized === 'packages/cli/src/lib/commandMetadata.ts' || normalized.startsWith('packages/cli/src/commands/')) {
    reasons.push('command surface changed');
    return { path: normalized, status: file.status, bump: 'minor', reasons };
  }

  if (isStableContractExpansionPath(normalized)) {
    reasons.push('stable contract expansion changed');
    return { path: normalized, status: file.status, bump: 'minor', reasons };
  }

  if (normalized === 'packages/engine/src/index.ts' || normalized === 'packages/contracts/src/index.ts') {
    reasons.push('public export surface changed');
    return { path: normalized, status: file.status, bump: 'minor', reasons };
  }

  if (normalized.includes('/verify/') || normalized.endsWith('/rules.ts') || normalized.endsWith('/rules.js')) {
    reasons.push('rule surface changed');
    return { path: normalized, status: file.status, bump: 'minor', reasons };
  }

  if (normalized.startsWith('packages/') && normalized.includes('/src/')) {
    reasons.push('shipped internal code changed');
    return { path: normalized, status: file.status, bump: 'patch', reasons };
  }

  reasons.push('non-shipping repository change');
  return { path: normalized, status: file.status, bump: 'none', reasons };
};

const buildPackageEvidence = (workspacePackage: WorkspacePackage, changedFiles: ChangedFileEvidence[]): ChangedFileEvidence[] =>
  changedFiles.filter((file) => file.path === `${workspacePackage.path}/package.json` || file.path.startsWith(`${workspacePackage.path}/`));

export const buildReleasePlanFromInputs = (
  repoRoot: string,
  inputs: {
    generatedAt: string;
    baseRef: string;
    baseSha: string;
    headSha: string;
    policy?: VersionPolicy;
    changedFiles: Array<{ path: string; status: string }>;
  }
): ReleasePlan => {
  const policy = inputs.policy ?? readVersionPolicy(repoRoot);
  const workspacePackages = readWorkspacePackages(repoRoot, policy);
  validateVersionGroupCompleteness(workspacePackages, policy);
  const changedFiles = inputs.changedFiles.map((file) => classifyFileChange(file, repoRoot, policy));

  const packagePlans = workspacePackages.map((workspacePackage) => {
    const evidence = buildPackageEvidence(workspacePackage, changedFiles);
    let recommendedBump: ReleaseBump = 'none';
    for (const file of evidence) {
      recommendedBump = compareBumps(recommendedBump, file.bump);
    }

    const reasons = uniqueSorted(evidence.flatMap((file) => file.reasons));
    return {
      name: workspacePackage.name,
      path: workspacePackage.path,
      currentVersion: workspacePackage.currentVersion,
      recommendedBump,
      versionGroup: workspacePackage.versionGroup,
      reasons,
      evidence
    };
  });

  const versionGroups = policy.versionGroups.map((group) => {
    const matchingPackages = packagePlans.filter((entry) => group.packages.includes(entry.name));
    let recommendedBump: ReleaseBump = 'none';
    for (const pkg of matchingPackages) {
      recommendedBump = compareBumps(recommendedBump, pkg.recommendedBump);
    }
    const reasons = uniqueSorted(matchingPackages.flatMap((pkg) => pkg.reasons));
    return { name: group.name, packages: [...group.packages], recommendedBump, reasons };
  });

  const groupBumpByName = new Map(versionGroups.map((group) => [group.name, group.recommendedBump] as const));
  const normalizedPackages = packagePlans
    .map((entry) => ({
      ...entry,
      recommendedBump: entry.versionGroup ? (groupBumpByName.get(entry.versionGroup) ?? entry.recommendedBump) : entry.recommendedBump
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  let recommendedBump: ReleaseBump = 'none';
  for (const file of changedFiles) {
    recommendedBump = compareBumps(recommendedBump, file.bump);
  }
  for (const group of versionGroups) {
    recommendedBump = compareBumps(recommendedBump, group.recommendedBump);
  }
  for (const pkg of normalizedPackages) {
    recommendedBump = compareBumps(recommendedBump, pkg.recommendedBump);
  }

  const summaryReasons = uniqueSorted([
    ...changedFiles.filter((file) => file.bump === recommendedBump).flatMap((file) => file.reasons),
    ...versionGroups.filter((group) => group.recommendedBump === recommendedBump).flatMap((group) => group.reasons)
  ]);

  const nextVersionByPackage = new Map<string, string>();
  const packagesToUpdate = normalizedPackages
    .filter((pkg) => pkg.recommendedBump !== 'none')
    .map((pkg) => {
      const nextVersion = bumpVersion(pkg.currentVersion, pkg.recommendedBump);
      nextVersionByPackage.set(pkg.name, nextVersion);
      return { ...pkg, nextVersion };
    });

  const tasks: ReleasePlanTask[] = packagesToUpdate.map((pkg) => ({
    id: buildReleaseTaskId(['release-package', pkg.name, pkg.nextVersion]),
    ruleId: 'release.package-json.version',
    file: `${pkg.path}/package.json`,
    action: `Update ${pkg.name} package.json to ${pkg.nextVersion}`,
    autoFix: true,
    task_kind: 'release-package-version',
    provenance: {
      release_plan_kind: 'playbook-release-plan',
      package_name: pkg.name,
      package_path: pkg.path,
      current_version: pkg.currentVersion,
      next_version: pkg.nextVersion,
      version_group: pkg.versionGroup,
      linked_workspace_versions: packagesToUpdate.map((linkedPkg) => ({ name: linkedPkg.name, currentVersion: linkedPkg.currentVersion, nextVersion: linkedPkg.nextVersion }))
    }
  }));

  if (packagesToUpdate.length > 0) {
    tasks.push(buildChangelogTask(repoRoot, inputs.generatedAt, recommendedBump, packagesToUpdate, nextVersionByPackage));
  }

  return {
    schemaVersion: '1.0',
    kind: 'playbook-release-plan',
    generatedAt: inputs.generatedAt,
    policy: {
      path: VERSION_POLICY_PATH,
      breakingChangeMarkers: [...policy.breakingChangeMarkers],
      versionGroups: policy.versionGroups.map((group) => ({ name: group.name, packages: [...group.packages] }))
    },
    diff: {
      baseRef: inputs.baseRef,
      baseSha: inputs.baseSha,
      headSha: inputs.headSha,
      changedFiles
    },
    summary: {
      recommendedBump,
      reasons: summaryReasons
    },
    packages: normalizedPackages,
    versionGroups,
    tasks
  };
};

export const buildReleasePlan = (repoRoot: string, options: { baseRef?: string; generatedAt?: string } = {}): ReleasePlan => {
  const diffBase = resolveScmDiffBase(repoRoot, { baseRef: options.baseRef, commandName: 'playbook release plan' });
  const headSha = resolveHeadSha(repoRoot);
  const changedFiles = readChangedFiles(repoRoot, diffBase.baseSha);
  return buildReleasePlanFromInputs(repoRoot, {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    baseRef: diffBase.baseRef,
    baseSha: diffBase.baseSha,
    headSha,
    changedFiles
  });
};


const readJsonAtGitRef = <T>(repoRoot: string, gitRef: string, relativePath: string): T | null => {
  try {
    const raw = execFileSync('git', ['show', `${gitRef}:${relativePath}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const detectVersionBump = (previousVersion: string | null, currentVersion: string): ReleaseBump => {
  if (!previousVersion || previousVersion === currentVersion) {
    return 'none';
  }

  const previous = /^(\d+)\.(\d+)\.(\d+)$/.exec(previousVersion.trim());
  const current = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion.trim());
  if (!previous || !current) {
    return 'none';
  }

  const [prevMajor, prevMinor, prevPatch] = previous.slice(1).map((value) => Number.parseInt(value ?? '0', 10));
  const [currMajor, currMinor, currPatch] = current.slice(1).map((value) => Number.parseInt(value ?? '0', 10));
  if (currMajor > prevMajor) return 'major';
  if (currMinor > prevMinor) return 'minor';
  if (currPatch > prevPatch) return 'patch';
  return 'none';
};

const hasManagedChangelogUpdate = (repoRoot: string, baseSha: string): boolean => {
  const current = readFileText(repoRoot, CHANGELOG_PATH);
  if (!current) {
    return false;
  }
  try {
    const previous = execFileSync('git', ['show', `${baseSha}:${CHANGELOG_PATH}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return previous !== current;
  } catch {
    return true;
  }
};

export const verifyReleaseGovernance = (repoRoot: string, options: { baseRef: string; baseSha: string }): ReleaseGovernanceFailure[] => {
  const policy = readVersionPolicy(repoRoot);
  const changedFiles = readChangedFiles(repoRoot, options.baseSha);
  const changedPaths = new Set(changedFiles.map((file) => file.path));

  let plan: ReleasePlan;
  try {
    plan = buildReleasePlanFromInputs(repoRoot, {
      generatedAt: new Date().toISOString(),
      baseRef: options.baseRef,
      baseSha: options.baseSha,
      headSha: resolveHeadSha(repoRoot),
      policy,
      changedFiles
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('lockstep version group')) {
      return [{
        id: 'release.versionGroup.inconsistent',
        message: 'Release governance requires every configured lockstep version group to stay complete and version-aligned.',
        evidence: `base_ref=${options.baseRef}; base_sha=${options.baseSha}; error=${message}`,
        fix: 'Align the version group members and rerun `pnpm playbook verify --json`.'
      }];
    }
    return [];
  }

  const workspacePackages = readWorkspacePackages(repoRoot, policy);
  const actualBumpByPackage = new Map(workspacePackages.map((pkg) => {
    const previous = readJsonAtGitRef<{ version?: string }>(repoRoot, options.baseSha, `${pkg.path}/package.json`);
    return [pkg.name, detectVersionBump(previous?.version ? String(previous.version) : null, pkg.currentVersion)] as const;
  }));

  const failures: ReleaseGovernanceFailure[] = [];

  for (const group of plan.versionGroups) {
    if (group.recommendedBump === 'none') {
      continue;
    }
    const memberVersions = group.packages
      .map((packageName) => workspacePackages.find((pkg) => pkg.name === packageName))
      .filter((value): value is WorkspacePackage => value !== undefined)
      .map((pkg) => pkg.currentVersion);
    const distinctVersions = uniqueSorted(memberVersions);
    if (distinctVersions.length > 1) {
      failures.push({
        id: 'release.versionGroup.inconsistent',
        message: `Release governance detected divergent versions inside lockstep group ${group.name}.`,
        evidence: `version_group=${group.name}; expected_bump=${group.recommendedBump}; current_versions=${distinctVersions.join(',')}`,
        fix: 'Apply one coordinated version update across the full lockstep group before merging.'
      });
      continue;
    }

    const memberBumps = uniqueSorted(group.packages.map((packageName) => actualBumpByPackage.get(packageName) ?? 'none'));
    if (memberBumps.length > 1) {
      failures.push({
        id: 'release.versionGroup.inconsistent',
        message: `Release governance requires lockstep group ${group.name} to receive one coordinated version bump.`,
        evidence: `version_group=${group.name}; expected_bump=${group.recommendedBump}; observed_bumps=${memberBumps.join(',')}`,
        fix: 'Update every package in the lockstep group to the same next version, or revert the partial version edits.'
      });
    }
  }

  const missingVersionPackages = plan.packages.filter((pkg) => pkg.recommendedBump !== 'none' && bumpRank[pkg.recommendedBump] > bumpRank[actualBumpByPackage.get(pkg.name) ?? 'none']);
  if (missingVersionPackages.length > 0) {
    failures.push({
      id: 'release.requiredVersionBump.missing',
      message: 'Release-relevant changes require a corresponding package version update before merge.',
      evidence: `base_ref=${options.baseRef}; packages=${missingVersionPackages.map((pkg) => `${pkg.name}:${pkg.currentVersion}:${pkg.recommendedBump}`).join(',')}; reasons=${uniqueSorted(missingVersionPackages.flatMap((pkg) => pkg.reasons)).join(',')}`,
      fix: 'Run `pnpm playbook release plan --json --out .playbook/release-plan.json`, review the artifact, then apply the approved release tasks.'
    });
  }

  const contractExpansionFiles = plan.diff.changedFiles.filter((file) => file.reasons.includes('stable contract expansion changed'));
  if (contractExpansionFiles.length > 0) {
    const packageVersionFilesChanged = plan.tasks
      .filter((task) => task.task_kind === 'release-package-version' && typeof task.file === 'string')
      .every((task) => changedPaths.has(task.file ?? ''));
    const changelogChanged = hasManagedChangelogUpdate(repoRoot, options.baseSha);
    if (!packageVersionFilesChanged || !changelogChanged) {
      failures.push({
        id: 'release.contractExpansion.releasePlan.required',
        message: 'Stable contract expansion must carry an applied release-governance update before merge.',
        evidence: `contract_files=${contractExpansionFiles.map((file) => file.path).join(',')}; recommended_bump=${plan.summary.recommendedBump}; package_updates_present=${String(packageVersionFilesChanged)}; changelog_updated=${String(changelogChanged)}`,
        fix: 'Generate `.playbook/release-plan.json`, apply the approved package/changelog tasks, and rerun verify.'
      });
    }
  }

  return failures;
};
