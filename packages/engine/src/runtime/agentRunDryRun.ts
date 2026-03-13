import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { controlPlaneRuntimePaths } from '@zachariahredfield/playbook-core';
import { compilePlanArtifactToRuntime } from '../runtimeCompiler/runtimeCompiler.js';
import { evaluateDryRunRuntimePolicy } from '../runtimePolicy/dryRunEvaluator.js';
import { previewDryRunScheduling } from '../runtimePreview/index.js';

export type AgentRunPlanDryRunInput = {
  repoRoot: string;
  fromPlanPath: string;
};

export type AgentRunPlanDryRunResult = {
  runMetadata: {
    runId: string;
    agentId: string;
    repoId: string;
    objective: string;
    mode: 'dry-run';
    createdAt: number;
  };
  compiledTaskCount: number;
  readyBlockedSummary: {
    readyCount: number;
    blockedCount: number;
    completedCount: number;
  };
  approvalRequiredSummary: {
    taskCount: number;
    taskIds: string[];
  };
  deniedTaskSummary: {
    taskCount: number;
    taskIds: string[];
  };
  schedulingPreview: ReturnType<typeof previewDryRunScheduling>;
  provenance: {
    sourcePlanArtifactPath: string;
    sourcePlanArtifactId: string;
  };
};

const stableTempRoot = (repoRoot: string): string => {
  const hash = createHash('sha256').update(repoRoot, 'utf8').digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), 'playbook-agent-dry-run', hash);
};

const normalizePath = (value: string): string => value.split(path.sep).join('/');

const resolvePlanArtifactPath = (repoRoot: string, fromPlanPath: string): string => {
  const absolutePlanPath = path.isAbsolute(fromPlanPath) ? fromPlanPath : path.join(repoRoot, fromPlanPath);

  if (!fs.existsSync(absolutePlanPath)) {
    throw new Error(`playbook agent run: plan artifact not found: ${normalizePath(fromPlanPath)}`);
  }

  if (!fs.statSync(absolutePlanPath).isFile()) {
    throw new Error(`playbook agent run: plan artifact path must be a file: ${normalizePath(fromPlanPath)}`);
  }

  return absolutePlanPath;
};

export const runAgentPlanDryRun = (input: AgentRunPlanDryRunInput): AgentRunPlanDryRunResult => {
  const tempRoot = stableTempRoot(input.repoRoot);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(tempRoot, { recursive: true });

  const planArtifactPath = resolvePlanArtifactPath(input.repoRoot, input.fromPlanPath);
  const sourcePlanArtifactPath = normalizePath(path.relative(input.repoRoot, planArtifactPath));

  const compiled = compilePlanArtifactToRuntime({
    repoRoot: tempRoot,
    planArtifactPath,
    agentId: 'playbook-agent',
    repoId: path.basename(input.repoRoot),
    objective: 'plan-backed-agent-dry-run'
  });

  const policy = evaluateDryRunRuntimePolicy({
    runId: compiled.run.runId,
    compiledTasksPath: path.join(tempRoot, controlPlaneRuntimePaths.compiledTasks),
    policyConfig: {
      repoRoot: input.repoRoot,
      allowedCommandFamilies: ['apply', 'ask', 'audit', 'context', 'deps', 'diagram', 'docs', 'doctor', 'explain', 'fix', 'index', 'memory', 'orchestrate', 'plan', 'query', 'route', 'rules', 'schema', 'session', 'status', 'verify'],
      allowedPathScopes: ['.'],
      requireApprovalForMutation: true
    }
  });

  const schedulingPreview = previewDryRunScheduling(tempRoot, compiled.run.runId);

  return {
    runMetadata: {
      runId: compiled.run.runId,
      agentId: compiled.run.agentId,
      repoId: compiled.run.repoId,
      objective: compiled.run.objective,
      mode: 'dry-run',
      createdAt: compiled.run.createdAt
    },
    compiledTaskCount: compiled.compiledTasks.length,
    readyBlockedSummary: {
      readyCount: schedulingPreview.ready.length,
      blockedCount: schedulingPreview.blocked.length,
      completedCount: schedulingPreview.completed.length
    },
    approvalRequiredSummary: {
      taskCount: policy.approvalSummary.approvalRequiredTaskIds.length,
      taskIds: policy.approvalSummary.approvalRequiredTaskIds
    },
    deniedTaskSummary: {
      taskCount: policy.approvalSummary.deniedTaskIds.length,
      taskIds: policy.approvalSummary.deniedTaskIds
    },
    schedulingPreview,
    provenance: {
      sourcePlanArtifactPath,
      sourcePlanArtifactId: compiled.metadata.sourcePlan.artifactId
    }
  };
};
