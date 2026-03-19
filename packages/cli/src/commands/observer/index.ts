import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import {
  emitJsonOutput,
  writeJsonArtifactAbsolute,
} from "../../lib/jsonArtifact.js";
import { previewWorkflowArtifact } from "../../lib/workflowPromotion.js";
import type { WorkflowPromotion } from "../../lib/workflowPromotion.js";
import {
  buildFleetAdoptionReadinessSummary,
  buildFleetAdoptionWorkQueue,
  buildFleetCodexExecutionPlan,
  buildFleetExecutionReceipt,
  buildFleetUpdatedAdoptionState,
  deriveNextAdoptionQueueFromUpdatedState,
  buildRepoAdoptionReadiness,
  computeCrossRepoPatternLearning,
  readCrossRepoPatternsArtifact,
  type CrossRepoPatternsArtifact,
  type FleetExecutionOutcomeInput,
  type RepoAdoptionReadiness,
  readStoriesArtifact,
  resolvePatternKnowledgeStore,
  summarizeStoriesBacklog,
  findStoryById,
  sortStoriesForBacklog,
  type StoriesArtifact,
  type StoryBacklogSummary,
  type StoryRecord,
  buildStoryPatternContext,
  type StoryPatternContext,
} from "@zachariahredfield/playbook-engine";
import { ExitCode } from "../../lib/cliContract.js";
import {
  buildExecutionPlanInterpretation,
  buildFleetInterpretation,
  buildQueueInterpretation,
  buildReceiptInterpretation,
  buildUpdatedStateInterpretation,
} from "../../lib/interpretation.js";

type ObserverOptions = {
  format: "text" | "json";
  quiet: boolean;
};

type ObserverRepoEntry = {
  id: string;
  name: string;
  root: string;
  status: "connected";
  artifactsRoot: string;
  tags: string[];
};

type ObserverRepoReadinessState =
  | "connected_only"
  | "playbook_detected"
  | "partially_observable"
  | "observable";

type ObserverStoryBacklog = {
  artifact_path: ".playbook/stories.json";
  stories: StoriesArtifact["stories"];
  summary: StoryBacklogSummary;
};

type ObserverStoryDetail = {
  story: StoryRecord;
  pattern_context: StoryPatternContext;
  lifecycle_warnings: string[];
  lifecycle_links: {
    story_reference: string | null;
    last_plan_ref: string | null;
    last_receipt_ref: string | null;
    last_updated_state_ref: string | null;
    reconciliation_status: string | null;
    planned_at: string | null;
    last_receipt_at: string | null;
    last_updated_state_at: string | null;
    reconciled_at: string | null;
  };
  linked_status: {
    readiness_state: ObserverRepoReadinessState;
    lifecycle_stage: RepoAdoptionReadiness["lifecycle_stage"];
  };
  linked_evidence: Array<{
    label: string;
    artifact_path: string;
    artifact_kind: string;
    href: string | null;
  }>;
  linked_route: {
    label: string;
    href: string | null;
  } | null;
  raw_artifact_path: ".playbook/stories.json";
  related?: ObserverJoinLink[];
};

type ObserverJoinLink = {
  type: "story" | "story-candidate" | "pattern-candidate" | "pattern";
  id: string;
  title: string;
  normalizationKey: string | null;
  promotedFrom: string | null;
  sourceRefs: string[];
  origin: "repo-truth" | "derived-candidate" | "promoted-knowledge";
  raw_artifact_path: string;
  promote_command: string | null;
};

type ObserverPromotionLayer = {
  repo_truth: {
    raw_artifact_path: ".playbook/stories.json";
    stories: StoryRecord[];
  };
  derived_candidates: {
    raw_artifact_path: ".playbook/story-candidates.json";
    stories: Array<Record<string, unknown>>;
  };
  promoted_knowledge: {
    raw_artifact_path: string;
    patterns: Array<Record<string, unknown>>;
    scope?: string;
    canonical_artifact_path?: string;
  };
  joins: {
    linked_story_ids: string[];
    linked_story_candidate_ids: string[];
    linked_pattern_candidate_ids: string[];
    linked_pattern_ids: string[];
  };
};

type ObserverGlobalPromotionLayer = {
  derived_candidates: {
    raw_artifact_path: string;
    patterns: Array<Record<string, unknown>>;
    scope?: string;
    canonical_artifact_path?: string;
  };
  promoted_knowledge: {
    raw_artifact_path: string;
    patterns: Array<Record<string, unknown>>;
    scope?: string;
    canonical_artifact_path?: string;
  };
};

type ObserverPatternLineageStory = {
  repo_id: string;
  story_id: string;
  title: string;
  status: string;
  suggested_route: string | null;
  raw_artifact_path: ".playbook/stories.json";
  provenance: {
    source_ref: string | null;
    candidate_id: string | null;
    promoted_from: string | null;
  };
};

type ObserverGlobalPatternSummary = {
  id: string;
  title: string;
  candidate_id: string | null;
  promoted_at: string | null;
  lifecycle_state: string;
  staleness: 'fresh' | 'stale' | 'unknown';
  warnings: string[];
  source_refs: string[];
  linked_story_count: number;
  linked_repo_ids: string[];
};

type ObserverGlobalPatternDetail = {
  summary: ObserverGlobalPatternSummary;
  pattern: Record<string, unknown>;
  raw_artifact_path: string;
  linked_stories: ObserverPatternLineageStory[];
  supersession: {
    superseded_by: string | null;
    lifecycle_events: Array<Record<string, unknown>>;
  };
};

type ObserverCrossRepoCandidateGroup = {
  kind: string;
  candidate_count: number;
  affected_repo_count: number;
  affected_repos: string[];
  primary_next_action: string;
  top_evidence: Array<{
    repo_id: string;
    artifact_kind: string;
    artifact_path: string;
    pointer: string;
    excerpt: string;
  }>;
  patterns: Array<{
    id: string;
    title: string;
    classification: string;
    portability_score: number;
    supporting_repos: string[];
    evidence_count: number;
  }>;
};

type ObserverRepoReadiness = {
  connected: true;
  playbook_detected: boolean;
  playbook_directory_present: boolean;
  repo_index_present: boolean;
  cycle_state_present: boolean;
  cycle_history_present: boolean;
  policy_evaluation_present: boolean;
  policy_apply_result_present: boolean;
  pr_review_present: boolean;
  session_present: boolean;
  last_artifact_update_time: string | null;
  readiness_state: ObserverRepoReadinessState;
  missing_artifacts: string[];
  lifecycle_stage: RepoAdoptionReadiness["lifecycle_stage"];
  fallback_proof_ready: boolean;
  cross_repo_eligible: boolean;
  blockers: RepoAdoptionReadiness["blockers"];
  recommended_next_steps: string[];
};

type ObserverRepoRegistry = {
  schemaVersion: "1.0";
  kind: "repo-registry";
  repos: ObserverRepoEntry[];
};

type ObserverRepoCreateInput = {
  path: string;
  id?: string;
  tags?: string[];
};

const OBSERVER_REPO_REGISTRY_RELATIVE_PATH =
  ".playbook/observer/repos.json" as const;
const OBSERVER_SNAPSHOT_RELATIVE_PATH =
  ".playbook/observer/snapshot.json" as const;
const EXECUTION_OUTCOME_INPUT_RELATIVE_PATH = path.join(
  ".playbook",
  "execution-outcome-input.json",
);
const UPDATED_STATE_RELATIVE_PATH = path.join(
  ".playbook",
  "execution-updated-state.json",
);
const UPDATED_STATE_STAGING_RELATIVE_PATH = path.join(
  ".playbook",
  "staged",
  "workflow-status-updated",
  "execution-updated-state.json",
);

const OBSERVER_ARTIFACTS = [
  { kind: "execution-plan", relativePath: ".playbook/execution-plan.json" },
  { kind: "cycle-state", relativePath: ".playbook/cycle-state.json" },
  { kind: "cycle-history", relativePath: ".playbook/cycle-history.json" },
  {
    kind: "policy-evaluation",
    relativePath: ".playbook/policy-evaluation.json",
  },
  {
    kind: "policy-apply-result",
    relativePath: ".playbook/policy-apply-result.json",
  },
  { kind: "pr-review", relativePath: ".playbook/pr-review.json" },
  { kind: "session", relativePath: ".playbook/session.json" },
  { kind: "system-map", relativePath: ".playbook/system-map.json" },
  {
    kind: "pattern-candidates",
    relativePath: ".playbook/pattern-candidates.json",
  },
  { kind: "patterns", relativePath: ".playbook/patterns.json" },
  {
    kind: "promotion-receipts",
    relativePath: ".playbook/promotion-receipts.json",
  },
] as const;

const READINESS_ARTIFACTS = [
  { key: "repo_index_present", relativePath: ".playbook/repo-index.json" },
  { key: "cycle_state_present", relativePath: ".playbook/cycle-state.json" },
  {
    key: "cycle_history_present",
    relativePath: ".playbook/cycle-history.json",
  },
  {
    key: "policy_evaluation_present",
    relativePath: ".playbook/policy-evaluation.json",
  },
  {
    key: "policy_apply_result_present",
    relativePath: ".playbook/policy-apply-result.json",
  },
  { key: "pr_review_present", relativePath: ".playbook/pr-review.json" },
  { key: "session_present", relativePath: ".playbook/session.json" },
] as const;

type ObserverArtifactKind = (typeof OBSERVER_ARTIFACTS)[number]["kind"];

const defaultExecutionOutcomeInput = (): FleetExecutionOutcomeInput => ({
  schemaVersion: "1.0",
  kind: "fleet-adoption-execution-outcome-input",
  generated_at: new Date(0).toISOString(),
  session_id: "unrecorded-session",
  prompt_outcomes: [],
});

