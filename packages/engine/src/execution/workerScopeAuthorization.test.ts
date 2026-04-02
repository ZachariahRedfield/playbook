import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateWorkerSubmitAgainstScope } from './workerScopeAuthorization.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeLaunchPlan = (repo: string): void => {
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.playbook', 'worker-launch-plan.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'worker-launch-plan',
        proposalOnly: true,
        generatedAt: new Date(0).toISOString(),
        sourceArtifacts: {
          worksetPlanPath: '.playbook/workset-plan.json',
          laneStatePath: '.playbook/lane-state.json',
          workerAssignmentsPath: '.playbook/worker-assignments.json',
          verifyPath: '.playbook/verify-report.json',
          policyEvaluationPath: '.playbook/policy-evaluation.json'
        },
        summary: { launchEligibleLanes: ['lane-1'], blockedLanes: [], failClosedReasons: [] },
        lanes: [
          {
            lane_id: 'lane-1',
            worker_id: 'worker-1',
            worker_type: 'codex-docs',
            launchEligible: true,
            blockers: [],
            requiredCapabilities: [],
            allowedWriteSurfaces: ['docs/commands/workers.md'],
            declaredChangeScope: {
              scopeId: 'scope-1',
              allowedWriteSurfaces: ['docs/commands/workers.md'],
              patchSizeBudget: { maxFiles: 1, maxHunks: 2, maxAddedLines: 10, maxRemovedLines: 10 },
              enforced: true
            },
            protectedSingletonImpact: { hasProtectedSingletonWork: true, targets: ['docs/commands/workers.md'], consolidationStage: 'applied', unresolved: false },
            requiredReceipts: [],
            releaseReadyPreconditions: []
          }
        ]
      },
      null,
      2
    )}\n`,
    'utf8'
  );
};

describe('validateWorkerSubmitAgainstScope', () => {
  it('keeps scoped lane submissions eligible when mutation targets stay within scope', () => {
    const repo = createRepo('worker-scope-eligible');
    writeLaunchPlan(repo);
    const result = validateWorkerSubmitAgainstScope(repo, {
      lane_id: 'lane-1',
      fragment_refs: [{ target_path: 'docs/commands/workers.md', fragment_path: '.playbook/orchestrator/workers/lane-1/worker-fragment.json' }],
      artifact_refs: []
    });
    expect(result.errors).toEqual([]);
  });

  it('fails closed when worker submission targets out-of-scope files', () => {
    const repo = createRepo('worker-scope-outside');
    writeLaunchPlan(repo);
    const result = validateWorkerSubmitAgainstScope(repo, {
      lane_id: 'lane-1',
      artifact_refs: [{ path: 'README.md', kind: 'artifact' }]
    });
    expect(result.errors).toContain('scope:out-of-scope-targets:README.md');
  });
});

