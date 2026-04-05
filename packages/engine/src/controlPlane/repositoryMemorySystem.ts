import fs from 'node:fs';
import path from 'node:path';
import { writeReplayPromotionSystem } from './replayPromotionSystem.js';

export const REPOSITORY_MEMORY_SYSTEM_RELATIVE_PATH = '.playbook/memory-system.json' as const;

type SourceArtifactState = { path: string; present: boolean; valid: boolean };

type LayerInventory = {
  class: 'structural_graph' | 'temporal_episodic' | 'candidate_knowledge' | 'promoted_doctrine';
  artifactCount: number;
  recordCount: number;
  refs: string[];
};

export type RepositoryMemorySystemArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-repository-memory-system';
  generatedAt: string;
  layers: {
    structural_graph: {
      boundary: 'repository-shape-intelligence';
      artifacts: ['.playbook/repo-index.json', '.playbook/repo-graph.json'];
      modules: number;
      graphNodes: number;
      graphEdges: number;
    };
    temporal_episodic: {
      boundary: 'execution-observation-events';
      artifacts: string[];
      eventCount: number;
      replayCandidateCount: number;
      consolidationCandidateCount: number;
    };
    candidate_knowledge: {
      boundary: 'candidate-only-review-required';
      artifacts: string[];
      total: number;
      stale: number;
      byState: {
        candidate: number;
        stale: number;
        superseded: number;
      };
    };
    promoted_doctrine: {
      boundary: 'reviewed-promoted-doctrine';
      artifacts: [
        '.playbook/memory/knowledge/decisions.json',
        '.playbook/memory/knowledge/patterns.json',
        '.playbook/memory/knowledge/failure-modes.json',
        '.playbook/memory/knowledge/invariants.json'
      ];
      total: number;
      active: number;
      superseded: number;
      retired: number;
    };
  };
  boundaries: {
    graph_vs_temporal: {
      policy: 'must-remain-explicitly-separated';
      structuralRefs: ['.playbook/repo-index.json', '.playbook/repo-graph.json'];
      temporalRefs: ['.playbook/memory/index.json', '.playbook/memory/events'];
    };
    episodic_vs_doctrine: {
      policy: 'episodic-evidence-cannot-auto-promote';
      episodicRefs: ['.playbook/memory/events', '.playbook/memory/replay-candidates.json', '.playbook/memory/consolidation-candidates.json'];
      doctrineRefs: ['.playbook/memory/knowledge/decisions.json', '.playbook/memory/knowledge/patterns.json', '.playbook/memory/knowledge/failure-modes.json', '.playbook/memory/knowledge/invariants.json'];
    };
  };
  inventory_by_class: LayerInventory[];
  replay_consolidation_promotion_refs: {
    replay: { path: '.playbook/memory/replay-candidates.json'; present: boolean; count: number };
    consolidation: { path: '.playbook/memory/consolidation-candidates.json'; present: boolean; count: number };
    compactionReview: { path: '.playbook/memory/compaction-review.json'; present: boolean; count: number };
    promotionReview: { path: '.playbook/review-queue.json'; present: boolean; count: number };
  };
  pressure_retention_class_summary: {
    statusPath: '.playbook/memory-pressure.json';
    band: 'normal' | 'warm' | 'pressure' | 'critical' | 'unknown';
    classes: { canonical: number; compactable: number; disposable: number };
    recommendedActions: string[];
  };
  state_summaries: {
    candidates: { total: number; stale: number };
    promoted: { total: number; superseded: number; retired: number };
    superseded: { total: number; refs: string[] };
  };
  source_artifacts: SourceArtifactState[];
  authority: {
    mutation: 'read-only';
    promotion: 'review-required';
    execution: 'unchanged';
  };
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const readJson = (repoRoot: string, relativePath: string): Record<string, unknown> | null => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const readArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)) : [];

