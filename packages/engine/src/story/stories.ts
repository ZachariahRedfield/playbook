import fs from 'node:fs';
import path from 'node:path';
export const STORIES_SCHEMA_VERSION = '1.0' as const;
export const STORIES_RELATIVE_PATH = '.playbook/stories.json' as const;

export const STORY_TYPES = ['bug', 'feature', 'governance', 'maintenance', 'research'] as const;
export const STORY_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const STORY_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const STORY_CONFIDENCES = ['low', 'medium', 'high'] as const;
export const STORY_STATUSES = ['proposed', 'ready', 'in_progress', 'blocked', 'done', 'archived'] as const;

export type StoryType = (typeof STORY_TYPES)[number];
export type StorySeverity = (typeof STORY_SEVERITIES)[number];
export type StoryPriority = (typeof STORY_PRIORITIES)[number];
export type StoryConfidence = (typeof STORY_CONFIDENCES)[number];
export type StoryStatus = (typeof STORY_STATUSES)[number];

export type StoryPlanningReference = {
  story_reference: string;
  id: string;
  title: string;
  status: StoryStatus;
  artifact_path: typeof STORIES_RELATIVE_PATH;
  suggested_route: string | null;
  execution_lane: string | null;
};

export type StoryLifecycleEvent = 'planned' | 'receipt_blocked' | 'receipt_completed';
export type StoryReconciliationStatus = 'pending_plan' | 'in_progress' | 'completed' | 'blocked';

export type StoryTransitionPreview = {
  story_id: string;
  previous_status: StoryStatus;
  next_status: StoryStatus;
};

export type StoryPromotionProvenance = {
  source_ref: string;
  promoted_from: 'story-candidate' | 'pattern-candidate' | 'pattern';
  candidate_id?: string;
  candidate_fingerprint?: string;
  pattern_id?: string;
  pattern_story_seed_fingerprint?: string;
  source_artifact: string;
  promoted_at: string;
};

export type StoryRecord = {
  story_reference?: string;
  id: string;
  repo: string;
  title: string;
  type: StoryType;
  source: string;
  severity: StorySeverity;
  priority: StoryPriority;
  confidence: StoryConfidence;
  status: StoryStatus;
  evidence: string[];
  rationale: string;
  acceptance_criteria: string[];
  dependencies: string[];
  execution_lane: string | null;
  suggested_route: string | null;
  last_plan_ref?: string | null;
  last_receipt_ref?: string | null;
  last_updated_state_ref?: string | null;
  reconciliation_status?: StoryReconciliationStatus | null;
  planned_at?: string | null;
  last_receipt_at?: string | null;
  last_updated_state_at?: string | null;
  reconciled_at?: string | null;
  provenance?: StoryPromotionProvenance;
};

export type StoriesArtifact = {
  schemaVersion: typeof STORIES_SCHEMA_VERSION;
  repo: string;
  stories: StoryRecord[];
};

export type StoryBacklogSummary = {
  counts_by_status: Record<StoryStatus, number>;
  highest_priority_ready_story: StoryRecord | null;
  blocked_stories: StoryRecord[];
  primary_next_action: string | null;
};

export type CreateStoryInput = Omit<StoryRecord, 'repo' | 'status'> & { status?: StoryStatus };


const PRIORITY_RANK: Record<StoryPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

const SEVERITY_RANK: Record<StorySeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const CONFIDENCE_RANK: Record<StoryConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const compareStories = (left: StoryRecord, right: StoryRecord): number => {
  const priorityDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  if (priorityDelta !== 0) return priorityDelta;
  const severityDelta = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
  if (severityDelta !== 0) return severityDelta;
  const confidenceDelta = CONFIDENCE_RANK[left.confidence] - CONFIDENCE_RANK[right.confidence];
  if (confidenceDelta !== 0) return confidenceDelta;
  return left.id.localeCompare(right.id);
};

export const sortStoriesForBacklog = (stories: StoryRecord[]): StoryRecord[] => [...stories].sort(compareStories);