const validateUpdatedStateArtifact = (
  updatedState: ReturnType<typeof buildFleetUpdatedAdoptionState>,
  nextQueue: ReturnType<typeof deriveNextAdoptionQueueFromUpdatedState>,
): string[] => {
  const errors: string[] = [];
  if (updatedState.schemaVersion !== "1.0")
    errors.push("schemaVersion must be 1.0");
  if (updatedState.kind !== "fleet-adoption-updated-state")
    errors.push("kind must be fleet-adoption-updated-state");
  if (!Array.isArray(updatedState.repos)) errors.push("repos must be an array");
  if (!updatedState.summary || typeof updatedState.summary !== "object")
    errors.push("summary must be present");
  if (nextQueue.queue_source !== "updated_state")
    errors.push("next queue must be derived from updated_state");
  if (
    Array.isArray(updatedState.repos) &&
    updatedState.summary?.repos_total !== updatedState.repos.length
  ) {
    errors.push("summary.repos_total must match repos length");
  }
  return errors;
};

const previewUpdatedStatePromotion = (
  observerRoot: string,
  updatedState: ReturnType<typeof buildFleetUpdatedAdoptionState>,
  nextQueue: ReturnType<typeof deriveNextAdoptionQueueFromUpdatedState>,
): WorkflowPromotion =>
  previewWorkflowArtifact({
    cwd: observerRoot,
    workflowKind: "status-updated",
    candidateRelativePath: UPDATED_STATE_STAGING_RELATIVE_PATH,
    committedRelativePath: UPDATED_STATE_RELATIVE_PATH,
    artifact: updatedState,
    validate: () => validateUpdatedStateArtifact(updatedState, nextQueue),
    generatedAt: updatedState.generated_at,
    successSummary:
      "Staged updated-state candidate validated and ready for promotion into committed adoption state.",
    blockedSummary:
      "Staged updated-state candidate blocked; committed adoption state preserved.",
  });

const computeReadinessArtifacts = (
  observerRoot: string,
  registry: ObserverRepoRegistry,
) => {
  const fleet = buildFleetReadinessSummary(registry);
  const queue = buildFleetAdoptionWorkQueue(fleet);
  const executionPlan = buildFleetCodexExecutionPlan(queue);
  const outcomePath = path.join(
    observerRoot,
    EXECUTION_OUTCOME_INPUT_RELATIVE_PATH,
  );
  const outcomeInput = fs.existsSync(outcomePath)
    ? (JSON.parse(
        fs.readFileSync(outcomePath, "utf8"),
      ) as FleetExecutionOutcomeInput)
    : defaultExecutionOutcomeInput();
  const provisionalReceipt = buildFleetExecutionReceipt(
    executionPlan,
    queue,
    fleet,
    outcomeInput,
  );
  const updatedState = buildFleetUpdatedAdoptionState(
    executionPlan,
    queue,
    fleet,
    provisionalReceipt,
  );
  const nextQueue = deriveNextAdoptionQueueFromUpdatedState(updatedState);
  const promotion = previewUpdatedStatePromotion(
    observerRoot,
    updatedState,
    nextQueue,
  );
  const receipt = buildFleetExecutionReceipt(
    executionPlan,
    queue,
    fleet,
    outcomeInput,
    { workflowPromotion: promotion },
  );
  return {
    fleet,
    queue,
    executionPlan,
    receipt,
    updatedState,
    nextQueue,
    promotion,
    interpretations: {
      fleet: buildFleetInterpretation(fleet),
      queue: buildQueueInterpretation(queue),
      executionPlan: buildExecutionPlanInterpretation(executionPlan),
      receipt: buildReceiptInterpretation(receipt),
      updatedState: buildUpdatedStateInterpretation(
        updatedState,
        nextQueue,
        promotion.promotion_status,
      ),
      nextQueue: buildQueueInterpretation(nextQueue),
    },
  };
};

const printObserverHelp = (): void => {
  console.log(`Usage: playbook observer <repo|serve> [options]

Manage a deterministic local observer repo registry and read-only local API.

Subcommands:
  repo add <path> [--id <id>] [--tag <tag>] [--root <path>]
  repo list [--root <path>]
  repo remove <id> [--root <path>]
  serve [--host <host>] [--port <port>] [--root <path>]

Options:
  --root <path>                Override observer home root used for registry persistence
  --json                       Print machine-readable JSON output
  --help                       Show help`);
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1] ?? null;
  }

  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  if (!prefixed) {
    return null;
  }

  return prefixed.slice(optionName.length + 1) || null;
};

const readOptionValues = (args: string[], optionName: string): string[] => {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== optionName) {
      continue;
    }

    const value = args[index + 1];
    if (value && !value.startsWith("-")) {
      values.push(value);
    }
  }

  return values;
};

const stableRepoId = (repoRoot: string, repoName: string): string => {
  const digest = crypto
    .createHash("sha256")
    .update(repoRoot, "utf8")
    .digest("hex")
    .slice(0, 12);
  return `${repoName}-${digest}`;
};

const normalizeRegistry = (
  registry: ObserverRepoRegistry,
): ObserverRepoRegistry => ({
  schemaVersion: "1.0",
  kind: "repo-registry",
  repos: [...registry.repos].sort((left, right) =>
    left.id.localeCompare(right.id),
  ),
});

const defaultRegistry = (): ObserverRepoRegistry => ({
  schemaVersion: "1.0",
  kind: "repo-registry",
  repos: [],
});

const isPlaybookHomeRoot = (candidateRoot: string): boolean => {
  const packageJsonPath = path.join(candidateRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
    };
    return (
      typeof pkg.name === "string" &&
      pkg.name.toLowerCase().includes("playbook")
    );
  } catch {
    return false;
  }
};

export const resolveObserverHomeRoot = (
  explicitRoot: string | undefined,
  cwd: string,
): string => {
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return path.resolve(cwd, explicitRoot.trim());
  }

  let current = path.resolve(cwd);
  while (true) {
    if (isPlaybookHomeRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.resolve(cwd);
};

const registryPath = (observerRoot: string): string =>
  path.join(observerRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);

const readRegistry = (observerRoot: string): ObserverRepoRegistry => {
  const artifactPath = registryPath(observerRoot);
  if (!fs.existsSync(artifactPath)) {
    return defaultRegistry();
  }

  const parsed = JSON.parse(
    fs.readFileSync(artifactPath, "utf8"),
  ) as Partial<ObserverRepoRegistry>;
  if (
    parsed.schemaVersion !== "1.0" ||
    parsed.kind !== "repo-registry" ||
    !Array.isArray(parsed.repos)
  ) {
    throw new Error(
      `playbook observer: invalid registry artifact at ${OBSERVER_REPO_REGISTRY_RELATIVE_PATH}`,
    );
  }

  return normalizeRegistry({
    schemaVersion: "1.0",
    kind: "repo-registry",
    repos: parsed.repos
      .map((entry: any) => ({
        id: String(entry.id ?? ""),
        name: String(entry.name ?? ""),
        root: String(entry.root ?? ""),
        status: "connected" as const,
        artifactsRoot: String(entry.artifactsRoot ?? ""),
        tags: Array.isArray(entry.tags)
          ? entry.tags
              .map((tag: unknown) => String(tag))
              .sort((left: string, right: string) => left.localeCompare(right))
          : [],
      }))
      .filter((entry: any) => entry.id.length > 0),
  });
};

const writeRegistry = (
  observerRoot: string,
  registry: ObserverRepoRegistry,
): void => {
  writeJsonArtifactAbsolute(
    registryPath(observerRoot),
    normalizeRegistry(registry) as unknown as Record<string, unknown>,
    "observer",
    { envelope: false },
  );
};

const emitObserverPayload = (
  cwd: string,
  options: ObserverOptions,
  payload: Record<string, unknown>,
  textMessage: string,
): void => {
  if (options.format === "json") {
    emitJsonOutput({ cwd, command: "observer", payload });
    return;
  }

  if (!options.quiet) {
    console.log(textMessage);
  }
};

const nonFlagPositionals = (args: string[]): string[] => {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("-")) {
      if (
        value === "--id" ||
        value === "--tag" ||
        value === "--root" ||
        value === "--host" ||
        value === "--port"
      ) {
        index += 1;
      }
      continue;
    }

    values.push(value);
  }

  return values;
};

const readJsonFile = (targetPath: string): unknown =>
  JSON.parse(fs.readFileSync(targetPath, "utf8")) as unknown;

const loadSnapshotArtifact = (
  observerRoot: string,
): Record<string, unknown> | null => {
  const snapshotPath = path.join(observerRoot, OBSERVER_SNAPSHOT_RELATIVE_PATH);
  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  const value = readJsonFile(snapshotPath);
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== "1.0" ||
    candidate.kind !== "observer-snapshot"
  ) {
    return null;
  }

  return candidate;
};

const findArtifactSpec = (
  kind: string,
): (typeof OBSERVER_ARTIFACTS)[number] | null =>
  OBSERVER_ARTIFACTS.find((artifact) => artifact.kind === kind) ?? null;

const readRepoArtifact = (
  repo: ObserverRepoEntry,
  kind: ObserverArtifactKind,
): { kind: ObserverArtifactKind; value: unknown | null } => {
  const spec = findArtifactSpec(kind);
  if (!spec) {
    return { kind, value: null };
  }

  const artifactPath = path.join(repo.root, spec.relativePath);
  if (!fs.existsSync(artifactPath)) {
    return { kind, value: null };
  }

  try {
    return { kind, value: readJsonFile(artifactPath) };
  } catch {
    return { kind, value: null };
  }
};

const readJsonArtifact = <T>(
  root: string,
  relativePath: string,
  fallback: T,
): T => {
  const targetPath = path.join(root, relativePath);
  if (!fs.existsSync(targetPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return fallback;
  }
};

const toRecordArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object",
      )
    : [];

const listArtifactRecords = (
  artifact: unknown,
): Array<Record<string, unknown>> => {
  if (!artifact || typeof artifact !== "object") return [];
  const record = artifact as Record<string, unknown>;
  return toRecordArray(
    record.candidates ??
      record.patterns ??
      record.promotedPatterns ??
      record.stories ??
      record.entries ??
      [],
  );
};

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (entry): entry is string =>
              typeof entry === "string" && entry.trim().length > 0,
          ),
        ),
      ].sort((left, right) => left.localeCompare(right))
    : [];

