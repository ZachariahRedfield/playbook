import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  attachSessionRunState,
  clearSession,
  initializeSession,
  pinSessionArtifact,
  readSession,
  resumeSession,
  sessionArtifactPath,
  updateSession
} from '../src/session/sessionStore.js';

const makeRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-session-store-'));

describe('sessionStore', () => {
  it('initializes deterministic repo-scoped session state', () => {
    const repo = makeRepo();
    const session = initializeSession(repo, { activeGoal: 'ship deterministic workflow', constraints: ['no network', 'no network'] });

    expect(session.repoRoot).toBe(path.resolve(repo));
    expect(session.activeGoal).toBe('ship deterministic workflow');
    expect(session.constraints).toEqual(['no network']);
    expect(fs.existsSync(sessionArtifactPath(repo))).toBe(true);
    expect(session.evidenceEnvelope.artifacts.some((entry) => entry.path === '.playbook/session.json')).toBe(true);
  });

  it('pins artifacts and resumes with stale artifact warnings', () => {
    const repo = makeRepo();
    initializeSession(repo, { activeGoal: 'resume workflow', selectedRunId: 'missing-run' });

    const artifact = '.playbook/plan.json';
    pinSessionArtifact(repo, artifact, 'plan');

    const resumed = resumeSession(repo);
    expect(resumed.warnings).toContain('Missing pinned artifact: .playbook/plan.json');
    expect(resumed.warnings).toContain('Selected run not found: missing-run');
    expect(resumed.session.currentStep).toBe('resume');
  });

  it('builds deterministic evidence envelope references for governed artifacts', () => {
    const repo = makeRepo();
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'improvement-candidates.json'), JSON.stringify({ candidates: [{ candidate_id: 'proposal.alpha' }] }), 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'policy-evaluation.json'), JSON.stringify({ evaluations: [{ proposal_id: 'proposal.alpha', decision: 'safe', reason: 'strong evidence' }] }), 'utf8');
    fs.writeFileSync(path.join(repo, '.playbook', 'policy-apply-result.json'), JSON.stringify({ executed: [{ proposal_id: 'proposal.alpha', decision: 'safe', reason: 'applied' }], skipped_requires_review: [], skipped_blocked: [], failed_execution: [] }), 'utf8');

    const session = initializeSession(repo, { selectedRunId: 'run-123' });

    expect(session.evidenceEnvelope.session_id).toBe(session.sessionId);
    expect(session.evidenceEnvelope.selected_run_id).toBe('run-123');
    expect(session.evidenceEnvelope.proposal_ids).toEqual(['proposal.alpha']);
    expect(session.evidenceEnvelope.policy_decisions.map((entry) => entry.source)).toEqual(['policy-apply-result', 'policy-evaluation']);
    expect(session.evidenceEnvelope.execution_result?.executed).toEqual(['proposal.alpha']);
    expect(session.evidenceEnvelope.lineage.map((entry) => entry.stage)).toEqual(['session', 'proposal_generation', 'policy_evaluation', 'execution_result']);
  });

  it('attaches run-state and clears session artifacts', () => {
    const repo = makeRepo();
    attachSessionRunState(repo, {
      step: 'verify',
      runId: 'run-123',
      goal: 'verify repository governance',
      artifacts: [{ artifact: '.playbook/verify.json', kind: 'finding' }]
    });

    const session = readSession(repo);
    expect(session?.selectedRunId).toBe('run-123');
    expect(session?.pinnedArtifacts.map((entry) => entry.artifact)).toContain('.playbook/verify.json');

    updateSession(repo, { unresolvedQuestions: ['what is stale?', 'what is stale?'] });
    expect(readSession(repo)?.unresolvedQuestions).toEqual(['what is stale?']);

    expect(clearSession(repo)).toBe(true);
    expect(readSession(repo)).toBeNull();
  });
});
