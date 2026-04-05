import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MaintenancePlanArtifact } from './maintenancePlan.js';
import { buildApprovedMaintenanceTasks, parseMaintenanceApprovals, writeMaintenanceExecutionArtifacts } from './maintenanceExecution.js';

const createRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-maintenance-exec-'));

const createPlan = (): MaintenancePlanArtifact => ({
  schemaVersion: '1.0',
  kind: 'playbook-maintenance-plan',
  command: 'maintenance-plan',
  proposalOnly: true,
  generatedAt: new Date(0).toISOString(),
  sourceArtifacts: {
    verify: '.playbook/verify.json',
    verifyPreflight: '.playbook/verify-preflight.json',
    longitudinalState: '.playbook/longitudinal-state.json',
    outcomeFeedback: '.playbook/outcome-feedback.json',
    remediationStatus: '.playbook/remediation-status.json',
    remediationHistory: '.playbook/test-autofix-history.json'
  },
  maintenanceRows: [{
    maintenanceId: 'maintenance.docs-audit.recurring-findings',
    sourceEvidenceRefs: ['.playbook/longitudinal-state.json'],
    maintenanceType: 'docs-audit-maintenance',
    boundedTargetSurface: 'docs/ governance surfaces and docs audit command outputs',
    recurrenceTrendRationale: 'test',
    requiredApprovals: ['human:maintainer-approval'],
    confidence: 0.8,
    nextActionText: 'run docs audit'
  }],
  summary: {
    totalCandidates: 1,
    byType: {
      'docs-audit-maintenance': 1,
      'release-governance-drift-reconciliation': 0,
      'ignore-cleanup-hygiene-recommendations': 0,
      'approved-low-risk-remediation-patterns': 0
    }
  },
  authority: {
    mutation: 'read-only',
    execution: 'unchanged',
    doctrinePromotion: 'forbidden'
  }
});

describe('maintenanceExecution', () => {
  const repos: string[] = [];

  afterEach(() => {
    for (const repo of repos) {
      fs.rmSync(repo, { recursive: true, force: true });
    }
    repos.length = 0;
  });

  it('builds approved bounded maintenance execution tasks', () => {
    const repo = createRepo();
    repos.push(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook/longitudinal-state.json'), '{}\n', 'utf8');

    const tasks = buildApprovedMaintenanceTasks(
      createPlan(),
      parseMaintenanceApprovals(JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-maintenance-approvals',
        generatedAt: new Date(0).toISOString(),
        approvals: [{
          maintenanceId: 'maintenance.docs-audit.recurring-findings',
          approved: true,
          approvalRef: 'approval:docs:1',
          approvedBy: 'maintainer',
          boundedTargetSurface: 'docs/ governance surfaces and docs audit command outputs'
        }]
      }), '.playbook/maintenance-approvals.json'),
      [{ proposal_id: 'maintenance:maintenance.docs-audit.recurring-findings', decision: 'safe', reason: 'approved' }],
      { repoRoot: repo }
    );

    expect(tasks).toEqual([{
      id: 'maintenance:maintenance.docs-audit.recurring-findings',
      maintenanceId: 'maintenance.docs-audit.recurring-findings',
      maintenanceType: 'docs-audit-maintenance',
      command: 'pnpm playbook docs audit --json',
      boundedTargetSurface: 'docs/ governance surfaces and docs audit command outputs',
      sourceEvidenceRefs: ['.playbook/longitudinal-state.json'],
      approvalRef: 'approval:docs:1',
      policyRef: 'maintenance:maintenance.docs-audit.recurring-findings'
    }]);
  });

  it('fails closed when approvals are missing', () => {
    const repo = createRepo();
    repos.push(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook/longitudinal-state.json'), '{}\n', 'utf8');

    expect(() => buildApprovedMaintenanceTasks(
      createPlan(),
      parseMaintenanceApprovals(JSON.stringify({ schemaVersion: '1.0', kind: 'playbook-maintenance-approvals', generatedAt: new Date(0).toISOString(), approvals: [] }), '.playbook/maintenance-approvals.json'),
      [{ proposal_id: 'maintenance:maintenance.docs-audit.recurring-findings', decision: 'safe', reason: 'approved' }],
      { repoRoot: repo }
    )).toThrow(/explicit approval is missing/);
  });

  it('writes deterministic receipt and state artifacts', () => {
    const repo = createRepo();
    repos.push(repo);

    const { receipt, state } = writeMaintenanceExecutionArtifacts(repo, {
      sourcePlan: '.playbook/maintenance-plan.json',
      sourceApprovals: '.playbook/maintenance-approvals.json',
      sourcePolicy: '.playbook/policy-evaluation.json',
      outcomes: [{
        taskId: 'maintenance:maintenance.docs-audit.recurring-findings',
        maintenanceId: 'maintenance.docs-audit.recurring-findings',
        maintenanceType: 'docs-audit-maintenance',
        command: 'pnpm playbook docs audit --json',
        status: 'executed',
        boundedTargetSurface: 'docs/ governance surfaces and docs audit command outputs',
        approvalRef: 'approval:docs:1',
        policyRef: 'maintenance:maintenance.docs-audit.recurring-findings',
        sourceEvidenceRefs: ['.playbook/longitudinal-state.json'],
        exitCode: 0,
        message: 'ok'
      }]
    });

    expect(receipt.summary.executed).toBe(1);
    expect(state.runs).toHaveLength(1);
    expect(fs.existsSync(path.join(repo, '.playbook/maintenance-execution-receipt.json'))).toBe(true);
    expect(fs.existsSync(path.join(repo, '.playbook/maintenance-execution-state.json'))).toBe(true);
  });
});
