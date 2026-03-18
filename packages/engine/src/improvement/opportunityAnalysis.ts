import fs from 'node:fs';
import path from 'node:path';

export const OPPORTUNITY_ANALYSIS_SCHEMA_VERSION = '1.0' as const;
export const OPPORTUNITY_ANALYSIS_RELATIVE_PATH = '.playbook/next-best-improvement.json' as const;

export type OpportunityHeuristicClass =
  | 'duplicated_derivation_logic'
  | 'broad_query_fanout'
  | 'missing_invalidation_boundary'
  | 'repeated_recompute_loops'
  | 'canonical_id_inconsistency';

export type OpportunityEvidencePointer = {
  file: string;
  lines: number[];
  detail: string;
};

export type ImprovementOpportunity = {
  opportunity_id: string;
  title: string;
  heuristic_class: OpportunityHeuristicClass;
  priority_score: number;
  confidence: number;
  why_it_matters: string;
  likely_change_shape: string;
  rationale: string[];
  evidence: OpportunityEvidencePointer[];
};

export type OpportunityAnalysisArtifact = {
  schemaVersion: typeof OPPORTUNITY_ANALYSIS_SCHEMA_VERSION;
  kind: 'opportunity-analysis';
  generatedAt: string;
  proposalOnly: true;
  reportOnly: true;
  sourceArtifacts: {
    scannedRoots: string[];
    filesScanned: number;
    doctrineSources: string[];
  };
  top_recommendation: ImprovementOpportunity | null;
  secondary_queue: ImprovementOpportunity[];
};

type ScannedFile = {
  relativePath: string;
  lines: string[];
  text: string;
};

const SOURCE_ROOTS = ['packages/cli/src', 'packages/engine/src', 'packages/core/src', 'scripts'] as const;
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs']);
const IGNORE_SEGMENTS = new Set(['node_modules', 'dist', '.git', 'coverage', '.playbook']);
const PLAYBOOK_ARTIFACT_RE = /\.playbook\/[A-Za-z0-9_./-]+\.json/g;
const ID_TOKEN_RE = /\b(?:candidate_id|proposal_id|route_id|lane_id|task_profile_id|module_id|repo_id|event_id|subject_id|owner_id)\b/g;
const RECOMPUTE_RE = /\b(recompute|derived?|derive|derivation|generated?|generate|invalidate|invalidation)\b/i;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(4))));
const round2 = (value: number): number => Number(value.toFixed(2));

const shouldScanFile = (relativePath: string): boolean => {
  const ext = path.extname(relativePath);
  if (!SOURCE_EXTENSIONS.has(ext)) return false;
  return !relativePath.split(path.sep).some((segment) => IGNORE_SEGMENTS.has(segment));
};

const walk = (root: string, current: string, results: string[]): void => {
  if (!fs.existsSync(current)) return;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (IGNORE_SEGMENTS.has(entry.name)) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(root, full, results);
      continue;
    }
    const relativePath = path.relative(root, full);
    if (shouldScanFile(relativePath)) {
      results.push(full);
    }
  }
};

const loadSourceFiles = (repoRoot: string): ScannedFile[] => {
  const files: string[] = [];
  for (const root of SOURCE_ROOTS) {
    walk(repoRoot, path.join(repoRoot, root), files);
  }
  return files
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => {
      const text = fs.readFileSync(filePath, 'utf8');
      return {
        relativePath: path.relative(repoRoot, filePath),
        lines: text.split(/\r?\n/),
        text
      };
    });
};

const findLineNumbers = (lines: string[], predicate: (line: string) => boolean, limit = 4): number[] => {
  const matches: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (predicate(lines[index] ?? '')) {
      matches.push(index + 1);
      if (matches.length >= limit) break;
    }
  }
  return matches;
};

const buildBroadQueryFanout = (files: ScannedFile[]): ImprovementOpportunity | null => {
  const evidence = files
    .map((file) => {
      const matches = new Set(file.text.match(PLAYBOOK_ARTIFACT_RE) ?? []);
      if (matches.size < 5) return null;
      const lines = findLineNumbers(file.lines, (line) => line.includes('.playbook/'));
      return {
        file: file.relativePath,
        lines,
        detail: `${matches.size} distinct .playbook artifact reads/writes in one surface`
      } satisfies OpportunityEvidencePointer;
    })
    .filter((entry): entry is OpportunityEvidencePointer => Boolean(entry))
    .sort((a, b) => b.detail.localeCompare(a.detail) || a.file.localeCompare(b.file))
    .slice(0, 5);

  if (evidence.length === 0) return null;
  const strongestCount = Number(evidence[0]?.detail.split(' ')[0] ?? '0');
  return {
    opportunity_id: 'shared_read_aggregation_boundary',
    title: 'Converge broad artifact fanout through a shared read aggregation boundary',
    heuristic_class: 'broad_query_fanout',
    priority_score: round2(60 + strongestCount * 2 + evidence.length * 3),
    confidence: clamp01(0.66 + evidence.length * 0.04 + Math.min(0.1, strongestCount / 100)),
    why_it_matters:
      'The same surfaces are reading many control-plane artifacts directly, which increases query scope, makes derived views expensive to evolve, and raises read/write inconsistency risk.',
    likely_change_shape:
      'Introduce a shared repository-intelligence/read-model aggregator that owns artifact hydration and exposes narrower per-surface projections.',
    rationale: [
      'Pilot doctrine already favors a shared aggregation boundary for reads instead of repeated per-surface re-derivation.',
      'Files with many direct .playbook references are strong candidates for a centralized read model because they fan out across multiple state sources.'
    ],
    evidence
  };
};

