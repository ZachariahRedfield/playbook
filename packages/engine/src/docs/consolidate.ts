import fs from "node:fs";
import path from "node:path";
import type { PlanTask } from "../execution/types.js";
import type { ProtectedSingletonDoc } from "../orchestrator/types.js";

export type WorkerFragmentContent = {
  format: "json" | "markdown";
  payload: string;
};

export type DocsConsolidationOperation =
  | {
      type: "replace-managed-block";
      startMarker: string;
      endMarker: string;
      content: string;
    }
  | {
      type: "append-managed-block";
      startMarker: string;
      endMarker: string;
      content: string;
    }
  | {
      type: "insert-under-anchor";
      anchor: string;
      content: string;
    };

export type WorkerFragmentArtifact = {
  schemaVersion: "1.0";
  kind: "worker-fragment";
  lane_id: string;
  worker_id: string;
  fragment_id: string;
  created_at: string;
  target_doc: string;
  section_key: string;
  conflict_key: string;
  ordering_key: string;
  status: "proposed" | "consolidated" | "superseded";
  summary: string;
  artifact_path: string;
  content: WorkerFragmentContent;
  metadata?: {
    source_paths?: string[];
    notes?: string[];
  };
};

export type DocsConsolidationExclusion = {
  exclusionKey: string;
  targetDoc: string;
  sectionKey: string;
  fragmentIds: string[];
  laneIds: string[];
  reason:
    | "duplicate"
    | "conflict"
    | "unsupported_fragment_format"
    | "invalid_fragment_payload"
    | "mixed_group_operations"
    | "missing_required_field"
    | "missing_anchor";
  message: string;
};

export type DocsConsolidationIssue = {
  issueKey: string;
  type: "duplicate" | "conflict";
  targetDoc: string;
  sectionKey: string;
  conflictKey: string;
  fragmentIds: string[];
  laneIds: string[];
  message: string;
};

export type DocsConsolidationPlanArtifact = {
  schemaVersion: "1.0";
  command: "docs consolidate-plan";
  kind: "docs-consolidation-plan";
  artifactPath: ".playbook/docs-consolidation-plan.json";
  sourceArtifactPath: ".playbook/docs-consolidation.json";
  mutationBoundary: "apply-only";
  tasks: PlanTask[];
  summary: {
    candidateGroupCount: number;
    executableTaskCount: number;
    exclusionCount: number;
  };
  approvedGroups: Array<{
    targetDoc: string;
    sectionKey: string;
    fragmentIds: string[];
    laneIds: string[];
    operation: DocsConsolidationOperation;
    taskId: string;
  }>;
  exclusions: DocsConsolidationExclusion[];
};

