import fs from 'node:fs';
import path from 'node:path';
import { ExitCode } from '../lib/cliContract.js';
import { migrationRegistry, type MigrationApplyResult } from '../lib/migrations.js';

type UpgradeOptions = {
  check: boolean;
  apply: boolean;
  dryRun: boolean;
  offline: boolean;
  from?: string;
  to?: string;
  ci: boolean;
  format: 'text' | 'json';
  quiet: boolean;
  explain: boolean;
};

type IntegrationMode = 'dependency' | 'vendored' | 'unknown';

type UpgradeStatus = 'up_to_date' | 'upgrade_available' | 'upgrade_applied' | 'upgrade_blocked';

type ModeDetection = {
  mode: IntegrationMode;
  currentVersion?: string;
  dependencySection?: string;
};

type NeededMigration = {
  id: string;
  introducedIn: string;
  description: string;
  reason: string;
  safeToAutoApply: boolean;
};

type PackageManagerState = {
  manager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';
  status: 'supported' | 'unsupported' | 'ambiguous';
  details: string;
};

type UpgradeJsonResult = {
  schemaVersion: '1.0';
  kind: 'playbook-upgrade';
  currentVersion?: string;
  targetVersion: string;
  status: UpgradeStatus;
  actions: string[];
  notes: string[];
  mode: IntegrationMode;
  packageManager: PackageManagerState;
  command: 'upgrade';
  ok: boolean;
  exitCode: number;
  migrationsNeeded: NeededMigration[];
  applied?: MigrationApplyResult[];
  dryRun?: boolean;
  summary: string;
};

type UpgradeResultParams = {
  options: UpgradeOptions;
  integration: ModeDetection;
  packageManager: PackageManagerState;
  targetVersion: string;
  migrationsNeeded: NeededMigration[];
  exitCode: number;
  status: UpgradeStatus;
  summary: string;
  actions: string[];
  notes: string[];
  applied?: MigrationApplyResult[];
};

const readJson = (filePath: string): Record<string, unknown> | undefined => {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
};

const writeJson = (filePath: string, value: Record<string, unknown>): void => {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, serialized, 'utf8');
};

const getCurrentCliVersion = (): string => {
  const cliPackagePath = new URL('../../package.json', import.meta.url);
  const packageJson = JSON.parse(fs.readFileSync(cliPackagePath, 'utf8')) as { version?: string };
  return packageJson.version ?? '0.1.2';
};

const extractDependencyVersion = (pkg: Record<string, unknown>): { version: string; section: string } | undefined => {
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

  for (const section of sections) {
    const block = pkg[section];
    if (!block || typeof block !== 'object') {
      continue;
    }

    const value = (block as Record<string, unknown>)['@fawxzzy/playbook'];
    if (typeof value === 'string' && value.length > 0) {
      return { version: value, section };
    }
  }

  return undefined;
};

const normalizeVersionSpec = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('workspace:')) {
    return trimmed.slice('workspace:'.length).replace(/^[\^~><= ]+/, '').trim();
  }

  return trimmed.replace(/^[\^~><= ]+/, '').trim();
};

const isVersionAligned = (currentVersion: string | undefined, targetVersion: string): boolean => {
  const normalizedCurrent = normalizeVersionSpec(currentVersion);
  const normalizedTarget = normalizeVersionSpec(targetVersion);
  if (!normalizedCurrent || !normalizedTarget) {
    return false;
  }

  return normalizedCurrent === normalizedTarget;
};

const detectVendoredVersion = (repoRoot: string): string | undefined => {
  const candidates = [
    path.join(repoRoot, 'Playbook', 'VERSION'),
    path.join(repoRoot, 'Playbook', '.version'),
    path.join(repoRoot, 'Playbook', 'version.txt'),
    path.join(repoRoot, 'Playbook', 'package.json')
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    if (candidate.endsWith('package.json')) {
      const pkg = readJson(candidate);
      const version = pkg && typeof pkg.version === 'string' ? pkg.version : undefined;
      if (version) {
        return version;
      }
      continue;
    }

    const version = fs.readFileSync(candidate, 'utf8').trim();
    if (version.length > 0) {
      return version;
    }
  }

  return undefined;
};