const buildDuplicatedDerivation = (files: ScannedFile[]): ImprovementOpportunity | null => {
  const byArtifact = new Map<string, Set<string>>();
  for (const file of files) {
    const matches = new Set(file.text.match(PLAYBOOK_ARTIFACT_RE) ?? []);
    for (const match of matches) {
      byArtifact.set(match, new Set([...(byArtifact.get(match) ?? new Set<string>()), file.relativePath]));
    }
  }

  const repeated = [...byArtifact.entries()]
    .filter(([, fileSet]) => fileSet.size >= 4)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, 4);

  if (repeated.length === 0) return null;

  const evidence: OpportunityEvidencePointer[] = repeated.flatMap(([artifact, fileSet]) =>
    [...fileSet]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 2)
      .map((file) => {
        const scanned = files.find((entry) => entry.relativePath === file)!;
        return {
          file,
          lines: findLineNumbers(scanned.lines, (line) => line.includes(artifact)),
          detail: `${artifact} referenced in ${fileSet.size} source files`
        } satisfies OpportunityEvidencePointer;
      })
  );

  const strongest = repeated[0]?.[1].size ?? 0;
  return {
    opportunity_id: 'consolidate_repeated_artifact_derivation',
    title: 'Consolidate repeated artifact-derivation and path wiring',
    heuristic_class: 'duplicated_derivation_logic',
    priority_score: round2(54 + strongest * 3 + repeated.length * 4),
    confidence: clamp01(0.63 + repeated.length * 0.05 + Math.min(0.12, strongest / 40)),
    why_it_matters:
      'Repeated artifact derivation/path logic spreads the same truth boundary across multiple files, which makes future architectural improvements harder to rank and update safely.',
    likely_change_shape:
      'Extract shared derivation/read-path descriptors or a registry-backed loader so command and engine surfaces stop repeating artifact wiring.',
    rationale: [
      'Repeated references to the same control-plane artifacts suggest duplicated derivation seams instead of one canonical composition point.',
      'The MVP should prefer high-leverage seams; shared derivation logic usually unlocks multiple downstream surfaces at once.'
    ],
    evidence: evidence.slice(0, 6)
  };
};

const buildInvalidationBoundary = (files: ScannedFile[]): ImprovementOpportunity | null => {
  const candidates = files
    .map((file) => {
      const writeLines = findLineNumbers(file.lines, (line) => line.includes('writeDeterministicJsonAtomic') || line.includes('writeFileSync'), 6);
      const artifactLines = findLineNumbers(file.lines, (line) => line.includes('.playbook/'), 6);
      const invalidationLines = findLineNumbers(file.lines, (line) => /invalidate|recompute|derived|promotion/i.test(line), 6);
      if (writeLines.length === 0 || artifactLines.length < 2 || invalidationLines.length === 0) return null;
      return {
        file: file.relativePath,
        lines: [...new Set([...writeLines, ...artifactLines, ...invalidationLines])].sort((a, b) => a - b),
        detail: 'writes derived artifacts while also carrying local recompute/invalidation logic'
      } satisfies OpportunityEvidencePointer;
    })
    .filter((entry): entry is OpportunityEvidencePointer => Boolean(entry))
    .sort((a, b) => a.file.localeCompare(b.file))
    .slice(0, 5);

  if (candidates.length < 2) return null;
  return {
    opportunity_id: 'centralize_write_invalidation_boundaries',
    title: 'Centralize write invalidation boundaries for derived artifacts',
    heuristic_class: 'missing_invalidation_boundary',
    priority_score: round2(58 + candidates.length * 5),
    confidence: clamp01(0.68 + candidates.length * 0.04),
    why_it_matters:
      'When surfaces both write artifacts and carry local recompute/invalidation decisions, correctness can drift and safe future changes require too much cross-file knowledge.',
    likely_change_shape:
      'Move artifact invalidation/recompute policy behind a small boundary that maps mutation intent to affected artifacts and centralized regeneration.',
    rationale: [
      'Repository doctrine explicitly calls for targeted invalidation boundaries on writes.',
      'Files mixing writes with local recompute hints are likely carrying invalidation policy that should be centralized.'
    ],
    evidence: candidates
  };
};

