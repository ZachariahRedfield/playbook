import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildRepoAdoptionReadiness } from '../adoption/readiness.js';
import { generateDoctrineTransformArtifact } from '../doctrineTransforms.js';
import {
  STORIES_RELATIVE_PATH,
  createStoryRecord,
  readStoriesArtifact,
  upsertStory,
  type CreateStoryInput,
  type StoryConfidence,
  type StoryPriority,
  type StoryRecord,
  type StorySeverity,
  type StoryType,
  type StoriesArtifact
} from './stories.js';

export const STORY_CANDIDATES_SCHEMA_VERSION = '1.0' as const;
export const STORY_CANDIDATES_RELATIVE_PATH = '.playbook/story-candidates.json' as const;

type StoryCandidateSourceKind = 'readiness' | 'opportunity' | 'updated-state' | 'route' | 'doctrine-transform';

type StoryCandidateSeed = {
  sourceKind: StoryCandidateSourceKind;
  sourceKey: string;
  groupingKey: string;
  title: string;
  type: StoryType;
  source: string;
  severity: StorySeverity;
  priority: StoryPriority;
  confidence: StoryConfidence;
  rationaleParts: string[];
  evidence: string[];
  acceptance: string[];
  dependencies: string[];
  executionLane: string | null;
  suggestedRoute: string | null;
  explanation: string[];
};

export type StoryCandidateInput = CreateStoryInput;

export type StoryCandidateRecord = StoryRecord & {
  candidate_fingerprint: string;
  candidate_id: string;
  grouping_keys: string[];
  source_signals: string[];
  source_artifacts: string[];
  promotion_hint: string;
  explanation: string[];
};

export type StoryCandidatesArtifact = {
  schemaVersion: typeof STORY_CANDIDATES_SCHEMA_VERSION;
  kind: 'story-candidates';
  generatedAt: string;
  repo: string;
  readOnly: true;
  sourceArtifacts: {
    readiness: string[];
    improvementCandidatesPath: string;
    updatedStatePath: string;
    routerRecommendationsPath: string;
  };
  candidates: StoryCandidateRecord[];
};

export type StoryCandidateGenerationResult = StoryCandidatesArtifact;

const IMPROVEMENT_CANDIDATES_PATH = '.playbook/improvement-candidates.json' as const;
const UPDATED_STATE_PATH = '.playbook/execution-updated-state.json' as const;
const ROUTER_RECOMMENDATIONS_PATH = '.playbook/router-recommendations.json' as const;

const writeJsonArtifact = (repoRoot: string, relativePath: string, artifact: unknown): string => {
  const targetPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return targetPath;
};

const writeStoriesArtifact = (repoRoot: string, artifact: StoriesArtifact): string => writeJsonArtifact(repoRoot, STORIES_RELATIVE_PATH, artifact);

