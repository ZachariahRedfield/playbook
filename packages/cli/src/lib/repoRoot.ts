import fs from 'node:fs';
import path from 'node:path';

export const stripGlobalRepoOption = (allArgs: readonly string[]): { args: string[]; repo: string | undefined } => {
  const stripped: string[] = [];
  let repo: string | undefined;
  let index = 0;

  while (index < allArgs.length) {
    const arg = allArgs[index];
    if (arg === '--repo') {
      const value = allArgs[index + 1];
      if (value && !value.startsWith('-')) {
        repo = String(value);
        index += 2;
        continue;
      }

      stripped.push(arg);
      index += 1;
      continue;
    }

    if (arg.startsWith('--repo=')) {
      const value = arg.slice('--repo='.length);
      if (value.length > 0) {
        repo = value;
        index += 1;
        continue;
      }

      stripped.push(arg);
      index += 1;
      continue;
    }

    if (arg === '--' || !arg.startsWith('-')) {
      break;
    }

    stripped.push(arg);
    index += 1;
  }

  stripped.push(...allArgs.slice(index));

  return { args: stripped, repo };
};

const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;

const normalizeWindowsAbsolutePath = (repo: string): string => {
  if (process.platform === 'win32' || !WINDOWS_ABSOLUTE_PATH_PATTERN.test(repo)) {
    return repo;
  }

  const drive = repo.slice(0, 1).toLowerCase();
  const remainder = repo.slice(2).replace(/[\\]+/g, '/').replace(/^\/+/, '');
  return path.posix.join('/mnt', drive, remainder);
};

export const resolveTargetRepoRoot = (invocationCwd: string, repo: string | undefined): string => {
  const requestedPath = repo ? normalizeWindowsAbsolutePath(repo) : invocationCwd;
  const requestedRoot = repo ? path.resolve(invocationCwd, requestedPath) : invocationCwd;

  if (!fs.existsSync(requestedRoot)) {
    throw new Error(`Target repository does not exist: ${requestedRoot}`);
  }

  const canonicalRoot = fs.realpathSync(requestedRoot);
  const stat = fs.statSync(canonicalRoot);

  if (!stat.isDirectory()) {
    throw new Error(`Target repository must be a directory: ${canonicalRoot}`);
  }

  return canonicalRoot;
};