const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const listJsonFilesRecursive = (rootPath: string): string[] => {
  if (!fs.existsSync(rootPath)) return [];
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFilesRecursive(absolutePath));
      continue;
    }
    if (entry.isFile() && absolutePath.endsWith('.json')) {
      files.push(absolutePath);
    }
  }
  return files;
};

const toRelative = (repoRoot: string, absolutePath: string): string => path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');

const countRecords = (record: Record<string, unknown> | null): number => {
  if (!record) return 0;
  const entries = readArray(record.entries);
  if (entries.length > 0) return entries.length;
  const candidates = readArray(record.candidates);
  if (candidates.length > 0) return candidates.length;
  const rows = readArray(record.rows);
  if (rows.length > 0) return rows.length;
  return 0;
};

const statusOf = (entry: Record<string, unknown>): string => (typeof entry.status === 'string' ? entry.status : '');

const buildSourceArtifacts = (repoRoot: string, paths: string[]): SourceArtifactState[] =>
  paths.map((artifactPath) => {
    if (artifactPath.endsWith('/events')) {
      const present = fs.existsSync(path.join(repoRoot, artifactPath));
      return { path: artifactPath, present, valid: true };
    }
    const parsed = readJson(repoRoot, artifactPath);
    return { path: artifactPath, present: fs.existsSync(path.join(repoRoot, artifactPath)), valid: parsed !== null };
  });

const promotedKnowledgePaths = [
  '.playbook/memory/knowledge/decisions.json',
  '.playbook/memory/knowledge/patterns.json',
  '.playbook/memory/knowledge/failure-modes.json',
  '.playbook/memory/knowledge/invariants.json'
] as const;

const buildPromotedState = (repoRoot: string): RepositoryMemorySystemArtifact['layers']['promoted_doctrine'] => {
  const entries = promotedKnowledgePaths.flatMap((artifactPath) => readArray(readJson(repoRoot, artifactPath)?.entries).map((entry) => ({ ...entry, _path: artifactPath })));
  const superseded = entries.filter((entry) => statusOf(entry) === 'superseded').length;
  const retired = entries.filter((entry) => statusOf(entry) === 'retired').length;
  const total = entries.length;
  return {
    boundary: 'reviewed-promoted-doctrine',
    artifacts: [...promotedKnowledgePaths],
    total,
    active: Math.max(0, total - superseded - retired),
    superseded,
    retired
  };
};

const buildCandidateState = (repoRoot: string): RepositoryMemorySystemArtifact['layers']['candidate_knowledge'] => {
  const replay = readJson(repoRoot, '.playbook/memory/replay-candidates.json');
  const fallbackCandidates = readJson(repoRoot, '.playbook/memory/candidates.json');
  const lifecycle = readJson(repoRoot, '.playbook/memory/lifecycle-candidates.json');

  const replayCandidates = readArray(replay?.candidates);
  const compatibilityCandidates = replayCandidates.length > 0 ? [] : readArray(fallbackCandidates?.candidates);
  const lifecycleCandidates = readArray(lifecycle?.candidates);

  const staleLifecycle = lifecycleCandidates.filter((entry) => entry.status === 'stale' || entry.recommended_action === 'retire' || entry.recommended_action === 'supersede').length;
  const supersededLifecycle = lifecycleCandidates.filter((entry) => entry.recommended_action === 'supersede' || entry.status === 'superseded').length;

  const total = replayCandidates.length + compatibilityCandidates.length + lifecycleCandidates.length;

  return {
    boundary: 'candidate-only-review-required',
    artifacts: uniqueSorted([
      '.playbook/memory/replay-candidates.json',
      replayCandidates.length > 0 ? null : '.playbook/memory/candidates.json',
      '.playbook/memory/lifecycle-candidates.json'
    ]),
    total,
    stale: staleLifecycle,
    byState: {
      candidate: total - staleLifecycle,
      stale: staleLifecycle,
      superseded: supersededLifecycle
    }
  };
};

