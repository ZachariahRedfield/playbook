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
