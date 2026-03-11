import fs from 'node:fs';
import path from 'node:path';
import { minimatch } from 'minimatch';
import { toPosixPath } from '../util/paths.js';

const DEFAULT_PLAYBOOK_IGNORE = [
  '.git',
  'node_modules',
  '.next/cache',
  'playwright-report',
  'dist',
  'build',
  'coverage',
  '.playbook/cache',
  '*.tmp',
  'tmp',
  'temp'
];

export type PlaybookIgnoreRule = {
  pattern: string;
  negated: boolean;
};

export type RecommendationSafetyLevel = 'safe-default' | 'likely-safe' | 'review-first';
export type RecommendationImpactLevel = 'low' | 'medium' | 'high';

export type IgnoreRecommendation = {
  path: string;
  rank: number;
  class: string;
  rationale: string;
  confidence: number;
  expected_scan_impact: {
    estimated_files_reduced: number;
    estimated_bytes_reduced: number;
    impact_level: RecommendationImpactLevel;
  };
  safety_level: RecommendationSafetyLevel;
};

export type IgnoreRecommendationArtifact = {
  schemaVersion: '1.0';
  cycle_id: string;
  generated_at: string;
  recommendation_model: 'deterministic-v1';
  ranking_factors: string[];
  recommendations: IgnoreRecommendation[];
  summary: {
    total_recommendations: number;
    safety_level_counts: Record<RecommendationSafetyLevel, number>;
    class_counts: Record<string, number>;
  };
};

export type PlaybookIgnoreSuggestion = IgnoreRecommendation & {
  already_covered: boolean;
  eligible_for_safe_apply: boolean;
};

export type PlaybookIgnoreSuggestResult = {
  schemaVersion: '1.0';
  command: 'ignore suggest';
  repoRoot: string;
  recommendationSource: string;
  recommendations: PlaybookIgnoreSuggestion[];
  safe_defaults: PlaybookIgnoreSuggestion[];
  review_required: PlaybookIgnoreSuggestion[];
  summary: {
    total_recommendations: number;
    safe_default_count: number;
    review_required_count: number;
    already_covered_count: number;
  };
};

export type PlaybookIgnoreApplyResult = {
  schemaVersion: '1.0';
  command: 'ignore apply';
  repoRoot: string;
  recommendationSource: string;
  targetFile: string;
  changed: boolean;
  created: boolean;
  applied_entries: string[];
  retained_entries: string[];
  already_covered_entries: string[];
  deferred_entries: string[];
  removed_entries: string[];
  summary: {
    applied_count: number;
    retained_count: number;
    already_covered_count: number;
    deferred_count: number;
    removed_count: number;
  };
};

export const PLAYBOOK_IGNORE_MANAGED_START = '# PLAYBOOK:IGNORE_START';
export const PLAYBOOK_IGNORE_MANAGED_END = '# PLAYBOOK:IGNORE_END';

const IGNORE_RECOMMENDATIONS_RELATIVE_PATH = path.join('.playbook', 'runtime', 'current', 'ignore-recommendations.json');
const MANAGED_IGNORE_HEADER = [
  PLAYBOOK_IGNORE_MANAGED_START,
  '# Managed by Playbook from ranked ignore recommendations.',
  '# Only safe-default recommendations are auto-applied. Review-first and lower-confidence entries stay suggestion-only.'
] as const;

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

const normalizeIgnoreEntryValue = (value: string): string => toPosixPath(value.trim()).replace(/^\//, '');

const stripNestedRepoPrefix = (repoRoot: string, candidate: string): string => {
  const normalized = candidate.split(path.sep).join(path.posix.sep).replace(/^\.\//, '').replace(/^\/+/, '');
  const nestedPrefix = path.basename(repoRoot).toLowerCase();
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length <= 1 || segments[0].toLowerCase() !== nestedPrefix) {
    return normalized;
  }

  return segments.slice(1).join('/');
};

const normalizeLegacyRepoPrefixedPath = (repoRoot: string, value: string): string => {
  const withPrefixRemoved = stripNestedRepoPrefix(repoRoot, value);
  return withPrefixRemoved;
};

const normalizeIgnoreEntry = (repoRoot: string, value: string): string => {
  const trimmed = normalizeIgnoreEntryValue(value).replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  const absolute = path.isAbsolute(value) ? path.relative(repoRoot, value) : trimmed;
  const candidate = absolute.startsWith('..') || path.isAbsolute(absolute) ? trimmed : normalizeLegacyRepoPrefixedPath(repoRoot, absolute);
  const hadTrailingSlash = value.endsWith('/');
  const withTrailingSlash = candidate.endsWith('/') ? candidate : hadTrailingSlash ? `${candidate}/` : candidate;

  return withTrailingSlash;
};

const parsePlaybookIgnoreLines = (lines: string[]): PlaybookIgnoreRule[] =>
  lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => ({
      negated: line.startsWith('!'),
      pattern: normalizePattern(line.startsWith('!') ? line.slice(1) : line)
    }))
    .filter((entry) => entry.pattern.length > 0);

