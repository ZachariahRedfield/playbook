import fs from 'node:fs';
import path from 'node:path';
import { validateSessionSnapshot, type SessionSnapshot } from './schema.js';

export type CleanupOptions = {
  sessionsDir: string;
  maxDays?: number;
  maxCount?: number;
  dryRun?: boolean;
  now?: Date;
  hygiene?: boolean;
  maxEntryLength?: number;
};

export type HygieneFileReport = {
  filePath: string;
  parseable: boolean;
  beforeBytes: number;
  afterBytes: number;
  beforeLines: number;
  afterLines: number;
  normalizedCount: number;
  deduplicatedCount: number;
  truncatedCount: number;
  junkRemovedCount: number;
  preservedCount: number;
  duplicateGroupsFound: number;
  changed: boolean;
};

export type CleanupResult = {
  deleted: string[];
  kept: string[];
  deletedCount: number;
  keptCount: number;
  hygieneReport: {
    enabled: boolean;
    processedArtifacts: number;
    duplicateGroupsFound: number;
    itemsRemoved: {
      deduplicated: number;
      junk: number;
      deletedArtifacts: number;
    };
    itemsCompacted: {
      truncated: number;
      normalized: number;
    };
    preservedHighValue: number;
    bytesReduced: number;
    linesReduced: number;
    warnings: string[];
    files: HygieneFileReport[];
  };
};

const PLACEHOLDER_VALUES = new Set(['', 'n/a', 'na', 'none', 'null', 'todo', 'tbd', 'placeholder', '-', 'same']);

