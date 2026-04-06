import { execFileSync } from 'node:child_process';
import path from 'node:path';

type GitRef = string;

export type ScmDiffBase = {
  requestedBaseRef?: string;
  baseRef?: string;
  baseSha?: string;
  warning?: string;
};

export type ScmRenameEntry = {
  status: string;
  from: string;
  to: string;
};

export type ScmContext = {
  schemaVersion: '1.0';
  kind: 'playbook-scm-context';
  repoRoot: string;
  git: {
    isRepository: boolean;
    branch: string | null;
    detachedHead: boolean;
    headSha?: string;
    headShortSha?: string;
    isShallow: boolean;
  };
  workingTree: {
    dirty: boolean;
    stagedChanges: boolean;
    unstagedChanges: boolean;
    untrackedChanges: boolean;
  };
  diffBase: ScmDiffBase;
  renameSummary: {
    count: number;
    entries: ScmRenameEntry[];
  };
};

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const git = (repoRoot: string, args: string[]): string =>
  execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();

const tryGit = (repoRoot: string, args: string[]): string | undefined => {
  try {
    const output = git(repoRoot, args);
    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
};

const getMergeBase = (repoRoot: string, baseRef: GitRef, headRef: GitRef): string | undefined =>
  tryGit(repoRoot, ['merge-base', baseRef, headRef]);

const resolveDefaultDiffBase = (repoRoot: string, headRef: GitRef, headSha: string | undefined): ScmDiffBase => {
  const originMainBase = getMergeBase(repoRoot, 'origin/main', headRef);
  if (originMainBase) {
    return { baseRef: 'origin/main', baseSha: originMainBase };
  }

  const mainBase = getMergeBase(repoRoot, 'main', headRef);
  if (mainBase) {
    if (headSha && mainBase === headSha) {
      const previous = tryGit(repoRoot, ['rev-parse', `${headRef}~1`]);
      if (previous) {
        return {
          baseRef: `${headRef}~1`,
          baseSha: previous,
          warning: 'On main; using HEAD~1 for diff base.'
        };
      }
    }

    return { baseRef: 'main', baseSha: mainBase };
  }

  const previous = tryGit(repoRoot, ['rev-parse', `${headRef}~1`]);
  if (previous) {
    return { baseRef: `${headRef}~1`, baseSha: previous };
  }

  return { warning: 'Unable to determine diff base; treating as no changes.' };
};

const parseRenameEntries = (output: string): ScmRenameEntry[] => {
  const entries = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/u);
      const status = parts[0] ?? '';
      if (!status.startsWith('R')) {
        return null;
      }
      const from = parts[1];
      const to = parts[2];
      if (!from || !to) {
        return null;
      }
      return {
        status,
        from: toPosixPath(from),
        to: toPosixPath(to)
      } satisfies ScmRenameEntry;
    })
    .filter((value): value is ScmRenameEntry => value !== null)
    .sort((left, right) => {
      const byTo = left.to.localeCompare(right.to);
      if (byTo !== 0) {
        return byTo;
      }
      const byFrom = left.from.localeCompare(right.from);
      if (byFrom !== 0) {
        return byFrom;
      }
      return left.status.localeCompare(right.status);
    });

  return entries;
};

const resolveRenameSummary = (repoRoot: string, baseSha: string | undefined, headRef: GitRef): ScmContext['renameSummary'] => {
  if (!baseSha) {
    return { count: 0, entries: [] };
  }

  const output = tryGit(repoRoot, ['diff', '--name-status', '--find-renames', `${baseSha}..${headRef}`, '--']) ?? '';
  const entries = parseRenameEntries(output);
  return { count: entries.length, entries };
};

const resolveDirtyState = (repoRoot: string): ScmContext['workingTree'] => {
  const status = tryGit(repoRoot, ['status', '--porcelain']) ?? '';
  if (!status) {
    return {
      dirty: false,
      stagedChanges: false,
      unstagedChanges: false,
      untrackedChanges: false
    };
  }

  const lines = status.split('\n').filter(Boolean);
  let stagedChanges = false;
  let unstagedChanges = false;
  let untrackedChanges = false;

  for (const line of lines) {
    const x = line[0] ?? ' ';
    const y = line[1] ?? ' ';
    if (x === '?' && y === '?') {
      untrackedChanges = true;
      continue;
    }

    if (x !== ' ') {
      stagedChanges = true;
    }

    if (y !== ' ') {
      unstagedChanges = true;
    }
  }

  return {
    dirty: stagedChanges || unstagedChanges || untrackedChanges,
    stagedChanges,
    unstagedChanges,
    untrackedChanges
  };
};

export const collectScmContext = (
  repoRoot: string,
  options: {
    baseRef?: string;
    headRef?: GitRef;
  } = {}
): ScmContext => {
  const headRef = options.headRef ?? 'HEAD';
  const isRepository = tryGit(repoRoot, ['rev-parse', '--is-inside-work-tree']) === 'true';
  const normalizedRoot = isRepository
    ? toPosixPath(tryGit(repoRoot, ['rev-parse', '--show-toplevel']) ?? repoRoot)
    : toPosixPath(repoRoot);

  if (!isRepository) {
    return {
      schemaVersion: '1.0',
      kind: 'playbook-scm-context',
      repoRoot: normalizedRoot,
      git: {
        isRepository: false,
        branch: null,
        detachedHead: false,
        isShallow: false
      },
      workingTree: {
        dirty: false,
        stagedChanges: false,
        unstagedChanges: false,
        untrackedChanges: false
      },
      diffBase: {
        requestedBaseRef: options.baseRef,
        warning: 'Repository is not a git work tree; skipping diff-based verification checks.'
      },
      renameSummary: {
        count: 0,
        entries: []
      }
    };
  }

  const headSha = tryGit(repoRoot, ['rev-parse', headRef]);
  const branch = tryGit(repoRoot, ['symbolic-ref', '--short', headRef]) ?? null;
  const detachedHead = branch === null;
  const isShallow = (tryGit(repoRoot, ['rev-parse', '--is-shallow-repository']) ?? 'false') === 'true';
  const workingTree = resolveDirtyState(repoRoot);

  const diffBase = options.baseRef
    ? {
        requestedBaseRef: options.baseRef,
        baseRef: options.baseRef,
        baseSha: getMergeBase(repoRoot, options.baseRef, headRef)
      }
    : resolveDefaultDiffBase(repoRoot, headRef, headSha);

  const renameSummary = resolveRenameSummary(repoRoot, diffBase.baseSha, headRef);

  return {
    schemaVersion: '1.0',
    kind: 'playbook-scm-context',
    repoRoot: normalizedRoot,
    git: {
      isRepository,
      branch,
      detachedHead,
      headSha,
      headShortSha: headSha ? headSha.slice(0, 12) : undefined,
      isShallow
    },
    workingTree,
    diffBase,
    renameSummary
  };
};
