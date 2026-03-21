import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PlanTask } from '../execution/types.js';
import type { DocsConsolidationArtifact, WorkerFragmentArtifact } from './consolidate.js';

export type DocsWriteOperation = 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor';

export type DocsWriteInstruction = {
  operation: DocsWriteOperation;
  blockId: string;
  startMarker: string;
  endMarker: string;
  anchor?: string;
  content: string;
};

export type DocsConsolidationPlanTask = PlanTask & {
  task_kind: 'docs-managed-write';
  write: DocsWriteInstruction;
  provenance: {
    source_artifact_path: '.playbook/docs-consolidation.json';
    fragment_ids: string[];
    lane_ids: string[];
    target_doc: string;
    section_keys: string[];
  };
};

export type DocsConsolidationPlanExclusion = {
  exclusion_id: string;
  target_doc: string;
  section_keys: string[];
  fragment_ids: string[];
  lane_ids: string[];
  reason:
    | 'issue-blocked'
    | 'missing-write-seam'
    | 'missing-target-file'
    | 'missing-anchor'
    | 'invalid-fragment-content'
    | 'mixed-write-strategies'
    | 'mixed-block-markers'
    | 'mixed-anchor-values';
  message: string;
};

export type DocsConsolidationPlanArtifact = {
  schemaVersion: '1.0';
  kind: 'docs-consolidation-plan';
  command: 'docs-consolidate-plan';
  source: { path: '.playbook/docs-consolidation.json'; command: 'docs consolidate' };
  tasks: DocsConsolidationPlanTask[];
  excluded: DocsConsolidationPlanExclusion[];
  summary: {
    total_targets: number;
    executable_targets: number;
    excluded_targets: number;
    auto_fix_tasks: number;
  };
};

export type DocsConsolidationPlanResult = {
  ok: boolean;
  artifactPath: string;
  artifact: DocsConsolidationPlanArtifact;
};

const DEFAULT_SOURCE_PATH = '.playbook/docs-consolidation.json' as const;
const DEFAULT_ARTIFACT_PATH = '.playbook/docs-consolidation-plan.json' as const;

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort(compareStrings);
const trimTrailingNewlines = (value: string): string => value.replace(/\s+$/u, '').trimEnd();
const stableHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonFile = <T>(absolutePath: string): T => JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;

const readSourceArtifact = (cwd: string): DocsConsolidationArtifact => {
  const absolutePath = path.join(cwd, DEFAULT_SOURCE_PATH);
  return parseJsonFile<DocsConsolidationArtifact>(absolutePath);
};

const getIntegration = (fragment: WorkerFragmentArtifact): Record<string, unknown> | null => {
  const metadata = fragment.metadata;
  if (!metadata || !isRecord(metadata)) {
    return null;
  }
  const integration = metadata.integration;
  return isRecord(integration) ? integration : null;
};

const renderManagedBlock = (startMarker: string, endMarker: string, body: string): string =>
  `${startMarker}\n${trimTrailingNewlines(body)}\n${endMarker}`;

const buildTaskId = (targetDoc: string, sectionKeys: string[], operation: DocsWriteOperation, blockId: string): string =>
  `task-docs-${stableHash(JSON.stringify({ targetDoc, sectionKeys, operation, blockId }))}`;

const buildExclusionId = (targetDoc: string, sectionKeys: string[], reason: string): string =>
  `exclude-docs-${stableHash(JSON.stringify({ targetDoc, sectionKeys, reason }))}`;