export const summarizeStoriesBacklog = (artifact: StoriesArtifact): StoryBacklogSummary => {
  const countsByStatus = STORY_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as Record<StoryStatus, number>);
  for (const story of artifact.stories) {
    countsByStatus[story.status] += 1;
  }

  const sortedStories = sortStoriesForBacklog(artifact.stories);
  const highestPriorityReadyStory = sortedStories.find((story) => story.status === 'ready') ?? null;
  const blockedStories = sortedStories.filter((story) => story.status === 'blocked');
  const inProgressStory = sortedStories.find((story) => story.status === 'in_progress') ?? null;
  const proposedStory = sortedStories.find((story) => story.status === 'proposed') ?? null;
  const primaryNextAction = highestPriorityReadyStory
    ? `Route ${highestPriorityReadyStory.id} via ${highestPriorityReadyStory.suggested_route ?? 'playbook route'}`
    : inProgressStory
      ? `Continue ${inProgressStory.id} in ${inProgressStory.execution_lane ?? 'current lane'}`
      : blockedStories[0]
        ? `Unblock ${blockedStories[0].id} dependencies before planning execution.`
        : proposedStory
          ? `Promote ${proposedStory.id} from proposed to ready when evidence is sufficient.`
          : null;

  return {
    counts_by_status: countsByStatus,
    highest_priority_ready_story: highestPriorityReadyStory,
    blocked_stories: blockedStories,
    primary_next_action: primaryNextAction
  };
};

export const findStoryById = (artifact: StoriesArtifact, storyId: string): StoryRecord | null =>
  artifact.stories.find((story) => story.id === storyId) ?? null;

export const buildStableStoryReference = (storyId: string): string => `story:${storyId}`;

export const toStoryPlanningReference = (story: StoryRecord): StoryPlanningReference => ({
  story_reference: story.story_reference ?? buildStableStoryReference(story.id),
  id: story.id,
  title: story.title,
  status: story.status,
  artifact_path: STORIES_RELATIVE_PATH,
  suggested_route: story.suggested_route,
  execution_lane: story.execution_lane
});

const STORY_ROUTE_TASK_PREFIX: Record<Exclude<StoryType, 'research'> | 'research', string> = {
  bug: 'fix cli command',
  feature: 'implement cli command',
  governance: 'update command docs',
  maintenance: 'update cli command',
  research: 'document command research'
};

export const buildStoryRouteTask = (story: StoryRecord): string => {
  const routeHint = story.suggested_route?.trim().toLowerCase() ?? null;
  const base = routeHint === 'docs_only'
    ? 'update command docs'
    : routeHint === 'contracts_schema'
      ? 'update contract schema'
      : routeHint === 'cli_command'
        ? 'update cli command'
        : routeHint === 'engine_scoring'
          ? 'update engine scoring'
          : routeHint === 'pattern_learning'
            ? 'update pattern learning'
            : STORY_ROUTE_TASK_PREFIX[story.type];
  return `${base}: ${story.title}`;
};

export const deriveStoryLifecycleStatus = (story: StoryRecord, event: StoryLifecycleEvent): StoryStatus | null => {
  if (story.status === 'archived' || story.status === 'done') {
    return null;
  }
  if (event === 'planned') {
    return story.status === 'ready' ? 'in_progress' : null;
  }
  if (event === 'receipt_blocked') {
    return story.status === 'ready' || story.status === 'in_progress' ? 'blocked' : null;
  }
  if (event === 'receipt_completed') {
    return story.status === 'in_progress' ? 'done' : null;
  }
  return null;
};

export const deriveStoryTransitionPreview = (artifact: StoriesArtifact, storyId: string, event: StoryLifecycleEvent): StoryTransitionPreview | null => {
  const story = findStoryById(artifact, storyId);
  if (!story) {
    return null;
  }
  const nextStatus = deriveStoryLifecycleStatus(story, event);
  if (!nextStatus || nextStatus === story.status) {
    return null;
  }
  return {
    story_id: storyId,
    previous_status: story.status,
    next_status: nextStatus
  };
};

