import fs from 'node:fs/promises';
import path from 'node:path';
import { applySafePlaybookIgnoreRecommendations, getDefaultPlaybookIgnoreSuggestions } from '../indexer/playbookIgnore.js';
import type { FixHandler } from './types.js';

const PLAYBOOK_NOTES_STARTER = `# Playbook Notes

## YYYY-MM-DD

- WHAT changed:
- WHY it changed:
`;

const notesPath = (repoRoot: string): string => path.join(repoRoot, 'docs', 'PLAYBOOK_NOTES.md');

const upsertLineEntries = async (filePath: string, entries: string[], dryRun: boolean): Promise<boolean> => {
  let current = '';
  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch {
    current = '';
  }

  const existing = new Set(current.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0));
  const missing = entries.filter((entry) => !existing.has(entry));

  if (missing.length === 0) {
    return false;
  }

  if (!dryRun) {
    const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
    const payload = `${current}${separator}${missing.join('\n')}\n`;
    await fs.writeFile(filePath, payload, 'utf8');
  }

  return true;
};

const fixNotesMissing: FixHandler = async ({ repoRoot, dryRun }) => {
  const targetPath = notesPath(repoRoot);

  if (!dryRun) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, PLAYBOOK_NOTES_STARTER, 'utf8');
  }

  return {
    status: 'applied',
    filesChanged: ['docs/PLAYBOOK_NOTES.md'],
    summary: 'Created docs/PLAYBOOK_NOTES.md with a minimal starter template.'
  };
};

const fixNotesEmpty: FixHandler = async ({ repoRoot, dryRun }) => {
  const targetPath = notesPath(repoRoot);

  if (!dryRun) {
    await fs.writeFile(targetPath, PLAYBOOK_NOTES_STARTER, 'utf8');
  }

  return {
    status: 'applied',
    filesChanged: ['docs/PLAYBOOK_NOTES.md'],
    summary: 'Wrote a minimal starter template to docs/PLAYBOOK_NOTES.md.'
  };
};

const fixPb012PlaybookIgnore: FixHandler = async ({ repoRoot, dryRun }) => {
  if (dryRun) {
    return {
      status: 'applied',
      filesChanged: ['.playbookignore'],
      summary: 'Would apply safe-default ranked ignore recommendations to .playbookignore.'
    };
  }

  try {
    const result = applySafePlaybookIgnoreRecommendations(repoRoot);

    return {
      status: result.changed ? 'applied' : 'skipped',
      filesChanged: result.changed ? ['.playbookignore'] : [],
      summary: result.changed
        ? 'Applied safe-default ranked ignore recommendations to .playbookignore.'
        : '.playbookignore already matched safe-default ranked ignore recommendations.'
    };
  } catch {
    const targetPath = path.join(repoRoot, '.playbookignore');
    const fallbackEntries = getDefaultPlaybookIgnoreSuggestions().filter((entry) =>
      ['.git', '.next/cache', 'node_modules', 'playwright-report'].includes(entry)
    );
    const changed = await upsertLineEntries(targetPath, fallbackEntries, false);

    return {
      status: changed ? 'applied' : 'skipped',
      filesChanged: changed ? ['.playbookignore'] : [],
      summary: changed
        ? 'Applied fallback safe-default .playbookignore entries because ranked recommendations were unavailable.'
        : '.playbookignore already contained fallback safe-default entries.'
    };
  }
};

const fixPb013GitIgnore: FixHandler = async ({ repoRoot, dryRun }) => {
  const entries = ['.playbook/repo-index.json', '.playbook/plan.json', '.playbook/verify.json'];
  const targetPath = path.join(repoRoot, '.gitignore');
  const changed = await upsertLineEntries(targetPath, entries, dryRun);

  return {
    status: changed ? 'applied' : 'skipped',
    filesChanged: changed ? ['.gitignore'] : [],
    summary: changed ? 'Updated .gitignore with runtime artifact entries.' : '.gitignore already contained runtime artifact entries.'
  };
};


