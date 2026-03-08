import { getMergeBase, isGitRepository, resolveDiffBase } from './base.js';

export type ScmDiffBaseResolution = {
  baseRef: string;
  baseSha: string;
};

export const resolveScmDiffBase = (
  repoRoot: string,
  options: { baseRef?: string; commandName: string }
): ScmDiffBaseResolution => {
  if (!isGitRepository(repoRoot)) {
    throw new Error(`${options.commandName}: git diff is unavailable because this directory is not a git repository.`);
  }

  if (options.baseRef) {
    const mergeBase = getMergeBase(repoRoot, options.baseRef, 'HEAD');
    if (!mergeBase) {
      throw new Error(`${options.commandName}: unable to determine git diff from base "${options.baseRef}".`);
    }

    return {
      baseRef: options.baseRef,
      baseSha: mergeBase
    };
  }

  const resolved = resolveDiffBase(repoRoot);
  if (!resolved.baseRef || !resolved.baseSha) {
    throw new Error(`${options.commandName}: unable to determine git diff base. Provide --base <ref>.`);
  }

  return {
    baseRef: resolved.baseRef,
    baseSha: resolved.baseSha
  };
};
