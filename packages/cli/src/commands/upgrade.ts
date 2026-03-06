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

type ModeDetection = {
  mode: IntegrationMode;
  currentVersion?: string;
};

type NeededMigration = {
  id: string;
  introducedIn: string;
  description: string;
  reason: string;
  safeToAutoApply: boolean;
};

type UpgradeJsonResult = {
  schemaVersion: '1.0';
  command: 'upgrade';
  ok: boolean;
  exitCode: number;
  mode: IntegrationMode;
  currentVersion?: string;
  targetVersion: string;
  recommendedCommands: string[];
  migrationsNeeded: NeededMigration[];
  applied?: MigrationApplyResult[];
  dryRun?: boolean;
  summary: string;
};

const readJson = (filePath: string): Record<string, unknown> | undefined => {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
};

const getCurrentCliVersion = (): string => {
  const cliPackagePath = new URL('../../package.json', import.meta.url);
  const packageJson = JSON.parse(fs.readFileSync(cliPackagePath, 'utf8')) as { version?: string };
  return packageJson.version ?? '0.1.1';
};

const extractDependencyVersion = (pkg: Record<string, unknown>): string | undefined => {
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

  for (const section of sections) {
    const block = pkg[section];
    if (!block || typeof block !== 'object') {
      continue;
    }

    const value = (block as Record<string, unknown>)['@fawxzzy/playbook'];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
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
      return { mode: 'dependency', currentVersion: dependencyVersion };
    }
  }

  const vendoredDir = path.join(repoRoot, 'Playbook');
  if (fs.existsSync(vendoredDir) && fs.statSync(vendoredDir).isDirectory()) {
    return { mode: 'vendored', currentVersion: detectVendoredVersion(repoRoot) };
  }

  return { mode: 'unknown' };
};

const recommendedCommandsForMode = (mode: IntegrationMode, targetVersion: string): string[] => {
  if (mode === 'dependency') {
    return [
      `pnpm add -D @fawxzzy/playbook@${targetVersion}`,
      'pnpm exec playbook upgrade --check',
      'pnpm exec playbook upgrade --apply'
    ];
  }

  if (mode === 'vendored') {
    return [
      `Update the vendored Playbook directory to version ${targetVersion} from your approved source.`,
      'Update Playbook/VERSION (or equivalent marker file).',
      'Run playbook upgrade --check to verify local migrations.'
    ];
  }

  return [
    'Install @fawxzzy/playbook as a dev dependency, or vendor a Playbook/ directory.',
    'Re-run playbook upgrade --check --from <currentVersion> after integration mode is known.'
  ];
};

const printText = (result: UpgradeJsonResult, options: UpgradeOptions): void => {
  if (options.quiet && result.ok && !options.check && !options.apply) {
    return;
  }

  console.log('Playbook upgrade');
  console.log(`- mode: ${result.mode}`);
  console.log(`- currentVersion: ${result.currentVersion ?? 'unknown'}`);
  console.log(`- targetVersion: ${result.targetVersion}`);
  console.log(`- offline: ${options.offline ? 'true' : 'false'} (network lookups are disabled in v1)`);

  console.log('Recommended manual upgrade commands:');
  for (const command of result.recommendedCommands) {
    console.log(`- ${command}`);
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

export const runUpgrade = async (cwd: string, options: UpgradeOptions): Promise<number> => {
  try {
    const integration = detectIntegrationMode(cwd);
    const targetVersion = options.to ?? getCurrentCliVersion();

    if ((options.check || options.apply) && integration.mode === 'unknown' && !options.from) {
      const unknownModeResult: UpgradeJsonResult = {
        schemaVersion: '1.0',
        command: 'upgrade',
        ok: false,
        exitCode: ExitCode.Failure,
        mode: integration.mode,
        currentVersion: integration.currentVersion,
        targetVersion,
        recommendedCommands: recommendedCommandsForMode(integration.mode, targetVersion),
        migrationsNeeded: [],
        summary: 'Unknown integration mode. Provide --from <version> to run upgrade checks safely.'
      };

      if (options.format === 'json') {
        console.log(JSON.stringify(unknownModeResult, null, 2));
      } else {
        printText(unknownModeResult, options);
      }

      return ExitCode.Failure;
    }

    const fromVersion = options.from ?? integration.currentVersion;
    let migrationsNeeded = await runChecks(cwd, fromVersion, targetVersion);
    let applied: MigrationApplyResult[] | undefined;

    if (options.apply) {
      applied = await runApply(cwd, options, fromVersion, targetVersion, migrationsNeeded);
      migrationsNeeded = await runChecks(cwd, fromVersion, targetVersion);
    }

    const exitCode = migrationsNeeded.length > 0 ? ExitCode.WarningsOnly : ExitCode.Success;
    const summary = options.apply
      ? migrationsNeeded.length > 0
        ? 'Upgrade apply finished with additional recommended migrations remaining.'
        : options.dryRun
          ? 'Upgrade dry-run completed successfully.'
          : 'Upgrade apply completed successfully.'
      : migrationsNeeded.length > 0
        ? 'Upgrade checks found recommended migrations.'
        : 'Upgrade checks passed with no recommended migrations.';

    const result: UpgradeJsonResult = {
      schemaVersion: '1.0',
      command: 'upgrade',
      ok: exitCode === ExitCode.Success,
      exitCode,
      mode: integration.mode,
      currentVersion: integration.currentVersion,
      targetVersion,
      recommendedCommands: recommendedCommandsForMode(integration.mode, targetVersion),
      migrationsNeeded,
      applied,
      dryRun: options.apply ? options.dryRun : undefined,
      summary
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printText(result, options);
    }

    return exitCode;
  } catch (error) {
    if (options.format === 'json') {
      const failed: UpgradeJsonResult = {
        schemaVersion: '1.0',
        command: 'upgrade',
        ok: false,
        exitCode: ExitCode.Failure,
        mode: 'unknown',
        targetVersion: options.to ?? getCurrentCliVersion(),
        recommendedCommands: [],
        migrationsNeeded: [],
        summary: String(error)
      };
      console.log(JSON.stringify(failed, null, 2));
    } else {
      console.error('playbook upgrade failed with an internal error.');
      console.error(String(error));
    }

    return ExitCode.Failure;
  }
};