export const transitionStoryFromEvent = (artifact: StoriesArtifact, storyId: string, event: StoryLifecycleEvent): StoriesArtifact => {
  const transition = deriveStoryTransitionPreview(artifact, storyId, event);
  if (!transition) {
    return artifact;
  }
  return updateStoryStatus(artifact, storyId, transition.next_status);
};

const unique = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] => typeof value === 'string' && (allowed as readonly string[]).includes(value);

export const createDefaultStoriesArtifact = (repoName: string): StoriesArtifact => ({
  schemaVersion: STORIES_SCHEMA_VERSION,
  repo: repoName,
  stories: []
});

export const validateStoryRecord = (story: unknown, expectedRepo?: string): string[] => {
  const errors: string[] = [];
  if (!story || typeof story !== 'object' || Array.isArray(story)) {
    return ['story must be an object'];
  }
  const record = story as Record<string, unknown>;
  const requiredStringFields = ['id', 'repo', 'title', 'source', 'rationale'] as const;
  for (const field of requiredStringFields) {
    if (typeof record[field] !== 'string' || record[field].trim().length === 0) {
      errors.push(`story.${field} must be a non-empty string`);
    }
  }
  if (expectedRepo && record.repo !== expectedRepo) {
    errors.push(`story.repo must match backlog repo ${expectedRepo}`);
  }
  if (!isOneOf(record.type, STORY_TYPES)) errors.push(`story.type must be one of: ${STORY_TYPES.join(', ')}`);
  if (!isOneOf(record.severity, STORY_SEVERITIES)) errors.push(`story.severity must be one of: ${STORY_SEVERITIES.join(', ')}`);
  if (!isOneOf(record.priority, STORY_PRIORITIES)) errors.push(`story.priority must be one of: ${STORY_PRIORITIES.join(', ')}`);
  if (!isOneOf(record.confidence, STORY_CONFIDENCES)) errors.push(`story.confidence must be one of: ${STORY_CONFIDENCES.join(', ')}`);
  if (!isOneOf(record.status, STORY_STATUSES)) errors.push(`story.status must be one of: ${STORY_STATUSES.join(', ')}`);
  if (!Array.isArray(record.evidence) || asStringArray(record.evidence).length !== record.evidence.length) errors.push('story.evidence must be an array of strings');
  if (!Array.isArray(record.acceptance_criteria) || asStringArray(record.acceptance_criteria).length !== record.acceptance_criteria.length) errors.push('story.acceptance_criteria must be an array of strings');
  if (!Array.isArray(record.dependencies) || asStringArray(record.dependencies).length !== record.dependencies.length) errors.push('story.dependencies must be an array of strings');
  if (!(record.execution_lane === null || typeof record.execution_lane === 'string')) errors.push('story.execution_lane must be a string or null');
  if (!(record.suggested_route === null || typeof record.suggested_route === 'string')) errors.push('story.suggested_route must be a string or null');
  if (!(record.story_reference === undefined || typeof record.story_reference === 'string')) errors.push('story.story_reference must be a string when provided');
  if (!(record.last_plan_ref === undefined || record.last_plan_ref === null || typeof record.last_plan_ref === 'string')) errors.push('story.last_plan_ref must be a string or null when provided');
  if (!(record.last_receipt_ref === undefined || record.last_receipt_ref === null || typeof record.last_receipt_ref === 'string')) errors.push('story.last_receipt_ref must be a string or null when provided');
  if (!(record.last_updated_state_ref === undefined || record.last_updated_state_ref === null || typeof record.last_updated_state_ref === 'string')) errors.push('story.last_updated_state_ref must be a string or null when provided');
  if (!(record.reconciliation_status === undefined || record.reconciliation_status === null || isOneOf(record.reconciliation_status, ['pending_plan', 'in_progress', 'completed', 'blocked'] as const))) errors.push('story.reconciliation_status must be one of: pending_plan, in_progress, completed, blocked');
  if (!(record.planned_at === undefined || record.planned_at === null || typeof record.planned_at === 'string')) errors.push('story.planned_at must be a string or null when provided');
  if (!(record.last_receipt_at === undefined || record.last_receipt_at === null || typeof record.last_receipt_at === 'string')) errors.push('story.last_receipt_at must be a string or null when provided');
  if (!(record.last_updated_state_at === undefined || record.last_updated_state_at === null || typeof record.last_updated_state_at === 'string')) errors.push('story.last_updated_state_at must be a string or null when provided');
  if (!(record.reconciled_at === undefined || record.reconciled_at === null || typeof record.reconciled_at === 'string')) errors.push('story.reconciled_at must be a string or null when provided');
  if (!(record.provenance === undefined || (typeof record.provenance === 'object' && record.provenance !== null && !Array.isArray(record.provenance)))) {
    errors.push('story.provenance must be an object when provided');
  } else if (record.provenance && typeof record.provenance === 'object' && !Array.isArray(record.provenance)) {
    const provenance = record.provenance as Record<string, unknown>;
    if (typeof provenance.source_ref !== 'string' || provenance.source_ref.trim().length === 0) errors.push('story.provenance.source_ref must be a non-empty string');
    if (!isOneOf(provenance.promoted_from, ['story-candidate', 'pattern-candidate', 'pattern'] as const)) {
      errors.push('story.provenance.promoted_from must be one of: story-candidate, pattern-candidate, pattern');
    }
    if (typeof provenance.source_artifact !== 'string' || provenance.source_artifact.trim().length === 0) errors.push('story.provenance.source_artifact must be a non-empty string');
    if (typeof provenance.promoted_at !== 'string' || provenance.promoted_at.trim().length === 0) errors.push('story.provenance.promoted_at must be a non-empty string');
    if (!(provenance.candidate_id === undefined || typeof provenance.candidate_id === 'string')) errors.push('story.provenance.candidate_id must be a string when provided');
    if (!(provenance.candidate_fingerprint === undefined || typeof provenance.candidate_fingerprint === 'string')) errors.push('story.provenance.candidate_fingerprint must be a string when provided');
    if (!(provenance.pattern_id === undefined || typeof provenance.pattern_id === 'string')) errors.push('story.provenance.pattern_id must be a string when provided');
    if (!(provenance.pattern_story_seed_fingerprint === undefined || typeof provenance.pattern_story_seed_fingerprint === 'string')) errors.push('story.provenance.pattern_story_seed_fingerprint must be a string when provided');
  }
  return errors;
};

