#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertLocalCliBuild,
  cloneDemoRepository,
  installNodeDependencies,
  localCliEntrypoint,
  run
} from './demo-repo-utils.mjs';

const DEFAULT_REPO_URL = 'https://github.com/ZachariahRedfield/playbook-demo.git';
const DEFAULT_BASE_BRANCH = 'main';
const DEFAULT_FEATURE_ID = 'PB-V1-DEMO-REFRESH-001';
const REQUIRED_ALLOWED_PATHS = ['.playbook/demo-artifacts/', '.playbook/repo-index.json', 'docs/ARCHITECTURE_DIAGRAMS.md'];
const DEFAULT_GIT_AUTHOR_NAME = 'playbook-demo-refresh[bot]';
const DEFAULT_GIT_AUTHOR_EMAIL = 'playbook-demo-refresh[bot]@users.noreply.github.com';

const parseArgs = (argv) => {
  const args = {
    dryRun: true,
    push: false,
    repoUrl: process.env.PLAYBOOK_DEMO_REPO_URL ?? DEFAULT_REPO_URL,
    base: DEFAULT_BASE_BRANCH,
    branch: '',
    featureId: process.env.PLAYBOOK_DEMO_FEATURE_ID ?? DEFAULT_FEATURE_ID
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--push') {
      args.push = true;
      args.dryRun = false;
      continue;
    }
    if (arg === '--repo-url') {
      args.repoUrl = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--branch') {
      args.branch = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--base') {
      args.base = argv[index + 1] ?? DEFAULT_BASE_BRANCH;
      index += 1;
      continue;
    }
    if (arg === '--feature-id') {
      args.featureId = argv[index + 1] ?? DEFAULT_FEATURE_ID;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.repoUrl) {
    throw new Error('Missing required --repo-url value.');
  }

  if (!args.featureId) {
    throw new Error('Missing required --feature-id value.');
  }

  return args;
};

const parseChangedFiles = (repoDir) => {
  const status = run({ cwd: repoDir, command: 'git', args: ['status', '--porcelain', '--untracked-files=all'] });
  return status.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3));
};

const resolveAllowedPaths = () => {
  const extra = (process.env.PLAYBOOK_DEMO_EXTRA_ALLOWED_PATHS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...REQUIRED_ALLOWED_PATHS, ...extra];
};

const isAllowedFile = (filePath, allowlist) =>
  allowlist.some((allowedPath) => (allowedPath.endsWith('/') ? filePath.startsWith(allowedPath) : filePath === allowedPath));

const tokenizeCommand = (command) => {
  const tokens = [];
  let current = '';
  let quote = '';

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) {
        quote = '';
      } else if (character === '\\' && quote === '"' && index + 1 < command.length) {
        current += command[index + 1];
        index += 1;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    if (character === '\\' && index + 1 < command.length) {
      current += command[index + 1];
      index += 1;
      continue;
    }

    current += character;
  }

  if (quote) {
    throw new Error(`Invalid PLAYBOOK_DEMO_REFRESH_CMD: unmatched ${quote} quote.`);
  }

  if (current) {
    tokens.push(current);
  }

  if (tokens.length === 0) {
    throw new Error('PLAYBOOK_DEMO_REFRESH_CMD was provided but empty after parsing.');
  }

  return tokens;
};

const resolveRefreshCommand = (demoDir) => {
  const configured = process.env.PLAYBOOK_DEMO_REFRESH_CMD;
  if (configured) {
    const [command, ...args] = tokenizeCommand(configured);
    return {
      description: configured,
      command,
      args
    };
  }

  const packageJsonPath = path.join(demoDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('playbook-demo package.json is missing; unable to determine refresh command.');
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const candidates = ['refresh:playbook', 'demo:refresh', 'refresh'];
  const hasNpmLock = fs.existsSync(path.join(demoDir, 'package-lock.json'));
  const hasPnpmLock = fs.existsSync(path.join(demoDir, 'pnpm-lock.yaml'));
  const hasYarnLock = fs.existsSync(path.join(demoDir, 'yarn.lock'));

  let packageManager = 'npm';
  if (hasPnpmLock) {
    packageManager = 'pnpm';
  } else if (hasYarnLock) {
    packageManager = 'yarn';
  } else if (hasNpmLock) {
    packageManager = 'npm';
  }

  for (const name of candidates) {
    if (typeof scripts[name] === 'string' && scripts[name].trim()) {
      if (packageManager === 'pnpm') {
        return { description: `pnpm run ${name}`, command: 'pnpm', args: ['run', name] };
      }
      if (packageManager === 'yarn') {
        return { description: `yarn run ${name}`, command: 'yarn', args: ['run', name] };
      }
      return { description: `npm run ${name}`, command: 'npm', args: ['run', name] };
    }
  }

  throw new Error(
    'Unable to resolve demo refresh command. Set PLAYBOOK_DEMO_REFRESH_CMD (for example "npm run demo:refresh").'
  );
};

const runRefreshCommand = ({ demoDir, refreshCommand }) => {
  run({
    cwd: demoDir,
    command: refreshCommand.command,
    args: refreshCommand.args,
    env: {
      ...process.env,
      PLAYBOOK_CLI_PATH: localCliEntrypoint
    }
  });
};

const configureGitIdentity = (demoDir) => {
  const gitAuthorName = process.env.PLAYBOOK_GIT_AUTHOR_NAME ?? DEFAULT_GIT_AUTHOR_NAME;
  const gitAuthorEmail = process.env.PLAYBOOK_GIT_AUTHOR_EMAIL ?? DEFAULT_GIT_AUTHOR_EMAIL;

  run({ cwd: demoDir, command: 'git', args: ['config', 'user.name', gitAuthorName] });
  run({ cwd: demoDir, command: 'git', args: ['config', 'user.email', gitAuthorEmail] });

  return { gitAuthorName, gitAuthorEmail };
};

const configurePushAuthentication = (demoDir) => {
  const token = process.env.PLAYBOOK_DEMO_GH_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new Error('Push mode requires PLAYBOOK_DEMO_GH_TOKEN or GH_TOKEN.');
  }

  const authHeader = Buffer.from(`x-access-token:${token}`).toString('base64');
  run({
    cwd: demoDir,
    command: 'git',
    args: ['config', 'http.https://github.com/.extraheader', `AUTHORIZATION: basic ${authHeader}`]
  });
  return token;
};

