import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { InteropUpdatedTruthArtifact } from './playbookLifelineInterop.js';
import type { MemoryReplayCandidate, MemoryReplayResult } from '../schema/memoryReplay.js';

export const INTEROP_UPDATED_TRUTH_DEFAULT_FILE = '.playbook/interop-updated-truth.json' as const;
export const INTEROP_FOLLOWUPS_DEFAULT_FILE = '.playbook/interop-followups.json' as const;
export const MEMORY_CANDIDATES_DEFAULT_FILE = '.playbook/memory/candidates.json' as const;
export const INTEROP_FOLLOWUPS_SCHEMA_VERSION = '1.0' as const;

type InteropFollowupType = 'memory-candidate' | 'next-plan-hint' | 'review-cue' | 'docs-story-followup';
type InteropFollowupAction = 'queue-memory-candidate' | 'queue-next-plan-hint' | 'queue-review-cue' | 'queue-docs-story-followup';
type InteropFollowupTargetSurface =
  | '.playbook/memory/candidates.json'
  | '.playbook/plan.json'
  | '.playbook/review-queue.json'
  | '.playbook/stories.json';

export type InteropFollowupRow = {
  followupId: string;
  source: {
    receiptId: string;
    requestId: string;
  };
  action: InteropFollowupAction;
  targetSurface: InteropFollowupTargetSurface;
  followupType: InteropFollowupType;
  provenanceRefs: string[];
  nextActionText: string;
  confidence: {
    score: number;
    rationale: string;
  };
  reviewQueueEntry?: {
    targetKind: 'knowledge' | 'doc';
    targetId?: string;
    path?: string;
    triggerReasonCode: 'interop-policy-assumption-shift' | 'interop-runtime-outcome-repeat' | 'interop-domain-state-change';
    triggerEvidenceRefs: string[];
    triggerStrength: number;
    recommendedAction?: 'reaffirm' | 'revise' | 'supersede';
  };
};

export type InteropFollowupsArtifact = {
  schemaVersion: typeof INTEROP_FOLLOWUPS_SCHEMA_VERSION;
  kind: 'interop-followups-artifact';
  command: 'interop followups';
  reviewOnly: true;
  authority: {
    mutation: 'read-only';
    promotion: 'review-required';
  };
  sourceArtifact: {
    path: typeof INTEROP_UPDATED_TRUTH_DEFAULT_FILE;
    contractSourceHash: string;
    contractSourceRef: string;
    contractSourcePath: string;
  };
  followups: InteropFollowupRow[];
};

type InteropReviewQueueEntry = NonNullable<InteropFollowupRow['reviewQueueEntry']>;
type InteropOutcome = InteropUpdatedTruthArtifact['updates'][number]['canonicalOutcomeSummary']['outcome'];
type InteropMemoryCandidateEligibility =
  | 'repeated-blocked-runtime-outcome'
  | 'repeated-failed-runtime-outcome'
  | 'meaningful-domain-state-change';

export type InteropDerivedMemoryCandidate = {
  candidateId: string;
  source: InteropFollowupRow['source'];
  action: InteropFollowupAction;
  confidence: InteropFollowupRow['confidence'];
  provenanceRefs: string[];
  canonicalOutcomeSummary: InteropUpdatedTruthArtifact['updates'][number]['canonicalOutcomeSummary'];
  sourceHash: string;
  sourceContractFingerprint: string;
  interopFollowupId: string;
  eligibilityReason: InteropMemoryCandidateEligibility;
};

