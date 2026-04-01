import fs from 'node:fs';
import path from 'node:path';
import {
  INTEROP_FOLLOWUPS_DEFAULT_FILE,
  INTEROP_UPDATED_TRUTH_DEFAULT_FILE
} from './interopFollowups.js';
import type { InteropUpdatedTruthArtifact } from './playbookLifelineInterop.js';

export const INTEROP_DOCS_STORY_FOLLOWUPS_DEFAULT_FILE = '.playbook/interop-docs-story-followups.json' as const;
export const INTEROP_DOCS_STORY_FOLLOWUPS_SCHEMA_VERSION = '1.0' as const;

type InteropDocsStoryFollowupReasonCode =
  | 'completed-weekly-goal-plan-revision-docs-sync'
  | 'completed-weekly-goal-plan-revision-story-candidate';

export type InteropDocsStoryFollowupRow = {
  followupId: string;
  requestId: string;
  receiptId: string;
  action: 'revise_weekly_goal_plan';
  canonicalOutcomeSummary: InteropUpdatedTruthArtifact['updates'][number]['canonicalOutcomeSummary'] & { outcome: 'completed' };
  recommendedSurface: 'docs' | 'story';
  targetPath?: string;
  targetStoryId?: string;
  reasonCode: InteropDocsStoryFollowupReasonCode;
  confidence: {
    score: number;
    rationale: string;
  };
  provenanceRefs: string[];
  nextActionText: string;
};

export type InteropDocsStoryFollowupsArtifact = {
  schemaVersion: typeof INTEROP_DOCS_STORY_FOLLOWUPS_SCHEMA_VERSION;
  kind: 'interop-docs-story-followups-artifact';
  command: 'interop docs-story-followups';
  reviewOnly: true;
  proposalOnly: true;
  authority: {
    mutation: 'read-only';
    promotion: 'review-required';
  };
  sourceArtifacts: {
    updatedTruthPath: typeof INTEROP_UPDATED_TRUTH_DEFAULT_FILE;
    followupsPath: typeof INTEROP_FOLLOWUPS_DEFAULT_FILE;
    contractSourceHash: string;
    contractSourceRef: string;
    contractSourcePath: string;
  };
  followups: InteropDocsStoryFollowupRow[];
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const parseUpdatedTruth = (raw: string): InteropUpdatedTruthArtifact => JSON.parse(raw) as InteropUpdatedTruthArtifact;

const docsConfidence = {
  score: 0.83,
  rationale: 'Completed weekly goal-plan revisions deterministically imply docs synchronization proposals while preserving review-only authority.'
} as const;

const storyConfidence = {
  score: 0.79,
  rationale: 'Completed weekly goal-plan revisions deterministically imply story candidate followups, but promotion remains explicitly review-gated.'
} as const;

const buildRows = (updatedTruth: InteropUpdatedTruthArtifact): InteropDocsStoryFollowupRow[] => {
  const rows: InteropDocsStoryFollowupRow[] = [];

  for (const update of [...updatedTruth.updates].sort((a, b) => a.receiptId.localeCompare(b.receiptId))) {
    if (update.action !== 'revise_weekly_goal_plan') continue;
    if (update.canonicalOutcomeSummary.outcome !== 'completed') continue;

    const common = {
      requestId: update.requestId,
      receiptId: update.receiptId,
      action: 'revise_weekly_goal_plan' as const,
      canonicalOutcomeSummary: {
        ...update.canonicalOutcomeSummary,
        outcome: 'completed' as const
      },
      provenanceRefs: uniqueSorted([
        INTEROP_UPDATED_TRUTH_DEFAULT_FILE,
        ...update.memoryProvenanceRefs,
        `request:${update.requestId}`,
        `receipt:${update.receiptId}`,
        `action:${update.action}`
      ])
    };

    rows.push({
      followupId: `docs-story-followup-${update.receiptId}-docs`,
      ...common,
      recommendedSurface: 'docs',
      targetPath: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
      reasonCode: 'completed-weekly-goal-plan-revision-docs-sync',
      confidence: docsConfidence,
      nextActionText: `Propose a docs update in docs/PLAYBOOK_PRODUCT_ROADMAP.md for completed request ${update.requestId}; do not mutate docs automatically.`
    });

    rows.push({
      followupId: `docs-story-followup-${update.receiptId}-story`,
      ...common,
      recommendedSurface: 'story',
      targetStoryId: `interop-followup:${update.requestId}:${update.receiptId}`,
      reasonCode: 'completed-weekly-goal-plan-revision-story-candidate',
      confidence: storyConfidence,
      nextActionText: `Propose a story candidate for completed request ${update.requestId}; do not auto-create story artifacts.`
    });
  }

  return rows.sort((a, b) => a.followupId.localeCompare(b.followupId));
};

export const compileInteropDocsStoryFollowups = (
  cwd: string,
  options?: { updatedTruthPath?: string; artifactPath?: string }
): { artifactPath: string; docsStoryFollowups: InteropDocsStoryFollowupsArtifact } => {
  const updatedTruthPath = options?.updatedTruthPath ?? INTEROP_UPDATED_TRUTH_DEFAULT_FILE;
  const artifactPath = options?.artifactPath ?? INTEROP_DOCS_STORY_FOLLOWUPS_DEFAULT_FILE;

  if (updatedTruthPath !== INTEROP_UPDATED_TRUTH_DEFAULT_FILE) {
    throw new Error('Cannot compile interop docs/story followups: only canonical updated truth artifact path is supported.');
  }
  if (artifactPath !== INTEROP_DOCS_STORY_FOLLOWUPS_DEFAULT_FILE) {
    throw new Error('Cannot compile interop docs/story followups: only canonical docs/story followups artifact path is supported.');
  }

  const absUpdatedTruth = path.resolve(cwd, updatedTruthPath);
  if (!fs.existsSync(absUpdatedTruth)) {
    throw new Error(`Cannot compile interop docs/story followups: required artifact not found at ${updatedTruthPath}.`);
  }

  const updatedTruth = parseUpdatedTruth(fs.readFileSync(absUpdatedTruth, 'utf8'));
  const docsStoryFollowups: InteropDocsStoryFollowupsArtifact = {
    schemaVersion: INTEROP_DOCS_STORY_FOLLOWUPS_SCHEMA_VERSION,
    kind: 'interop-docs-story-followups-artifact',
    command: 'interop docs-story-followups',
    reviewOnly: true,
    proposalOnly: true,
    authority: {
      mutation: 'read-only',
      promotion: 'review-required'
    },
    sourceArtifacts: {
      updatedTruthPath: INTEROP_UPDATED_TRUTH_DEFAULT_FILE,
      followupsPath: INTEROP_FOLLOWUPS_DEFAULT_FILE,
      contractSourceHash: updatedTruth.contract.sourceHash,
      contractSourceRef: updatedTruth.contract.sourceRef,
      contractSourcePath: updatedTruth.contract.sourcePath
    },
    followups: buildRows(updatedTruth)
  };

  const absArtifact = path.resolve(cwd, artifactPath);
  fs.mkdirSync(path.dirname(absArtifact), { recursive: true });
  fs.writeFileSync(absArtifact, deterministicStringify(docsStoryFollowups), 'utf8');

  return { artifactPath, docsStoryFollowups };
};