const stageAllowedChanges = ({ demoDir, changedFiles, allowlist }) => {
  for (const file of changedFiles) {
    if (isAllowedFile(file, allowlist)) {
      run({ cwd: demoDir, command: 'git', args: ['add', '--', file] });
    }
  }
};

const createOrUpdatePullRequest = ({ demoDir, featureId, branch, base, token }) => {
  const title = `${featureId}: refresh committed Playbook demo artifacts`;
  const body = `## Summary\n- refresh committed demo artifacts/docs using local Playbook CLI build\n- enforce allowlisted committed surfaces only\n\n## Feature\n- ${featureId}\n`;

  const env = { ...process.env, GH_TOKEN: token };
  const prView = run({ cwd: demoDir, command: 'gh', args: ['pr', 'view', branch, '--json', 'number'], allowFailure: true, env });
  if (prView.status === 0) {
    run({ cwd: demoDir, command: 'gh', args: ['pr', 'edit', branch, '--title', title, '--body', body], env });
    return 'updated';
  }

  run({ cwd: demoDir, command: 'gh', args: ['pr', 'create', '--base', base, '--head', branch, '--title', title, '--body', body], env });
  return 'created';
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  assertLocalCliBuild();

  const { demoDir } = cloneDemoRepository({ repoUrl: args.repoUrl, prefix: 'playbook-demo-refresh' });
  installNodeDependencies(demoDir);

  const refreshCommand = resolveRefreshCommand(demoDir);
  console.log(`Using refresh command: ${refreshCommand.description}`);
  runRefreshCommand({ demoDir, refreshCommand });

  const changedFiles = parseChangedFiles(demoDir);
  if (changedFiles.length === 0) {
    console.log('No demo changes detected.');
    return;
  }

  const allowlist = resolveAllowedPaths();
  const disallowed = changedFiles.filter((file) => !isAllowedFile(file, allowlist));

  console.log('Detected changes:');
  for (const file of changedFiles) {
    console.log(`- ${file}`);
  }

  if (disallowed.length > 0) {
    throw new Error(`Refresh modified non-allowlisted files:\n${disallowed.map((f) => `- ${f}`).join('\n')}`);
  }

  if (args.dryRun) {
    console.log('Dry-run mode: no commit/push/PR actions taken.');
    return;
  }

  if (!args.push) {
    throw new Error('Non-dry-run execution requires --push.');
  }

  const branch = args.branch || `automation/demo-refresh/${args.featureId.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
  const gitIdentity = configureGitIdentity(demoDir);
  const token = configurePushAuthentication(demoDir);
  console.log(`Configured git author identity: ${gitIdentity.gitAuthorName} <${gitIdentity.gitAuthorEmail}>`);
  console.log('Configured explicit GitHub authentication for push via git http extraheader.');

  run({ cwd: demoDir, command: 'git', args: ['checkout', '-b', branch] });
  stageAllowedChanges({ demoDir, changedFiles, allowlist });

  const staged = run({ cwd: demoDir, command: 'git', args: ['diff', '--cached', '--name-only'] }).stdout.trim();
  if (!staged) {
    console.log('No allowlisted files were staged. Nothing to commit.');
    return;
  }

  run({ cwd: demoDir, command: 'git', args: ['commit', '-m', `${args.featureId}: refresh Playbook demo artifacts`] });
  run({ cwd: demoDir, command: 'git', args: ['push', '-u', 'origin', branch] });
  const prStatus = createOrUpdatePullRequest({ demoDir, featureId: args.featureId, branch, base: args.base, token });
  console.log(`PR ${prStatus} for branch ${branch}.`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