const splitManagedBlock = (content: string, repoRoot: string): {
  contentWithoutManagedBlock: string;
  managedEntries: string[];
  hadManagedBlock: boolean;
} => {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const lines = normalizedContent.split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === PLAYBOOK_IGNORE_MANAGED_START);
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === PLAYBOOK_IGNORE_MANAGED_END);

  if (startIndex < 0 || endIndex < 0) {
    return {
      contentWithoutManagedBlock: normalizedContent,
      managedEntries: [],
      hadManagedBlock: false
    };
  }

  const managedEntries = lines
    .slice(startIndex + 1, endIndex)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => normalizeIgnoreEntry(repoRoot, line))
    .filter((line) => line.length > 0);

  const nextLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex + 1)];
  const contentWithoutManagedBlock = nextLines.join('\n').replace(/\n{3,}/g, '\n\n');

  return {
    contentWithoutManagedBlock,
    managedEntries,
    hadManagedBlock: true
  };
};

const toCoverageProbe = (repoRoot: string, value: string): string => {
  const normalized = normalizeIgnoreEntry(repoRoot, value);
  if (normalized.endsWith('/')) {
    return `${normalized}__playbook_probe__`;
  }

  return normalized;
};

const isRecommendationCovered = (repoRoot: string, recommendationPath: string, rules: PlaybookIgnoreRule[]): boolean => {
  const probe = toCoverageProbe(repoRoot, recommendationPath);
  if (probe.length === 0) {
    return false;
  }

  return isPlaybookIgnored(probe, rules);
};

const compareRecommendations = (left: IgnoreRecommendation, right: IgnoreRecommendation): number => {
  const rankDiff = left.rank - right.rank;
  if (rankDiff !== 0) {
    return rankDiff;
  }

  return left.path.localeCompare(right.path);
};

const compareEntries = (left: string, right: string): number => left.localeCompare(right);

export const parsePlaybookIgnoreContent = (content: string): PlaybookIgnoreRule[] =>
  parsePlaybookIgnoreLines(content.replace(/\r\n/g, '\n').split('\n'));

export const parsePlaybookIgnore = (repoRoot: string): PlaybookIgnoreRule[] => {
  const ignorePath = path.join(repoRoot, '.playbookignore');
  if (!fs.existsSync(ignorePath)) {
    return [];
  }

  return parsePlaybookIgnoreContent(fs.readFileSync(ignorePath, 'utf8'));
};

export const getDefaultPlaybookIgnoreSuggestions = (): string[] => [...DEFAULT_PLAYBOOK_IGNORE];