const safeReadJson = <T>(repoRoot: string, relativePath: string): T | null => {
  const targetPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(targetPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;
  } catch {
    return null;
  }
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'candidate';

const rankSeverity = (value: StorySeverity): number => ({ critical: 0, high: 1, medium: 2, low: 3 })[value];
const rankPriority = (value: StoryPriority): number => ({ urgent: 0, high: 1, medium: 2, low: 3 })[value];
const rankConfidence = (value: StoryConfidence): number => ({ high: 0, medium: 1, low: 2 })[value];

const strongerSeverity = (left: StorySeverity, right: StorySeverity): StorySeverity => rankSeverity(left) <= rankSeverity(right) ? left : right;
const strongerPriority = (left: StoryPriority, right: StoryPriority): StoryPriority => rankPriority(left) <= rankPriority(right) ? left : right;
const strongerConfidence = (left: StoryConfidence, right: StoryConfidence): StoryConfidence => rankConfidence(left) <= rankConfidence(right) ? left : right;

const compareCandidates = (left: StoryCandidateRecord, right: StoryCandidateRecord): number =>
  rankPriority(left.priority) - rankPriority(right.priority) ||
  rankSeverity(left.severity) - rankSeverity(right.severity) ||
  rankConfidence(left.confidence) - rankConfidence(right.confidence) ||
  left.id.localeCompare(right.id);

type ImprovementOpportunityLike = {
  opportunity_id?: string;
  title?: string;
  heuristic_class?: string;
  confidence?: number;
  evidence?: Array<{ file?: string; detail?: string }>;
  why_it_matters?: string;
  likely_change_shape?: string;
  rationale?: string[];
};

type ImprovementCandidatesLike = {
  opportunity_analysis?: {
    top_recommendation?: ImprovementOpportunityLike | null;
    secondary_queue?: ImprovementOpportunityLike[];
  };
};

type UpdatedStateLike = {
  summary?: {
    repos_needing_review?: string[];
    repos_needing_replan?: string[];
    repos_needing_retry?: string[];
    stale_or_superseded_repo_ids?: string[];
    blocked_repo_ids?: string[];
  };
  repos?: Array<{
    repo_id?: string;
    reconciliation_status?: string;
    blocker_codes?: string[];
    drift_prompt_ids?: string[];
    prompt_ids?: string[];
  }>;
};

type RouterRecommendationsLike = {
  recommendations?: Array<{
    recommendation_id?: string;
    task_family?: string;
    current_strategy?: string;
    recommended_strategy?: string;
    rationale?: string;
    confidence_score?: number;
  }>;
};

const deriveReadinessSeeds = (repoRoot: string): StoryCandidateSeed[] => {
  const readiness = buildRepoAdoptionReadiness({ repoRoot });
  if (readiness.blockers.length === 0) return [];
  const nextCommands = uniqueSorted(readiness.blockers.map((blocker) => blocker.next_command));
  return [{
    sourceKind: 'readiness',
    sourceKey: readiness.blockers.map((blocker) => blocker.code).sort().join('+'),
    groupingKey: 'readiness:blockers',
    title: 'Restore governed readiness prerequisites before backlog execution',
    type: 'governance',
    source: 'governed-readiness',
    severity: readiness.lifecycle_stage === 'playbook_not_detected' ? 'critical' : 'high',
    priority: readiness.fallback_proof_ready ? 'medium' : 'urgent',
    confidence: 'high',
    rationaleParts: [
      `The repository is currently in lifecycle stage ${readiness.lifecycle_stage}.`,
      'Findings need durable interpretation before they become backlog work.'
    ],
    evidence: uniqueSorted([
      '.playbook/repo-index.json',
      '.playbook/repo-graph.json',
      '.playbook/plan.json',
      '.playbook/policy-apply-result.json'
    ]),
    acceptance: uniqueSorted([
      ...readiness.blockers.map((blocker) => blocker.message),
      ...nextCommands.map((command) => `Run ${command} and re-check readiness evidence.`)
    ]),
    dependencies: [],
    executionLane: 'safe_single_pr',
    suggestedRoute: nextCommands[0] ?? 'pnpm playbook verify --json && pnpm playbook plan --json',
    explanation: readiness.blockers.map((blocker) => `${blocker.code}: ${blocker.message} -> ${blocker.next_command}`)
  }];
};

const deriveOpportunitySeeds = (repoRoot: string): StoryCandidateSeed[] => {
  const artifact = safeReadJson<ImprovementCandidatesLike>(repoRoot, IMPROVEMENT_CANDIDATES_PATH);
  const opportunities = [artifact?.opportunity_analysis?.top_recommendation, ...(artifact?.opportunity_analysis?.secondary_queue ?? [])]
    .filter((entry): entry is ImprovementOpportunityLike => Boolean(entry));
  return opportunities.map((entry) => ({
    sourceKind: 'opportunity',
    sourceKey: entry.opportunity_id ?? entry.title ?? 'opportunity',
    groupingKey: `opportunity:${entry.heuristic_class ?? 'general'}`,
    title: entry.title ?? 'Address deterministic improvement opportunity',
    type: 'maintenance',
    source: 'improve-opportunities',
    severity: (entry.confidence ?? 0) >= 0.8 ? 'high' : 'medium',
    priority: entry === artifact?.opportunity_analysis?.top_recommendation ? 'urgent' : 'high',
    confidence: (entry.confidence ?? 0) >= 0.8 ? 'high' : 'medium',
    rationaleParts: uniqueSorted([entry.why_it_matters ?? '', ...(entry.rationale ?? [])]),
    evidence: uniqueSorted([IMPROVEMENT_CANDIDATES_PATH, ...(entry.evidence ?? []).map((item) => item.file ?? '').filter(Boolean)]),
    acceptance: uniqueSorted([
      'Group duplicated or fan-out findings into one durable backlog item rather than one finding per story.',
      entry.likely_change_shape ? `Implement the indicated change shape: ${entry.likely_change_shape}` : ''
    ]),
    dependencies: [],
    executionLane: 'safe_single_pr',
    suggestedRoute: 'pnpm playbook improve opportunities --json',
    explanation: uniqueSorted([
      `heuristic=${entry.heuristic_class ?? 'unknown'}`,
      ...(entry.evidence ?? []).map((item) => `${item.file ?? 'artifact'}: ${item.detail ?? 'evidence'}`)
    ])
  }));
};

const deriveUpdatedStateSeeds = (repoRoot: string): StoryCandidateSeed[] => {
  const artifact = safeReadJson<UpdatedStateLike>(repoRoot, UPDATED_STATE_PATH);
  if (!artifact) return [];
  const seeds: StoryCandidateSeed[] = [];
  const staleRepos = uniqueSorted(artifact.summary?.stale_or_superseded_repo_ids ?? []);
  const reviewRepos = uniqueSorted(artifact.summary?.repos_needing_review ?? []);
  const retryRepos = uniqueSorted(artifact.summary?.repos_needing_retry ?? []);
  const blockedRepos = uniqueSorted(artifact.summary?.blocked_repo_ids ?? []);

  if (staleRepos.length > 0) {
    seeds.push({
      sourceKind: 'updated-state',
      sourceKey: `stale:${staleRepos.join(',')}`,
      groupingKey: 'updated-state:stale-or-superseded',
      title: 'Replan stale or superseded governed execution work',
      type: 'governance',
      source: 'execution-updated-state',
      severity: 'high',
      priority: 'urgent',
      confidence: 'high',
      rationaleParts: ['Replay and reconciliation evidence show previously planned work is stale or has been superseded.'],
      evidence: [UPDATED_STATE_PATH],
      acceptance: ['Generate a fresh deterministic plan from current governed evidence.', `Review impacted repos: ${staleRepos.join(', ')}`],
      dependencies: [],
      executionLane: 'safe_single_pr',
      suggestedRoute: 'pnpm playbook verify --json && pnpm playbook plan --json',
      explanation: staleRepos.map((repoId) => `${repoId}: stale_plan_or_superseded`)
    });
  }

  if (reviewRepos.length > 0 || blockedRepos.length > 0 || retryRepos.length > 0) {
    const impacted = uniqueSorted([...reviewRepos, ...blockedRepos, ...retryRepos]);
    seeds.push({
      sourceKind: 'updated-state',
      sourceKey: `drift:${impacted.join(',')}`,
      groupingKey: 'updated-state:drift-review',
      title: 'Review governed execution drift and retry-only findings before promotion',
      type: 'research',
      source: 'execution-updated-state',
      severity: blockedRepos.length > 0 ? 'high' : 'medium',
      priority: reviewRepos.length > 0 ? 'high' : 'medium',
      confidence: 'medium',
      rationaleParts: ['Candidate stories require grouping, dedupe, and explicit promotion.', 'Execution drift should be interpreted before it becomes durable backlog work.'],
      evidence: [UPDATED_STATE_PATH],
      acceptance: uniqueSorted([
        reviewRepos.length > 0 ? `Review drifted repos: ${reviewRepos.join(', ')}` : '',
        blockedRepos.length > 0 ? `Inspect blocked repos: ${blockedRepos.join(', ')}` : '',
        retryRepos.length > 0 ? `Confirm retry vs replan posture for repos: ${retryRepos.join(', ')}` : ''
      ]),
      dependencies: [],
      executionLane: null,
      suggestedRoute: 'pnpm playbook receipt replay --json',
      explanation: (artifact.repos ?? [])
        .filter((repo) => impacted.includes(repo.repo_id ?? ''))
        .map((repo) => `${repo.repo_id}: ${repo.reconciliation_status ?? 'unknown'} blockers=${(repo.blocker_codes ?? []).join(',') || 'none'} drift=${(repo.drift_prompt_ids ?? []).join(',') || 'none'}`)
    });
  }

  return seeds;
};


const deriveDoctrineTransformSeeds = (repoRoot: string): StoryCandidateSeed[] => {
  const artifact = generateDoctrineTransformArtifact({
    playbookHome: repoRoot,
    targetRepoId: path.basename(repoRoot),
  });
  return artifact.proposals.map((proposal) => ({
    sourceKind: 'doctrine-transform',
    sourceKey: proposal.proposal_id,
    groupingKey: `doctrine-transform:${proposal.source.pattern_id}`,
    title: proposal.target.title,
    type: 'feature',
    source: 'doctrine-transform',
    severity: 'medium',
    priority: 'high',
    confidence: 'high',
    rationaleParts: [proposal.target.summary, 'Promoted active doctrine may influence planning only through reviewable proposal artifacts.'],
    evidence: proposal.evidence,
    acceptance: proposal.target.acceptance_criteria,
    dependencies: [],
    executionLane: proposal.target.execution_lane,
    suggestedRoute: proposal.target.suggested_route,
    explanation: [
      `transform=${proposal.transform_kind}`,
      `pattern=${proposal.source.pattern_id}`,
      `eligible=${String(proposal.eligibility.eligible)}`,
      `mutation_allowed=${String(proposal.governance.mutation_allowed)}`,
    ]
  }));
};

const deriveRouteSeeds = (repoRoot: string): StoryCandidateSeed[] => {
  const artifact = safeReadJson<RouterRecommendationsLike>(repoRoot, ROUTER_RECOMMENDATIONS_PATH);
  return (artifact?.recommendations ?? []).slice(0, 2).map((entry) => ({
    sourceKind: 'route',
    sourceKey: entry.recommendation_id ?? entry.task_family ?? 'route',
    groupingKey: `route:${entry.task_family ?? 'general'}`,
    title: `Adopt stable route guidance for ${entry.task_family ?? 'governed work'}`,
    type: 'maintenance',
    source: 'router-recommendations',
    severity: 'medium',
    priority: 'medium',
    confidence: (entry.confidence_score ?? 0) >= 0.75 ? 'high' : 'medium',
    rationaleParts: [entry.rationale ?? 'Stable route evidence suggests one strategy is a better fit.'],
    evidence: [ROUTER_RECOMMENDATIONS_PATH],
    acceptance: uniqueSorted([
      `Review current strategy: ${entry.current_strategy ?? 'unknown'}`,
      `Evaluate recommended strategy: ${entry.recommended_strategy ?? 'unknown'}`
    ]),
    dependencies: [],
    executionLane: null,
    suggestedRoute: `pnpm playbook route "${entry.task_family ?? 'governed work'}" --json`,
    explanation: [
      `recommendation_id=${entry.recommendation_id ?? 'unknown'}`,
      `strategy=${entry.current_strategy ?? 'unknown'} -> ${entry.recommended_strategy ?? 'unknown'}`,
      `confidence=${String(entry.confidence_score ?? 'unknown')}`
    ]
  }));
};

const seedFingerprint = (seed: StoryCandidateSeed): string =>
  crypto.createHash('sha256').update(JSON.stringify({ groupingKey: seed.groupingKey, title: seed.title, sourceKind: seed.sourceKind, sourceKey: seed.sourceKey })).digest('hex').slice(0, 12);

const mergeSeeds = (repoName: string, seeds: StoryCandidateSeed[]): StoryCandidateRecord[] => {
  const grouped = new Map<string, StoryCandidateSeed[]>();
  for (const seed of seeds) {
    grouped.set(seed.groupingKey, [...(grouped.get(seed.groupingKey) ?? []), seed]);
  }

  return [...grouped.entries()].map(([groupingKey, entries]) => {
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(entries.map((entry) => ({
      groupingKey: entry.groupingKey,
      sourceKey: entry.sourceKey,
      title: entry.title,
      evidence: uniqueSorted(entry.evidence)
    })))).digest('hex').slice(0, 12);
    const title = entries.slice().sort((left, right) => left.title.localeCompare(right.title))[0]?.title ?? 'Derived candidate story';
    const merged = entries.reduce((acc, entry) => ({
      type: acc.type,
      source: acc.source,
      severity: strongerSeverity(acc.severity, entry.severity),
      priority: strongerPriority(acc.priority, entry.priority),
      confidence: strongerConfidence(acc.confidence, entry.confidence),
      rationaleParts: [...acc.rationaleParts, ...entry.rationaleParts],
      evidence: [...acc.evidence, ...entry.evidence],
      acceptance: [...acc.acceptance, ...entry.acceptance],
      dependencies: [...acc.dependencies, ...entry.dependencies],
      executionLane: acc.executionLane ?? entry.executionLane,
      suggestedRoute: acc.suggestedRoute ?? entry.suggestedRoute,
      explanation: [...acc.explanation, ...entry.explanation]
    }), {
      type: entries[0]?.type ?? 'maintenance',
      source: entries[0]?.source ?? 'derived',
      severity: entries[0]?.severity ?? 'medium',
      priority: entries[0]?.priority ?? 'medium',
      confidence: entries[0]?.confidence ?? 'medium',
      rationaleParts: [] as string[],
      evidence: [] as string[],
      acceptance: [] as string[],
      dependencies: [] as string[],
      executionLane: entries[0]?.executionLane ?? null,
      suggestedRoute: entries[0]?.suggestedRoute ?? null,
      explanation: [] as string[]
    });

    const candidate = createStoryRecord(repoName, {
      id: `story-candidate-${slugify(title)}-${fingerprint}`,
      title,
      type: merged.type,
      source: merged.source,
      severity: merged.severity,
      priority: merged.priority,
      confidence: merged.confidence,
      rationale: uniqueSorted(merged.rationaleParts).join(' '),
      evidence: uniqueSorted(merged.evidence),
      acceptance_criteria: uniqueSorted(merged.acceptance),
      dependencies: uniqueSorted(merged.dependencies),
      execution_lane: merged.executionLane,
      suggested_route: merged.suggestedRoute
    });

    return {
      ...candidate,
      candidate_fingerprint: fingerprint,
      candidate_id: candidate.id,
      grouping_keys: uniqueSorted([groupingKey, ...entries.map((entry) => entry.groupingKey)]),
      source_signals: uniqueSorted(entries.map((entry) => `${entry.sourceKind}:${entry.sourceKey}`)),
      source_artifacts: uniqueSorted(entries.flatMap((entry) => entry.evidence.filter((value) => value.startsWith('.playbook/')))),
      promotion_hint: `Promote with: pnpm playbook story promote ${candidate.id} --json`,
      explanation: uniqueSorted(merged.explanation)
    } satisfies StoryCandidateRecord;
  }).sort(compareCandidates);
};

