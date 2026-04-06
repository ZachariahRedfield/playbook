import { collectScmContext } from '@zachariahredfield/playbook-core';

export const getMergeBase = (repoRoot: string, baseRef: string, headRef = 'HEAD'): string | undefined =>
  collectScmContext(repoRoot, { baseRef, headRef }).diffBase.baseSha;

export const isGitRepository = (repoRoot: string): boolean => collectScmContext(repoRoot).git.isRepository;

export const resolveDiffBase = (repoRoot: string): { baseRef?: string; baseSha?: string; warning?: string } => {
  const context = collectScmContext(repoRoot);
  return {
    baseRef: context.diffBase.baseRef,
    baseSha: context.diffBase.baseSha,
    warning: context.diffBase.warning
  };
};