const toSourceRefList = (entry: Record<string, unknown>): string[] => {
  const rawSourceRefs = Array.isArray(entry.sourceRefs) ? entry.sourceRefs : [];
  const direct = rawSourceRefs.flatMap((value) => {
    if (typeof value === "string" && value.trim()) return [value];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const repoId = typeof record.repoId === "string" ? record.repoId : null;
      const artifactPath =
        typeof record.artifactPath === "string" ? record.artifactPath : null;
      const entryId =
        typeof record.entryId === "string" ? record.entryId : null;
      const fingerprint =
        typeof record.fingerprint === "string" ? record.fingerprint : null;
      if (repoId && artifactPath && entryId && fingerprint) {
        return [`${repoId}::${artifactPath}::${entryId}::${fingerprint}`];
      }
    }
    return [];
  });
  const provenance =
    entry.provenance &&
    typeof entry.provenance === "object" &&
    !Array.isArray(entry.provenance)
      ? toSourceRefList(entry.provenance as Record<string, unknown>)
      : [];
  const evidenceRefs = Array.isArray(entry.evidence_refs)
    ? entry.evidence_refs.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const sourceArtifact =
    typeof entry.source_artifact === "string" && entry.source_artifact
      ? [entry.source_artifact]
      : [];
  return [
    ...new Set([...direct, ...provenance, ...evidenceRefs, ...sourceArtifact]),
  ].sort((left, right) => left.localeCompare(right));
};

const toJoinableLink = (
  entry: Record<string, unknown>,
  fallbackType: ObserverJoinLink["type"],
  origin: ObserverJoinLink["origin"],
  rawArtifactPath: string,
  promoteCommand: string | null,
): ObserverJoinLink | null => {
  const id =
    typeof entry.id === "string" && entry.id
      ? entry.id
      : typeof entry.candidateId === "string" && entry.candidateId
        ? entry.candidateId
        : typeof entry.knowledgeId === "string" && entry.knowledgeId
          ? entry.knowledgeId
          : null;
  if (!id) return null;
  const title =
    typeof entry.title === "string" && entry.title
      ? entry.title
      : typeof entry.canonicalPatternName === "string" &&
          entry.canonicalPatternName
        ? entry.canonicalPatternName
        : typeof entry.name === "string" && entry.name
          ? entry.name
          : id;
  return {
    type: fallbackType,
    id,
    title,
    normalizationKey:
      typeof entry.normalizationKey === "string" && entry.normalizationKey
        ? entry.normalizationKey
        : null,
    promotedFrom:
      typeof entry.promotedFrom === "string" && entry.promotedFrom
        ? entry.promotedFrom
        : typeof entry.sourceCandidateId === "string" && entry.sourceCandidateId
          ? entry.sourceCandidateId
          : null,
    sourceRefs: toSourceRefList(entry),
    origin,
    raw_artifact_path: rawArtifactPath,
    promote_command: promoteCommand,
  };
};

const buildGlobalPatternStoryLinks = (
  registry: ObserverRepoRegistry,
  patternEntry: Record<string, unknown>,
): ObserverPatternLineageStory[] => {
  const provenance =
    patternEntry.provenance &&
    typeof patternEntry.provenance === "object" &&
    !Array.isArray(patternEntry.provenance)
      ? (patternEntry.provenance as Record<string, unknown>)
      : {};
  const sourceRef =
    typeof provenance.source_ref === "string" ? provenance.source_ref : null;
  const candidateId =
    typeof provenance.candidate_id === "string"
      ? provenance.candidate_id
      : null;
  const stories: ObserverPatternLineageStory[] = [];
  for (const repo of registry.repos) {
    const artifact = readRepoStories(repo);
    for (const story of artifact.stories) {
      const storyProvenance =
        (
          story as typeof story & {
            provenance?: {
              source_ref?: string;
              candidate_id?: string;
              promoted_from?: string;
            };
          }
        ).provenance ?? null;
      if (
        !storyProvenance ||
        storyProvenance.promoted_from !== "pattern-candidate"
      )
        continue;
      const matchesSourceRef =
        sourceRef && storyProvenance.source_ref === sourceRef;
      const matchesCandidateId =
        candidateId && storyProvenance.candidate_id === candidateId;
      if (!matchesSourceRef && !matchesCandidateId) continue;
      stories.push({
        repo_id: repo.id,
        story_id: story.id,
        title: story.title,
        status: story.status,
        suggested_route: story.suggested_route,
        raw_artifact_path: ".playbook/stories.json",
        provenance: {
          source_ref: storyProvenance.source_ref ?? null,
          candidate_id: storyProvenance.candidate_id ?? null,
          promoted_from: storyProvenance.promoted_from ?? null,
        },
      });
    }
  }
  return stories.sort(
    (left, right) =>
      left.repo_id.localeCompare(right.repo_id) ||
      left.story_id.localeCompare(right.story_id),
  );
};

const buildGlobalPatternSummary = (
  registry: ObserverRepoRegistry,
  patternEntry: Record<string, unknown>,
): ObserverGlobalPatternSummary | null => {
  const id =
    typeof patternEntry.id === "string" && patternEntry.id
      ? patternEntry.id
      : null;
  if (!id) return null;
  const provenance =
    patternEntry.provenance &&
    typeof patternEntry.provenance === "object" &&
    !Array.isArray(patternEntry.provenance)
      ? (patternEntry.provenance as Record<string, unknown>)
      : {};
  const linkedStories = buildGlobalPatternStoryLinks(registry, patternEntry);
  const rawStatus = typeof patternEntry.status === "string" ? patternEntry.status : "active";
  const lifecycleState = rawStatus === "promoted" ? "active" : rawStatus;
  const promotedAt = typeof provenance.promoted_at === "string"
    ? provenance.promoted_at
    : typeof patternEntry.promotedAt === "string"
      ? patternEntry.promotedAt
      : null;
  const staleness: ObserverGlobalPatternSummary["staleness"] = promotedAt
    ? (Date.now() - Date.parse(promotedAt) > 1000 * 60 * 60 * 24 * 90 ? "stale" : "fresh")
    : "unknown";
  return {
    id,
    title:
      typeof patternEntry.title === "string" && patternEntry.title
        ? patternEntry.title
        : id,
    candidate_id:
      typeof provenance.candidate_id === "string"
        ? provenance.candidate_id
        : null,
    promoted_at: promotedAt,
    lifecycle_state: lifecycleState,
    staleness,
    warnings: [
      lifecycleState !== "active" ? `Pattern is ${lifecycleState}.` : "",
      staleness === "stale" ? "Pattern has not been refreshed recently; verify downstream stories still align." : "",
    ].filter((value): value is string => value.length > 0),
    source_refs: toSourceRefList(patternEntry),
    linked_story_count: linkedStories.length,
    linked_repo_ids: [
      ...new Set(linkedStories.map((story) => story.repo_id)),
    ].sort((left, right) => left.localeCompare(right)),
  };
};

const buildGlobalPatternList = (
  observerRoot: string,
  registry: ObserverRepoRegistry,
): ObserverGlobalPatternSummary[] =>
  readGlobalPromotedPatterns(observerRoot)
    .map((entry) => buildGlobalPatternSummary(registry, entry))
    .filter((entry): entry is ObserverGlobalPatternSummary => entry !== null)
    .sort((left, right) => left.id.localeCompare(right.id));

const buildGlobalPatternDetail = (
  observerRoot: string,
  registry: ObserverRepoRegistry,
  patternId: string,
): ObserverGlobalPatternDetail | null => {
  const pattern = readGlobalPromotedPatterns(observerRoot).find(
    (entry) => entry.id === patternId,
  );
  if (!pattern) return null;
  const summary = buildGlobalPatternSummary(registry, pattern);
  if (!summary) return null;
  return {
    summary,
    pattern,
    raw_artifact_path: ".playbook/patterns.json",
    linked_stories: buildGlobalPatternStoryLinks(registry, pattern),
    supersession: {
      superseded_by: typeof pattern.superseded_by === "string" ? pattern.superseded_by : null,
      lifecycle_events: Array.isArray(pattern.lifecycle_events)
        ? pattern.lifecycle_events.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
        : [],
    },
  };
};

const joinRelatedLinks = (
  subject: ObserverJoinLink | null,
  links: ObserverJoinLink[],
): ObserverJoinLink[] => {
  if (!subject) return [];
  const subjectRefs = new Set(subject.sourceRefs);
  return links.filter((entry) => {
    if (entry.id === subject.id && entry.type === subject.type) return false;
    if (
      subject.normalizationKey &&
      entry.normalizationKey &&
      subject.normalizationKey === entry.normalizationKey
    )
      return true;
    if (subject.promotedFrom && entry.id === subject.promotedFrom) return true;
    if (entry.promotedFrom && entry.promotedFrom === subject.id) return true;
    return entry.sourceRefs.some((ref) => subjectRefs.has(ref));
  });
};

const readRepoStoryCandidates = (
  repo: ObserverRepoEntry,
): Array<Record<string, unknown>> =>
  listArtifactRecords(
    readJsonArtifact<Record<string, unknown>>(
      repo.root,
      ".playbook/story-candidates.json",
      { candidates: [] },
    ),
  );

const readRepoPatternCandidates = (
  repo: ObserverRepoEntry,
): Array<Record<string, unknown>> =>
  listArtifactRecords(
    readJsonArtifact<Record<string, unknown>>(
      repo.root,
      ".playbook/pattern-candidates.json",
      { candidates: [] },
    ),
  );

const readRepoPromotedPatterns = (
  repo: ObserverRepoEntry,
): Array<Record<string, unknown>> =>
  listArtifactRecords(
    readJsonArtifact<Record<string, unknown>>(
      repo.root,
      resolvePatternKnowledgeStore("repo_local_memory", { projectRoot: repo.root }).canonicalRelativePath,
      { patterns: [] },
    ),
  );

