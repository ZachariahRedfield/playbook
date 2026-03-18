#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_OWNER = 'ZachariahRedfield';
const DEFAULT_REPO = 'playbook';
const IS_WINDOWS = process.platform === 'win32';

export const resolveCommand = (command, platform = process.platform) => {
  if (platform !== 'win32') return command;
  if (command === 'npm' || command === 'npx') return `${command}.cmd`;
  if (command === 'curl' || command === 'tar') return `${command}.exe`;
  return command;
};

const NPM_COMMAND = resolveCommand('npm');
const NPX_COMMAND = resolveCommand('npx');
const CURL_COMMAND = resolveCommand('curl');
const TAR_COMMAND = resolveCommand('tar');
const WINDOWS_SHELL = process.env.ComSpec || 'cmd.exe';

const quoteWindowsCommandArg = (arg) => {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(arg)) return arg;
  return `"${String(arg).replace(/"/g, '\"')}"`;
};

export const createSpawnInvocation = (cmd, args, platform = process.platform) => {
  if (platform !== 'win32') return { spawnCommand: cmd, spawnArgs: args, command: `${cmd} ${args.join(' ')}`.trim() };

  const lowerCommand = cmd.toLowerCase();
  if (lowerCommand !== 'npm' && lowerCommand !== 'npm.cmd' && lowerCommand !== 'npx' && lowerCommand !== 'npx.cmd') {
    return { spawnCommand: cmd, spawnArgs: args, command: `${cmd} ${args.join(' ')}`.trim() };
  }

  const commandString = [cmd, ...args].map(quoteWindowsCommandArg).join(' ');
  return {
    spawnCommand: WINDOWS_SHELL,
    spawnArgs: ['/d', '/s', '/c', commandString],
    command: `${cmd} ${args.join(' ')}`.trim()
  };
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = {
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    version: '',
    consumerRepo: '',
    assetPath: '',
    json: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--version') result.version = args[++i] ?? '';
    else if (arg === '--owner') result.owner = args[++i] ?? DEFAULT_OWNER;
    else if (arg === '--repo') result.repo = args[++i] ?? DEFAULT_REPO;
    else if (arg === '--consumer-repo') result.consumerRepo = args[++i] ?? '';
    else if (arg === '--asset-path') result.assetPath = args[++i] ?? '';
    else if (arg === '--json') result.json = true;
    else if (arg === '--help') {
      process.stdout.write(
        [
          'Usage: node scripts/release-fallback-proof.mjs --version <x.y.z> [--asset-path <tarball>] [--consumer-repo <path>] [--json]',
          '',
          'Verifies Playbook release fallback tarball provisioning and optionally runs consumer fallback smoke checks.',
          'When --asset-path is omitted the proof downloads https://github.com/<owner>/<repo>/releases/download/v<version>/playbook-cli-<version>.tgz'
        ].join('\n') + '\n'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!result.version) throw new Error('--version is required');
  return result;
};


export const ensureConsumerPackageBaseline = (consumerRepo) => {
  mkdirSync(consumerRepo, { recursive: true });
  const packageJsonPath = path.join(consumerRepo, 'package.json');
  if (existsSync(packageJsonPath)) return packageJsonPath;

  writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: 'playbook-fallback-proof-consumer',
        private: true,
        version: '0.0.0',
        description: 'Machine-generated fallback proof consumer baseline'
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  return packageJsonPath;
};

export const run = (cmd, args, cwd = process.cwd(), spawnImpl = spawnSync, platform = process.platform) => {
  const startedAt = Date.now();
  const invocation = createSpawnInvocation(cmd, args, platform);
  const child = spawnImpl(invocation.spawnCommand, invocation.spawnArgs, { cwd, encoding: 'utf8' });
  const endedAt = Date.now();
  const spawnError = child.error ?? null;

  return {
    ok: child.status === 0 && spawnError === null,
    status: child.status,
    stdout: child.stdout,
    stderr: child.stderr,
    command: invocation.command,
    startedAt,
    endedAt,
    errorMessage: spawnError?.message,
    errorCode: spawnError?.code,
    errorName: spawnError?.name,
    errorErrno: spawnError?.errno,
    errorSyscall: spawnError?.syscall,
    errorPath: spawnError?.path,
    errorSpawnargs: Array.isArray(spawnError?.spawnargs) ? spawnError.spawnargs : undefined
  };
};

const createCheck = (name, ok, command, extras = {}) => ({
  name,
  ok,
  command,
  status: ok ? 0 : 1,
  ...extras
});

const classifyArtifactFailure = ({ exists, parseError, schemaError, stale }) => {
  if (!exists) return 'missing_prerequisite_artifact';
  if (parseError || schemaError) return 'invalid_artifact';
  if (stale) return 'stale_artifact';
  return null;
};

const extractArtifactPayload = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (parsed.data && typeof parsed.data === 'object') return parsed.data;
  return parsed;
};

const validateArtifactSchema = (parsed, schema) => {
  if (!schema) return null;
  const payload = extractArtifactPayload(parsed);
  if (schema.kind === 'repo-graph') {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.edges)) {
      return 'Expected JSON object with an edges array.';
    }
    return null;
  }

  if (schema.kind === 'plan') {
    if (!payload || typeof payload !== 'object') {
      return 'Expected JSON object.';
    }
    if (payload.command !== 'plan') {
      return 'Expected command field to equal "plan".';
    }
    return null;
  }

  return null;
};