export const generateStoryCandidates = (repoRoot: string, inputs: StoryCandidateInput[] = []): StoryCandidateGenerationResult => {
  const backlog = readStoriesArtifact(repoRoot);
  const manualSeeds: StoryCandidateSeed[] = inputs.map((input) => ({
    sourceKind: 'opportunity',
    sourceKey: input.id,
    groupingKey: `manual:${input.id}`,
    title: input.title,
    type: input.type,
    source: input.source,
    severity: input.severity,
    priority: input.priority,
    confidence: input.confidence,
    rationaleParts: [input.rationale],
    evidence: input.evidence,
    acceptance: input.acceptance_criteria,
    dependencies: input.dependencies,
    executionLane: input.execution_lane,
    suggestedRoute: input.suggested_route,
    explanation: [`manual:${input.id}`]
  }));
  const seeds = [
    ...manualSeeds,
    ...deriveReadinessSeeds(repoRoot),
    ...deriveOpportunitySeeds(repoRoot),
    ...deriveUpdatedStateSeeds(repoRoot),
    ...deriveRouteSeeds(repoRoot),
    ...deriveDoctrineTransformSeeds(repoRoot)
  ];
  const existingIds = new Set(backlog.stories.map((story) => story.id));
  const candidates = mergeSeeds(backlog.repo, seeds).filter((candidate) => !existingIds.has(candidate.id));
  return {
    schemaVersion: STORY_CANDIDATES_SCHEMA_VERSION,
    kind: 'story-candidates',
    generatedAt: new Date().toISOString(),
    repo: backlog.repo,
    readOnly: true,
    sourceArtifacts: {
      readiness: ['.playbook/repo-index.json', '.playbook/repo-graph.json', '.playbook/plan.json', '.playbook/policy-apply-result.json'],
      improvementCandidatesPath: IMPROVEMENT_CANDIDATES_PATH,
      updatedStatePath: UPDATED_STATE_PATH,
      routerRecommendationsPath: ROUTER_RECOMMENDATIONS_PATH
    },
    candidates
  };
};

