import fs from 'node:fs';
import path from 'node:path';
import type { ProtectedSingletonDoc } from '../orchestrator/types.js';

export type WorkerFragmentContent = {
  format: 'json' | 'markdown';
  payload: string;
};

export type WorkerFragmentArtifact = {
  schemaVersion: '1.0';
  kind: 'worker-fragment';
  lane_id: string;
  worker_id: string;
  fragment_id: string;
  created_at: string;
  target_doc: string;
  section_key: string;
  conflict_key: string;
  ordering_key: string;
  status: 'proposed' | 'consolidated' | 'superseded';
  summary: string;
  artifact_path: string;
  content: WorkerFragmentContent;
  metadata?: {
    source_paths?: string[];
    notes?: string[];
  };
};

export type DocsConsolidationIssue = {
  issueKey: string;
  type: 'duplicate' | 'conflict';
  targetDoc: string;
  sectionKey: string;
  conflictKey: string;
  fragmentIds: string[];
  laneIds: string[];
  message: string;
};

export type DocsConsolidationArtifact = {
  schemaVersion: '1.0';
  command: 'docs consolidate';
  mode: 'proposal-only';
  artifactPath: '.playbook/docs-consolidation.json';
  protectedSurfaceRegistry: {
    source: string;
    targets: Array<{
      targetDoc: string;
      consolidationStrategy: string;
      rationale: string;
    }>;
  };
  summary: {
    protectedTargetCount: number;
    fragmentCount: number;
    consolidatedTargetCount: number;
    issueCount: number;
    duplicateCount: number;
    conflictCount: number;
  };
  fragments: WorkerFragmentArtifact[];
  consolidatedTargets: Array<{
    targetDoc: string;
    fragmentCount: number;
    fragmentIds: string[];
    laneIds: string[];
    sectionKeys: string[];
    summaries: string[];
  }>;
  issues: DocsConsolidationIssue[];
  brief: string;
};

export type DocsConsolidationResult = {
  ok: boolean;
  artifactPath: string;
  artifact: DocsConsolidationArtifact;
};

const DEFAULT_ARTIFACT_PATH = '.playbook/docs-consolidation.json' as const;
const DEFAULT_REGISTRY_PATH = '.playbook/orchestrator/orchestrator.json' as const;
const DEFAULT_WORKERS_DIR = '.playbook/orchestrator/workers' as const;

const compareStrings = (left: string, right: string): number => left.localeCompare(right);

const sortUnique = (values: string[]): string[] => Array.from(new Set(values)).sort(compareStrings);

const stableFragmentSignature = (fragment: WorkerFragmentArtifact): string =>
  JSON.stringify({
    target_doc: fragment.target_doc,
    section_key: fragment.section_key,
    summary: fragment.summary,
    content: fragment.content,
    metadata: fragment.metadata ?? null
  });

const parseJsonFile = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const loadProtectedSurfaceRegistry = (cwd: string): DocsConsolidationArtifact['protectedSurfaceRegistry'] => {
  const registryPath = path.join(cwd, DEFAULT_REGISTRY_PATH);
  if (fs.existsSync(registryPath)) {
    const registry = parseJsonFile<{ protectedSingletonDocs?: ProtectedSingletonDoc[] }>(registryPath);
    const targets = (registry.protectedSingletonDocs ?? [])
      .map((entry) => ({
        targetDoc: entry.targetDoc,
        consolidationStrategy: entry.consolidationStrategy,
        rationale: entry.rationale
      }))
      .sort((left, right) => compareStrings(left.targetDoc, right.targetDoc));

    return {
      source: DEFAULT_REGISTRY_PATH,
      targets
    };
  }

  return {
    source: 'embedded-default',
    targets: []
  };
};

const loadWorkerFragments = (cwd: string): WorkerFragmentArtifact[] => {
  const workersDir = path.join(cwd, DEFAULT_WORKERS_DIR);
  if (!fs.existsSync(workersDir)) {
    return [];
  }

  const laneDirs = fs
    .readdirSync(workersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareStrings);

  const fragments: WorkerFragmentArtifact[] = [];
  for (const laneDir of laneDirs) {
    const fragmentPath = path.join(workersDir, laneDir, 'worker-fragment.json');
    if (!fs.existsSync(fragmentPath)) {
      continue;
    }

    fragments.push(parseJsonFile<WorkerFragmentArtifact>(fragmentPath));
  }

  return fragments.sort((left, right) => {
    const ordering = compareStrings(left.ordering_key, right.ordering_key);
    if (ordering !== 0) {
      return ordering;
    }

    return compareStrings(left.fragment_id, right.fragment_id);
  });
};