const requiredTarEntries = [
  'package/bin/playbook.js',
  'package/runtime/main.js'
];

export const parseTarEntries = (stdout) =>
  stdout
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

const hasVendoredRuntime = (entries) => entries.some((entry) => entry.startsWith('package/runtime/node_modules/'));

export const evaluateTarballEntries = ({ tarPath, tarEntries }) => {
  const checks = [];

  for (const entry of requiredTarEntries) {
    const present = tarEntries.includes(entry);
    checks.push(
      createCheck(`tarball contains ${entry}`, present, `node tar-entry-check ${tarPath} ${entry}`, {
        reason: present ? undefined : `Expected tarball entry ${entry} was not found.`
      })
    );
  }

  const hasRuntime = hasVendoredRuntime(tarEntries);
  checks.push(
    createCheck('tarball contains vendored runtime dependencies', hasRuntime, `node tar-entry-prefix-check ${tarPath} package/runtime/node_modules/`, {
      reason: hasRuntime ? undefined : 'Expected vendored runtime dependencies under package/runtime/node_modules/.'
    })
  );

  return checks;
};

export const evaluateArtifactContracts = ({ repoRoot, contracts, producerRuns = {} }) =>
  contracts.map((contract) => {
    const absolutePath = path.join(repoRoot, contract.path);
    const producerRun = producerRuns[contract.producerKey] ?? null;
    const exists = existsSync(absolutePath);

    let parseError = null;
    let schemaError = null;
    let stale = false;

    if (exists) {
      try {
        const parsed = JSON.parse(readFileSync(absolutePath, 'utf8'));
        schemaError = validateArtifactSchema(parsed, contract.schema);
      } catch (error) {
        parseError = error instanceof Error ? error.message : String(error);
      }

      if (producerRun?.startedAt) {
        stale = statSync(absolutePath).mtimeMs < producerRun.startedAt;
      }
    }

    const failureType = classifyArtifactFailure({ exists, parseError, schemaError, stale });
    const reason =
      failureType === 'missing_prerequisite_artifact'
        ? `Artifact not found at ${contract.path}.`
        : failureType === 'stale_artifact'
          ? `Artifact exists but predates producer command ${contract.producerCommand}.`
          : failureType === 'invalid_artifact'
            ? `Artifact JSON/schema validation failed for ${contract.path}.`
            : null;

    const details = [parseError, schemaError].filter(Boolean).join(' ');

    return {
      name: `artifact assertion: ${contract.path}`,
      ok: failureType === null,
      command: `node artifact-exists-check ${contract.path}`,
      status: failureType === null ? 0 : 1,
      artifactPath: contract.path,
      failureType,
      reason: reason ?? undefined,
      expectedProducerCommand: contract.producerCommand,
      remediation: contract.remediation,
      severity: contract.severity,
      details: details || undefined
    };
  });