export const validateStoriesArtifact = (artifact: unknown): string[] => {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return ['stories artifact must be an object'];
  }
  const record = artifact as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== STORIES_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${STORIES_SCHEMA_VERSION}`);
  if (typeof record.repo !== 'string' || record.repo.trim().length === 0) errors.push('repo must be a non-empty string');
  if (!Array.isArray(record.stories)) errors.push('stories must be an array');
  if (Array.isArray(record.stories)) {
    const seen = new Set<string>();
    for (const [index, story] of record.stories.entries()) {
      for (const error of validateStoryRecord(story, typeof record.repo === 'string' ? record.repo : undefined)) {
        errors.push(`stories[${index}].${error}`);
      }
      if (story && typeof story === 'object' && !Array.isArray(story) && typeof (story as Record<string, unknown>).id === 'string') {
        const id = (story as Record<string, unknown>).id as string;
        if (seen.has(id)) errors.push(`stories[${index}].id must be unique`);
        seen.add(id);
      }
    }
  }
  return errors;
};

export const readStoriesArtifact = (repoRoot: string): StoriesArtifact => {
  const artifactPath = path.join(repoRoot, STORIES_RELATIVE_PATH);
  if (!fs.existsSync(artifactPath)) {
    return createDefaultStoriesArtifact(path.basename(repoRoot));
  }
  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as unknown;
  const errors = validateStoriesArtifact(parsed);
  if (errors.length > 0) throw new Error(`Invalid stories artifact: ${errors.join('; ')}`);
  return parsed as StoriesArtifact;
};

export const createStoryRecord = (repoName: string, input: CreateStoryInput): StoryRecord => ({
  ...input,
  story_reference: input.story_reference?.trim() || buildStableStoryReference(input.id),
  repo: repoName,
  status: input.status ?? 'proposed',
  evidence: unique(input.evidence),
  acceptance_criteria: unique(input.acceptance_criteria),
  dependencies: unique(input.dependencies),
  rationale: input.rationale.trim(),
  title: input.title.trim(),
  source: input.source.trim(),
  execution_lane: input.execution_lane?.trim() ? input.execution_lane : null,
  suggested_route: input.suggested_route?.trim() ? input.suggested_route : null,
  last_plan_ref: input.last_plan_ref ?? null,
  last_receipt_ref: input.last_receipt_ref ?? null,
  last_updated_state_ref: input.last_updated_state_ref ?? null,
  reconciliation_status: input.reconciliation_status ?? null,
  planned_at: input.planned_at ?? null,
  last_receipt_at: input.last_receipt_at ?? null,
  last_updated_state_at: input.last_updated_state_at ?? null,
  reconciled_at: input.reconciled_at ?? null,
  provenance: input.provenance
});

export const upsertStory = (artifact: StoriesArtifact, story: StoryRecord): StoriesArtifact => {
  const without = artifact.stories.filter((entry) => entry.id !== story.id);
  return {
    ...artifact,
    stories: [...without, story].sort((left, right) => left.id.localeCompare(right.id))
  };
};

export const updateStoryStatus = (artifact: StoriesArtifact, storyId: string, status: StoryStatus): StoriesArtifact => ({
  ...artifact,
  stories: artifact.stories.map((story) => story.id === storyId ? { ...story, status } : story)
});

const updateStoryRecord = (artifact: StoriesArtifact, storyId: string, update: (story: StoryRecord) => StoryRecord): StoriesArtifact => ({
  ...artifact,
  stories: artifact.stories.map((story) => story.id === storyId ? update(story) : story)
});

export const linkStoryToPlan = (artifact: StoriesArtifact, storyId: string, planRef: string, plannedAt: string): StoriesArtifact => {
  const transition = deriveStoryTransitionPreview(artifact, storyId, 'planned');
  return updateStoryRecord(artifact, storyId, (story) => ({
    ...story,
    story_reference: story.story_reference ?? buildStableStoryReference(story.id),
    status: transition?.next_status ?? story.status,
    last_plan_ref: planRef,
    reconciliation_status: transition?.next_status === 'in_progress' || story.status === 'in_progress' ? 'in_progress' : 'pending_plan',
    planned_at: plannedAt
  }));
};

export const reconcileStoryExecution = (
  artifact: StoriesArtifact,
  storyId: string,
  input: {
    receiptRef: string;
    updatedStateRef: string;
    reconciledAt: string;
    event: Extract<StoryLifecycleEvent, 'receipt_blocked' | 'receipt_completed'>;
  }
): { artifact: StoriesArtifact; outcome: 'applied' | 'noop' | 'conflict' } => {
  const story = findStoryById(artifact, storyId);
  if (!story) return { artifact, outcome: 'noop' };
  if (story.last_receipt_ref === input.receiptRef && story.last_updated_state_ref === input.updatedStateRef) {
    return { artifact, outcome: 'noop' };
  }
  if (
    story.last_receipt_ref &&
    story.last_receipt_ref !== input.receiptRef &&
    story.last_updated_state_ref &&
    story.last_updated_state_ref !== input.updatedStateRef
  ) {
    return { artifact, outcome: 'conflict' };
  }
  const nextStatus = deriveStoryLifecycleStatus(story, input.event) ?? story.status;
  return {
    outcome: 'applied',
    artifact: updateStoryRecord(artifact, storyId, (current) => ({
      ...current,
      story_reference: current.story_reference ?? buildStableStoryReference(current.id),
      status: nextStatus,
      last_receipt_ref: input.receiptRef,
      last_updated_state_ref: input.updatedStateRef,
      reconciliation_status: input.event === 'receipt_completed' ? 'completed' : 'blocked',
      last_receipt_at: input.reconciledAt,
      last_updated_state_at: input.reconciledAt,
      reconciled_at: input.reconciledAt
    }))
  };
};
