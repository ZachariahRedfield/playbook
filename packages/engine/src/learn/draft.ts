import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getWorkingTreeChangedFiles } from '../git/diff.js';
import { resolveScmDiffBase } from '../git/context.js';
import { readIndexedRepository } from '../query/moduleIntelligence.js';
import type { LearnDraftResult, KnowledgeCandidate } from '../schema/knowledgeCandidate.js';

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const toStableTheme = (changedFiles: string[]): string[] => {
  const themes = new Set<string>();

  for (const filePath of changedFiles) {
    if (filePath.startsWith('packages/cli/')) {
      themes.add('cli-surface');
      continue;
    }

    if (filePath.startsWith('packages/engine/')) {
      themes.add('engine-behavior');
      continue;
    }

    if (filePath.startsWith('tests/')) {
      themes.add('test-contracts');
      continue;
    }

    if (filePath.startsWith('docs/')) {
      themes.add('documentation');
      continue;
    }

    if (filePath.startsWith('.playbook/')) {
      themes.add('playbook-artifacts');
      continue;
    }

    const topLevel = filePath.split('/')[0] ?? 'repository';
    themes.add(topLevel || 'repository');
  }

  if (themes.size === 0) {
    themes.add('repository-intelligence');
  }

  return uniqueSorted([...themes]);
};

const stableCandidateId = (parts: { baseSha: string; headSha: string; changedFiles: string[]; theme: string }): string => {
  const fingerprint = JSON.stringify({
    baseSha: parts.baseSha,
    headSha: parts.headSha,
    changedFiles: uniqueSorted(parts.changedFiles),
    theme: parts.theme
  });

  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
};

const readHeadSha = (projectRoot: string): string =>
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();

export const generateKnowledgeCandidatesDraft = (
  projectRoot: string,
  options?: { baseRef?: string; diffContext?: boolean }
): LearnDraftResult => {
  try {
    readIndexedRepository(projectRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('missing repository index')) {
      throw new Error('playbook learn draft: missing repository index at .playbook/repo-index.json. Run "playbook index" first.');
    }

    throw error;
  }

  const { baseRef, baseSha } = resolveScmDiffBase(projectRoot, {
    baseRef: options?.baseRef,
    commandName: 'playbook learn draft'
  });
  const headSha = readHeadSha(projectRoot);
  const useDiffContext = options?.diffContext !== false;
  const changedFiles = useDiffContext ? getWorkingTreeChangedFiles(projectRoot, baseSha) : [];
  const themes = toStableTheme(changedFiles);

  const candidates: KnowledgeCandidate[] = themes.map((theme) => {
    const evidence = changedFiles
      .filter((filePath) => {
        if (theme === 'cli-surface') return filePath.startsWith('packages/cli/');
        if (theme === 'engine-behavior') return filePath.startsWith('packages/engine/');
        if (theme === 'test-contracts') return filePath.startsWith('tests/');
        if (theme === 'documentation') return filePath.startsWith('docs/');
        if (theme === 'playbook-artifacts') return filePath.startsWith('.playbook/');

        return filePath.split('/')[0] === theme;
      })
      .map((filePath) => ({ path: filePath }));

    return {
      candidateId: stableCandidateId({ baseSha, headSha, changedFiles, theme }),
      theme,
      evidence,
      dedupe: { kind: 'none' }
    };
  });

  return {
    schemaVersion: '1.0',
    command: 'learn-draft',
    baseRef,
    baseSha,
    headSha,
    diffContext: useDiffContext,
    changedFiles,
    candidates
  };
};
