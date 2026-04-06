import { collectScmContext } from '@zachariahredfield/playbook-core';

export type ScmDiffBaseResolution = {
  baseRef: string;
  baseSha: string;
};

export const resolveScmDiffBase = (
  repoRoot: string,
  options: { baseRef?: string; commandName: string }
): ScmDiffBaseResolution => {
  const context = collectScmContext(repoRoot, { baseRef: options.baseRef });

  if (!context.git.isRepository) {
    throw new Error(`${options.commandName}: git diff is unavailable because this directory is not a git repository.`);
  }

  if (options.baseRef && !context.diffBase.baseSha) {
    throw new Error(`${options.commandName}: unable to determine git diff from base "${options.baseRef}".`);
  }

  if (!context.diffBase.baseRef || !context.diffBase.baseSha) {
    throw new Error(`${options.commandName}: unable to determine git diff base. Provide --base <ref>.`);
  }

  return {
    baseRef: context.diffBase.baseRef,
    baseSha: context.diffBase.baseSha
  };
};
