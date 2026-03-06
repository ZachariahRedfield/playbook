import fs from 'node:fs/promises';
import path from 'node:path';

export const PLAYBOOK_NOTES_STARTER = `# Playbook Notes

## YYYY-MM-DD

- WHAT changed:
- WHY it changed:
`;

export type FixHandlerContext = {
  repoRoot: string;
  dryRun: boolean;
};

export type FixResult = {
  filesChanged: string[];
  summary: string;
};

export type FixHandler = (context: FixHandlerContext) => Promise<FixResult>;

const notesPath = (repoRoot: string): string => path.join(repoRoot, 'docs', 'PLAYBOOK_NOTES.md');

const fixNotesMissing: FixHandler = async ({ repoRoot, dryRun }) => {
  const targetPath = notesPath(repoRoot);

  if (!dryRun) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, PLAYBOOK_NOTES_STARTER, 'utf8');
  }

  return {
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
    filesChanged: ['docs/PLAYBOOK_NOTES.md'],
    summary: 'Wrote a minimal starter template to docs/PLAYBOOK_NOTES.md.'
  };
};

export const fixRegistry: Record<string, FixHandler> = {
  'notes.missing': fixNotesMissing,
  'notes.empty': fixNotesEmpty
};