export const writeStoryCandidatesArtifact = (repoRoot: string, artifact: StoryCandidatesArtifact): string =>
  writeJsonArtifact(repoRoot, STORY_CANDIDATES_RELATIVE_PATH, artifact);

export const readStoryCandidatesArtifact = (repoRoot: string): StoryCandidatesArtifact => {
  const existing = safeReadJson<StoryCandidatesArtifact>(repoRoot, STORY_CANDIDATES_RELATIVE_PATH);
  return existing ?? generateStoryCandidates(repoRoot);
};

export const promoteStoryCandidate = (repoRoot: string, candidate: StoryRecord | string): { story: StoryRecord; artifact: StoriesArtifact; artifactPath: string } => {
  const current = readStoriesArtifact(repoRoot);
  const selected = typeof candidate === 'string'
    ? readStoryCandidatesArtifact(repoRoot).candidates.find((entry) => entry.id === candidate)
    : candidate;
  if (!selected) throw new Error(`Story candidate not found: ${String(candidate)}`);
  const nextArtifact = upsertStory(current, { ...selected, repo: current.repo });
  const artifactPath = writeStoriesArtifact(repoRoot, nextArtifact);
  return {
    story: nextArtifact.stories.find((story) => story.id === selected.id) ?? { ...selected, repo: current.repo },
    artifact: nextArtifact,
    artifactPath
  };
};
