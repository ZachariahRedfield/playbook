import fs from 'node:fs/promises';
import path from 'node:path';
import { getDefaultPlaybookIgnoreSuggestions } from '../indexer/playbookIgnore.js';
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
  const entries = getDefaultPlaybookIgnoreSuggestions();
  const targetPath = path.join(repoRoot, '.playbookignore');
  const changed = await upsertLineEntries(targetPath, entries, dryRun);

  return {
    status: changed ? 'applied' : 'skipped',
    filesChanged: changed ? ['.playbookignore'] : [],
    summary: changed ? 'Added missing .playbookignore entries.' : '.playbookignore already contained recommended entries.'
  };
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
  PB014: fixPb014MoveArtifacts
};
