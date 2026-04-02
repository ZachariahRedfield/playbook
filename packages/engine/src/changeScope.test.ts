import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildChangeScopeBundleFromAiProposal,
  buildChangeScopeBundleFromAnalyzePr,
  buildChangeScopeBundleFromPlan,
  buildChangeScopeBundleFromWorkerLaunchPlan,
  writeChangeScopeArtifact
} from './changeScope.js';

describe('change scope bundles', () => {
  it('builds deterministic plan scope bundles', () => {
    const payload = {
      tasks: [
        { id: 'task-1', ruleId: 'PB001', file: 'packages/engine/src/index.ts', action: 'update engine exports', autoFix: true },
        { id: 'task-2', ruleId: 'PB002', file: 'docs/commands/README.md', action: 'update docs', autoFix: true }
      ]
    };

    const first = buildChangeScopeBundleFromPlan(payload);
    const second = buildChangeScopeBundleFromPlan(payload);

    expect(first).toEqual(second);
    expect(first.mutationScope.allowedFiles).toEqual(['docs/commands/README.md', 'packages/engine/src/index.ts']);
    expect(first.docsSurfaces).toEqual(['docs/commands/README.md']);
  });

  it('preserves analyze-pr risk and changed files in bundle', () => {
    const bundle = buildChangeScopeBundleFromAnalyzePr({
      schemaVersion: '1.0',
      command: 'analyze-pr',
      baseRef: 'main',
      changedFiles: ['packages/cli/src/commands/plan.ts'],
      summary: { changedFileCount: 1, affectedModuleCount: 1, riskLevel: 'high' },
      affectedModules: ['cli'],
      impact: [],
      architecture: { boundariesTouched: [] },
      risk: { level: 'high', signals: ['risk'], moduleRisk: [] },
      docs: { changed: [], recommendedReview: [] },
      rules: { related: ['PB001'], owners: [] },
      moduleOwners: [],
      findings: [],
      reviewGuidance: ['Run tests before merge'],
      contractSurface: { hasImpact: false, categories: [], changedFiles: [], requiredUpdates: [], changelogUpdated: false },
      preventionGuidance: [],
      context: { sources: [] }
    });

    expect(bundle.riskLevel).toBe('high');
    expect(bundle.mutationScope.allowedFiles).toEqual(['packages/cli/src/commands/plan.ts']);
    expect(bundle.rulesTouched).toEqual(['PB001']);
  });

  it('writes canonical change-scope artifact', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-change-scope-'));
    const bundle = buildChangeScopeBundleFromAiProposal({
      schemaVersion: '1.0',
      command: 'ai-propose',
      proposalId: 'proposal-1',
      scope: {
        mode: 'proposal-only',
        boundaries: ['no-direct-apply', 'no-memory-promotion', 'no-pattern-promotion', 'no-external-interop-emit', 'artifact-only-output'],
        allowedInputs: [],
        optionalInputs: [],
        target: 'general'
      },
      reasoningSummary: [],
      recommendedNextGovernedSurface: 'plan',
      suggestedArtifactPath: '.playbook/ai-proposal.json',
      blockers: [],
      assumptions: [],
      confidence: 0.5,
      provenance: [{ artifactPath: '.playbook/repo-index.json', source: 'file', required: true, available: true, used: true }]
    });

    const artifact = writeChangeScopeArtifact(repo, bundle);

    expect(artifact.kind).toBe('change-scope');
    expect(artifact.generatedAt).toBe('1970-01-01T00:00:00.000Z');
    expect(fs.existsSync(path.join(repo, '.playbook', 'change-scope.json'))).toBe(true);
  });

  it('derives worker launch-plan bundle boundaries', () => {
    const bundle = buildChangeScopeBundleFromWorkerLaunchPlan({
      schemaVersion: '1.0',
      kind: 'worker-launch-plan',
      proposalOnly: true,
      generatedAt: '1970-01-01T00:00:00.000Z',
      sourceArtifacts: {
        worksetPlanPath: '.playbook/workset-plan.json',
        laneStatePath: '.playbook/lane-state.json',
        workerAssignmentsPath: '.playbook/worker-assignments.json',
        verifyPath: '.playbook/verify-report.json',
        policyEvaluationPath: '.playbook/policy-evaluation.json'
      },
      summary: { launchEligibleLanes: [], blockedLanes: [{ lane_id: 'lane-1', blockers: ['verify:PB001'] }], failClosedReasons: [] },
      lanes: [
        {
          lane_id: 'lane-1',
          worker_id: null,
          worker_type: null,
          launchEligible: false,
          blockers: ['verify:PB001'],
          requiredCapabilities: [],
          allowedWriteSurfaces: ['packages/engine/src/changeScope.ts'],
          scopeBoundaries: {
            scope_id: null,
            allowed_write_surfaces: ['packages/engine/src/changeScope.ts'],
            blocked_surfaces: [],
            patch_size_budget: null
          },
          protectedSingletonImpact: { hasProtectedSingletonWork: false, targets: [], consolidationStage: 'not_applicable', unresolved: false },
          requiredReceipts: [],
          releaseReadyPreconditions: []
        }
      ]
    });

    expect(bundle.mutationScope.allowedFiles).toEqual(['packages/engine/src/changeScope.ts']);
    expect(bundle.rulesTouched).toEqual(['PB001']);
    expect(bundle.riskLevel).toBe('medium');
  });
});