const compileTarget = (
  cwd: string,
  targetDoc: string,
  fragments: WorkerFragmentArtifact[],
  issueConflictKeys: Set<string>
): { task?: DocsConsolidationPlanTask; exclusion?: DocsConsolidationPlanExclusion } => {
  const sectionKeys = uniqueSorted(fragments.map((fragment) => fragment.section_key));
  const fragmentIds = fragments.map((fragment) => fragment.fragment_id);
  const laneIds = uniqueSorted(fragments.map((fragment) => fragment.lane_id));

  if (fragments.some((fragment) => issueConflictKeys.has(fragment.conflict_key))) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'issue-blocked'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'issue-blocked',
        message: 'Target has duplicate/conflicting fragments in docs-consolidation.json and cannot become executable.'
      }
    };
  }

  const integrations = fragments.map((fragment) => getIntegration(fragment));
  if (integrations.some((entry) => entry === null)) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'missing-write-seam'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'missing-write-seam',
        message: 'Fragments do not declare one approved write seam, so planning keeps them review-only.'
      }
    };
  }

  const operations = uniqueSorted(integrations.map((entry) => String(entry?.operation ?? '')));
  if (operations.length !== 1 || !['replace-managed-block', 'append-managed-block', 'insert-under-anchor'].includes(operations[0] ?? '')) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'mixed-write-strategies'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'mixed-write-strategies',
        message: 'Fragments disagree on the bounded write strategy, so no executable task was emitted.'
      }
    };
  }

  const operation = operations[0] as DocsWriteOperation;
  const startMarkers = uniqueSorted(integrations.map((entry) => String(entry?.start_marker ?? '')));
  const endMarkers = uniqueSorted(integrations.map((entry) => String(entry?.end_marker ?? '')));
  const blockIds = uniqueSorted(integrations.map((entry) => String(entry?.block_id ?? '')));
  if (startMarkers.length !== 1 || endMarkers.length !== 1 || blockIds.length !== 1 || !startMarkers[0] || !endMarkers[0] || !blockIds[0]) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'mixed-block-markers'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'mixed-block-markers',
        message: 'Fragments must agree on one managed block id/start marker/end marker before apply can own the write.'
      }
    };
  }

  const anchors = uniqueSorted(
    integrations
      .map((entry) => (typeof entry?.anchor === 'string' ? entry.anchor : ''))
      .filter((value) => value.length > 0)
  );
  if (operation === 'insert-under-anchor' && anchors.length !== 1) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'mixed-anchor-values'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'mixed-anchor-values',
        message: 'Insert-under-anchor planning requires one explicit anchor value shared by all fragments.'
      }
    };
  }

  const contentParts = fragments.map((fragment) => trimTrailingNewlines(fragment.content.payload)).filter((value) => value.length > 0);
  if (contentParts.length !== fragments.length) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'invalid-fragment-content'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'invalid-fragment-content',
        message: 'All fragments must contain non-empty payloads before they can compile into an executable managed block.'
      }
    };
  }

  const absoluteTargetPath = path.join(cwd, targetDoc);
  if (!fs.existsSync(absoluteTargetPath)) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'missing-target-file'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'missing-target-file',
        message: 'Target document is missing, so the reviewed write seam cannot be validated.'
      }
    };
  }

  const targetText = fs.readFileSync(absoluteTargetPath, 'utf8');
  if (operation === 'insert-under-anchor' && !targetText.includes(anchors[0]!)) {
    return {
      exclusion: {
        exclusion_id: buildExclusionId(targetDoc, sectionKeys, 'missing-anchor'),
        target_doc: targetDoc,
        section_keys: sectionKeys,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        reason: 'missing-anchor',
        message: `Explicit anchor not found in ${targetDoc}; planning left the target review-only.`
      }
    };
  }

  const body = contentParts.join('\n');
  const write: DocsWriteInstruction = {
    operation,
    blockId: blockIds[0]!,
    startMarker: startMarkers[0]!,
    endMarker: endMarkers[0]!,
    content: renderManagedBlock(startMarkers[0]!, endMarkers[0]!, body),
    ...(operation === 'insert-under-anchor' ? { anchor: anchors[0]! } : {})
  };

  return {
    task: {
      id: buildTaskId(targetDoc, sectionKeys, operation, write.blockId),
      ruleId: 'docs-consolidation.managed-write',
      file: targetDoc,
      action: `Apply protected docs consolidation for ${targetDoc} (${sectionKeys.join(', ')})`,
      autoFix: true,
      task_kind: 'docs-managed-write',
      write,
      provenance: {
        source_artifact_path: DEFAULT_SOURCE_PATH,
        fragment_ids: fragmentIds,
        lane_ids: laneIds,
        target_doc: targetDoc,
        section_keys: sectionKeys
      }
    }
  };
};

export const buildDocsConsolidationPlanArtifact = (cwd: string): DocsConsolidationPlanArtifact => {
  const source = readSourceArtifact(cwd);
  const issueConflictKeys = new Set(source.issues.map((issue) => issue.conflictKey));
  const grouped = new Map<string, WorkerFragmentArtifact[]>();
  for (const fragment of source.fragments) {
    const entries = grouped.get(fragment.target_doc) ?? [];
    entries.push(fragment);
    grouped.set(fragment.target_doc, entries);
  }

  const tasks: DocsConsolidationPlanTask[] = [];
  const excluded: DocsConsolidationPlanExclusion[] = [];
  for (const [targetDoc, fragments] of [...grouped.entries()].sort((a, b) => compareStrings(a[0], b[0]))) {
    const orderedFragments = [...fragments].sort((left, right) => compareStrings(left.ordering_key, right.ordering_key) || compareStrings(left.fragment_id, right.fragment_id));
    const compiled = compileTarget(cwd, targetDoc, orderedFragments, issueConflictKeys);
    if (compiled.task) tasks.push(compiled.task);
    if (compiled.exclusion) excluded.push(compiled.exclusion);
  }

  return {
    schemaVersion: '1.0',
    kind: 'docs-consolidation-plan',
    command: 'docs-consolidate-plan',
    source: { path: DEFAULT_SOURCE_PATH, command: 'docs consolidate' },
    tasks,
    excluded,
    summary: {
      total_targets: grouped.size,
      executable_targets: tasks.length,
      excluded_targets: excluded.length,
      auto_fix_tasks: tasks.filter((task) => task.autoFix).length
    }
  };
};

export const runDocsConsolidationPlan = (cwd: string): DocsConsolidationPlanResult => {
  const artifact = buildDocsConsolidationPlanArtifact(cwd);
  const artifactPath = path.join(cwd, DEFAULT_ARTIFACT_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { ok: artifact.excluded.length === 0, artifactPath: DEFAULT_ARTIFACT_PATH, artifact };
};
