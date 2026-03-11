import fs from 'node:fs';
import path from 'node:path';

export const stripGlobalRepoOption = (allArgs: readonly string[]): { args: string[]; repo: string | undefined } => {
  const stripped = [...allArgs];
  let repo: string | undefined;

  const commandIndex = stripped.findIndex((arg) => !arg.startsWith('-'));
  const parseLimit = commandIndex === -1 ? stripped.length : commandIndex;

  for (let index = 0; index < parseLimit; index += 1) {
    const arg = stripped[index];
    if (arg === '--repo') {
      const value = stripped[index + 1];
      if (value && !value.startsWith('-')) {
        repo = String(value);
        stripped.splice(index, 2);
        index -= 1;
      }
      continue;
    }

    if (arg.startsWith('--repo=')) {
      const value = arg.slice('--repo='.length);
      if (value.length > 0) {
        repo = value;
      }
      stripped.splice(index, 1);
      index -= 1;
    }
  }

  return { args: stripped, repo };
};

export const resolveTargetRepoRoot = (invocationCwd: string, repo: string | undefined): string => {
  const requestedRoot = repo ? path.resolve(invocationCwd, repo) : invocationCwd;

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