export type DocsConsolidationArtifact = {
  schemaVersion: "1.0";
  command: "docs consolidate";
  mode: "proposal-only";
  artifactPath: ".playbook/docs-consolidation.json";
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

const DEFAULT_ARTIFACT_PATH = ".playbook/docs-consolidation.json" as const;
const DEFAULT_PLAN_ARTIFACT_PATH =
  ".playbook/docs-consolidation-plan.json" as const;
const DOCS_CONSOLIDATION_RULE_ID = "DOCS_CONSOLIDATION_WRITE";
const DEFAULT_REGISTRY_PATH =
  ".playbook/orchestrator/orchestrator.json" as const;
const DEFAULT_WORKERS_DIR = ".playbook/orchestrator/workers" as const;

const compareStrings = (left: string, right: string): number =>
  left.localeCompare(right);

const sortUnique = (values: string[]): string[] =>
  Array.from(new Set(values)).sort(compareStrings);

const stableFragmentSignature = (fragment: WorkerFragmentArtifact): string =>
  JSON.stringify({
    target_doc: fragment.target_doc,
    section_key: fragment.section_key,
    summary: fragment.summary,
    content: fragment.content,
    metadata: fragment.metadata ?? null,
  });

const parseJsonFile = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const loadProtectedSurfaceRegistry = (
  cwd: string,
): DocsConsolidationArtifact["protectedSurfaceRegistry"] => {
  const registryPath = path.join(cwd, DEFAULT_REGISTRY_PATH);
  if (fs.existsSync(registryPath)) {
    const registry = parseJsonFile<{
      protectedSingletonDocs?: ProtectedSingletonDoc[];
    }>(registryPath);
    const targets = (registry.protectedSingletonDocs ?? [])
      .map((entry) => ({
        targetDoc: entry.targetDoc,
        consolidationStrategy: entry.consolidationStrategy,
        rationale: entry.rationale,
      }))
      .sort((left, right) => compareStrings(left.targetDoc, right.targetDoc));

    return {
      source: DEFAULT_REGISTRY_PATH,
      targets,
    };
  }

  return {
    source: "embedded-default",
    targets: [],
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
    const fragmentPath = path.join(workersDir, laneDir, "worker-fragment.json");
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

const normalizeMultilineContent = (value: string): string =>
  value.replace(/\r\n/g, "\n").replace(/\s+$/u, "");

const parseOperationPayload = (
  payload: string,
): DocsConsolidationOperation | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const typed = parsed as Record<string, unknown>;
  if (
    typed.type === "replace-managed-block" ||
    typed.type === "append-managed-block"
  ) {
    if (
      typeof typed.startMarker !== "string" ||
      typeof typed.endMarker !== "string" ||
      typeof typed.content !== "string"
    ) {
      return null;
    }
    return {
      type: typed.type,
      startMarker: typed.startMarker,
      endMarker: typed.endMarker,
      content: normalizeMultilineContent(typed.content),
    };
  }

  if (typed.type === "insert-under-anchor") {
    if (typeof typed.anchor !== "string" || typeof typed.content !== "string") {
      return null;
    }
    return {
      type: "insert-under-anchor",
      anchor: typed.anchor,
      content: normalizeMultilineContent(typed.content),
    };
  }

  return null;
};

const buildDocsConsolidationTask = (
  targetDoc: string,
  sectionKey: string,
  operation: DocsConsolidationOperation,
  fragmentIds: string[],
): PlanTask => ({
  id: `docs-consolidation::${targetDoc}::${sectionKey}`,
  ruleId: DOCS_CONSOLIDATION_RULE_ID,
  file: targetDoc,
  action:
    operation.type === "replace-managed-block"
      ? `Replace managed block for ${sectionKey} in ${targetDoc}`
      : operation.type === "append-managed-block"
        ? `Append managed block for ${sectionKey} in ${targetDoc}`
        : `Insert content under explicit anchor for ${sectionKey} in ${targetDoc}`,
  autoFix: true,
  execution: {
    kind: "docs-consolidation",
    fragmentIds,
    sectionKey,
    operation,
  },
});

const groupExclusion = (
  reason: DocsConsolidationExclusion["reason"],
  targetDoc: string,
  sectionKey: string,
  fragments: WorkerFragmentArtifact[],
  message: string,
): DocsConsolidationExclusion => ({
  exclusionKey: `${reason}::${targetDoc}::${sectionKey}`,
  targetDoc,
  sectionKey,
  fragmentIds: fragments.map((fragment) => fragment.fragment_id),
  laneIds: sortUnique(fragments.map((fragment) => fragment.lane_id)),
  reason,
  message,
});

export const compileDocsConsolidationPlan = (
  cwd: string,
): DocsConsolidationPlanArtifact => {
  const sourcePath = path.join(cwd, DEFAULT_ARTIFACT_PATH);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `docs consolidate-plan: missing source artifact at ${DEFAULT_ARTIFACT_PATH}. Run "playbook docs consolidate --json" first.`,
    );
  }

  const artifact = parseJsonFile<DocsConsolidationArtifact>(sourcePath);
  const blockedConflictKeys = new Set(
    artifact.issues.map((issue) => issue.conflictKey),
  );
  const grouped = new Map<string, WorkerFragmentArtifact[]>();
  for (const fragment of artifact.fragments) {
    if (blockedConflictKeys.has(fragment.conflict_key)) {
      continue;
    }
    const key = `${fragment.target_doc}::${fragment.section_key}`;
    const entries = grouped.get(key) ?? [];
    entries.push(fragment);
    grouped.set(key, entries);
  }

  const exclusions: DocsConsolidationExclusion[] = artifact.issues.map(
    (issue) => ({
      exclusionKey: `${issue.type}::${issue.conflictKey}`,
      targetDoc: issue.targetDoc,
      sectionKey: issue.sectionKey,
      fragmentIds: issue.fragmentIds,
      laneIds: issue.laneIds,
      reason: issue.type,
      message: issue.message,
    }),
  );
  const approvedGroups: DocsConsolidationPlanArtifact["approvedGroups"] = [];
  const tasks: PlanTask[] = [];

  for (const [groupKey, fragments] of Array.from(grouped.entries()).sort(
    (a, b) => compareStrings(a[0], b[0]),
  )) {
    const first = fragments[0]!;
    const parsedOperations = fragments.map((fragment) => ({
      fragment,
      operation:
        fragment.content.format === "json"
          ? parseOperationPayload(fragment.content.payload)
          : null,
    }));

    if (
      parsedOperations.some((entry) => entry.fragment.content.format !== "json")
    ) {
      exclusions.push(
        groupExclusion(
          "unsupported_fragment_format",
          first.target_doc,
          first.section_key,
          fragments,
          `Only JSON worker fragments compile into ${DEFAULT_PLAN_ARTIFACT_PATH}; markdown fragments remain proposal-only.`,
        ),
      );
      continue;
    }

    if (parsedOperations.some((entry) => entry.operation === null)) {
      exclusions.push(
        groupExclusion(
          "invalid_fragment_payload",
          first.target_doc,
          first.section_key,
          fragments,
          "Fragment payload must be valid docs consolidation JSON for a bounded operation.",
        ),
      );
      continue;
    }

    const operations = parsedOperations.map((entry) => entry.operation!);
    const uniqueOperations = sortUnique(
      operations.map((operation) => JSON.stringify(operation)),
    );
    if (uniqueOperations.length !== 1) {
      exclusions.push(
        groupExclusion(
          "mixed_group_operations",
          first.target_doc,
          first.section_key,
          fragments,
          "Conflict-free fragment group must resolve to exactly one deterministic bounded operation.",
        ),
      );
      continue;
    }

    const operation = operations[0]!;
    if (operation.type === "insert-under-anchor") {
      const targetPath = path.join(cwd, first.target_doc);
      if (
        !fs.existsSync(targetPath) ||
        !fs.readFileSync(targetPath, "utf8").includes(operation.anchor)
      ) {
        exclusions.push(
          groupExclusion(
            "missing_anchor",
            first.target_doc,
            first.section_key,
            fragments,
            `Anchor "${operation.anchor}" was not found in ${first.target_doc}.`,
          ),
        );
        continue;
      }
    }

    const task = buildDocsConsolidationTask(
      first.target_doc,
      first.section_key,
      operation,
      fragments.map((fragment) => fragment.fragment_id),
    );
    approvedGroups.push({
      targetDoc: first.target_doc,
      sectionKey: first.section_key,
      fragmentIds: fragments.map((fragment) => fragment.fragment_id),
      laneIds: sortUnique(fragments.map((fragment) => fragment.lane_id)),
      operation,
      taskId: task.id,
    });
    tasks.push(task);
  }

  const planArtifact: DocsConsolidationPlanArtifact = {
    schemaVersion: "1.0",
    command: "docs consolidate-plan",
    kind: "docs-consolidation-plan",
    artifactPath: DEFAULT_PLAN_ARTIFACT_PATH,
    sourceArtifactPath: DEFAULT_ARTIFACT_PATH,
    mutationBoundary: "apply-only",
    tasks,
    summary: {
      candidateGroupCount: grouped.size,
      executableTaskCount: tasks.length,
      exclusionCount: exclusions.length,
    },
    approvedGroups,
    exclusions: exclusions.sort((a, b) =>
      compareStrings(a.exclusionKey, b.exclusionKey),
    ),
  };

  const planPath = path.join(cwd, DEFAULT_PLAN_ARTIFACT_PATH);
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(
    planPath,
    `${JSON.stringify(planArtifact, null, 2)}
`,
    "utf8",
  );
  return planArtifact;
};