const buildRecomputeLoops = (files: ScannedFile[]): ImprovementOpportunity | null => {
  const evidence = files
    .map((file) => {
      const keywordLines = findLineNumbers(file.lines, (line) => RECOMPUTE_RE.test(line), 8);
      const loopLines = findLineNumbers(file.lines, (line) => /\bfor\b|\.map\(|\.reduce\(|\.filter\(/.test(line), 8);
      if (keywordLines.length < 3 || loopLines.length < 2) return null;
      return {
        file: file.relativePath,
        lines: [...new Set([...keywordLines, ...loopLines])].sort((a, b) => a - b),
        detail: `${keywordLines.length} recompute/derive markers alongside repeated loop-based aggregation`
      } satisfies OpportunityEvidencePointer;
    })
    .filter((entry): entry is OpportunityEvidencePointer => Boolean(entry))
    .sort((a, b) => b.lines.length - a.lines.length || a.file.localeCompare(b.file))
    .slice(0, 4);

  if (evidence.length === 0) return null;
  return {
    opportunity_id: 'extract_recompute_hotspots',
    title: 'Extract repeated recompute hotspots into narrower deterministic passes',
    heuristic_class: 'repeated_recompute_loops',
    priority_score: round2(50 + evidence.length * 6),
    confidence: clamp01(0.58 + evidence.length * 0.05),
    why_it_matters:
      'Repeated loop-based recompute logic increases the chance of N+1 style re-derivation and makes performance/correctness behavior harder to reason about.',
    likely_change_shape:
      'Split expensive recompute passes into cached helpers or precomputed summaries that are reused across downstream ranking/reporting steps.',
    rationale: [
      'The first MVP should catch repeated recompute patterns well rather than attempting full static analysis completeness.',
      'Files with many recompute markers and aggregation loops often indicate a seam for shared precomputation.'
    ],
    evidence
  };
};

const buildCanonicalIdConsistency = (files: ScannedFile[]): ImprovementOpportunity | null => {
  const evidence = files
    .map((file) => {
      const tokens = new Set(file.text.match(ID_TOKEN_RE) ?? []);
      const derivedLines = findLineNumbers(file.lines, (line) => /derived|reconcile|promotion|candidate|artifact|state/i.test(line), 6);
      if (tokens.size < 3 || derivedLines.length === 0) return null;
      const idLines = findLineNumbers(file.lines, (line) => ID_TOKEN_RE.test(line), 8);
      return {
        file: file.relativePath,
        lines: [...new Set([...idLines, ...derivedLines])].sort((a, b) => a - b),
        detail: `${tokens.size} identifier forms participate in derived-state paths`
      } satisfies OpportunityEvidencePointer;
    })
    .filter((entry): entry is OpportunityEvidencePointer => Boolean(entry))
    .sort((a, b) => b.detail.localeCompare(a.detail) || a.file.localeCompare(b.file))
    .slice(0, 5);

  if (evidence.length === 0) return null;
  return {
    opportunity_id: 'normalize_canonical_identifier_usage',
    title: 'Normalize canonical identifier usage across derived-state paths',
    heuristic_class: 'canonical_id_inconsistency',
    priority_score: round2(52 + evidence.length * 5),
    confidence: clamp01(0.61 + evidence.length * 0.04),
    why_it_matters:
      'Mixed identifier vocabularies in derived-state code paths make it easier to introduce non-canonical flows and harder to centralize recompute safely.',
    likely_change_shape:
      'Define canonical identifier mapping helpers/types at the engine boundary and route derived-state builders through them.',
    rationale: [
      'Pilot doctrine explicitly recommends mutation path -> affected canonical IDs -> centralized recompute.',
      'Files juggling several identifier forms are likely candidates for normalization before more automation depends on them.'
    ],
    evidence
  };
};

const rankOpportunities = (opportunities: ImprovementOpportunity[]): ImprovementOpportunity[] =>
  opportunities.sort((a, b) => b.priority_score - a.priority_score || b.confidence - a.confidence || a.opportunity_id.localeCompare(b.opportunity_id));

export const analyzeImprovementOpportunities = (repoRoot: string): OpportunityAnalysisArtifact => {
  const files = loadSourceFiles(repoRoot);
  const opportunities = rankOpportunities(
    [
      buildBroadQueryFanout(files),
      buildDuplicatedDerivation(files),
      buildInvalidationBoundary(files),
      buildRecomputeLoops(files),
      buildCanonicalIdConsistency(files)
    ].filter((entry): entry is ImprovementOpportunity => Boolean(entry))
  );

  return {
    schemaVersion: OPPORTUNITY_ANALYSIS_SCHEMA_VERSION,
    kind: 'opportunity-analysis',
    generatedAt: new Date().toISOString(),
    proposalOnly: true,
    reportOnly: true,
    sourceArtifacts: {
      scannedRoots: [...SOURCE_ROOTS],
      filesScanned: files.length,
      doctrineSources: ['docs/PATTERNS.md', 'docs/ARCHITECTURE.md', 'docs/CHANGELOG.md']
    },
    top_recommendation: opportunities[0] ?? null,
    secondary_queue: opportunities.slice(1)
  };
};