const buildTemporalState = (repoRoot: string): RepositoryMemorySystemArtifact['layers']['temporal_episodic'] => {
  const index = readJson(repoRoot, '.playbook/memory/index.json');
  const replay = readJson(repoRoot, '.playbook/memory/replay-candidates.json');
  const consolidation = readJson(repoRoot, '.playbook/memory/consolidation-candidates.json');
  const eventsDir = path.join(repoRoot, '.playbook/memory/events');
  const eventCount = listJsonFilesRecursive(eventsDir).length;

  return {
    boundary: 'execution-observation-events',
    artifacts: ['.playbook/memory/index.json', '.playbook/memory/events', '.playbook/memory/replay-candidates.json', '.playbook/memory/consolidation-candidates.json'],
    eventCount: Math.max(eventCount, readArray(index?.events).length),
    replayCandidateCount: readArray(replay?.candidates).length,
    consolidationCandidateCount: readArray(consolidation?.candidates).length
  };
};

const buildStructuralState = (repoRoot: string): RepositoryMemorySystemArtifact['layers']['structural_graph'] => {
  const repoIndex = readJson(repoRoot, '.playbook/repo-index.json');
  const repoGraph = readJson(repoRoot, '.playbook/repo-graph.json');
  return {
    boundary: 'repository-shape-intelligence',
    artifacts: ['.playbook/repo-index.json', '.playbook/repo-graph.json'],
    modules: readArray(repoIndex?.modules).length,
    graphNodes: readArray(repoGraph?.nodes).length,
    graphEdges: readArray(repoGraph?.edges).length
  };
};

const buildPressureSummary = (repoRoot: string): RepositoryMemorySystemArtifact['pressure_retention_class_summary'] => {
  const status = readJson(repoRoot, '.playbook/memory-pressure.json');
  const classes = status?.classes && typeof status.classes === 'object' ? status.classes as Record<string, unknown> : {};
  return {
    statusPath: '.playbook/memory-pressure.json',
    band: (typeof status?.band === 'string' ? status.band : 'unknown') as RepositoryMemorySystemArtifact['pressure_retention_class_summary']['band'],
    classes: {
      canonical: Array.isArray(classes.canonical) ? classes.canonical.length : 0,
      compactable: Array.isArray(classes.compactable) ? classes.compactable.length : 0,
      disposable: Array.isArray(classes.disposable) ? classes.disposable.length : 0
    },
    recommendedActions: Array.isArray(status?.recommendedActions) ? status.recommendedActions.filter((entry): entry is string => typeof entry === 'string').sort((a, b) => a.localeCompare(b)) : []
  };
};