const buildIssues = (fragments: WorkerFragmentArtifact[]): DocsConsolidationIssue[] => {
  const grouped = new Map<string, WorkerFragmentArtifact[]>();
  for (const fragment of fragments) {
    const entries = grouped.get(fragment.conflict_key) ?? [];
    entries.push(fragment);
    grouped.set(fragment.conflict_key, entries);
  }

  return Array.from(grouped.entries())
    .filter(([, entries]) => entries.length > 1)
    .map(([conflictKey, entries]) => {
      const orderedEntries = [...entries].sort((left, right) => compareStrings(left.ordering_key, right.ordering_key) || compareStrings(left.fragment_id, right.fragment_id));
      const first = orderedEntries[0]!;
      const signatures = sortUnique(orderedEntries.map((entry) => stableFragmentSignature(entry)));
      const duplicate = signatures.length === 1;
      return {
        issueKey: `${duplicate ? 'duplicate' : 'conflict'}::${conflictKey}`,
        type: duplicate ? 'duplicate' : 'conflict',
        targetDoc: first.target_doc,
        sectionKey: first.section_key,
        conflictKey,
        fragmentIds: orderedEntries.map((entry) => entry.fragment_id),
        laneIds: orderedEntries.map((entry) => entry.lane_id),
        message: duplicate
          ? `Duplicate worker fragments target ${conflictKey}; keep one and supersede the rest before doc integration.`
          : `Conflicting worker fragments target ${conflictKey}; resolve competing summaries/content before doc integration.`
      } satisfies DocsConsolidationIssue;
    })
    .sort((left, right) => compareStrings(left.issueKey, right.issueKey));
};

const buildConsolidatedTargets = (fragments: WorkerFragmentArtifact[], issues: DocsConsolidationIssue[]): DocsConsolidationArtifact['consolidatedTargets'] => {
  const blockedKeys = new Set(issues.map((issue) => issue.conflictKey));
  const grouped = new Map<string, WorkerFragmentArtifact[]>();
  for (const fragment of fragments) {
    if (blockedKeys.has(fragment.conflict_key)) {
      continue;
    }
    const entries = grouped.get(fragment.target_doc) ?? [];
    entries.push(fragment);
    grouped.set(fragment.target_doc, entries);
  }

  return Array.from(grouped.entries())
    .map(([targetDoc, entries]) => ({
      targetDoc,
      fragmentCount: entries.length,
      fragmentIds: entries.map((entry) => entry.fragment_id),
      laneIds: sortUnique(entries.map((entry) => entry.lane_id)),
      sectionKeys: sortUnique(entries.map((entry) => entry.section_key)),
      summaries: entries.map((entry) => entry.summary)
    }))
    .sort((left, right) => compareStrings(left.targetDoc, right.targetDoc));
};

const buildBrief = (artifact: Omit<DocsConsolidationArtifact, 'brief'>): string => {
  const lines: string[] = [
    'Lead-agent integration brief',
    `Proposal-only consolidation artifact: ${artifact.artifactPath}`,
    `Protected singleton targets in scope: ${artifact.summary.protectedTargetCount}`,
    `Worker fragments discovered: ${artifact.summary.fragmentCount}`
  ];

  if (artifact.issues.length > 0) {
    lines.push(`Blocking issues: ${artifact.summary.issueCount} (${artifact.summary.duplicateCount} duplicate, ${artifact.summary.conflictCount} conflict)`);
    for (const issue of artifact.issues.slice(0, 3)) {
      lines.push(`- ${issue.type.toUpperCase()}: ${issue.conflictKey} <- ${issue.fragmentIds.join(', ')}`);
    }
  } else {
    lines.push('Blocking issues: none');
  }

  lines.push('Ready integration targets:');
  for (const target of artifact.consolidatedTargets.slice(0, 5)) {
    lines.push(`- ${target.targetDoc}: ${target.fragmentCount} fragment(s), sections=${target.sectionKeys.join(', ')}`);
  }

  lines.push('Constraint: consolidate into protected singleton docs manually after review; v1 does not auto-apply doc mutations.');
  return lines.join('\n');
};

export const runDocsConsolidation = (cwd: string): DocsConsolidationResult => {
  const protectedSurfaceRegistry = loadProtectedSurfaceRegistry(cwd);
  const fragments = loadWorkerFragments(cwd);
  const issues = buildIssues(fragments);
  const consolidatedTargets = buildConsolidatedTargets(fragments, issues);

  const artifactWithoutBrief = {
    schemaVersion: '1.0',
    command: 'docs consolidate',
    mode: 'proposal-only',
    artifactPath: DEFAULT_ARTIFACT_PATH,
    protectedSurfaceRegistry,
    summary: {
      protectedTargetCount: protectedSurfaceRegistry.targets.length,
      fragmentCount: fragments.length,
      consolidatedTargetCount: consolidatedTargets.length,
      issueCount: issues.length,
      duplicateCount: issues.filter((issue) => issue.type === 'duplicate').length,
      conflictCount: issues.filter((issue) => issue.type === 'conflict').length
    },
    fragments,
    consolidatedTargets,
    issues
  } satisfies Omit<DocsConsolidationArtifact, 'brief'>;

  const artifact: DocsConsolidationArtifact = {
    ...artifactWithoutBrief,
    brief: buildBrief(artifactWithoutBrief)
  };

  const artifactPath = path.join(cwd, DEFAULT_ARTIFACT_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  return {
    ok: artifact.summary.conflictCount === 0,
    artifactPath: DEFAULT_ARTIFACT_PATH,
    artifact
  };
};