const detectIntegrationMode = (repoRoot: string): ModeDetection => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pkg = readJson(packageJsonPath);

  if (pkg) {
    const dependencyVersion = extractDependencyVersion(pkg);
    if (dependencyVersion) {
      return { mode: 'dependency', currentVersion: dependencyVersion.version, dependencySection: dependencyVersion.section };
    }
  }

  const vendoredDir = path.join(repoRoot, 'Playbook');
  if (fs.existsSync(vendoredDir) && fs.statSync(vendoredDir).isDirectory()) {
    return { mode: 'vendored', currentVersion: detectVendoredVersion(repoRoot) };
  }

  return { mode: 'unknown' };
};

const detectPackageManagerState = (repoRoot: string): PackageManagerState => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pkg = readJson(packageJsonPath);
  const packageManagerField = typeof pkg?.packageManager === 'string' ? pkg.packageManager : undefined;

  const lockfiles = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' as const },
    { file: 'package-lock.json', manager: 'npm' as const },
    { file: 'yarn.lock', manager: 'yarn' as const },
    { file: 'bun.lockb', manager: 'bun' as const }
  ].filter((entry) => fs.existsSync(path.join(repoRoot, entry.file)));

  const detectedManagers = new Set<string>();
  for (const lockfile of lockfiles) {
    detectedManagers.add(lockfile.manager);
  }
  if (packageManagerField) {
    detectedManagers.add(packageManagerField.split('@')[0]);
  }

  if (detectedManagers.size > 1) {
    return {
      manager: 'unknown',
      status: 'ambiguous',
      details: `Detected multiple package managers: ${Array.from(detectedManagers).join(', ')}`
    };
  }

  if (detectedManagers.size === 0) {
    return {
      manager: 'unknown',
      status: 'unsupported',
      details: 'No package manager markers found (expected pnpm lockfile or packageManager field).'
    };
  }

  const manager = Array.from(detectedManagers)[0] as PackageManagerState['manager'];
  if (manager !== 'pnpm') {
    return {
      manager,
      status: 'unsupported',
      details: `Detected ${manager}; this operator flow currently supports pnpm-managed repositories only.`
    };
  }

  return {
    manager,
    status: 'supported',
    details: 'Detected pnpm repository markers.'
  };
};

const recommendedActions = (mode: IntegrationMode, targetVersion: string): string[] => {
  if (mode === 'dependency') {
    return ['pnpm install', 'pnpm playbook verify', 'pnpm playbook index --json'];
  }

  if (mode === 'vendored') {
    return [
      `Update the vendored Playbook directory to version ${targetVersion} from your approved source.`,
      'Update Playbook/VERSION (or equivalent marker file).',
      'pnpm playbook upgrade --check --json'
    ];
  }

  return [
    'Install @fawxzzy/playbook as a dev dependency in package.json.',
    'pnpm install',
    'pnpm playbook upgrade --json'
  ];
};

const toUpgradeResult = ({
  options,
  integration,
  packageManager,
  targetVersion,
  migrationsNeeded,
  exitCode,
  status,
  summary,
  actions,
  notes,
  applied
}: UpgradeResultParams): UpgradeJsonResult => ({
  schemaVersion: '1.0',
  kind: 'playbook-upgrade',
  currentVersion: integration.currentVersion,
  targetVersion,
  status,
  actions,
  notes,
  mode: integration.mode,
  packageManager,
  command: 'upgrade',
  ok: exitCode === ExitCode.Success,
  exitCode,
  migrationsNeeded,
  applied,
  dryRun: options.apply ? options.dryRun : undefined,
  summary
});

const emitUpgradeResult = (result: UpgradeJsonResult, options: UpgradeOptions): void => {
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printText(result, options);
};