const readGlobalPatternCandidates = (
  observerRoot: string,
): Array<Record<string, unknown>> =>
  listArtifactRecords(
    readJsonArtifact<Record<string, unknown>>(
      observerRoot,
      ".playbook/pattern-candidates.json",
      { candidates: [] },
    ),
  );

const readGlobalPromotedPatterns = (
  observerRoot: string,
): Array<Record<string, unknown>> => {
  const store = resolvePatternKnowledgeStore("global_reusable_pattern_memory", { playbookHome: observerRoot });
  return listArtifactRecords(
    readJsonArtifact<Record<string, unknown>>(
      observerRoot,
      store.resolvedFrom === "compatibility"
        ? store.compatibilityRelativePaths[0] ?? store.canonicalRelativePath
        : store.canonicalRelativePath,
      { patterns: [] },
    ),
  );
};

const buildRepoPromotionLayer = (
  repo: ObserverRepoEntry,
): ObserverPromotionLayer => {
  const stories = readRepoStories(repo).stories;
  const storyCandidates = readRepoStoryCandidates(repo);
  const patternCandidates = readRepoPatternCandidates(repo);
  const patterns = readRepoPromotedPatterns(repo);
  const storyLinks = stories
    .map((story) =>
      toJoinableLink(
        story as unknown as Record<string, unknown>,
        "story",
        "repo-truth",
        ".playbook/stories.json",
        null,
      ),
    )
    .filter((entry): entry is ObserverJoinLink => entry !== null);
  const storyCandidateLinks = storyCandidates
    .map((entry) =>
      toJoinableLink(
        entry,
        "story-candidate",
        "derived-candidate",
        ".playbook/story-candidates.json",
        typeof entry.id === "string"
          ? `pnpm playbook story promote ${entry.id} --json`
          : null,
      ),
    )
    .filter((entry): entry is ObserverJoinLink => entry !== null);
  const patternCandidateLinks = patternCandidates
    .map((entry) =>
      toJoinableLink(
        entry,
        "pattern-candidate",
        "derived-candidate",
        ".playbook/pattern-candidates.json",
        typeof entry.id === "string"
          ? `pnpm playbook patterns promote --id ${entry.id} --decision approve`
          : null,
      ),
    )
    .filter((entry): entry is ObserverJoinLink => entry !== null);
  const patternLinks = patterns
    .map((entry) =>
      toJoinableLink(
        entry,
        "pattern",
        "promoted-knowledge",
        resolvePatternKnowledgeStore("repo_local_memory", { projectRoot: repo.root }).canonicalRelativePath,
        null,
      ),
    )
    .filter((entry): entry is ObserverJoinLink => entry !== null);
  const joinedStories = new Set<string>();
  const joinedStoryCandidates = new Set<string>();
  const joinedPatternCandidates = new Set<string>();
  const joinedPatterns = new Set<string>();
  for (const storyLink of storyLinks) {
    for (const related of joinRelatedLinks(storyLink, [
      ...storyCandidateLinks,
      ...patternCandidateLinks,
      ...patternLinks,
    ])) {
      if (related.type === "story-candidate")
        joinedStoryCandidates.add(related.id);
      if (related.type === "pattern-candidate")
        joinedPatternCandidates.add(related.id);
      if (related.type === "pattern") joinedPatterns.add(related.id);
      joinedStories.add(storyLink.id);
    }
  }
  return {
    repo_truth: { raw_artifact_path: ".playbook/stories.json", stories },
    derived_candidates: {
      raw_artifact_path: ".playbook/story-candidates.json",
      stories: storyCandidates,
    },
    promoted_knowledge: {
      raw_artifact_path: resolvePatternKnowledgeStore("repo_local_memory", { projectRoot: repo.root }).canonicalRelativePath,
      patterns,
      scope: "repo_local_memory",
      canonical_artifact_path: resolvePatternKnowledgeStore("repo_local_memory", { projectRoot: repo.root }).canonicalRelativePath,
    },
    joins: {
      linked_story_ids: [...joinedStories].sort((l, r) => l.localeCompare(r)),
      linked_story_candidate_ids: [...joinedStoryCandidates].sort((l, r) =>
        l.localeCompare(r),
      ),
      linked_pattern_candidate_ids: [...joinedPatternCandidates].sort((l, r) =>
        l.localeCompare(r),
      ),
      linked_pattern_ids: [...joinedPatterns].sort((l, r) =>
        l.localeCompare(r),
      ),
    },
  };
};

const buildGlobalPromotionLayer = (
  observerRoot: string,
): ObserverGlobalPromotionLayer => ({
  derived_candidates: {
    raw_artifact_path: ".playbook/pattern-candidates.json",
    patterns: readGlobalPatternCandidates(observerRoot),
    scope: "cross_repo_proposal_bridge",
    canonical_artifact_path: ".playbook/pattern-candidates.json",
  },
  promoted_knowledge: {
    raw_artifact_path: resolvePatternKnowledgeStore("global_reusable_pattern_memory", { playbookHome: observerRoot }).resolvedFrom === "compatibility"
      ? resolvePatternKnowledgeStore("global_reusable_pattern_memory", { playbookHome: observerRoot }).compatibilityRelativePaths[0] ?? resolvePatternKnowledgeStore("global_reusable_pattern_memory", { playbookHome: observerRoot }).canonicalRelativePath
      : resolvePatternKnowledgeStore("global_reusable_pattern_memory", { playbookHome: observerRoot }).canonicalRelativePath,
    patterns: readGlobalPromotedPatterns(observerRoot),
    scope: "global_reusable_pattern_memory",
    canonical_artifact_path: resolvePatternKnowledgeStore("global_reusable_pattern_memory", { playbookHome: observerRoot }).canonicalRelativePath,
  },
});

const readRepoStories = (repo: ObserverRepoEntry): StoriesArtifact => {
  try {
    return readStoriesArtifact(repo.root);
  } catch {
    return { schemaVersion: "1.0", repo: repo.name, stories: [] };
  }
};

const buildStoryEvidenceLinks = (
  repoId: string,
  story: StoryRecord,
): ObserverStoryDetail["linked_evidence"] => {
  const links = story.evidence.map((entry) => {
    const normalized = String(entry);
    const artifactPath = normalized.startsWith(".playbook/")
      ? normalized
      : ".playbook/" + normalized.replace(/^\/+/, "");
    const artifactKind =
      artifactPath
        .split("/")
        .pop()
        ?.replace(/\.json$/, "") || "evidence";
    return {
      label: normalized,
      artifact_path: artifactPath,
      artifact_kind: artifactKind,
      href: artifactKindsForStoryEvidence().includes(artifactKind)
        ? `/repos/${encodeURIComponent(repoId)}/artifacts/${encodeURIComponent(artifactKind)}`
        : null,
    };
  });
  return links;
};

const artifactKindsForStoryEvidence = (): string[] => [
  "execution-plan",
  "cycle-state",
  "cycle-history",
  "policy-evaluation",
  "policy-apply-result",
  "pr-review",
  "session",
  "system-map",
  "promotion-receipts",
];

const buildRepoBacklog = (
  repo: ObserverRepoEntry,
  readiness: ObserverRepoReadiness,
): ObserverStoryBacklog => {
  const artifact = readRepoStories(repo);
  return {
    artifact_path: ".playbook/stories.json",
    stories: sortStoriesForBacklog(artifact.stories),
    summary: summarizeStoriesBacklog(artifact),
  };
};

const buildStoryDetail = (
  repo: ObserverRepoEntry,
  storyId: string,
  readiness: ObserverRepoReadiness,
): ObserverStoryDetail | null => {
  const artifact = readRepoStories(repo);
  const story = findStoryById(artifact, storyId);
  if (!story) return null;
  const linkedEvidence = buildStoryEvidenceLinks(repo.id, story);
  const patternContext = buildStoryPatternContext(story);
  const promotionLayer = buildRepoPromotionLayer(repo);
  const storyLink = toJoinableLink(
    story as unknown as Record<string, unknown>,
    "story",
    "repo-truth",
    ".playbook/stories.json",
    null,
  );
  const related = joinRelatedLinks(storyLink, [
    ...promotionLayer.derived_candidates.stories
      .map((entry) =>
        toJoinableLink(
          entry,
          "story-candidate",
          "derived-candidate",
          ".playbook/story-candidates.json",
          typeof entry.id === "string"
            ? `pnpm playbook story promote ${entry.id} --json`
            : null,
        ),
      )
      .filter((entry): entry is ObserverJoinLink => entry !== null),
    ...readRepoPatternCandidates(repo)
      .map((entry) =>
        toJoinableLink(
          entry,
          "pattern-candidate",
          "derived-candidate",
          ".playbook/pattern-candidates.json",
          typeof entry.id === "string"
            ? `pnpm playbook patterns promote --id ${entry.id} --decision approve`
            : null,
        ),
      )
      .filter((entry): entry is ObserverJoinLink => entry !== null),
    ...promotionLayer.promoted_knowledge.patterns
      .map((entry) =>
        toJoinableLink(
          entry,
          "pattern",
          "promoted-knowledge",
          ".playbook/patterns.json",
          null,
        ),
      )
      .filter((entry): entry is ObserverJoinLink => entry !== null),
  ]);
  return {
    story,
    pattern_context: patternContext,
    lifecycle_warnings: patternContext.patterns.flatMap((entry) => entry.lifecycle.warnings),
    lifecycle_links: {
      story_reference: story.story_reference ?? null,
      last_plan_ref: story.last_plan_ref ?? null,
      last_receipt_ref: story.last_receipt_ref ?? null,
      last_updated_state_ref: story.last_updated_state_ref ?? null,
      reconciliation_status: story.reconciliation_status ?? null,
      planned_at: story.planned_at ?? null,
      last_receipt_at: story.last_receipt_at ?? null,
      last_updated_state_at: story.last_updated_state_at ?? null,
      reconciled_at: story.reconciled_at ?? null,
    },
    linked_status: {
      readiness_state: readiness.readiness_state,
      lifecycle_stage: readiness.lifecycle_stage,
    },
    linked_evidence: linkedEvidence,
    linked_route: story.suggested_route
      ? {
          label: story.suggested_route,
          href: null,
        }
      : null,
    raw_artifact_path: ".playbook/stories.json",
    related,
  } as ObserverStoryDetail & { related: ObserverJoinLink[] };
};