const rewriteManagedDocBlock = async (
  repoRoot: string,
  task: { file: string | null; write?: { operation: 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor'; blockId: string; startMarker: string; endMarker: string; anchor?: string; content: string } },
  dryRun: boolean
): Promise<{ changed: boolean; summary: string }> => {
  if (!task.file || !task.write) {
    throw new Error('Docs consolidation task must include target file and write instructions.');
  }

  const targetPath = path.join(repoRoot, task.file);
  let current = '';
  try {
    current = await fs.readFile(targetPath, 'utf8');
  } catch {
    throw new Error(`Docs consolidation target not found: ${task.file}`);
  }

  const { operation, startMarker, endMarker, anchor, content, blockId } = task.write;
  const startIndex = current.indexOf(startMarker);
  const endIndex = current.indexOf(endMarker);
  let next = current;

  if (operation === 'replace-managed-block') {
    if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
      throw new Error(`Managed block ${blockId} not found in ${task.file}.`);
    }
    const before = current.slice(0, startIndex);
    const after = current.slice(endIndex + endMarker.length);
    next = `${before}${content}${after}`;
  } else if (operation === 'append-managed-block') {
    if (startIndex >= 0 || endIndex >= 0) {
      throw new Error(`Managed block ${blockId} already exists in ${task.file}; append-managed-block refuses to mutate it.`);
    }
    const separator = current.endsWith('\n') || current.length === 0 ? '' : '\n';
    next = `${current}${separator}${content}\n`;
  } else {
    if (!anchor) {
      throw new Error(`Insert-under-anchor task ${blockId} is missing anchor text.`);
    }
    if (startIndex >= 0 || endIndex >= 0) {
      throw new Error(`Managed block ${blockId} already exists in ${task.file}; insert-under-anchor will not duplicate it.`);
    }
    const anchorIndex = current.indexOf(anchor);
    if (anchorIndex < 0) {
      throw new Error(`Anchor not found for managed block ${blockId} in ${task.file}.`);
    }
    const insertAt = anchorIndex + anchor.length;
    const needsLeadingNewline = current.slice(insertAt, insertAt + 1) !== '\n';
    next = `${current.slice(0, insertAt)}${needsLeadingNewline ? '\n' : ''}\n${content}\n${current.slice(insertAt)}`;
  }

  if (next === current) {
    return { changed: false, summary: `Managed block ${blockId} in ${task.file} already matched the planned content.` };
  }

  if (!dryRun) {
    await fs.writeFile(targetPath, next, 'utf8');
  }

  return { changed: true, summary: `Updated protected docs managed block ${blockId} in ${task.file} via ${operation}.` };
};

const fixDocsConsolidationManagedWrite: FixHandler = async ({ repoRoot, dryRun, task }) => {
  const result = await rewriteManagedDocBlock(repoRoot, task, dryRun);
  return {
    status: result.changed ? 'applied' : 'skipped',
    ...(result.changed ? { filesChanged: [task.file!] , summary: result.summary } : { message: result.summary })
  };
};

const fixPb014MoveArtifacts: FixHandler = async ({ repoRoot, dryRun }) => {
  const candidates = ['repo-index.json', 'plan.json', 'verify.json'];
  const changes: string[] = [];

  for (const file of candidates) {
    const source = path.join(repoRoot, file);
    const destination = path.join(repoRoot, '.playbook', file);
    try {
      await fs.access(source);
    } catch {
      continue;
    }

    try {
      await fs.access(destination);
      continue;
    } catch {
      // destination missing: move candidate
    }

    if (!dryRun) {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
    }

    changes.push(file);
  }

  return {
    status: changes.length > 0 ? 'applied' : 'skipped',
    filesChanged: changes.map((entry) => entry),
    summary: changes.length > 0 ? `Moved runtime artifacts into .playbook/: ${changes.join(', ')}` : 'No movable runtime artifacts found at repository root.'
  };
};

export const defaultFixHandlers: Record<string, FixHandler> = {
  'notes.missing': fixNotesMissing,
  'notes.empty': fixNotesEmpty,
  PB012: fixPb012PlaybookIgnore,
  PB013: fixPb013GitIgnore,
  PB014: fixPb014MoveArtifacts,
  'docs-consolidation.managed-write': fixDocsConsolidationManagedWrite
};