const listSnapshots = (sessionsDir: string): Array<{ path: string; mtimeMs: number }> => {
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  return fs
    .readdirSync(sessionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => {
      const filePath = path.join(sessionsDir, entry);
      return { path: filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
};

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

const isJunk = (value: string): boolean => PLACEHOLDER_VALUES.has(value.toLowerCase());

const truncate = (value: string, maxLength: number): { value: string; truncated: boolean } => {
  if (value.length <= maxLength) {
    return { value, truncated: false };
  }
  return {
    value: `${value.slice(0, Math.max(0, maxLength - 16)).trimEnd()} … [truncated]`,
    truncated: true
  };
};

const applyListHygiene = (
  entries: string[],
  maxEntryLength: number,
  counters: {
    normalized: number;
    deduplicated: number;
    truncated: number;
    junk: number;
    preserved: number;
    duplicateGroups: number;
  }
): string[] => {
  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();
  const results: string[] = [];

  for (const originalEntry of entries) {
    const normalized = normalize(originalEntry);
    if (normalized !== originalEntry) {
      counters.normalized += 1;
    }

    if (isJunk(normalized)) {
      counters.junk += 1;
      continue;
    }

    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) {
      counters.deduplicated += 1;
      duplicateKeys.add(dedupeKey);
      continue;
    }
    seen.add(dedupeKey);

    const truncation = truncate(normalized, maxEntryLength);
    if (truncation.truncated) {
      counters.truncated += 1;
    } else {
      counters.preserved += 1;
    }

    results.push(truncation.value);
  }

  counters.duplicateGroups += duplicateKeys.size;
  return results;
};

const applyDecisionHygiene = (
  decisions: SessionSnapshot['decisions'],
  maxEntryLength: number,
  counters: {
    normalized: number;
    deduplicated: number;
    truncated: number;
    junk: number;
    preserved: number;
    duplicateGroups: number;
  }
): SessionSnapshot['decisions'] => {
  const decisionKeys = new Set<string>();
  const duplicateKeys = new Set<string>();
  const cleaned = [] as SessionSnapshot['decisions'];

  for (const decision of decisions) {
    const normalizedDecision = normalize(decision.decision);
    if (normalizedDecision !== decision.decision) {
      counters.normalized += 1;
    }

    if (isJunk(normalizedDecision)) {
      counters.junk += 1;
      continue;
    }

    const key = normalizedDecision.toLowerCase();
    if (decisionKeys.has(key)) {
      counters.deduplicated += 1;
      duplicateKeys.add(key);
      continue;
    }
    decisionKeys.add(key);

    const decisionText = truncate(normalizedDecision, maxEntryLength);
    if (decisionText.truncated) {
      counters.truncated += 1;
    } else {
      counters.preserved += 1;
    }

    const rationale = decision.rationale ? normalize(decision.rationale) : undefined;
    if (rationale && rationale !== decision.rationale) {
      counters.normalized += 1;
    }

    const truncatedRationale = rationale ? truncate(rationale, maxEntryLength) : undefined;
    if (truncatedRationale?.truncated) {
      counters.truncated += 1;
    }

    cleaned.push({
      ...decision,
      decision: decisionText.value,
      rationale: truncatedRationale?.value,
      alternatives: decision.alternatives
        ? applyListHygiene(decision.alternatives, maxEntryLength, counters)
        : decision.alternatives,
      evidence: decision.evidence ? applyListHygiene(decision.evidence, maxEntryLength, counters) : decision.evidence
    });
  }

  counters.duplicateGroups += duplicateKeys.size;
  return cleaned;
};

const countLines = (value: string): number => (value.length === 0 ? 0 : value.split('\n').length);

export const cleanupSessionSnapshots = (options: CleanupOptions): CleanupResult => {
  const maxDays = options.maxDays ?? 30;
  const maxCount = options.maxCount ?? 50;
  const maxEntryLength = options.maxEntryLength ?? 400;
  const now = options.now ?? new Date();

  const snapshots = listSnapshots(options.sessionsDir);
  const cutoff = now.getTime() - maxDays * 24 * 60 * 60 * 1000;

  const byAge = snapshots.filter((snapshot) => snapshot.mtimeMs >= cutoff);
  const keep = byAge.slice(0, Math.min(maxCount, byAge.length));
  const keepSet = new Set(keep.map((snapshot) => snapshot.path));

  const deleted = snapshots.filter((snapshot) => !keepSet.has(snapshot.path)).map((snapshot) => snapshot.path).sort();
  const kept = keep.map((snapshot) => snapshot.path).sort();

  if (!options.dryRun) {
    for (const filePath of deleted) {
      fs.unlinkSync(filePath);
    }
  }

  const hygieneReport: CleanupResult['hygieneReport'] = {
    enabled: options.hygiene === true,
    processedArtifacts: 0,
    duplicateGroupsFound: 0,
    itemsRemoved: {
      deduplicated: 0,
      junk: 0,
      deletedArtifacts: deleted.length
    },
    itemsCompacted: {
      truncated: 0,
      normalized: 0
    },
    preservedHighValue: 0,
    bytesReduced: 0,
    linesReduced: 0,
    warnings: [],
    files: []
  };

  if (options.hygiene === true) {
    for (const filePath of kept) {
      const beforeText = fs.readFileSync(filePath, 'utf8');
      const beforeBytes = Buffer.byteLength(beforeText, 'utf8');
      const beforeLines = countLines(beforeText);
      const counters = {
        normalized: 0,
        deduplicated: 0,
        truncated: 0,
        junk: 0,
        preserved: 0,
        duplicateGroups: 0
      };

      try {
        const loaded = JSON.parse(beforeText) as unknown;
        const snapshot = validateSessionSnapshot(loaded);

        const cleaned: SessionSnapshot = {
          ...snapshot,
          constraints: applyListHygiene(snapshot.constraints, maxEntryLength, counters),
          openQuestions: applyListHygiene(snapshot.openQuestions, maxEntryLength, counters),
          artifacts: applyListHygiene(snapshot.artifacts, maxEntryLength, counters),
          nextSteps: applyListHygiene(snapshot.nextSteps, maxEntryLength, counters),
          tags: applyListHygiene(snapshot.tags, maxEntryLength, counters),
          decisions: applyDecisionHygiene(snapshot.decisions, maxEntryLength, counters)
        };

        const afterText = `${JSON.stringify(cleaned, null, 2)}\n`;
        const afterBytes = Buffer.byteLength(afterText, 'utf8');
        const afterLines = countLines(afterText);
        const changed = beforeText !== afterText;

        if (changed && !options.dryRun) {
          fs.writeFileSync(filePath, afterText, 'utf8');
        }

        hygieneReport.processedArtifacts += 1;
        hygieneReport.duplicateGroupsFound += counters.duplicateGroups;
        hygieneReport.itemsRemoved.deduplicated += counters.deduplicated;
        hygieneReport.itemsRemoved.junk += counters.junk;
        hygieneReport.itemsCompacted.truncated += counters.truncated;
        hygieneReport.itemsCompacted.normalized += counters.normalized;
        hygieneReport.preservedHighValue += counters.preserved;
        hygieneReport.bytesReduced += Math.max(0, beforeBytes - afterBytes);
        hygieneReport.linesReduced += Math.max(0, beforeLines - afterLines);

        hygieneReport.files.push({
          filePath,
          parseable: true,
          beforeBytes,
          afterBytes,
          beforeLines,
          afterLines,
          normalizedCount: counters.normalized,
          deduplicatedCount: counters.deduplicated,
          truncatedCount: counters.truncated,
          junkRemovedCount: counters.junk,
          preservedCount: counters.preserved,
          duplicateGroupsFound: counters.duplicateGroups,
          changed
        });
      } catch {
        hygieneReport.warnings.push(`Skipped unparseable snapshot: ${path.basename(filePath)}`);
        hygieneReport.files.push({
          filePath,
          parseable: false,
          beforeBytes,
          afterBytes: beforeBytes,
          beforeLines,
          afterLines: beforeLines,
          normalizedCount: 0,
          deduplicatedCount: 0,
          truncatedCount: 0,
          junkRemovedCount: 0,
          preservedCount: 0,
          duplicateGroupsFound: 0,
          changed: false
        });
      }
    }
  }

  return {
    deleted,
    kept,
    deletedCount: deleted.length,
    keptCount: kept.length,
    hygieneReport
  };
};