type MemoryCandidatesWithInterop = MemoryReplayResult & {
  kind: 'playbook-replay-candidates';
  candidateOnly: true;
  authority: {
    mutation: 'read-only';
    promotion: 'review-required';
  };
  interopDerivedCandidates?: InteropDerivedMemoryCandidate[];
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const parseUpdatedTruth = (raw: string): InteropUpdatedTruthArtifact => JSON.parse(raw) as InteropUpdatedTruthArtifact;
const parseInteropFollowups = (raw: string): InteropFollowupsArtifact => JSON.parse(raw) as InteropFollowupsArtifact;

const confidenceFor = (type: InteropFollowupType, outcome: 'completed' | 'blocked' | 'failed'): InteropFollowupRow['confidence'] => {
  if (type === 'memory-candidate') {
    return {
      score: outcome === 'completed' ? 0.91 : 0.78,
      rationale: 'Receipt + bounded state delta are durable evidence that can be queued for memory candidate review without mutating doctrine.'
    };
  }
  if (type === 'next-plan-hint') {
    return {
      score: outcome === 'completed' ? 0.87 : 0.74,
      rationale: 'Updated truth captures explicit interop outcome and request state, so planning guidance can be proposed without direct plan mutation.'
    };
  }
  if (type === 'review-cue') {
    return {
      score: outcome === 'completed' ? 0.85 : 0.82,
      rationale: 'Interop receipts should always be surfaced for operator review so bounded decisions remain explicit and auditable.'
    };
  }
  return {
    score: 0.69,
    rationale: 'Docs/story followups are gated behind narrow evidence and remain proposal-only until explicit review.'
  };
};

const docsStoryEvidence = (update: InteropUpdatedTruthArtifact['updates'][number]): boolean =>
  update.canonicalOutcomeSummary.outcome === 'completed' && update.action === 'revise_weekly_goal_plan';

const toTriggerStrength = (confidenceScore: number): number => Math.max(0, Math.min(100, Math.round(confidenceScore * 100)));

const deriveReviewReasonCode = (
  update: InteropUpdatedTruthArtifact['updates'][number]
): InteropReviewQueueEntry['triggerReasonCode'] => {
  if (update.canonicalOutcomeSummary.outcome === 'blocked' || update.canonicalOutcomeSummary.outcome === 'failed') {
    return 'interop-runtime-outcome-repeat';
  }

  if (
    update.nextActionHints.some((hint) => hint.toLowerCase().includes('assumption')) ||
    update.nextActionHints.some((hint) => hint.toLowerCase().includes('policy')) ||
    update.canonicalOutcomeSummary.detail.toLowerCase().includes('assumption') ||
    update.canonicalOutcomeSummary.detail.toLowerCase().includes('policy')
  ) {
    return 'interop-policy-assumption-shift';
  }

  return 'interop-domain-state-change';
};

const deriveReviewRecommendedAction = (
  reasonCode: InteropReviewQueueEntry['triggerReasonCode']
): InteropReviewQueueEntry['recommendedAction'] =>
  reasonCode === 'interop-runtime-outcome-repeat' || reasonCode === 'interop-policy-assumption-shift' ? 'revise' : 'reaffirm';

const deriveReviewTarget = (update: InteropUpdatedTruthArtifact['updates'][number]): Pick<InteropReviewQueueEntry, 'targetKind' | 'path' | 'targetId'> => {
  if (update.action === 'revise_weekly_goal_plan') {
    return { targetKind: 'doc', path: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md' };
  }
  return { targetKind: 'knowledge', targetId: `interop-request:${update.requestId}` };
};

const buildFollowupRows = (updatedTruth: InteropUpdatedTruthArtifact): InteropFollowupRow[] => {
  const rows: InteropFollowupRow[] = [];

  for (const update of updatedTruth.updates) {
    const sharedProvenance = uniqueSorted([
      INTEROP_UPDATED_TRUTH_DEFAULT_FILE,
      ...update.memoryProvenanceRefs,
      `request:${update.requestId}`,
      `receipt:${update.receiptId}`
    ]);

    const outcome = update.canonicalOutcomeSummary.outcome;
    rows.push({
      followupId: `followup-${update.receiptId}-memory`,
      source: { receiptId: update.receiptId, requestId: update.requestId },
      action: 'queue-memory-candidate',
      targetSurface: '.playbook/memory/candidates.json',
      followupType: 'memory-candidate',
      provenanceRefs: sharedProvenance,
      nextActionText: `Queue request ${update.requestId} receipt ${update.receiptId} as a memory candidate proposal with bounded provenance references.`,
      confidence: confidenceFor('memory-candidate', outcome)
    });

    rows.push({
      followupId: `followup-${update.receiptId}-plan`,
      source: { receiptId: update.receiptId, requestId: update.requestId },
      action: 'queue-next-plan-hint',
      targetSurface: '.playbook/plan.json',
      followupType: 'next-plan-hint',
      provenanceRefs: sharedProvenance,
      nextActionText: `Use request ${update.requestId} outcome (${outcome}) as a proposal-only next-plan hint; keep plan mutation behind reviewed apply flow.`,
      confidence: confidenceFor('next-plan-hint', outcome)
    });

    const reviewConfidence = confidenceFor('review-cue', outcome);
    const reviewReasonCode = deriveReviewReasonCode(update);
    const reviewEvidenceRefs = uniqueSorted([
      ...sharedProvenance,
      ...update.nextActionHints.map((hint) => `hint:${hint}`),
      `outcome:${update.canonicalOutcomeSummary.outcome}`,
      `action:${update.action}`,
      `detail:${update.canonicalOutcomeSummary.detail}`
    ]);
    rows.push({
      followupId: `followup-${update.receiptId}-review`,
      source: { receiptId: update.receiptId, requestId: update.requestId },
      action: 'queue-review-cue',
      targetSurface: '.playbook/review-queue.json',
      followupType: 'review-cue',
      provenanceRefs: sharedProvenance,
      nextActionText: `Attach receipt ${update.receiptId} to review queue evidence so operator decision remains explicit before any downstream action.`,
      confidence: reviewConfidence,
      reviewQueueEntry: {
        ...deriveReviewTarget(update),
        triggerReasonCode: reviewReasonCode,
        triggerEvidenceRefs: reviewEvidenceRefs,
        triggerStrength: toTriggerStrength(reviewConfidence.score),
        recommendedAction: deriveReviewRecommendedAction(reviewReasonCode)
      }
    });

    if (docsStoryEvidence(update)) {
      rows.push({
        followupId: `followup-${update.receiptId}-docs-story`,
        source: { receiptId: update.receiptId, requestId: update.requestId },
        action: 'queue-docs-story-followup',
        targetSurface: '.playbook/stories.json',
        followupType: 'docs-story-followup',
        provenanceRefs: sharedProvenance,
        nextActionText: `Propose docs/story followup for ${update.action} because the completed goal-plan revision receipt provides explicit justification evidence.`,
        confidence: confidenceFor('docs-story-followup', outcome)
      });
    }
  }

  return rows.sort((a, b) => a.followupId.localeCompare(b.followupId));
};

const readMemoryCandidates = (cwd: string): MemoryCandidatesWithInterop => {
  const absolutePath = path.resolve(cwd, MEMORY_CANDIDATES_DEFAULT_FILE);
  if (!fs.existsSync(absolutePath)) {
    return {
      schemaVersion: '1.0',
      kind: 'playbook-replay-candidates',
      command: 'memory-replay',
      sourceIndex: '.playbook/memory/index.json',
      generatedAt: new Date(0).toISOString(),
      totalEvents: 0,
      clustersEvaluated: 0,
      candidates: [],
      candidateOnly: true,
      authority: {
        mutation: 'read-only',
        promotion: 'review-required'
      },
      interopDerivedCandidates: []
    };
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as MemoryCandidatesWithInterop;
};

const interopFingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const chooseEligibility = (input: {
  outcome: InteropOutcome;
  repeats: number;
  actionName: string;
  detail: string;
  hints: string[];
  followupText: string;
}): InteropMemoryCandidateEligibility | null => {
  if (input.outcome === 'blocked' && input.repeats >= 2) return 'repeated-blocked-runtime-outcome';
  if (input.outcome === 'failed' && input.repeats >= 2) return 'repeated-failed-runtime-outcome';

  const hasRationale = input.followupText.trim().length > 0 || input.hints.some((hint) => hint.trim().length > 0);
  const meaningfulAction = input.actionName === 'revise_weekly_goal_plan' || /(amend|revise|update|change|adjust)/i.test(input.detail);
  if (input.outcome === 'completed' && hasRationale && meaningfulAction) return 'meaningful-domain-state-change';
  return null;
};

const toMemoryReplayCandidate = (
  followup: InteropFollowupRow,
  update: InteropUpdatedTruthArtifact['updates'][number],
  priorCandidates: MemoryReplayCandidate[],
  repeats: number
): MemoryReplayCandidate => {
  const base = {
    followupId: followup.followupId,
    requestId: followup.source.requestId,
    receiptId: followup.source.receiptId,
    action: update.action,
    outcome: update.canonicalOutcomeSummary.outcome,
    sourceHash: update.sourceHash
  };
  const fingerprint = interopFingerprint(base);
  const candidateId = `interop-${interopFingerprint({ ...base, completedAt: update.canonicalOutcomeSummary.completedAt }).slice(0, 16)}`;
  const prior = priorCandidates
    .filter((entry) => entry.fingerprint === fingerprint && entry.candidateId !== candidateId)
    .map((entry) => entry.candidateId)
    .sort((a, b) => a.localeCompare(b));
  const severity = update.canonicalOutcomeSummary.outcome === 'failed' ? 8 : update.canonicalOutcomeSummary.outcome === 'blocked' ? 6 : 4;
  return {
    candidateId,
    kind: update.canonicalOutcomeSummary.outcome === 'completed' ? 'decision' : 'failure_mode',
    title: `interop ${update.canonicalOutcomeSummary.outcome}: ${update.action}`,
    summary: update.canonicalOutcomeSummary.detail,
    clusterKey: `interop:${update.action}:${update.canonicalOutcomeSummary.outcome}`,
    salienceScore: Number((followup.confidence.score * 10).toFixed(3)),
    salienceFactors: {
      severity,
      recurrenceCount: Math.min(10, Math.max(1, repeats)),
      blastRadius: Math.min(10, Math.max(1, repeats + 1)),
      crossModuleSpread: 1,
      ownershipDocsGap: 0,
      novelSuccessfulRemediationSignal: update.canonicalOutcomeSummary.outcome === 'completed' ? 1 : 0
    },
    fingerprint,
    module: 'interop',
    ruleId: 'interop-followups',
    failureShape: `interop:${update.action}:${update.canonicalOutcomeSummary.outcome}`,
    eventCount: repeats,
    provenance: [{
      eventId: `interop-request:${followup.source.requestId}`,
      sourcePath: INTEROP_FOLLOWUPS_DEFAULT_FILE,
      fingerprint,
      runId: followup.source.receiptId
    }],
    lastSeenAt: update.canonicalOutcomeSummary.completedAt,
    supersession: {
      evolutionOrdinal: prior.length + 1,
      priorCandidateIds: prior,
      supersedesCandidateIds: prior
    }
  };
};

export const materializeInteropMemoryCandidates = (
  cwd: string,
  options?: { followupsPath?: string; updatedTruthPath?: string; memoryCandidatesPath?: string }
): { memoryCandidatesPath: string; derivedCandidates: InteropDerivedMemoryCandidate[] } => {
  const followupsPath = options?.followupsPath ?? INTEROP_FOLLOWUPS_DEFAULT_FILE;
  const updatedTruthPath = options?.updatedTruthPath ?? INTEROP_UPDATED_TRUTH_DEFAULT_FILE;
  const memoryCandidatesPath = options?.memoryCandidatesPath ?? MEMORY_CANDIDATES_DEFAULT_FILE;

  if (followupsPath !== INTEROP_FOLLOWUPS_DEFAULT_FILE) throw new Error('Cannot materialize interop memory candidates: only canonical followups artifact path is supported.');
  if (updatedTruthPath !== INTEROP_UPDATED_TRUTH_DEFAULT_FILE) throw new Error('Cannot materialize interop memory candidates: only canonical updated truth artifact path is supported.');
  if (memoryCandidatesPath !== MEMORY_CANDIDATES_DEFAULT_FILE) throw new Error('Cannot materialize interop memory candidates: only canonical memory candidates artifact path is supported.');

  const absFollowups = path.resolve(cwd, followupsPath);
  const absUpdatedTruth = path.resolve(cwd, updatedTruthPath);
  if (!fs.existsSync(absFollowups)) throw new Error(`Cannot materialize interop memory candidates: required artifact not found at ${followupsPath}.`);
  if (!fs.existsSync(absUpdatedTruth)) throw new Error(`Cannot materialize interop memory candidates: required artifact not found at ${updatedTruthPath}.`);

  const followups = parseInteropFollowups(fs.readFileSync(absFollowups, 'utf8'));
  const updatedTruth = parseUpdatedTruth(fs.readFileSync(absUpdatedTruth, 'utf8'));
  const updatesByReceiptId = new Map(updatedTruth.updates.map((entry) => [entry.receiptId, entry] as const));
  const repeatsByActionOutcome = new Map<string, number>();
  for (const entry of updatedTruth.updates) {
    const key = `${entry.action}:${entry.canonicalOutcomeSummary.outcome}`;
    repeatsByActionOutcome.set(key, (repeatsByActionOutcome.get(key) ?? 0) + 1);
  }

  const memoryCandidates = readMemoryCandidates(cwd);
  const nextDerived: InteropDerivedMemoryCandidate[] = [];
  const nextCandidates: MemoryReplayCandidate[] = [...memoryCandidates.candidates];
  const existingById = new Map(nextCandidates.map((entry) => [entry.candidateId, entry] as const));

  for (const followup of followups.followups.filter((entry) => entry.followupType === 'memory-candidate')) {
    const update = updatesByReceiptId.get(followup.source.receiptId);
    if (!update) continue;
    const repeatKey = `${update.action}:${update.canonicalOutcomeSummary.outcome}`;
    const repeats = repeatsByActionOutcome.get(repeatKey) ?? 0;
    const eligibilityReason = chooseEligibility({
      outcome: update.canonicalOutcomeSummary.outcome,
      repeats,
      actionName: update.action,
      detail: update.canonicalOutcomeSummary.detail,
      hints: update.nextActionHints,
      followupText: followup.nextActionText
    });
    if (!eligibilityReason) continue;

    const candidate = toMemoryReplayCandidate(followup, update, nextCandidates, repeats);
    existingById.set(candidate.candidateId, candidate);
    nextDerived.push({
      candidateId: candidate.candidateId,
      source: { ...followup.source },
      action: followup.action,
      confidence: followup.confidence,
      provenanceRefs: uniqueSorted(followup.provenanceRefs),
      canonicalOutcomeSummary: update.canonicalOutcomeSummary,
      sourceHash: update.sourceHash,
      sourceContractFingerprint: updatedTruth.contract.sourceHash,
      interopFollowupId: followup.followupId,
      eligibilityReason
    });
  }

  const output: MemoryCandidatesWithInterop = {
    ...memoryCandidates,
    candidates: [...existingById.values()].sort((a, b) => (b.salienceScore - a.salienceScore) || a.candidateId.localeCompare(b.candidateId)),
    interopDerivedCandidates: [...nextDerived].sort((a, b) => a.candidateId.localeCompare(b.candidateId))
  };

  const absMemoryPath = path.resolve(cwd, memoryCandidatesPath);
  fs.mkdirSync(path.dirname(absMemoryPath), { recursive: true });
  fs.writeFileSync(absMemoryPath, deterministicStringify(output), 'utf8');
  return { memoryCandidatesPath, derivedCandidates: output.interopDerivedCandidates ?? [] };
};

export const compileInteropFollowups = (
  cwd: string,
  options?: { updatedTruthPath?: string; artifactPath?: string }
): { artifactPath: string; followups: InteropFollowupsArtifact } => {
  const updatedTruthPath = options?.updatedTruthPath ?? INTEROP_UPDATED_TRUTH_DEFAULT_FILE;
  if (updatedTruthPath !== INTEROP_UPDATED_TRUTH_DEFAULT_FILE) {
    throw new Error('Cannot compile interop followups: only canonical updated truth artifact path is supported.');
  }
  const artifactPath = options?.artifactPath ?? INTEROP_FOLLOWUPS_DEFAULT_FILE;
  if (artifactPath !== INTEROP_FOLLOWUPS_DEFAULT_FILE) {
    throw new Error('Cannot compile interop followups: only canonical followups artifact path is supported.');
  }

  const absoluteUpdatedTruthPath = path.resolve(cwd, updatedTruthPath);
  if (!fs.existsSync(absoluteUpdatedTruthPath)) {
    throw new Error(`Cannot compile interop followups: required artifact not found at ${updatedTruthPath}.`);
  }

  const updatedTruth = parseUpdatedTruth(fs.readFileSync(absoluteUpdatedTruthPath, 'utf8'));
  const followups: InteropFollowupsArtifact = {
    schemaVersion: INTEROP_FOLLOWUPS_SCHEMA_VERSION,
    kind: 'interop-followups-artifact',
    command: 'interop followups',
    reviewOnly: true,
    authority: {
      mutation: 'read-only',
      promotion: 'review-required'
    },
    sourceArtifact: {
      path: INTEROP_UPDATED_TRUTH_DEFAULT_FILE,
      contractSourceHash: updatedTruth.contract.sourceHash,
      contractSourceRef: updatedTruth.contract.sourceRef,
      contractSourcePath: updatedTruth.contract.sourcePath
    },
    followups: buildFollowupRows(updatedTruth)
  };

  const absoluteArtifactPath = path.resolve(cwd, artifactPath);
  fs.mkdirSync(path.dirname(absoluteArtifactPath), { recursive: true });
  fs.writeFileSync(absoluteArtifactPath, deterministicStringify(followups));
  return { artifactPath, followups };
};