const buildIssues = (
  fragments: WorkerFragmentArtifact[],
): DocsConsolidationIssue[] => {
  const grouped = new Map<string, WorkerFragmentArtifact[]>();
  for (const fragment of fragments) {
    const entries = grouped.get(fragment.conflict_key) ?? [];
    entries.push(fragment);
    grouped.set(fragment.conflict_key, entries);
  }

  return Array.from(grouped.entries())
    .filter(([, entries]) => entries.length > 1)
    .map(([conflictKey, entries]) => {
      const orderedEntries = [...entries].sort(
        (left, right) =>
          compareStrings(left.ordering_key, right.ordering_key) ||
          compareStrings(left.fragment_id, right.fragment_id),
      );
      const first = orderedEntries[0]!;
      const signatures = sortUnique(
        orderedEntries.map((entry) => stableFragmentSignature(entry)),
      );
      const duplicate = signatures.length === 1;
      return {
        issueKey: `${duplicate ? "duplicate" : "conflict"}::${conflictKey}`,
        type: duplicate ? "duplicate" : "conflict",
        targetDoc: first.target_doc,
        sectionKey: first.section_key,
        conflictKey,
        fragmentIds: orderedEntries.map((entry) => entry.fragment_id),
        laneIds: orderedEntries.map((entry) => entry.lane_id),
        message: duplicate
          ? `Duplicate worker fragments target ${conflictKey}; keep one and supersede the rest before doc integration.`
          : `Conflicting worker fragments target ${conflictKey}; resolve competing summaries/content before doc integration.`,
      } satisfies DocsConsolidationIssue;
    })
    .sort((left, right) => compareStrings(left.issueKey, right.issueKey));
};

