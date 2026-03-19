import path from 'node:path';
import {
  resolvePlaybookHome,
  readGlobalPatternsArtifact,
  type PatternRecord,
} from "../promotion/globalPatterns.js";
import { resolvePatternKnowledgeStore } from "../patternStore.js";
import type { StoryRecord } from "./stories.js";

export type StoryPatternContextMatch = {
  pattern_id: string;
  why_matched: string;
  provenance_refs: string[];
  freshness: {
    status: string;
    promoted_at: string | null;
  };
  lifecycle: {
    state: string;
    warnings: string[];
    superseded_by: string[];
  };
};

export type StoryPatternContext = {
  patterns: StoryPatternContextMatch[];
  pattern_store: {
    scope: 'global_reusable_pattern_memory';
    artifact_path: string;
    canonical_artifact_path: string;
    compat_artifact_paths: string[];
    resolution: 'canonical' | 'compatibility' | 'default';
  };
};

type MatchReason = {
  rank: number;
  label: string;
};

type ExtendedPatternRecord = PatternRecord & {
  storySeed?:
    | string
    | { title?: string; summary?: string; acceptance?: string[] };
};

const pathRelative = (root: string, target: string): string => path.relative(root, target).replaceAll('\\', '/');

const sortUnique = (values: string[]): string[] =>
  [...new Set(values.filter((value) => value.trim().length > 0))].sort(
    (left, right) => left.localeCompare(right),
  );
const normalizeToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const collectStoryText = (story: StoryRecord): string[] =>
  sortUnique([
    story.title,
    story.rationale,
    story.source,
    story.suggested_route ?? "",
    story.execution_lane ?? "",
    ...story.acceptance_criteria,
    ...story.dependencies,
    ...story.evidence,
  ]);

const collectExplicitPatternReferences = (story: StoryRecord): Set<string> => {
  const refs = new Set<string>();
  if (story.provenance?.pattern_id) refs.add(story.provenance.pattern_id);
  if (story.provenance?.source_ref?.startsWith("global/patterns/"))
    refs.add(story.provenance.source_ref.slice("global/patterns/".length));
  for (const text of collectStoryText(story)) {
    for (const match of text.matchAll(/pattern\.[a-z0-9._-]+/gi)) {
      refs.add(match[0].toLowerCase());
    }
  }
  return refs;
};

const collectNormalizationKeys = (story: StoryRecord): Set<string> => {
  const keys = new Set<string>();
  const provenance = story.provenance;
  if (provenance?.pattern_id) {
    const fromPatternId = provenance.pattern_id.replace(/^pattern\./, "");
    keys.add(normalizeToken(fromPatternId));
    keys.add(normalizeToken(fromPatternId.replace(/[._]+/g, "-")));
  }
  for (const text of collectStoryText(story)) {
    const normalized = normalizeToken(text);
    if (normalized) keys.add(normalized);
    for (const chunk of normalized.split("-")) {
      if (chunk.length >= 4) keys.add(chunk);
    }
  }
  return keys;
};

const collectProvenanceRefs = (pattern: ExtendedPatternRecord): string[] =>
  sortUnique([
    ...(pattern.sourceRefs ?? []).map(
      (entry) =>
        `${entry.repoId}::${entry.artifactPath}::${entry.entryId}::${entry.fingerprint}`,
    ),
    ...(pattern.provenance?.sourceRefs ?? []).map(
      (entry) =>
        `${entry.repoId}::${entry.artifactPath}::${entry.entryId}::${entry.fingerprint}`,
    ),
    pattern.id,
    pattern.normalizationKey,
    pattern.storySeed ? "storySeed" : "",
  ]);

const matchPattern = (
  story: StoryRecord,
  pattern: ExtendedPatternRecord,
): MatchReason | null => {
  const explicitRefs = collectExplicitPatternReferences(story);
  if (explicitRefs.has(pattern.id.toLowerCase())) {
    return { rank: 0, label: "explicit_pattern_reference" };
  }

  const provenance = story.provenance;
  if (
    provenance?.candidate_id &&
    pattern.provenance?.sourceRefs?.some(
      (entry) => entry.entryId === provenance.candidate_id,
    )
  ) {
    return { rank: 1, label: "provenance_candidate_match" };
  }

  if (
    provenance?.source_ref &&
    pattern.sourceRefs?.some((entry) =>
      provenance.source_ref?.includes(entry.entryId),
    )
  ) {
    return { rank: 2, label: "provenance_source_match" };
  }

  const normalizationKeys = collectNormalizationKeys(story);
  const normalizedPatternId = normalizeToken(
    pattern.id.replace(/^pattern\./, "").replace(/[._]+/g, "-"),
  );
  const normalizedPatternKey = normalizeToken(pattern.normalizationKey);
  if (
    normalizationKeys.has(normalizedPatternKey) ||
    normalizationKeys.has(normalizedPatternId)
  ) {
    return { rank: 3, label: "normalization_key_match" };
  }

  return null;
};

export const buildStoryPatternContext = (
  story: StoryRecord,
  options?: { playbookHome?: string },
): StoryPatternContext => {
  const playbookHome = options?.playbookHome ?? resolvePlaybookHome();
  const patternStore = resolvePatternKnowledgeStore('global_reusable_pattern_memory', { playbookHome });
  const patterns = readGlobalPatternsArtifact(playbookHome)
    .patterns
    .filter((pattern) => pattern.status === "active") as ExtendedPatternRecord[];
  const matches = patterns
    .flatMap((pattern) => {
      const reason = matchPattern(story, pattern);
      if (!reason) return [];
      return [
        {
          pattern_id: pattern.id,
          why_matched: reason.label,
          provenance_refs: collectProvenanceRefs(pattern),
          freshness: {
            status: pattern.status,
            promoted_at: pattern.promotedAt ?? null,
          },
          lifecycle: {
            state: pattern.status,
            warnings: pattern.status === 'active'
              ? []
              : [`Pattern ${pattern.id} is ${pattern.status}; inspect lifecycle metadata before reusing it.`],
            superseded_by: Array.isArray((pattern as PatternRecord & { superseded_by?: unknown }).superseded_by)
              ? ((pattern as PatternRecord & { superseded_by?: unknown }).superseded_by as string[])
              : typeof (pattern as PatternRecord & { superseded_by?: unknown }).superseded_by === 'string'
                ? [(pattern as PatternRecord & { superseded_by?: unknown }).superseded_by as string]
                : []
          },
          _rank: reason.rank,
        },
      ];
    })
    .sort(
      (left, right) =>
        left._rank - right._rank ||
        left.pattern_id.localeCompare(right.pattern_id),
    )
    .map(({ _rank, ...entry }) => entry);

  return {
    patterns: matches,
    pattern_store: {
      scope: 'global_reusable_pattern_memory',
      artifact_path: pathRelative(patternStore.rootPath, patternStore.resolvedPath),
      canonical_artifact_path: patternStore.canonicalRelativePath,
      compat_artifact_paths: patternStore.compatibilityRelativePaths,
      resolution: patternStore.resolvedFrom,
    },
  };
};
