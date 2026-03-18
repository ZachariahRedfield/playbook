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

export type StoryRecord = {
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
};

export type StoriesArtifact = {
  schemaVersion: typeof STORIES_SCHEMA_VERSION;
  repo: string;
  stories: StoryRecord[];
};

export type CreateStoryInput = Omit<StoryRecord, 'repo' | 'status'> & { status?: StoryStatus };

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
  repo: repoName,
  status: input.status ?? 'proposed',
  evidence: unique(input.evidence),
  acceptance_criteria: unique(input.acceptance_criteria),
  dependencies: unique(input.dependencies),
  rationale: input.rationale.trim(),
  title: input.title.trim(),
  source: input.source.trim(),
  execution_lane: input.execution_lane?.trim() ? input.execution_lane : null,
  suggested_route: input.suggested_route?.trim() ? input.suggested_route : null
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