const buildConsolidatedTargets = (
  fragments: WorkerFragmentArtifact[],
  issues: DocsConsolidationIssue[],
): DocsConsolidationArtifact["consolidatedTargets"] => {
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
      summaries: entries.map((entry) => entry.summary),
    }))
    .sort((left, right) => compareStrings(left.targetDoc, right.targetDoc));
};

const buildBrief = (
  artifact: Omit<DocsConsolidationArtifact, "brief">,
): string => {
  const lines: string[] = [
    "Lead-agent integration brief",
    `Proposal-only consolidation artifact: ${artifact.artifactPath}`,
    `Protected singleton targets in scope: ${artifact.summary.protectedTargetCount}`,
    `Worker fragments discovered: ${artifact.summary.fragmentCount}`,
  ];

  if (artifact.issues.length > 0) {
    lines.push(
      `Blocking issues: ${artifact.summary.issueCount} (${artifact.summary.duplicateCount} duplicate, ${artifact.summary.conflictCount} conflict)`,
    );
    for (const issue of artifact.issues.slice(0, 3)) {
      lines.push(
        `- ${issue.type.toUpperCase()}: ${issue.conflictKey} <- ${issue.fragmentIds.join(", ")}`,
      );
    }
  } else {
    lines.push("Blocking issues: none");
  }

  lines.push("Ready integration targets:");
  for (const target of artifact.consolidatedTargets.slice(0, 5)) {
    lines.push(
      `- ${target.targetDoc}: ${target.fragmentCount} fragment(s), sections=${target.sectionKeys.join(", ")}`,
    );
  }

  lines.push(
    "Constraint: consolidate into protected singleton docs manually after review; v1 does not auto-apply doc mutations.",
  );
  return lines.join("\n");
};

export const runDocsConsolidation = (cwd: string): DocsConsolidationResult => {
  const protectedSurfaceRegistry = loadProtectedSurfaceRegistry(cwd);
  const fragments = loadWorkerFragments(cwd);
  const issues = buildIssues(fragments);
  const consolidatedTargets = buildConsolidatedTargets(fragments, issues);

  const artifactWithoutBrief = {
    schemaVersion: "1.0",
    command: "docs consolidate",
    mode: "proposal-only",
    artifactPath: DEFAULT_ARTIFACT_PATH,
    protectedSurfaceRegistry,
    summary: {
      protectedTargetCount: protectedSurfaceRegistry.targets.length,
      fragmentCount: fragments.length,
      consolidatedTargetCount: consolidatedTargets.length,
      issueCount: issues.length,
      duplicateCount: issues.filter((issue) => issue.type === "duplicate")
        .length,
      conflictCount: issues.filter((issue) => issue.type === "conflict").length,
    },
    fragments,
    consolidatedTargets,
    issues,
  } satisfies Omit<DocsConsolidationArtifact, "brief">;

  const artifact: DocsConsolidationArtifact = {
    ...artifactWithoutBrief,
    brief: buildBrief(artifactWithoutBrief),
  };

  const artifactPath = path.join(cwd, DEFAULT_ARTIFACT_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    `${JSON.stringify(artifact, null, 2)}\n`,
    "utf8",
  );

  return {
    ok: artifact.summary.conflictCount === 0,
    artifactPath: DEFAULT_ARTIFACT_PATH,
    artifact,
  };
};