const repoReadiness = (repo: ObserverRepoEntry): ObserverRepoReadiness => {
  const playbookDirectoryPresent =
    fs.existsSync(repo.artifactsRoot) &&
    fs.statSync(repo.artifactsRoot).isDirectory();
  const adoption = buildRepoAdoptionReadiness({
    repoRoot: repo.root,
    connected: true,
  });

  const flags = Object.fromEntries(
    READINESS_ARTIFACTS.map((artifact) => [
      artifact.key,
      fs.existsSync(path.join(repo.root, artifact.relativePath)),
    ]),
  ) as Record<(typeof READINESS_ARTIFACTS)[number]["key"], boolean>;

  const presentArtifactPaths = READINESS_ARTIFACTS.filter(
    (artifact) => flags[artifact.key],
  ).map((artifact) => path.join(repo.root, artifact.relativePath));
  const lastArtifactUpdateTime =
    presentArtifactPaths.length === 0
      ? null
      : new Date(
          Math.max(
            ...presentArtifactPaths.map((artifactPath) => {
              try {
                return fs.statSync(artifactPath).mtimeMs;
              } catch {
                return 0;
              }
            }),
          ),
        ).toISOString();

  const observableFlags = READINESS_ARTIFACTS.every(
    (artifact) => flags[artifact.key],
  );
  const anyArtifactsPresent = READINESS_ARTIFACTS.some(
    (artifact) => flags[artifact.key],
  );
  const readinessState: ObserverRepoReadinessState = !adoption.playbook_detected
    ? "connected_only"
    : observableFlags
      ? "observable"
      : anyArtifactsPresent
        ? "partially_observable"
        : "playbook_detected";

  return {
    connected: true,
    playbook_detected: adoption.playbook_detected,
    playbook_directory_present: playbookDirectoryPresent,
    repo_index_present: flags.repo_index_present,
    cycle_state_present: flags.cycle_state_present,
    cycle_history_present: flags.cycle_history_present,
    policy_evaluation_present: flags.policy_evaluation_present,
    policy_apply_result_present: flags.policy_apply_result_present,
    pr_review_present: flags.pr_review_present,
    session_present: flags.session_present,
    last_artifact_update_time: lastArtifactUpdateTime,
    readiness_state: readinessState,
    missing_artifacts: READINESS_ARTIFACTS.filter(
      (artifact) => !flags[artifact.key],
    ).map((artifact) => artifact.relativePath),
    lifecycle_stage: adoption.lifecycle_stage,
    fallback_proof_ready: adoption.fallback_proof_ready,
    cross_repo_eligible: adoption.cross_repo_eligible,
    blockers: adoption.blockers,
    recommended_next_steps: adoption.recommended_next_steps,
  };
};

const buildFleetReadinessSummary = (registry: ObserverRepoRegistry) =>
  buildFleetAdoptionReadinessSummary(
    registry.repos.map((repo) => ({
      repo_id: repo.id,
      repo_name: repo.name,
      readiness: repoReadiness(repo),
    })),
  );

const findHomeRepoId = (
  registry: ObserverRepoRegistry,
  cwd: string,
): string | null => {
  const cwdRoot = path.resolve(cwd);
  const fromExactRoot = registry.repos.find(
    (repo) => path.resolve(repo.root) === cwdRoot,
  );
  if (fromExactRoot) {
    return fromExactRoot.id;
  }

  const fromTags = registry.repos.find((repo) =>
    repo.tags.some((tag) => tag === "self" || tag === "home"),
  );
  if (fromTags) {
    return fromTags.id;
  }

  const fromName = registry.repos.find(
    (repo) =>
      repo.name.toLowerCase() === "playbook" ||
      repo.id.toLowerCase() === "playbook",
  );
  return fromName?.id ?? null;
};

const addRepoToRegistry = (
  observerRoot: string,
  registry: ObserverRepoRegistry,
  input: ObserverRepoCreateInput,
): { repo: ObserverRepoEntry; registry: ObserverRepoRegistry } => {
  const root = path.resolve(observerRoot, input.path);
  const rootStat = fs.existsSync(root) ? fs.statSync(root) : null;
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(
      `playbook observer repo add: repository root does not exist: ${root}`,
    );
  }

  const artifactsRoot = path.join(root, ".playbook");
  if (fs.existsSync(artifactsRoot)) {
    const artifactsStat = fs.statSync(artifactsRoot);
    if (!artifactsStat.isDirectory()) {
      throw new Error(
        `playbook observer repo add: expected directory at ${artifactsRoot}`,
      );
    }
  }

  const repoName = path.basename(root);
  const requestedId = input.id;
  const repoId =
    requestedId && requestedId.trim().length > 0
      ? requestedId.trim()
      : stableRepoId(root, repoName);
  const duplicateId = registry.repos.find((repo) => repo.id === repoId);
  if (duplicateId) {
    throw new Error(`playbook observer repo add: duplicate id "${repoId}"`);
  }

  const duplicateRoot = registry.repos.find((repo) => repo.root === root);
  if (duplicateRoot) {
    throw new Error(
      `playbook observer repo add: duplicate root "${root}" already registered as "${duplicateRoot.id}"`,
    );
  }

  const tags = [
    ...new Set(
      (input.tags ?? [])
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const entry: ObserverRepoEntry = {
    id: repoId,
    name: repoName,
    root,
    status: "connected",
    artifactsRoot,
    tags,
  };

  const nextRegistry = normalizeRegistry({
    ...registry,
    repos: [...registry.repos, entry],
  });
  writeRegistry(observerRoot, nextRegistry);
  return { repo: entry, registry: nextRegistry };
};

const removeRepoFromRegistry = (
  observerRoot: string,
  registry: ObserverRepoRegistry,
  removeId: string,
): ObserverRepoRegistry => {
  const existing = registry.repos.find((repo) => repo.id === removeId);
  if (!existing) {
    throw new Error(`playbook observer repo remove: unknown id "${removeId}"`);
  }

  const nextRegistry = normalizeRegistry({
    ...registry,
    repos: registry.repos.filter((repo) => repo.id !== removeId),
  });
  writeRegistry(observerRoot, nextRegistry);
  return nextRegistry;
};

const buildSnapshotFromRegistry = (
  registry: ObserverRepoRegistry,
): Record<string, unknown> => ({
  schemaVersion: "1.0",
  kind: "observer-snapshot",
  repos: registry.repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    status: repo.status,
    artifacts: OBSERVER_ARTIFACTS.map((artifact) =>
      readRepoArtifact(repo, artifact.kind),
    ),
  })),
});

const buildCrossRepoArtifact = (
  observerRoot: string,
  registry: ObserverRepoRegistry,
): CrossRepoPatternsArtifact => {
  try {
    return readCrossRepoPatternsArtifact(observerRoot);
  } catch {
    const repos = registry.repos.map((repo) => ({
      id: repo.id,
      repoPath: repo.root,
    }));
    return computeCrossRepoPatternLearning(repos);
  }
};

const toCrossRepoCandidateGroups = (
  artifact: CrossRepoPatternsArtifact,
): ObserverCrossRepoCandidateGroup[] => {
  const groups = new Map<string, ObserverCrossRepoCandidateGroup>();
  for (const candidate of artifact.candidate_patterns) {
    const kind = candidate.classification || "uncategorized";
    const supportingRepos = Array.isArray(candidate.supporting_repos)
      ? candidate.supporting_repos.filter(
          (repoId: unknown): repoId is string =>
            typeof repoId === "string" && repoId.trim().length > 0,
        )
      : [];
    const evidence = Array.isArray(candidate.evidence)
      ? candidate.evidence.slice(0, 2)
      : [];
    const existing: ObserverCrossRepoCandidateGroup = groups.get(kind) ?? {
      kind,
      candidate_count: 0,
      affected_repo_count: 0,
      affected_repos: [] as string[],
      primary_next_action:
        kind === "gap"
          ? "Inspect the raw artifact viewer, then generate or promote the next story candidate for the missing governed surface."
          : "Inspect the strongest evidence, then decide whether to promote this portable pattern through the governed pattern flow.",
      top_evidence: [],
      patterns: [],
    };
    existing.candidate_count += 1;
    existing.patterns.push({
      id: candidate.id,
      title: candidate.title,
      classification: candidate.classification,
      portability_score: candidate.portability?.score ?? 0,
      supporting_repos: [...supportingRepos],
      evidence_count: Array.isArray(candidate.evidence)
        ? candidate.evidence.length
        : 0,
    });
    for (const repoId of supportingRepos) {
      if (!existing.affected_repos.includes(repoId))
        existing.affected_repos.push(repoId);
    }
    for (const item of evidence) {
      existing.top_evidence.push({
        repo_id: item.repo_id,
        artifact_kind: item.artifact_kind,
        artifact_path: item.artifact_path,
        pointer: item.pointer,
        excerpt: item.excerpt,
      });
    }
    groups.set(kind, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      affected_repos: [...group.affected_repos].sort((left, right) =>
        left.localeCompare(right),
      ),
      affected_repo_count: group.affected_repos.length,
      top_evidence: group.top_evidence.slice(0, 3),
      patterns: [...group.patterns].sort(
        (left, right) =>
          right.portability_score - left.portability_score ||
          right.evidence_count - left.evidence_count ||
          left.id.localeCompare(right.id),
      ),
    }))
    .sort(
      (left, right) =>
        right.candidate_count - left.candidate_count ||
        right.affected_repo_count - left.affected_repo_count ||
        left.kind.localeCompare(right.kind),
    );
};