export const readIgnoreRecommendationArtifact = (repoRoot: string): IgnoreRecommendationArtifact | undefined => {
  const targetPath = path.join(repoRoot, IGNORE_RECOMMENDATIONS_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as IgnoreRecommendationArtifact;
    if (parsed?.schemaVersion !== '1.0' || !Array.isArray(parsed.recommendations)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
};

const requireIgnoreRecommendationArtifact = (repoRoot: string): IgnoreRecommendationArtifact => {
  const artifact = readIgnoreRecommendationArtifact(repoRoot);
  if (!artifact) {
    throw new Error(
      'Playbook ignore recommendations are not available. Run `pnpm playbook pilot --repo "<target-repo>" --json` or `pnpm playbook --repo "<target-repo>" index --json` first.'
    );
  }

  return artifact;
};

export const suggestPlaybookIgnore = (repoRoot: string): PlaybookIgnoreSuggestResult => {
  const artifact = requireIgnoreRecommendationArtifact(repoRoot);
  const ignorePath = path.join(repoRoot, '.playbookignore');
  const currentContent = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
  const currentRules = parsePlaybookIgnoreContent(currentContent);

  const recommendations = [...artifact.recommendations]
    .sort(compareRecommendations)
    .map<PlaybookIgnoreSuggestion>((entry) => ({
      ...entry,
      path: normalizeIgnoreEntry(repoRoot, entry.path),
      already_covered: isRecommendationCovered(repoRoot, entry.path, currentRules),
      eligible_for_safe_apply: entry.safety_level === 'safe-default'
    }));

  const safeDefaults = recommendations.filter((entry) => entry.safety_level === 'safe-default');
  const reviewRequired = recommendations.filter((entry) => entry.safety_level !== 'safe-default');

  return {
    schemaVersion: '1.0',
    command: 'ignore suggest',
    repoRoot,
    recommendationSource: IGNORE_RECOMMENDATIONS_RELATIVE_PATH.split(path.sep).join(path.posix.sep),
    recommendations,
    safe_defaults: safeDefaults,
    review_required: reviewRequired,
    summary: {
      total_recommendations: recommendations.length,
      safe_default_count: safeDefaults.length,
      review_required_count: reviewRequired.length,
      already_covered_count: recommendations.filter((entry) => entry.already_covered).length
    }
  };
};

const renderManagedIgnoreBlock = (entries: string[]): string =>
  [...MANAGED_IGNORE_HEADER, ...entries, PLAYBOOK_IGNORE_MANAGED_END].join('\n');

export const applySafePlaybookIgnoreRecommendations = (repoRoot: string): PlaybookIgnoreApplyResult => {
  const suggestionResult = suggestPlaybookIgnore(repoRoot);
  const ignorePath = path.join(repoRoot, '.playbookignore');
  const fileExisted = fs.existsSync(ignorePath);
  const currentContent = fileExisted ? fs.readFileSync(ignorePath, 'utf8') : '';
  const { contentWithoutManagedBlock, managedEntries: existingManagedEntries } = splitManagedBlock(currentContent, repoRoot);
  const userRules = parsePlaybookIgnoreContent(contentWithoutManagedBlock);

  const safeRecommendations = suggestionResult.safe_defaults;
  const recommendedManagedEntries = safeRecommendations
    .filter((entry) => !isRecommendationCovered(repoRoot, entry.path, userRules))
    .map((entry) => normalizeIgnoreEntry(repoRoot, entry.path));
  const retainedManagedEntries = existingManagedEntries
    .map((entry) => normalizeIgnoreEntry(repoRoot, entry))
    .filter((entry) => !isRecommendationCovered(repoRoot, entry, userRules));
  const uniqueNextManagedEntries = [...new Set([...retainedManagedEntries, ...recommendedManagedEntries])].sort(compareEntries);
  const existingManagedEntrySet = new Set(existingManagedEntries.map((entry) => normalizeIgnoreEntry(repoRoot, entry)));
  const nextManagedEntrySet = new Set(uniqueNextManagedEntries);

  const appliedEntries = uniqueNextManagedEntries.filter((entry) => !existingManagedEntrySet.has(entry));
  const retainedEntries = uniqueNextManagedEntries.filter((entry) => existingManagedEntrySet.has(entry));
  const removedEntries = existingManagedEntries.filter((entry) => !nextManagedEntrySet.has(normalizeIgnoreEntry(repoRoot, entry)));
  const alreadyCoveredEntries = safeRecommendations
    .filter((entry) => isRecommendationCovered(repoRoot, entry.path, userRules))
    .map((entry) => normalizeIgnoreEntry(repoRoot, entry.path))
    .sort(compareEntries);
  const deferredEntries = suggestionResult.review_required.map((entry) => normalizeIgnoreEntry(repoRoot, entry.path)).sort(compareEntries);

  const userContent = contentWithoutManagedBlock.trimEnd();
  const managedBlock = uniqueNextManagedEntries.length > 0 ? renderManagedIgnoreBlock(uniqueNextManagedEntries) : '';
  const nextContent =
    managedBlock.length === 0
      ? (userContent.length > 0 ? `${userContent}\n` : '')
      : (userContent.length > 0 ? `${userContent}\n\n${managedBlock}\n` : `${managedBlock}\n`);

  const changed = nextContent !== currentContent.replace(/\r\n/g, '\n');
  if (changed) {
    fs.writeFileSync(ignorePath, nextContent, 'utf8');
  }

  return {
    schemaVersion: '1.0',
    command: 'ignore apply',
    repoRoot,
    recommendationSource: suggestionResult.recommendationSource,
    targetFile: '.playbookignore',
    changed,
    created: !fileExisted && nextContent.length > 0,
    applied_entries: appliedEntries.sort(compareEntries),
    retained_entries: retainedEntries.sort(compareEntries),
    already_covered_entries: alreadyCoveredEntries,
    deferred_entries: deferredEntries,
    removed_entries: removedEntries.map((entry) => normalizeIgnoreEntry(repoRoot, entry)).sort(compareEntries),
    summary: {
      applied_count: appliedEntries.length,
      retained_count: retainedEntries.length,
      already_covered_count: alreadyCoveredEntries.length,
      deferred_count: deferredEntries.length,
      removed_count: removedEntries.length
    }
  };
};

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
