import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export type WorkflowPromotion = {
  schemaVersion: '1.0';
  kind: 'workflow-promotion';
  workflow_kind: string;
  staged_generation: true;
  candidate_artifact_path: string;
  staged_artifact_path: string;
  committed_target_path: string;
  validation_status: 'passed' | 'blocked';
  validation_passed: boolean;
  promotion_status: 'promoted' | 'blocked';
  promoted: boolean;
  committed_state_preserved: boolean;
  blocked_reason: string | null;
  error_summary: string | null;
  generated_at: string;
  summary: string;
};

const stableStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const promoteWorkflowArtifact = (stagedPath: string, destinationPath: string): void => {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-promotion-'));
  const backupPath = path.join(backupRoot, 'artifact-backup.json');
  const destinationExisted = fs.existsSync(destinationPath);
  try {
    if (destinationExisted) {
      fs.copyFileSync(destinationPath, backupPath);
    }
    fs.copyFileSync(stagedPath, destinationPath);
  } catch (error) {
    if (destinationExisted && fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, destinationPath);
    } else {
      fs.rmSync(destinationPath, { force: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed promoting staged workflow artifact; committed state restored. ${message}`);
  } finally {
    fs.rmSync(backupRoot, { recursive: true, force: true });
  }
};

export type StageWorkflowArtifactInput = {
  cwd: string;
  workflowKind: string;
  candidateRelativePath: string;
  committedRelativePath: string;
  artifact: unknown;
  validate: () => string[];
  generatedAt?: string;
  successSummary: string;
  blockedSummary?: string;
};


const buildWorkflowPromotionResult = (input: {
  workflowKind: string;
  candidateRelativePath: string;
  committedRelativePath: string;
  generatedAt?: string;
  validationErrors: string[];
  successSummary: string;
  blockedSummary?: string;
}): WorkflowPromotion => {
  const blockedReason = input.validationErrors.length > 0 ? input.validationErrors.join('; ') : null;
  const promoted = input.validationErrors.length === 0;

  return {
    schemaVersion: '1.0',
    kind: 'workflow-promotion',
    workflow_kind: input.workflowKind,
    staged_generation: true,
    candidate_artifact_path: input.candidateRelativePath,
    staged_artifact_path: input.candidateRelativePath,
    committed_target_path: input.committedRelativePath,
    validation_status: promoted ? 'passed' : 'blocked',
    validation_passed: promoted,
    promotion_status: promoted ? 'promoted' : 'blocked',
    promoted,
    committed_state_preserved: true,
    blocked_reason: blockedReason,
    error_summary: blockedReason,
    generated_at: input.generatedAt ?? new Date(0).toISOString(),
    summary: promoted
      ? input.successSummary
      : input.blockedSummary ?? `Staged ${input.workflowKind} candidate blocked before promotion.`
  };
};

export const previewWorkflowArtifact = (input: StageWorkflowArtifactInput): WorkflowPromotion =>
  buildWorkflowPromotionResult({
    workflowKind: input.workflowKind,
    candidateRelativePath: input.candidateRelativePath,
    committedRelativePath: input.committedRelativePath,
    generatedAt: input.generatedAt,
    validationErrors: input.validate(),
    successSummary: input.successSummary,
    blockedSummary: input.blockedSummary
  });

export const stageWorkflowArtifact = (input: StageWorkflowArtifactInput): WorkflowPromotion => {
  const stagedPath = path.join(input.cwd, input.candidateRelativePath);
  const committedPath = path.join(input.cwd, input.committedRelativePath);

  fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
  fs.writeFileSync(stagedPath, stableStringify(input.artifact), 'utf8');

  const promotion = previewWorkflowArtifact(input);
  if (!promotion.promoted) {
    return promotion;
  }

  promoteWorkflowArtifact(stagedPath, committedPath);
  return promotion;
};