export const readRepositoryMemorySystem = (repoRoot: string): RepositoryMemorySystemArtifact => {
  const structural = buildStructuralState(repoRoot);
  const temporal = buildTemporalState(repoRoot);
  const candidates = buildCandidateState(repoRoot);
  const promoted = buildPromotedState(repoRoot);

  const lifecycle = readJson(repoRoot, '.playbook/memory/lifecycle-candidates.json');
  const lifecycleCandidates = readArray(lifecycle?.candidates);
  const staleRefs = uniqueSorted(
    lifecycleCandidates
      .filter((entry) => entry.status === 'stale' || entry.recommended_action === 'supersede' || entry.recommended_action === 'retire')
      .map((entry) => String(entry.recommendation_id ?? entry.target_pattern_id ?? ''))
  );

  const replay = readJson(repoRoot, '.playbook/memory/replay-candidates.json');
  const consolidation = readJson(repoRoot, '.playbook/memory/consolidation-candidates.json');
  const compaction = readJson(repoRoot, '.playbook/memory/compaction-review.json');
  const reviewQueue = readJson(repoRoot, '.playbook/review-queue.json');

  const inventoryByClass: LayerInventory[] = [
    { class: 'structural_graph', artifactCount: structural.artifacts.length, recordCount: structural.modules + structural.graphNodes + structural.graphEdges, refs: [...structural.artifacts] },
    { class: 'temporal_episodic', artifactCount: temporal.artifacts.length, recordCount: temporal.eventCount + temporal.replayCandidateCount + temporal.consolidationCandidateCount, refs: [...temporal.artifacts] },
    { class: 'candidate_knowledge', artifactCount: candidates.artifacts.length, recordCount: candidates.total, refs: [...candidates.artifacts] },
    { class: 'promoted_doctrine', artifactCount: promoted.artifacts.length, recordCount: promoted.total, refs: [...promoted.artifacts] }
  ];

  const sourcePaths = uniqueSorted([
    '.playbook/repo-index.json',
    '.playbook/repo-graph.json',
    '.playbook/memory/index.json',
    '.playbook/memory/events',
    '.playbook/memory/replay-candidates.json',
    '.playbook/memory/consolidation-candidates.json',
    '.playbook/memory/compaction-review.json',
    '.playbook/memory/lifecycle-candidates.json',
    '.playbook/longitudinal-state.json',
    '.playbook/review-queue.json',
    '.playbook/memory-pressure.json',
    ...promotedKnowledgePaths
  ]);

  return {
    schemaVersion: '1.0',
    kind: 'playbook-repository-memory-system',
    generatedAt: new Date(0).toISOString(),
    layers: {
      structural_graph: structural,
      temporal_episodic: temporal,
      candidate_knowledge: candidates,
      promoted_doctrine: promoted
    },
    boundaries: {
      graph_vs_temporal: {
        policy: 'must-remain-explicitly-separated',
        structuralRefs: ['.playbook/repo-index.json', '.playbook/repo-graph.json'],
        temporalRefs: ['.playbook/memory/index.json', '.playbook/memory/events']
      },
      episodic_vs_doctrine: {
        policy: 'episodic-evidence-cannot-auto-promote',
        episodicRefs: ['.playbook/memory/events', '.playbook/memory/replay-candidates.json', '.playbook/memory/consolidation-candidates.json'],
        doctrineRefs: [...promotedKnowledgePaths]
      }
    },
    inventory_by_class: inventoryByClass,
    replay_consolidation_promotion_refs: {
      replay: {
        path: '.playbook/memory/replay-candidates.json',
        present: replay !== null,
        count: countRecords(replay)
      },
      consolidation: {
        path: '.playbook/memory/consolidation-candidates.json',
        present: consolidation !== null,
        count: countRecords(consolidation)
      },
      compactionReview: {
        path: '.playbook/memory/compaction-review.json',
        present: compaction !== null,
        count: countRecords(compaction)
      },
      promotionReview: {
        path: '.playbook/review-queue.json',
        present: reviewQueue !== null,
        count: readArray(reviewQueue?.entries).length
      }
    },
    pressure_retention_class_summary: buildPressureSummary(repoRoot),
    state_summaries: {
      candidates: {
        total: candidates.total,
        stale: candidates.stale
      },
      promoted: {
        total: promoted.total,
        superseded: promoted.superseded,
        retired: promoted.retired
      },
      superseded: {
        total: promoted.superseded + candidates.byState.superseded,
        refs: staleRefs.slice(0, 100)
      }
    },
    source_artifacts: buildSourceArtifacts(repoRoot, sourcePaths),
    authority: {
      mutation: 'read-only',
      promotion: 'review-required',
      execution: 'unchanged'
    }
  };
};

export const writeRepositoryMemorySystem = (repoRoot: string): RepositoryMemorySystemArtifact => {
  const artifact = readRepositoryMemorySystem(repoRoot);
  const absolutePath = path.join(repoRoot, REPOSITORY_MEMORY_SYSTEM_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, deterministicStringify(artifact), 'utf8');
  writeReplayPromotionSystem(repoRoot);
  return artifact;
};