const printText = (result: UpgradeJsonResult, options: UpgradeOptions): void => {
  if (options.quiet && result.ok && !options.check && !options.apply) {
    return;
  }

  console.log('Playbook upgrade');
  console.log(`- status: ${result.status}`);
  console.log(`- mode: ${result.mode}`);
  console.log(`- currentVersion: ${result.currentVersion ?? 'unknown'}`);
  console.log(`- targetVersion: ${result.targetVersion}`);
  console.log(`- packageManager: ${result.packageManager.manager} (${result.packageManager.status})`);

  console.log('Actions:');
  for (const command of result.actions) {
    console.log(`- ${command}`);
  }

  if (result.notes.length > 0) {
    console.log('Notes:');
    for (const note of result.notes) {
      console.log(`- ${note}`);
    }
  }

  console.log('Migration check summary:');
  if (result.migrationsNeeded.length === 0) {
    console.log('- no recommended migrations');
  } else {
    for (const migration of result.migrationsNeeded) {
      console.log(`- ${migration.id}: ${migration.reason}`);
      if (options.explain) {
        console.log(`  introducedIn: ${migration.introducedIn}`);
        console.log(`  description: ${migration.description}`);
        console.log(`  safeToAutoApply: ${migration.safeToAutoApply}`);
      }
    }
  }

  if (result.applied && result.applied.length > 0) {
    console.log(options.dryRun ? 'Planned migration updates:' : 'Applied migration updates:');
    for (const entry of result.applied) {
      console.log(`- ${entry.summary}`);
    }
  }

  console.log(result.summary);
};

const runChecks = async (
  repoRoot: string,
  fromVersion: string | undefined,
  targetVersion: string
): Promise<NeededMigration[]> => {
  const checks = await Promise.all(
    migrationRegistry.map(async (migration) => {
      const checkResult = await migration.check({ repoRoot, fromVersion, toVersion: targetVersion });
      if (!checkResult.needed) {
        return undefined;
      }
      return {
        id: migration.id,
        introducedIn: migration.introducedIn,
        description: migration.description,
        reason: checkResult.reason,
        safeToAutoApply: migration.safeToAutoApply
      } as NeededMigration;
    })
  );

  return checks.filter((value): value is NeededMigration => Boolean(value));
};

const runApply = async (
  repoRoot: string,
  options: UpgradeOptions,
  fromVersion: string | undefined,
  targetVersion: string,
  migrationsNeeded: NeededMigration[]
): Promise<MigrationApplyResult[]> => {
  const neededSet = new Set(migrationsNeeded.map((migration) => migration.id));
  const applied: MigrationApplyResult[] = [];

  for (const migration of migrationRegistry) {
    if (!neededSet.has(migration.id) || !migration.safeToAutoApply || !migration.apply) {
      continue;
    }

    applied.push(
      await migration.apply({
        repoRoot,
        fromVersion,
        toVersion: targetVersion,
        dryRun: options.dryRun
      })
    );
  }

  return applied;
};


const classifyUpgradeExitCode = ({
  status,
  migrationsNeeded
}: {
  status: UpgradeStatus;
  migrationsNeeded: NeededMigration[];
}): number => {
  if (status === 'upgrade_blocked') {
    return ExitCode.WarningsOnly;
  }

  if (status === 'upgrade_applied') {
    return ExitCode.Success;
  }

  return migrationsNeeded.length > 0 ? ExitCode.WarningsOnly : ExitCode.Success;
};

const applyDependencyVersionBump = (
  repoRoot: string,
  integration: ModeDetection,
  targetVersion: string,
  dryRun: boolean
): { changed: boolean; note: string } => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pkg = readJson(packageJsonPath);
  if (!pkg || integration.mode !== 'dependency' || !integration.dependencySection) {
    return { changed: false, note: 'Package mutation skipped: dependency section not detected.' };
  }

  const section = pkg[integration.dependencySection];
  if (!section || typeof section !== 'object') {
    return { changed: false, note: 'Package mutation skipped: dependency section missing from package.json.' };
  }

  const deps = section as Record<string, unknown>;
  const currentSpec = typeof deps['@fawxzzy/playbook'] === 'string' ? (deps['@fawxzzy/playbook'] as string) : undefined;
  if (!currentSpec) {
    return { changed: false, note: 'Package mutation skipped: @fawxzzy/playbook dependency not found.' };
  }

  const prefixMatch = currentSpec.match(/^(workspace:)?[\^~]/);
  const nextSpec = `${prefixMatch?.[0] ?? '^'}${targetVersion}`;
  if (nextSpec === currentSpec) {
    return { changed: false, note: 'Dependency already pinned to target version.' };
  }

  if (!dryRun) {
    deps['@fawxzzy/playbook'] = nextSpec;
    writeJson(packageJsonPath, pkg);
  }

  return {
    changed: true,
    note: dryRun
      ? `Dry-run: would update @fawxzzy/playbook from ${currentSpec} to ${nextSpec}.`
      : `Updated @fawxzzy/playbook from ${currentSpec} to ${nextSpec}.`
  };
};

