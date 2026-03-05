import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export type ProjectContext = {
  repoRoot: string;
  readTextFile(pathFromRoot: string): string | undefined;
  writeTextFile(pathFromRoot: string, content: string): void;
  exists(pathFromRoot: string): boolean;
  listFiles(pathFromRoot: string): string[];
  resolveDiffBase(): { baseRef?: string; baseSha?: string; warning?: string };
  getChangedFiles(baseSha: string): string[];
};

const tryGit = (cwd: string, args: string[]): string | undefined => {
  try {
    const out = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
};

const detectRepoRoot = (cwd: string): string => {
  const topLevel = tryGit(cwd, ['rev-parse', '--show-toplevel']);
  return topLevel ? path.resolve(topLevel) : path.resolve(cwd);
};

export const createNodeContext = (options?: { cwd?: string }): ProjectContext => {
  const repoRoot = detectRepoRoot(options?.cwd ?? process.cwd());

  return {
    repoRoot,
    readTextFile: (pathFromRoot: string) => {
      const full = path.join(repoRoot, pathFromRoot);
      if (!fs.existsSync(full)) return undefined;
      return fs.readFileSync(full, 'utf8');
    },
    writeTextFile: (pathFromRoot: string, content: string) => {
      const full = path.join(repoRoot, pathFromRoot);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    },
    exists: (pathFromRoot: string) => fs.existsSync(path.join(repoRoot, pathFromRoot)),
    listFiles: (pathFromRoot: string) => {
      const full = path.join(repoRoot, pathFromRoot);
      if (!fs.existsSync(full)) return [];
      return fs.readdirSync(full).map((entry) => path.posix.join(pathFromRoot, entry));
    },
    resolveDiffBase: () => {
      const headSha = tryGit(repoRoot, ['rev-parse', 'HEAD']);
      const originMain = tryGit(repoRoot, ['merge-base', 'origin/main', 'HEAD']);
      if (originMain) return { baseRef: 'origin/main', baseSha: originMain };
      const main = tryGit(repoRoot, ['merge-base', 'main', 'HEAD']);
      if (main) {
        if (headSha && main === headSha) {
          const previous = tryGit(repoRoot, ['rev-parse', 'HEAD~1']);
          if (previous) return { baseRef: 'HEAD~1', baseSha: previous, warning: 'On main; using HEAD~1 for diff base.' };
        }
        return { baseRef: 'main', baseSha: main };
      }
      const previous = tryGit(repoRoot, ['rev-parse', 'HEAD~1']);
      if (previous) return { baseRef: 'HEAD~1', baseSha: previous };
      return { warning: 'Unable to determine diff base; treating as no changes.' };
    },
    getChangedFiles: (baseSha: string) => {
      try {
        const output = execFileSync('git', ['diff', '--name-only', `${baseSha}..HEAD`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return output.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => line.replace(/\\/g, '/'));
      } catch {
        return [];
      }
    }
  };
};