const writeJsonResponse = (
  response: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const readRequestBody = async (
  request: http.IncomingMessage,
): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const observerDashboardHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Playbook Observer UI</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
      body { margin: 0; background: #0b1020; color: #dbe5ff; }
      header { padding: 12px 18px; border-bottom: 1px solid #243252; }
      main { display: grid; grid-template-columns: 300px 1fr; min-height: calc(100vh - 52px); }
      aside, section { padding: 12px; border-right: 1px solid #243252; }
      section { border-right: none; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 10px; align-content: start; }
      h1, h2, h3 { margin: 0 0 8px; font-weight: 600; }
      .card { background: #111935; border: 1px solid #243252; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
      .repo { cursor: pointer; }
      .repo.selected { border-color: #a5c4ff; }
      button { cursor: pointer; border-radius: 6px; border: 1px solid #35519c; background: #1d3270; color: #e7eeff; padding: 5px 8px; }
      input, select { width: 100%; box-sizing: border-box; margin: 4px 0 8px; padding: 5px; background: #111935; color: #e7eeff; border: 1px solid #243252; border-radius: 6px; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0a1129; border: 1px solid #243252; padding: 10px; border-radius: 6px; max-height: 340px; overflow: auto; }
      .row { display: flex; gap: 8px; align-items: center; }
      .meta { color: #95addf; font-size: 12px; }
      .blueprint { width: 100%; height: 420px; background: #0a1129; border: 1px solid #243252; border-radius: 6px; }
      .layer-band { fill: #0f1734; stroke: #243252; stroke-width: 1; }
      .edge-line { stroke: #4a639f; stroke-width: 1.2; marker-end: url(#arrowhead); }
      .edge-line.active { stroke: #87afff; stroke-width: 2; }
      .node-label, .layer-label { fill: #dbe5ff; font-size: 12px; }
      .node-box { stroke-width: 1.4; rx: 6; }
      .node-state-active { fill: #173964; stroke: #4cb6ff; }
      .node-state-available { fill: #1e325e; stroke: #7ba6ff; }
      .node-state-idle { fill: #202f4d; stroke: #7f8fb0; }
      .node-state-missing { fill: #3a1f2f; stroke: #cf6a8e; }
      .node-state-stale { fill: #3b321f; stroke: #d8a052; }
      .node-box.selected { stroke: #ffffff; stroke-width: 2.3; }
      .badge { display: inline-flex; border-radius: 999px; padding: 2px 8px; border: 1px solid #35519c; font-size: 11px; margin-right: 6px; }
      .summary-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 10px; }
      .summary-metric { background: #0a1129; border: 1px solid #243252; border-radius: 6px; padding: 8px; }
      .summary-metric-label { color: #95addf; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
      .summary-metric-value { font-size: 13px; line-height: 1.4; }
      .summary-pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .summary-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 8px; font-size: 11px; border: 1px solid #35519c; background: #13214a; }
      .summary-pill.good { border-color: #3f9f74; background: #173629; }
      .summary-pill.warn { border-color: #d8a052; background: #3b321f; }
      .summary-pill.bad { border-color: #cf6a8e; background: #3a1f2f; }
      .narrative-card { background: #0a1129; border: 1px solid #243252; border-radius: 6px; padding: 10px; margin-top: 8px; }
      .narrative-primary { margin-top: 8px; padding: 8px; border-radius: 6px; background: #13214a; border: 1px solid #35519c; }
      .narrative-secondary { margin-top: 8px; }
      .narrative-secondary ul { margin-top: 6px; padding-left: 18px; }
      .raw-truth-note { margin-top: 8px; }
      .layout-main { min-width: 0; }
      .layout-side { min-width: 0; }
      .mode-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
      .mode-tab.active { border-color: #a5c4ff; background: #29458e; }
      .hidden { display: none; }
      .empty-state { padding: 10px; border: 1px dashed #35519c; border-radius: 6px; color: #95addf; font-size: 12px; }
      .cross-repo-list { display: grid; gap: 8px; }
      .cross-repo-item { border: 1px solid #243252; border-radius: 6px; padding: 8px; background: #0a1129; }
      details summary { cursor: pointer; font-weight: 600; }
      .state-legend { margin-top: 6px; }
      .state-legend .badge { margin-bottom: 4px; }
      @media (max-width: 1200px) {
        section { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header class="row"><h1>Observer Dashboard</h1><button id="refresh">Refresh</button><span id="health" class="meta"></span></header>
    <main>
      <aside>
        <div class="card"><h2>Connected Repos</h2><div id="repos"></div></div>
        <div class="card"><h3>Add Repo</h3><input id="repoPath" placeholder="/path/to/repo" /><input id="repoId" placeholder="optional-id" /><input id="repoTags" placeholder="tags comma-separated" /><button id="addRepo">Connect</button></div>
        <details id="selfPanel" class="card">
          <summary>Playbook Self-Observation</summary>
          <div id="observerRegistryMeta" class="meta">Observer root metadata pending.</div>
          <div id="selfSummary" class="meta">Waiting for observer data.</div>
        </details>
      </aside>
      <section>
        <div class="layout-main">
          <div class="mode-tabs" role="tablist" aria-label="Observer modes">
            <button id="repoModeBtn" class="mode-tab active" role="tab" aria-selected="true">Repo View</button>
            <button id="crossRepoModeBtn" class="mode-tab" role="tab" aria-selected="false">Cross-Repo View</button>
          </div>
          <div class="card"><h2>Control-Loop Summary</h2><div id="controlLoopSummaryPanel" class="meta">Control-loop summary loads from governed readiness artifacts.</div></div>
          <div id="repoViewPanel">
          <div class="card"><h2 id="repoTitle">Repo Detail</h2><div id="repoDetail" class="meta">Select a repo.</div><button id="removeRepo" style="display:none">Remove repo</button></div>
          <div class="card"><h3>Backlog Summary</h3><div id="backlogSummaryPanel" class="meta">Backlog summary loads from the canonical story artifact only.</div></div>
          <div class="card"><h3>Backlog List</h3><div id="backlogListPanel" class="meta">Backlog list loads from .playbook/stories.json.</div></div>
          <div class="card"><h3>Story Detail</h3><div id="storyDetailPanel" class="meta">Select a story to inspect details.</div></div>
          <div class="card"><h3>Promotion Layer</h3><div id="promotionLayerPanel" class="meta">Repo truth, derived candidates, and promoted knowledge load here.</div></div>
          <div class="card"><h3>System Blueprint</h3><div id="blueprintMeta" class="meta">Select a repo.</div><svg id="blueprintPanel" class="blueprint" viewBox="0 0 980 420" aria-label="System Blueprint"></svg></div>
          <div class="card"><h3>Artifact Detail Viewer</h3><select id="artifactKind"></select><div id="artifactPanel"></div></div>
          </div>
          <div id="crossRepoViewPanel" class="hidden">
          <div class="card"><h3>Fleet Readiness Summary</h3><div id="fleetSummaryPanel" class="meta">Fleet readiness summary loads from connected repos.</div></div>
          <div class="card"><h3>Adoption Work Queue</h3><div id="queueSummaryPanel" class="meta">Adoption work queue loads from connected repos.</div></div>
          <div class="card"><h3>Codex Execution Plan</h3><div id="executionPlanPanel" class="meta">Codex execution packaging loads from queue state.</div></div>
          <div class="card"><h3>Execution Outcome Receipt</h3><div id="executionReceiptPanel" class="meta">Execution outcome receipt loads from plan, queue, readiness, and ingested outcomes.</div></div>
          <div class="card"><h3>Workflow Promotion State</h3><div id="promotionPanel" class="meta">Promotion state loads from the shared workflow-promotion contract.</div></div>
          <div class="card"><h3>Reconciled Updated State</h3><div id="updatedStatePanel" class="meta">Reconciled updated state closes the loop from receipt into canonical adoption state.</div></div>
          <div class="card"><h3>Next Queue (Derived from Updated State)</h3><div id="nextQueuePanel" class="meta">Next adoption queue is derived deterministically from updated state only.</div></div>
          <div class="card"><h3>Global Promotion Layer</h3><div id="crossRepoPromotionPanel" class="meta">Global candidates and promoted patterns load here.</div></div>
          <div class="card"><h3>Global Pattern Lineage</h3><div id="globalPatternListPanel" class="meta">Promoted patterns and linked repo stories load here.</div><div id="globalPatternDetailPanel" class="meta">Select a promoted pattern to inspect provenance and downstream story lineage.</div></div>
          <div class="card"><h3>Cross-Repo Intelligence</h3>
            <div class="row"><label class="meta">Left repo</label><select id="compareLeft"></select></div>
            <div class="row"><label class="meta">Right repo</label><select id="compareRight"></select></div>
            <div class="row"><button id="compareBtn">Compare pair</button><button id="compareAllBtn">All connected repos</button></div>
            <div id="crossRepoPanel" class="meta">Choose repos to compare governed artifacts.</div>
          </div>
          </div>
        </div>
        <div class="layout-side">
          <div class="card"><h3>Selected Blueprint Node</h3><div id="selectedNodeDetail" class="meta">Click a node to inspect layer, state, and artifact linkage.</div></div>
        </div>
      </section>
    </main>
    <script src="/ui/app.js"></script>
  </body>
</html>`;

const OBSERVER_DASHBOARD_APP_SOURCE_PATH = new URL(
  "./dashboard-app.js",
  import.meta.url,
);

const observerDashboardScriptHasTypeScriptLeakage = (
  source: string,
): boolean => {
  const typeAnnotationLeakage =
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$][\w$<>,\s\[\]\|&]*\s*(?:=|;)/m;
  const anyAnnotationLeakage = /\b:\s*any\b/m;
  const typeAssertionLeakage =
    /\bas\s+(?:const|any|unknown|never|[A-Z][\w$]*(?:<[^>]+>)?)\b/m;
  const genericArrowLeakage =
    /=\s*<[A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*>\s*\(/m;
  return (
    typeAnnotationLeakage.test(source) ||
    anyAnnotationLeakage.test(source) ||
    typeAssertionLeakage.test(source) ||
    genericArrowLeakage.test(source)
  );
};

const observerDashboardJs = (): string => {
  const source = fs.readFileSync(OBSERVER_DASHBOARD_APP_SOURCE_PATH, "utf8");
  if (observerDashboardScriptHasTypeScriptLeakage(source)) {
    throw new Error(
      "playbook observer: dashboard app.js contains TypeScript-only syntax; browser bootstrap refused",
    );
  }
  return source;
};

const observerServerResponse = (
  observerRoot: string,
  invocationCwd: string,
  pathname: string,
  searchParams: URLSearchParams,
): { statusCode: number; payload: Record<string, unknown> } => {
  const registry = readRegistry(observerRoot);
  const homeRepoId = findHomeRepoId(registry, invocationCwd);
  const base = {
    schemaVersion: "1.0",
    readOnly: true,
    localOnly: true,
    cwd: invocationCwd,
    observer_root: observerRoot,
    registry_path: registryPath(observerRoot),
    repo_count: registry.repos.length,
  };

  if (pathname === "/health") {
    return {
      statusCode: 200,
      payload: { ...base, kind: "observer-server-health", status: "ok" },
    };
  }

  if (pathname === "/repos") {
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-server-repos",
        home_repo_id: homeRepoId,
        repos: registry.repos.map((repo) => ({
          ...repo,
          readiness: repoReadiness(repo),
        })),
      },
    };
  }

  if (pathname === "/api/cross-repo/summary") {
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    const groups = toCrossRepoCandidateGroups(artifact);
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-cross-repo-summary",
        summary: {
          source_repos: artifact.source_repos,
          candidate_count: artifact.candidate_patterns.length,
          comparison_count: artifact.comparisons.length,
          primary_next_action:
            groups[0]?.primary_next_action ??
            "Connect at least two observable repos, then review portable-pattern evidence.",
          candidate_groups: groups,
        },
      },
    };
  }

  if (pathname === "/api/readiness/fleet") {
    const readinessArtifacts = computeReadinessArtifacts(
      observerRoot,
      registry,
    );
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-fleet-readiness-summary",
        fleet: readinessArtifacts.fleet,
        interpretation: readinessArtifacts.interpretations.fleet,
        promotion: readinessArtifacts.promotion,
      },
    };
  }

  if (pathname === "/api/readiness/queue") {
    const readinessArtifacts = computeReadinessArtifacts(
      observerRoot,
      registry,
    );
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-fleet-adoption-work-queue",
        queue: readinessArtifacts.queue,
        interpretation: readinessArtifacts.interpretations.queue,
        promotion: readinessArtifacts.promotion,
      },
    };
  }

  if (pathname === "/api/readiness/execute") {
    const readinessArtifacts = computeReadinessArtifacts(
      observerRoot,
      registry,
    );
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-fleet-adoption-execution-plan",
        execution_plan: readinessArtifacts.executionPlan,
        interpretation: readinessArtifacts.interpretations.executionPlan,
        promotion: readinessArtifacts.promotion,
      },
    };
  }

  if (
    pathname === "/api/readiness/receipt" ||
    pathname === "/api/readiness/updated-state" ||
    pathname === "/api/readiness/next-queue" ||
    pathname === "/api/readiness/promotion"
  ) {
    const readinessArtifacts = computeReadinessArtifacts(
      observerRoot,
      registry,
    );
    if (pathname === "/api/readiness/updated-state") {
      return {
        statusCode: 200,
        payload: {
          ...base,
          kind: "observer-fleet-adoption-updated-state",
          updated_state: readinessArtifacts.updatedState,
          interpretation: readinessArtifacts.interpretations.updatedState,
          promotion: readinessArtifacts.promotion,
        },
      };
    }
    if (pathname === "/api/readiness/next-queue") {
      return {
        statusCode: 200,
        payload: {
          ...base,
          kind: "observer-fleet-adoption-next-queue",
          next_queue: readinessArtifacts.nextQueue,
          interpretation: readinessArtifacts.interpretations.nextQueue,
          promotion: readinessArtifacts.promotion,
        },
      };
    }
    if (pathname === "/api/readiness/promotion") {
      return {
        statusCode: 200,
        payload: {
          ...base,
          kind: "observer-fleet-adoption-promotion-state",
          promotion: readinessArtifacts.promotion,
          updated_state: readinessArtifacts.updatedState,
          receipt: readinessArtifacts.receipt,
        },
      };
    }
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-fleet-adoption-execution-receipt",
        receipt: readinessArtifacts.receipt,
        interpretation: readinessArtifacts.interpretations.receipt,
        promotion: readinessArtifacts.promotion,
      },
    };
  }

  if (pathname === "/api/cross-repo/promotion-layer") {
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-cross-repo-promotion-layer",
        promotion_layer: buildGlobalPromotionLayer(observerRoot),
      },
    };
  }

  if (pathname === "/api/cross-repo/global-patterns") {
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-cross-repo-global-pattern-list",
        patterns: buildGlobalPatternList(observerRoot, registry),
        deep_disclosure: {
          raw_artifact_path: ".playbook/patterns.json",
        },
      },
    };
  }

  const globalPatternMatch =
    /^\/api\/cross-repo\/global-patterns\/([^/]+)$/.exec(pathname);
  if (globalPatternMatch) {
    const patternId = decodeURIComponent(globalPatternMatch[1] ?? "");
    const detail = buildGlobalPatternDetail(observerRoot, registry, patternId);
    if (!detail) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "global-pattern-not-found",
        },
      };
    }
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-cross-repo-global-pattern-detail",
        detail,
      },
    };
  }

  if (pathname === "/api/cross-repo/candidates") {
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-cross-repo-candidates",
        candidates: artifact.candidate_patterns,
        candidate_groups: toCrossRepoCandidateGroups(artifact),
        deep_disclosure: {
          raw_artifact_path: ".playbook/cross-repo-patterns.json",
          pairwise_comparison_count: artifact.comparisons.length,
        },
      },
    };
  }

  if (
    pathname === "/api/cross-repo/compare" ||
    pathname === "/api/cross-repo/repo-delta"
  ) {
    const left = searchParams.get("left");
    const right = searchParams.get("right");
    if (!left || !right) {
      return {
        statusCode: 400,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "missing-left-right",
        },
      };
    }
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    const comparison = artifact.comparisons.find(
      (entry: any) =>
        (entry.left_repo_id === left && entry.right_repo_id === right) ||
        (entry.left_repo_id === right && entry.right_repo_id === left),
    );
    if (!comparison) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "comparison-not-found",
        },
      };
    }
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: pathname.endsWith("repo-delta")
          ? "observer-cross-repo-repo-delta"
          : "observer-cross-repo-compare",
        comparison,
        repo_delta: comparison.repo_deltas,
        deep_disclosure: {
          raw_artifact_path: ".playbook/cross-repo-patterns.json",
        },
      },
    };
  }

  const patternMatch = /^\/api\/cross-repo\/patterns\/([^/]+)$/.exec(pathname);
  if (patternMatch) {
    const patternId = decodeURIComponent(patternMatch[1] ?? "");
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    const pattern = artifact.candidate_patterns.find(
      (entry: any) => entry.id === patternId,
    );
    if (!pattern) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "pattern-not-found",
        },
      };
    }
    return {
      statusCode: 200,
      payload: { ...base, kind: "observer-cross-repo-pattern", pattern },
    };
  }

  if (pathname === "/snapshot") {
    return {
      statusCode: 200,
      payload: {
        ...base,
        home_repo_id: homeRepoId,
        snapshot:
          loadSnapshotArtifact(observerRoot) ??
          buildSnapshotFromRegistry(registry),
        readiness: registry.repos.map((repo) => ({
          id: repo.id,
          readiness: repoReadiness(repo),
        })),
        fleet: buildFleetReadinessSummary(registry),
      },
    };
  }

  const repoMatch = /^\/repos\/([^/]+)$/.exec(pathname);
  if (repoMatch) {
    const repo = registry.repos.find(
      (entry: any) => entry.id === decodeURIComponent(repoMatch[1] ?? ""),
    );
    if (!repo) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "repo-not-found",
        },
      };
    }
    const readiness = repoReadiness(repo);
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-server-repo",
        repo,
        readiness,
        backlog: buildRepoBacklog(repo, readiness),
        promotion_layer: buildRepoPromotionLayer(repo),
      },
    };
  }

  const backlogMatch = /^\/repos\/([^/]+)\/backlog$/.exec(pathname);
  if (backlogMatch) {
    const repo = registry.repos.find(
      (entry: any) => entry.id === decodeURIComponent(backlogMatch[1] ?? ""),
    );
    if (!repo) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "repo-not-found",
        },
      };
    }
    const readiness = repoReadiness(repo);
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-server-backlog",
        repoId: repo.id,
        backlog: buildRepoBacklog(repo, readiness),
        readiness,
      },
    };
  }

  const storyMatch = /^\/repos\/([^/]+)\/backlog\/stories\/([^/]+)$/.exec(
    pathname,
  );
  if (storyMatch) {
    const repo = registry.repos.find(
      (entry: any) => entry.id === decodeURIComponent(storyMatch[1] ?? ""),
    );
    if (!repo) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "repo-not-found",
        },
      };
    }
    const readiness = repoReadiness(repo);
    const detail = buildStoryDetail(
      repo,
      decodeURIComponent(storyMatch[2] ?? ""),
      readiness,
    );
    if (!detail) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "story-not-found",
        },
      };
    }
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-server-story-detail",
        repoId: repo.id,
        detail,
      },
    };
  }

  const artifactMatch = /^\/repos\/([^/]+)\/artifacts\/([^/]+)$/.exec(pathname);
  if (artifactMatch) {
    const repo = registry.repos.find(
      (entry: any) => entry.id === decodeURIComponent(artifactMatch[1] ?? ""),
    );
    if (!repo) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "repo-not-found",
        },
      };
    }

    const artifactKind = decodeURIComponent(artifactMatch[2] ?? "");
    const spec = findArtifactSpec(artifactKind);
    if (!spec) {
      return {
        statusCode: 404,
        payload: {
          ...base,
          kind: "observer-server-error",
          error: "artifact-kind-not-found",
        },
      };
    }

    const artifact = readRepoArtifact(repo, spec.kind);
    const storyReference =
      artifact.kind === "execution-plan" &&
      artifact.value &&
      typeof artifact.value === "object" &&
      !Array.isArray(artifact.value)
        ? (
            (artifact.value as Record<string, unknown>).story_reference as
              | Record<string, unknown>
              | undefined
          )?.id
        : undefined;
    const detail =
      typeof storyReference === "string"
        ? buildStoryDetail(repo, storyReference, repoReadiness(repo))
        : null;
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: "observer-server-artifact",
        repoId: repo.id,
        artifact,
        ...(detail
          ? {
              plan_detail: {
                story_id: storyReference,
                pattern_context: detail.pattern_context,
                lifecycle_warnings: detail.lifecycle_warnings,
              },
            }
          : {}),
      },
    };
  }

  return {
    statusCode: 404,
    payload: { ...base, kind: "observer-server-error", error: "not-found" },
  };
};

export const createObserverServer = (
  observerRoot: string,
  invocationCwd = observerRoot,
): http.Server =>
  http.createServer(async (request, response) => {
    const parsedUrl = new URL(request.url ?? "/", "http://localhost");
    if (
      request.method === "GET" &&
      (parsedUrl.pathname === "/" || parsedUrl.pathname === "/ui")
    ) {
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(observerDashboardHtml());
      return;
    }

    if (request.method === "GET" && parsedUrl.pathname === "/ui/app.js") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/javascript; charset=utf-8");
      response.end(observerDashboardJs());
      return;
    }

    if (request.method === "POST" && parsedUrl.pathname === "/repos") {
      try {
        const body = await readRequestBody(request);
        const payload = JSON.parse(body) as Partial<ObserverRepoCreateInput>;
        if (!payload.path || payload.path.trim().length === 0) {
          writeJsonResponse(response, 400, {
            schemaVersion: "1.0",
            kind: "observer-server-error",
            error: "missing-path",
            localOnly: true,
          });
          return;
        }

        const result = addRepoToRegistry(
          observerRoot,
          readRegistry(observerRoot),
          {
            path: payload.path,
            id: payload.id,
            tags: Array.isArray(payload.tags)
              ? payload.tags.map((tag) => String(tag))
              : [],
          },
        );
        writeJsonResponse(response, 200, {
          schemaVersion: "1.0",
          kind: "observer-server-repo-add",
          readOnly: false,
          localOnly: true,
          repo: result.repo,
          registry: result.registry,
        });
      } catch (error) {
        writeJsonResponse(response, 400, {
          schemaVersion: "1.0",
          kind: "observer-server-error",
          error: error instanceof Error ? error.message : String(error),
          localOnly: true,
        });
      }
      return;
    }

    const deleteRepoMatch = /^\/repos\/([^/]+)$/.exec(parsedUrl.pathname);
    if (request.method === "DELETE" && deleteRepoMatch) {
      try {
        const removedId = decodeURIComponent(deleteRepoMatch[1] ?? "");
        const registry = removeRepoFromRegistry(
          observerRoot,
          readRegistry(observerRoot),
          removedId,
        );
        writeJsonResponse(response, 200, {
          schemaVersion: "1.0",
          kind: "observer-server-repo-remove",
          readOnly: false,
          localOnly: true,
          removedId,
          registry,
        });
      } catch (error) {
        writeJsonResponse(response, 404, {
          schemaVersion: "1.0",
          kind: "observer-server-error",
          error: error instanceof Error ? error.message : String(error),
          localOnly: true,
        });
      }
      return;
    }

    if (request.method !== "GET") {
      writeJsonResponse(response, 405, {
        schemaVersion: "1.0",
        kind: "observer-server-error",
        error: "method-not-allowed",
        readOnly: true,
        localOnly: true,
      });
      return;
    }

    const result = observerServerResponse(
      observerRoot,
      invocationCwd,
      parsedUrl.pathname,
      parsedUrl.searchParams,
    );
    writeJsonResponse(response, result.statusCode, result.payload);
  });

export const runObserver = async (
  cwd: string,
  args: string[],
  options: ObserverOptions,
): Promise<number> => {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printObserverHelp();
    return args.length === 0 ? ExitCode.Failure : ExitCode.Success;
  }

  const [scope, action] = args;
  const observerRoot = resolveObserverHomeRoot(
    readOptionValue(args, "--root") ?? undefined,
    cwd,
  );
  const resolvedRegistryPath = registryPath(observerRoot);

  if (scope === "serve") {
    const requestedHost = readOptionValue(args, "--host")?.trim();
    const host =
      requestedHost && requestedHost.length > 0 ? requestedHost : "127.0.0.1";
    const requestedPort = readOptionValue(args, "--port");
    const parsedPort = requestedPort
      ? Number.parseInt(requestedPort, 10)
      : 4300;
    const port =
      Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535
        ? parsedPort
        : Number.NaN;
    if (Number.isNaN(port)) {
      const message =
        "playbook observer serve: --port must be an integer between 0 and 65535";
      if (options.format === "json") {
        emitJsonOutput({
          cwd,
          command: "observer",
          payload: {
            schemaVersion: "1.0",
            command: "observer",
            error: message,
          },
        });
      } else {
        console.error(message);
      }
      return ExitCode.Failure;
    }

    if (host !== "127.0.0.1" && host !== "localhost") {
      const message =
        "playbook observer serve: only local hosts are supported in v1 (127.0.0.1 or localhost).";
      if (options.format === "json") {
        emitJsonOutput({
          cwd,
          command: "observer",
          payload: {
            schemaVersion: "1.0",
            command: "observer",
            error: message,
          },
        });
      } else {
        console.error(message);
      }
      return ExitCode.Failure;
    }

    const server = createObserverServer(observerRoot, cwd);

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve();
      });
    });

    const address = server.address();
    const boundPort =
      typeof address === "object" && address ? address.port : port;
    const repoCount = readRegistry(observerRoot).repos.length;
    const message = [
      `Observer server listening at http://${host}:${boundPort}`,
      `Observer home root: ${observerRoot}`,
      `Registry path: ${resolvedRegistryPath}`,
      `Loaded repos: ${repoCount}`,
    ].join("\n");
    if (options.format === "json") {
      emitJsonOutput({
        cwd,
        command: "observer",
        payload: {
          schemaVersion: "1.0",
          command: "observer-serve",
          host,
          port: boundPort,
          readOnly: true,
          localOnly: true,
          observer_root: observerRoot,
          registry_path: resolvedRegistryPath,
          repo_count: repoCount,
        },
      });
    } else if (!options.quiet) {
      console.log(message);
    }

    await new Promise<void>((resolve) => {
      const closeServer = (): void => {
        server.close(() => resolve());
      };

      process.once("SIGINT", closeServer);
      process.once("SIGTERM", closeServer);
    });

    return ExitCode.Success;
  }

  if (scope !== "repo" || !["add", "list", "remove"].includes(action ?? "")) {
    const message =
      "playbook observer: use `playbook observer repo <add|list|remove>` or `playbook observer serve`.";
    if (options.format === "json") {
      emitJsonOutput({
        cwd,
        command: "observer",
        payload: { schemaVersion: "1.0", command: "observer", error: message },
      });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  const registry = readRegistry(observerRoot);

  try {
    if (action === "list") {
      emitObserverPayload(
        cwd,
        options,
        {
          schemaVersion: "1.0",
          command: "observer-repo-list",
          observer_root: observerRoot,
          registry_path: resolvedRegistryPath,
          repo_count: registry.repos.length,
          registry,
        },
        registry.repos.length === 0
          ? "No connected observer repositories."
          : registry.repos.map((repo) => `${repo.id} ${repo.root}`).join("\n"),
      );
      return ExitCode.Success;
    }

    if (action === "add") {
      const pathArg = nonFlagPositionals(args.slice(2))[0];
      if (!pathArg) {
        throw new Error("playbook observer repo add: missing <path> argument");
      }

      const result = addRepoToRegistry(observerRoot, registry, {
        path: pathArg,
        id: readOptionValue(args, "--id") ?? undefined,
        tags: readOptionValues(args, "--tag"),
      });
      emitObserverPayload(
        cwd,
        options,
        {
          schemaVersion: "1.0",
          command: "observer-repo-add",
          observer_root: observerRoot,
          registry_path: resolvedRegistryPath,
          repo_count: result.registry.repos.length,
          repo: result.repo,
          registry: result.registry,
        },
        `Connected observer repo ${result.repo.id}`,
      );
      return ExitCode.Success;
    }

    const removeId = nonFlagPositionals(args.slice(2))[0];
    if (!removeId) {
      throw new Error("playbook observer repo remove: missing <id> argument");
    }

    const nextRegistry = removeRepoFromRegistry(
      observerRoot,
      registry,
      removeId,
    );
    emitObserverPayload(
      cwd,
      options,
      {
        schemaVersion: "1.0",
        command: "observer-repo-remove",
        observer_root: observerRoot,
        registry_path: resolvedRegistryPath,
        repo_count: nextRegistry.repos.length,
        removedId: removeId,
        registry: nextRegistry,
      },
      `Removed observer repo ${removeId}`,
    );
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === "json") {
      emitJsonOutput({
        cwd,
        command: "observer",
        payload: { schemaVersion: "1.0", command: "observer", error: message },
      });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};

export { OBSERVER_REPO_REGISTRY_RELATIVE_PATH };