const main = async () => {
  const options = parseArgs();
  const assetUrl = `https://github.com/${options.owner}/${options.repo}/releases/download/v${options.version}/playbook-cli-${options.version}.tgz`;
  const assetPath = options.assetPath ? path.resolve(options.assetPath) : '';

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'playbook-release-fallback-proof-'));
  const tarPath = assetPath || path.join(tmp, `playbook-cli-${options.version}.tgz`);

  const sourceCheck = assetPath
    ? createCheck('local fallback asset exists', existsSync(assetPath), `node artifact-exists-check ${assetPath}`, {
        artifactPath: assetPath,
        reason: existsSync(assetPath) ? undefined : `Local fallback tarball not found at ${assetPath}.`
      })
    : { name: 'release asset download', ...run(CURL_COMMAND, ['-sSfL', assetUrl, '-o', tarPath]) };

  const inspect = sourceCheck.ok ? run(TAR_COMMAND, ['-tzf', tarPath]) : { ok: false, command: `${TAR_COMMAND} -tzf ${tarPath}` };
  const tarEntries = inspect.ok ? parseTarEntries(inspect.stdout) : [];

  const checks = [sourceCheck, { name: 'release asset tar inspection', ...inspect }];
  checks.push(...evaluateTarballEntries({ tarPath, tarEntries }));

  if (options.consumerRepo) {
    const consumerRepo = path.resolve(options.consumerRepo);
    ensureConsumerPackageBaseline(consumerRepo);
    const fallbackSpec = assetPath ? tarPath : assetUrl;
    const envPath = path.join(consumerRepo, '.env.playbook-fallback-proof');
    writeFileSync(envPath, `PLAYBOOK_OFFICIAL_FALLBACK_SPEC=${fallbackSpec}\n`, 'utf8');

    const install = { name: 'consumer npm install', ...run(NPM_COMMAND, ['install'], consumerRepo) };
    const packageMiss = {
      name: 'consumer package acquisition attempt fails as expected',
      ...(() => {
        const result = run(NPM_COMMAND, ['install', '@fawxzzy/playbook-cli@9999.0.0'], consumerRepo);
        return { ...result, ok: !result.ok };
      })()
    };
    const fallbackInstall = {
      name: 'consumer fallback acquisition from release tarball',
      ...run(NPM_COMMAND, ['install', '--no-save', fallbackSpec], consumerRepo)
    };
    const index = {
      name: 'consumer prerequisite: index',
      ...run(NPX_COMMAND, ['playbook', 'index', '--json'], consumerRepo)
    };
    const verify = {
      name: 'consumer canonical ladder: verify',
      ...run(NPX_COMMAND, ['playbook', 'verify', '--json'], consumerRepo)
    };
    const plan = {
      name: 'consumer canonical ladder: plan',
      ...run(NPX_COMMAND, ['playbook', 'plan', '--json', '--out', '.playbook/plan.json'], consumerRepo)
    };
    const apply = {
      name: 'consumer canonical ladder: apply',
      ...run(NPX_COMMAND, ['playbook', 'apply', '--from-plan', '.playbook/plan.json', '--json'], consumerRepo)
    };

    checks.push(install, packageMiss, fallbackInstall, index, verify, plan, apply);

    const artifactContracts = [
      {
        path: '.playbook/repo-graph.json',
        producerKey: 'index',
        producerCommand: 'npx playbook index --json',
        remediation: 'Run "npx playbook index --json" in the consumer repository before rerunning fallback proof.',
        severity: 'setup_precondition_fail',
        schema: { kind: 'repo-graph' }
      },
      {
        path: '.playbook/plan.json',
        producerKey: 'plan',
        producerCommand: 'npx playbook plan --json',
        remediation: 'Run "npx playbook verify --json" then "npx playbook plan --json" in the consumer repository before rerunning fallback proof.',
        severity: 'hard_fail',
        schema: { kind: 'plan' }
      }
    ];

    checks.push(
      ...evaluateArtifactContracts({
        repoRoot: consumerRepo,
        contracts: artifactContracts,
        producerRuns: { index, plan }
      })
    );
  }

  const ok = checks.every((item) => item.ok);
  const payload = {
    ok,
    version: options.version,
    assetUrl,
    assetPath: assetPath || undefined,
    checks: checks.map((item) => ({
      name: item.name,
      ok: item.ok,
      command: item.command,
      status: item.status ?? null,
      stdout: item.stdout?.trim() || undefined,
      stderr: item.stderr?.trim() || undefined,
      artifactPath: item.artifactPath,
      failureType: item.failureType,
      reason: item.reason,
      expectedProducerCommand: item.expectedProducerCommand,
      remediation: item.remediation,
      severity: item.severity,
      details: item.details,
      errorMessage: item.errorMessage,
      errorCode: item.errorCode,
      errorName: item.errorName,
      errorErrno: item.errorErrno,
      errorSyscall: item.errorSyscall,
      errorPath: item.errorPath,
      errorSpawnargs: item.errorSpawnargs
    }))
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    for (const item of payload.checks) {
      process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}: ${item.command}\n`);
      if (!item.ok && item.artifactPath) {
        process.stdout.write(
          `  -> ${item.failureType ?? 'check_failed'}${item.severity ? ` [${item.severity}]` : ''} at ${item.artifactPath}${item.expectedProducerCommand ? `; producer: ${item.expectedProducerCommand}` : ''}\n`
        );
      }
      if (!item.ok && item.reason) process.stdout.write(`  -> ${item.reason}\n`);
      if (!item.ok && item.errorMessage) {
        process.stdout.write(`  -> spawn error: ${item.errorMessage}${item.errorCode ? ` [${item.errorCode}]` : ''}\n`);
      }
      if (!item.ok && item.remediation) process.stdout.write(`  -> remediation: ${item.remediation}\n`);
    }
    process.stdout.write(`Asset URL: ${assetUrl}\n`);
    if (assetPath) process.stdout.write(`Asset path: ${assetPath}\n`);
  }

  rmSync(tmp, { recursive: true, force: true });
  if (!ok) process.exit(1);
};

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