export const runUpgrade = async (cwd: string, options: UpgradeOptions): Promise<number> => {
  try {
    const integration = detectIntegrationMode(cwd);
    const packageManager = detectPackageManagerState(cwd);
    const targetVersion = options.to ?? getCurrentCliVersion();
    const currentVersion = options.from ?? integration.currentVersion;
    const versionAligned = isVersionAligned(currentVersion, targetVersion);

    let status: UpgradeStatus = versionAligned ? 'up_to_date' : 'upgrade_available';
    let notes: string[] = [packageManager.details];
    let actions = recommendedActions(integration.mode, targetVersion);

    if (integration.mode === 'unknown') {
      status = 'upgrade_blocked';
      notes = [...notes, 'Unable to detect Playbook integration mode for this repository.'];
    }

    if (integration.mode === 'vendored' && options.apply) {
      status = 'upgrade_blocked';
      notes = [...notes, 'Automatic dependency bump is not supported for vendored mode.'];
    }

    if (options.apply && integration.mode === 'dependency' && packageManager.status !== 'supported') {
      status = 'upgrade_blocked';
      notes = [...notes, 'Automatic upgrade apply is only supported for pnpm-managed dependency mode repositories.'];
    }

    let migrationsNeeded = await runChecks(cwd, currentVersion, targetVersion);
    let applied: MigrationApplyResult[] | undefined;

    if (options.apply && status !== 'upgrade_blocked' && integration.mode === 'dependency') {
      let dependencyChanged = false;

      if (!versionAligned) {
        const dependencyMutation = applyDependencyVersionBump(cwd, integration, targetVersion, options.dryRun);
        notes = [...notes, dependencyMutation.note];
        dependencyChanged = dependencyMutation.changed;
      }

      applied = await runApply(cwd, options, currentVersion, targetVersion, migrationsNeeded);
      const migrationChanged = (applied ?? []).some((entry) => entry.changed);
      migrationsNeeded = await runChecks(cwd, currentVersion, targetVersion);
      status = dependencyChanged || migrationChanged ? 'upgrade_applied' : 'up_to_date';
      actions = ['pnpm install', 'pnpm playbook verify', 'pnpm playbook index --json'];
    }

    const exitCode = classifyUpgradeExitCode({ status, migrationsNeeded });

    const summary =
      status === 'upgrade_applied'
        ? options.dryRun
          ? 'Upgrade dry-run produced deterministic local update actions.'
          : 'Upgrade applied local dependency update actions successfully.'
        : status === 'up_to_date'
          ? 'Repository Playbook dependency is already aligned with target version.'
          : status === 'upgrade_available'
            ? 'A newer Playbook version is available for this repository.'
            : 'Upgrade is blocked until repository integration/package-manager state is resolved.';

    const result = toUpgradeResult({
      options,
      integration,
      packageManager,
      targetVersion,
      migrationsNeeded,
      exitCode,
      status,
      summary,
      actions,
      notes,
      applied
    });
    emitUpgradeResult(result, options);

    return exitCode;
  } catch (error) {
    if (options.format !== 'json') {
      console.error('playbook upgrade failed with an internal error.');
      console.error(String(error));
    } else {
      const failed = toUpgradeResult({
        options,
        integration: { mode: 'unknown' },
        packageManager: { manager: 'unknown', status: 'unsupported', details: 'Unable to detect package manager state.' },
        targetVersion: options.to ?? getCurrentCliVersion(),
        migrationsNeeded: [],
        exitCode: ExitCode.Failure,
        status: 'upgrade_blocked',
        summary: String(error),
        actions: ['Review command output and retry with --to <version> after resolving repository state.'],
        notes: [String(error)]
      });
      emitUpgradeResult(failed, options);
    }

    return ExitCode.Failure;
  }
};
