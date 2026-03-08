import { execFileSync } from 'node:child_process';
import { toPosixPath } from '../util/paths.js';

const runGitLines = (repoRoot: string, args: string[]): string[] => {
  const output = execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(toPosixPath);
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

export const getChangedFiles = (repoRoot: string, baseSha: string, headRef = 'HEAD'): string[] => {
  return runGitLines(repoRoot, ['diff', '--name-only', `${baseSha}..${headRef}`]);
};

export const getWorkingTreeChangedFiles = (repoRoot: string, baseSha: string): string[] => {
  const committedFromBase = getChangedFiles(repoRoot, baseSha, 'HEAD');
  const staged = runGitLines(repoRoot, ['diff', '--name-only', '--cached']);
  const unstaged = runGitLines(repoRoot, ['diff', '--name-only']);
  const untracked = runGitLines(repoRoot, ['ls-files', '--others', '--exclude-standard']);

  return uniqueSorted([...committedFromBase, ...staged, ...unstaged, ...untracked]);
};
