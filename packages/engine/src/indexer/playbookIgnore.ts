import fs from 'node:fs';
import path from 'node:path';
import { minimatch } from 'minimatch';
import { toPosixPath } from '../util/paths.js';

const DEFAULT_PLAYBOOK_IGNORE = ['node_modules', 'dist', 'build', 'coverage', '.next', '.playbook/cache'];

export type PlaybookIgnoreRule = {
  pattern: string;
  negated: boolean;
};

const normalizePattern = (value: string): string => {
  const normalized = toPosixPath(value.trim()).replace(/^\//, '');
  if (normalized.length === 0) {
    return normalized;
  }

  if (normalized.endsWith('/')) {
    return `${normalized}**`;
  }

  if (!normalized.includes('*') && !normalized.includes('/')) {
    return `**/${normalized}/**`;
  }

  if (!normalized.includes('*') && normalized.includes('/')) {
    return `${normalized}/**`;
  }

  return normalized;
};

export const parsePlaybookIgnore = (repoRoot: string): PlaybookIgnoreRule[] => {
  const ignorePath = path.join(repoRoot, '.playbookignore');
  if (!fs.existsSync(ignorePath)) {
    return [];
  }

  return fs
    .readFileSync(ignorePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => ({
      negated: line.startsWith('!'),
      pattern: normalizePattern(line.startsWith('!') ? line.slice(1) : line)
    }))
    .filter((entry) => entry.pattern.length > 0);
};

export const getDefaultPlaybookIgnoreSuggestions = (): string[] => [...DEFAULT_PLAYBOOK_IGNORE];

export const isPlaybookIgnored = (relativePath: string, rules: PlaybookIgnoreRule[]): boolean => {
  const candidate = toPosixPath(relativePath).replace(/^\.\//, '');
  const candidateAsDir = candidate.endsWith('/') ? candidate : `${candidate}/`;

  let ignored = false;
  for (const rule of rules) {
    const matched = minimatch(candidate, rule.pattern, { dot: true }) || minimatch(candidateAsDir, rule.pattern, { dot: true });
    if (!matched) {
      continue;
    }
    ignored = !rule.negated;
  }

  return ignored;
};
