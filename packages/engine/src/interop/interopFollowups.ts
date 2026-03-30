import fs from 'node:fs';
import path from 'node:path';
import type { InteropUpdatedTruthArtifact } from './playbookLifelineInterop.js';

export const INTEROP_UPDATED_TRUTH_DEFAULT_FILE = '.playbook/interop-updated-truth.json' as const;
export const INTEROP_FOLLOWUPS_DEFAULT_FILE = '.playbook/interop-followups.json' as const;
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

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const parseUpdatedTruth = (raw: string): InteropUpdatedTruthArtifact => JSON.parse(raw) as InteropUpdatedTruthArtifact;

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

    rows.push({
      followupId: `followup-${update.receiptId}-review`,
      source: { receiptId: update.receiptId, requestId: update.requestId },
      action: 'queue-review-cue',
      targetSurface: '.playbook/review-queue.json',
      followupType: 'review-cue',
      provenanceRefs: sharedProvenance,
      nextActionText: `Attach receipt ${update.receiptId} to review queue evidence so operator decision remains explicit before any downstream action.`,
      confidence: confidenceFor('review-cue', outcome)
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
