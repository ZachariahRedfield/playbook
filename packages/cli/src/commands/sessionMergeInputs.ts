import fs from 'node:fs';
import path from 'node:path';

const hasGlobCharacters = (value: string): boolean => /[*?[\]]/.test(value);

const readJsonFilesInDirectory = (dirPath: string): string[] =>
  fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));

export const resolveSessionMergeInputs = (
  cwd: string,
  inValues: string[],
  logger: Pick<Console, 'warn'> = console
): string[] => {
  const expanded: string[] = [];

  for (const value of inValues) {
    const resolved = path.resolve(cwd, value);
    if (fs.existsSync(resolved)) {
      const stat = fs.statSync(resolved);
      if (stat.isFile()) {
        expanded.push(resolved);
        continue;
      }
      if (stat.isDirectory()) {
        expanded.push(...readJsonFilesInDirectory(resolved));
        continue;
      }
    }

    if (hasGlobCharacters(value)) {
      const matches = fs
        .globSync(value, { cwd, windowsPathsNoEscape: true, dot: true })
        .map((match) => path.resolve(cwd, match))
        .filter((match) => fs.existsSync(match) && fs.statSync(match).isFile())
        .sort((a, b) => a.localeCompare(b));

      if (matches.length === 0) {
        logger.warn(`No snapshot files matched glob pattern: ${value}`);
      }

      expanded.push(...matches);
      continue;
    }

    throw new Error(`Snapshot input not found: ${value}`);
  }

  return Array.from(new Set(expanded)).sort((a, b) => a.localeCompare(b));
};
