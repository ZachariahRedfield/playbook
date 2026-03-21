import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generatePlanContract = vi.fn();
const routeTask = vi.fn();
const applyExecutionPlan = vi.fn();
const parsePlanArtifact = vi.fn();
const validateRemediationPlan = vi.fn();
const getLatestMutableRun = vi.fn();
const createExecutionIntent = vi.fn();
const createExecutionRun = vi.fn();
const appendExecutionStep = vi.fn();
const executionRunPath = vi.fn();
const attachSessionRunState = vi.fn();
const buildPolicyPreflight = vi.fn();
const pinSessionArtifact = vi.fn();
const updateSession = vi.fn();
const loadVerifyRules = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ generatePlanContract, routeTask, applyExecutionPlan, parsePlanArtifact, validateRemediationPlan, getLatestMutableRun, createExecutionIntent, createExecutionRun, appendExecutionStep, executionRunPath, attachSessionRunState, buildPolicyPreflight, pinSessionArtifact, updateSession, POLICY_EVALUATION_RELATIVE_PATH: '.playbook/policy-evaluation.json' }));
vi.mock('../lib/loadVerifyRules.js', () => ({ loadVerifyRules }));


const createPlanPayload = () => ({
  schemaVersion: '1.0',
  command: 'plan',
  remediation: { status: 'ready', totalSteps: 1, unresolvedFailures: 0 },
  tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }]
});


const createTestFixPlanPayload = () => ({
  schemaVersion: '1.0',
  kind: 'test-fix-plan',
  command: 'test-fix-plan',
  generatedAt: '1970-01-01T00:00:00.000Z',
  source: {
    kind: 'test-triage',
    command: 'test-triage',
    generatedAt: '1970-01-01T00:00:00.000Z',
    path: '.playbook/test-triage.json',
    input: 'file'
  },
  tasks: [{ id: 'task-test-fix', ruleId: 'test-triage.snapshot-refresh', file: 'packages/cli/src/commands/schema.test.ts', action: 'refresh snapshot', autoFix: true }],
  excluded: [{
    finding_index: 1,
    failure_kind: 'environment_limitation',
    summary: 'Error: Cannot find module @esbuild/linux-x64',
    reason: 'risky_or_review_required',
    detail: 'review required',
    repair_class: 'review_required',
    file: null,
    evidence: ['Error: Cannot find module @esbuild/linux-x64']
  }],
  summary: {
    total_findings: 2,
    eligible_findings: 1,
    excluded_findings: 1,
    auto_fix_tasks: 1
  }
});


const createDocsConsolidationPlanPayload = () => ({
  schemaVersion: '1.0',
  kind: 'docs-consolidation-plan',
  command: 'docs-consolidate-plan',
  source: { path: '.playbook/docs-consolidation.json', command: 'docs consolidate' },
  tasks: [{
    id: 'task-docs-1',
    ruleId: 'docs-consolidation.managed-write',
    file: 'docs/CHANGELOG.md',
    action: 'Apply protected docs consolidation for docs/CHANGELOG.md (release-notes)',
    autoFix: true,
    task_kind: 'docs-managed-write',
    write: {
      operation: 'replace-managed-block',
      blockId: 'changelog-release-notes',
      startMarker: '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->',
      endMarker: '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->',
      content: '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->
- Added docs consolidation plan.
<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->'
    },
    provenance: {
      source_artifact_path: '.playbook/docs-consolidation.json',
      fragment_ids: ['fragment-1'],
      lane_ids: ['lane-1'],
      target_doc: 'docs/CHANGELOG.md',
      section_keys: ['release-notes']
    }
  }],
  excluded: [{
    exclusion_id: 'exclude-docs-1',
    target_doc: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
    section_keys: ['roadmap'],
    fragment_ids: ['fragment-2'],
    lane_ids: ['lane-2'],
    reason: 'missing-anchor',
    message: 'Explicit anchor not found in docs/PLAYBOOK_PRODUCT_ROADMAP.md; planning left the target review-only.'
  }],
  summary: {
    total_targets: 2,
    executable_targets: 1,
    excluded_targets: 1,
    auto_fix_tasks: 1
  }
});

const encodeUtf16Be = (value: string): Buffer => {
  const utf16le = Buffer.from(value, 'utf16le');
  for (let i = 0; i < utf16le.length; i += 2) {
    const lowByte = utf16le[i];
    utf16le[i] = utf16le[i + 1] ?? 0;
    utf16le[i + 1] = lowByte;
  }
  return utf16le;
};

describe('runApply', () => {
  beforeEach(() => {
    generatePlanContract.mockReset();
    routeTask.mockReset();
    applyExecutionPlan.mockReset();
    parsePlanArtifact.mockReset();
    validateRemediationPlan.mockReset();
    getLatestMutableRun.mockReset();
    createExecutionIntent.mockReset();
    createExecutionRun.mockReset();
    appendExecutionStep.mockReset();
    executionRunPath.mockReset();
    attachSessionRunState.mockReset();
    buildPolicyPreflight.mockReset();
    pinSessionArtifact.mockReset();
    updateSession.mockReset();
    loadVerifyRules.mockReset();
    getLatestMutableRun.mockReturnValue({ id: 'run-test' });
    appendExecutionStep.mockReturnValue({ id: 'run-test' });
    executionRunPath.mockReturnValue('.playbook/runs/run-test.json');
    routeTask.mockReturnValue({
      route: 'hybrid',
      why: 'ok',
      requiredInputs: [],
      missingPrerequisites: [],
      repoMutationAllowed: true
    });
  });

  it('renders deterministic text output', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({ verify: { ok: false, summary: { failures: 1, warnings: 0 } }, tasks: [{ id: 'task-1', ruleId: 'PB001', file: 'docs/ARCHITECTURE.md', action: 'update docs', autoFix: true }] });
    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({
      results: [{ id: 'task-1', ruleId: 'PB001', file: 'docs/ARCHITECTURE.md', action: 'update docs', autoFix: true, status: 'applied' }],
      summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
    });

    const exitCode = await runApply('/repo', { format: 'text', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Apply');
    expect(output).toContain('Applied: 1');
    expect(output).toContain('task-1 PB001 applied docs/ARCHITECTURE.md');

    logSpy.mockRestore();
  });

  it('emits stable json output', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({ verify: { ok: false, summary: { failures: 1, warnings: 0 } }, tasks: [{ id: 'task-3', ruleId: 'PB003', file: 'docs/PLAYBOOK_CHECKLIST.md', action: 'add verify step', autoFix: false }] });
    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({
      results: [{ id: 'task-3', ruleId: 'PB003', file: 'docs/PLAYBOOK_CHECKLIST.md', action: 'add verify step', autoFix: false, status: 'skipped' }],
      summary: { applied: 0, skipped: 1, unsupported: 0, failed: 0 }
    });

    const exitCode = await runApply('/repo', { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'apply',
      ok: true,
      exitCode: ExitCode.Success,
      remediation: { status: 'ready', totalSteps: 1, unresolvedFailures: 0 },
      message: 'Plan remediation is ready. Applying available tasks.',
      results: [{ id: 'task-3', ruleId: 'PB003', file: 'docs/PLAYBOOK_CHECKLIST.md', action: 'add verify step', autoFix: false, status: 'skipped' }],
      summary: { applied: 0, skipped: 1, unsupported: 0, failed: 0 }
    });

    logSpy.mockRestore();
  });


  it('emits policy-check json output without execution', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-policy-check-json-'));
    const policyPath = path.join(tmpRoot, '.playbook', 'policy-evaluation.json');
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(
      policyPath,
      JSON.stringify({ evaluations: [{ proposal_id: 'proposal-2', decision: 'safe', reason: 'ok' }] })
    );

    buildPolicyPreflight.mockReturnValue({
      schemaVersion: '1.0',
      eligible: [{ proposal_id: 'proposal-2', decision: 'safe', reason: 'ok' }],
      requires_review: [],
      blocked: [],
      summary: { eligible: 1, requires_review: 0, blocked: 0, total: 1 }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, policyCheck: true });

    expect(exitCode).toBe(ExitCode.Success);
    expect(buildPolicyPreflight).toHaveBeenCalledWith([{ proposal_id: 'proposal-2', decision: 'safe', reason: 'ok' }]);
    expect(applyExecutionPlan).not.toHaveBeenCalled();

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'apply',
      mode: 'policy-check',
      ok: true,
      exitCode: ExitCode.Success,
      eligible: [{ proposal_id: 'proposal-2', decision: 'safe', reason: 'ok' }],
      requires_review: [],
      blocked: [],
      summary: { eligible: 1, requires_review: 0, blocked: 0, total: 1 }
    });

    logSpy.mockRestore();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('renders policy-check text output', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-policy-check-text-'));
    const policyPath = path.join(tmpRoot, '.playbook', 'policy-evaluation.json');
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(
      policyPath,
      JSON.stringify({ evaluations: [{ proposal_id: 'proposal-a', decision: 'requires_review', reason: 'needs review' }] })
    );

    buildPolicyPreflight.mockReturnValue({
      schemaVersion: '1.0',
      eligible: [],
      requires_review: [{ proposal_id: 'proposal-a', decision: 'requires_review', reason: 'needs review' }],
      blocked: [],
      summary: { eligible: 0, requires_review: 1, blocked: 0, total: 1 }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runApply(tmpRoot, { format: 'text', ci: false, quiet: false, policyCheck: true });

    expect(exitCode).toBe(ExitCode.Success);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Apply policy preflight (read-only)');
    expect(output).toContain('Requires review: 1');
    expect(output).toContain('proposal-a: needs review');

    logSpy.mockRestore();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('fails policy-check when combined with --from-plan', async () => {
    const { runApply } = await import('./apply.js');

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false, policyCheck: true, fromPlan: 'plan.json' })).rejects.toThrow(
      'The --policy-check flag is read-only and cannot be combined with --from-plan.'
    );
  });


  it('fails policy-check when combined with --task', async () => {
    const { runApply } = await import('./apply.js');

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false, policyCheck: true, tasks: ['task-1'] })).rejects.toThrow(
      'The --policy-check flag is read-only and cannot be combined with --task.'
    );
  });

  it('fails when --policy is combined with --policy-check', async () => {
    const { runApply } = await import('./apply.js');

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false, policy: true, policyCheck: true })).rejects.toThrow(
      'The --policy flag cannot be combined with --policy-check.'
    );
  });


  it('fails policy mode when combined with --task', async () => {
    const { runApply } = await import('./apply.js');

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false, policy: true, tasks: ['task-1'] })).rejects.toThrow(
      'The --policy flag cannot be combined with --task.'
    );
  });

  it('fails clearly when --policy artifact is missing', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-policy-missing-'));

    await expect(runApply(tmpRoot, { format: 'json', ci: false, quiet: false, policy: true })).rejects.toThrow(
      /Unable to read policy evaluation artifact at .*policy-evaluation\.json/
    );
    expect(applyExecutionPlan).not.toHaveBeenCalled();

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writes deterministic no-op policy result when there are no safe proposals', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-policy-no-safe-'));
    const policyPath = path.join(tmpRoot, '.playbook', 'policy-evaluation.json');
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(
      policyPath,
      JSON.stringify({ evaluations: [{ proposal_id: 'proposal-review', decision: 'requires_review', reason: 'needs review' }] })
    );

    buildPolicyPreflight.mockReturnValue({
      schemaVersion: '1.0',
      eligible: [],
      requires_review: [{ proposal_id: 'proposal-review', decision: 'requires_review', reason: 'needs review' }],
      blocked: [],
      summary: { eligible: 0, requires_review: 1, blocked: 0, total: 1 }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, policy: true });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.summary).toEqual({ executed: 0, skipped_requires_review: 1, skipped_blocked: 0, failed_execution: 0, total: 1 });

    const artifact = JSON.parse(fs.readFileSync(path.join(tmpRoot, '.playbook', 'policy-apply-result.json'), 'utf8'));
    expect(artifact).toEqual({
      schemaVersion: '1.0',
      kind: 'policy-apply-result',
      executed: [],
      skipped_requires_review: [{ proposal_id: 'proposal-review', decision: 'requires_review', reason: 'needs review' }],
      skipped_blocked: [],
      failed_execution: [],
      summary: { executed: 0, skipped_requires_review: 1, skipped_blocked: 0, failed_execution: 0, total: 1 }
    });

    logSpy.mockRestore();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('executes only safe proposals and records failed safe executions deterministically', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-policy-mixed-'));
    const playbookDir = path.join(tmpRoot, '.playbook');
    const policyPath = path.join(playbookDir, 'policy-evaluation.json');
    fs.mkdirSync(playbookDir, { recursive: true });
    fs.writeFileSync(policyPath, JSON.stringify({ evaluations: [{ proposal_id: 'a', decision: 'safe', reason: 'safe a' }] }));
    fs.writeFileSync(
      path.join(playbookDir, 'improvement-candidates.json'),
      JSON.stringify({ candidates: [{ candidate_id: 'safe-ok' }] })
    );

    buildPolicyPreflight.mockReturnValue({
      schemaVersion: '1.0',
      eligible: [
        { proposal_id: 'safe-fail', decision: 'safe', reason: 'safe but missing candidate' },
        { proposal_id: 'safe-ok', decision: 'safe', reason: 'safe and executable' }
      ],
      requires_review: [{ proposal_id: 'review-1', decision: 'requires_review', reason: 'review gate' }],
      blocked: [{ proposal_id: 'block-1', decision: 'blocked', reason: 'blocked gate' }],
      summary: { eligible: 2, requires_review: 1, blocked: 1, total: 4 }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, policy: true });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      schemaVersion: '1.0',
      command: 'apply',
      mode: 'policy',
      ok: false,
      exitCode: ExitCode.Failure,
      executed: [{ proposal_id: 'safe-ok', decision: 'safe', reason: 'safe and executable' }],
      skipped_requires_review: [{ proposal_id: 'review-1', decision: 'requires_review', reason: 'review gate' }],
      skipped_blocked: [{ proposal_id: 'block-1', decision: 'blocked', reason: 'blocked gate' }],
      summary: { executed: 1, skipped_requires_review: 1, skipped_blocked: 1, failed_execution: 1, total: 4 }
    });
    expect(payload.failed_execution).toHaveLength(1);
    expect(payload.failed_execution[0].proposal_id).toBe('safe-fail');

    const artifact = JSON.parse(fs.readFileSync(path.join(playbookDir, 'policy-apply-result.json'), 'utf8'));
    expect(artifact.executed.map((entry: { proposal_id: string }) => entry.proposal_id)).toEqual(['safe-ok']);
    expect(artifact.failed_execution.map((entry: { proposal_id: string }) => entry.proposal_id)).toEqual(['safe-fail']);

    logSpy.mockRestore();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('validates policy apply artifact schema shape and ordering deterministically', async () => {
    const { validatePolicyApplyResultArtifact } = await import('./apply.js');

    const errors = validatePolicyApplyResultArtifact({
      schemaVersion: '1.0',
      kind: 'policy-apply-result',
      executed: [{ proposal_id: 'z', decision: 'safe', reason: 'safe z' }, { proposal_id: 'a', decision: 'safe', reason: 'safe a' }],
      skipped_requires_review: [],
      skipped_blocked: [],
      failed_execution: [],
      summary: { executed: 2, skipped_requires_review: 0, skipped_blocked: 0, failed_execution: 0, total: 2 }
    });

    expect(errors).toContain('executed must be deterministically ordered by proposal_id');
  });

  it('runs policy apply without validation warnings for valid deterministic artifacts', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-policy-warning-'));
    const playbookDir = path.join(tmpRoot, '.playbook');
    const policyPath = path.join(playbookDir, 'policy-evaluation.json');
    fs.mkdirSync(playbookDir, { recursive: true });
    fs.writeFileSync(policyPath, JSON.stringify({ evaluations: [] }));

    buildPolicyPreflight.mockReturnValue({
      schemaVersion: '1.0',
      eligible: [],
      requires_review: [],
      blocked: [],
      summary: { eligible: 0, requires_review: 0, blocked: 0, total: 0 }
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const exitCode = await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, policy: true });

    expect(exitCode).toBe(ExitCode.Success);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('loads serialized plan tasks from --from-plan input', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-'));
    const planPath = path.join(tmpRoot, 'plan.json');

    fs.writeFileSync(planPath, JSON.stringify(createPlanPayload()));

    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' });

    expect(generatePlanContract).not.toHaveBeenCalled();
    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }],
      { dryRun: false, handlers: {} }
    );
  });

  it('loads UTF-8 plan payload with BOM from --from-plan input', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-utf8-bom-'));
    const planPath = path.join(tmpRoot, 'plan.json');

    fs.writeFileSync(planPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(createPlanPayload()), 'utf8')]));

    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' });

    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }],
      { dryRun: false, handlers: {} }
    );
  });

  it('loads UTF-16LE BOM plan payload from --from-plan input', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-utf16le-bom-'));
    const planPath = path.join(tmpRoot, 'plan.json');

    fs.writeFileSync(planPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON.stringify(createPlanPayload()), 'utf16le')]));

    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' });

    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }],
      { dryRun: false, handlers: {} }
    );
  });

  it('loads UTF-16BE BOM plan payload from --from-plan input', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-utf16be-bom-'));
    const planPath = path.join(tmpRoot, 'plan.json');

    fs.writeFileSync(planPath, Buffer.concat([Buffer.from([0xfe, 0xff]), encodeUtf16Be(JSON.stringify(createPlanPayload()))]));

    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }] });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' });

    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-from-file', ruleId: 'plugin.failure', file: 'docs/PLUGIN.md', action: 'create plugin doc', autoFix: true }],
      { dryRun: false, handlers: {} }
    );
  });

  it('fails clearly when --from-plan file is missing', async () => {
    const { runApply } = await import('./apply.js');

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false, fromPlan: 'missing-plan.json' })).rejects.toThrow(
      /Unable to read plan file at .*missing-plan\.json:/
    );
    expect(generatePlanContract).not.toHaveBeenCalled();
  });

  it('fails clearly when --from-plan file has invalid json', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-invalid-json-'));
    const planPath = path.join(tmpRoot, 'plan.json');
    fs.writeFileSync(planPath, '{ this is not valid json');

    await expect(runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' })).rejects.toThrow(
      `Invalid plan JSON in ${planPath}:`
    );
    expect(generatePlanContract).not.toHaveBeenCalled();
    expect(parsePlanArtifact).not.toHaveBeenCalled();
  });


  it('supports selecting a single task from --from-plan via exact task id', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-select-'));
    const planPath = path.join(tmpRoot, 'plan.json');
    fs.writeFileSync(planPath, JSON.stringify({ schemaVersion: '1.0', command: 'plan', remediation: { status: 'ready', totalSteps: 2, unresolvedFailures: 0 }, tasks: [] }));

    parsePlanArtifact.mockReturnValue({
      tasks: [
        { id: 'task-1', ruleId: 'one', file: null, action: 'first', autoFix: true },
        { id: 'task-2', ruleId: 'two', file: null, action: 'second', autoFix: false }
      ]
    });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json', tasks: ['task-2'] });

    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-2', ruleId: 'two', file: null, action: 'second', autoFix: false }],
      { dryRun: false, handlers: {} }
    );
  });

  it('fails clearly when --task is used without --from-plan', async () => {
    const { runApply } = await import('./apply.js');

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false, tasks: ['task-1'] })).rejects.toThrow(
      'The --task flag requires --from-plan so task selection is tied to a reviewed artifact.'
    );
    expect(generatePlanContract).not.toHaveBeenCalled();
  });


  it('supports selecting multiple task ids with deduplication while preserving artifact order', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-multi-select-'));
    fs.writeFileSync(path.join(tmpRoot, 'plan.json'), JSON.stringify({ schemaVersion: '1.0', command: 'plan', remediation: { status: 'ready', totalSteps: 3, unresolvedFailures: 0 }, tasks: [] }));

    parsePlanArtifact.mockReturnValue({
      tasks: [
        { id: 'task-1', ruleId: 'one', file: null, action: 'first', autoFix: true },
        { id: 'task-2', ruleId: 'two', file: null, action: 'second', autoFix: true },
        { id: 'task-3', ruleId: 'three', file: null, action: 'third', autoFix: true }
      ]
    });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({ results: [], summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 } });

    await runApply(tmpRoot, {
      format: 'json',
      ci: false,
      quiet: false,
      fromPlan: 'plan.json',
      tasks: ['task-3', 'task-1', 'task-3']
    });

    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [
        { id: 'task-1', ruleId: 'one', file: null, action: 'first', autoFix: true },
        { id: 'task-3', ruleId: 'three', file: null, action: 'third', autoFix: true }
      ],
      { dryRun: false, handlers: {} }
    );
  });

  it('fails clearly when task selection includes unknown task ids', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-unknown-task-'));
    fs.writeFileSync(path.join(tmpRoot, 'plan.json'), JSON.stringify({ schemaVersion: '1.0', command: 'plan', remediation: { status: 'ready', totalSteps: 3, unresolvedFailures: 0 }, tasks: [] }));

    parsePlanArtifact.mockReturnValue({ tasks: [{ id: 'task-1', ruleId: 'one', file: null, action: 'first', autoFix: true }] });

    await expect(
      runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json', tasks: ['task-missing'] })
    ).rejects.toThrow('Unknown task id(s): task-missing.');
    expect(applyExecutionPlan).not.toHaveBeenCalled();
  });


  it('accepts test-fix-plan artifacts through --from-plan and derives remediation from exclusions', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-test-fix-plan-'));
    const planPath = path.join(tmpRoot, 'test-fix-plan.json');

    fs.writeFileSync(planPath, JSON.stringify(createTestFixPlanPayload()));

    parsePlanArtifact.mockReturnValue({
      tasks: [{ id: 'task-test-fix', ruleId: 'test-triage.snapshot-refresh', file: 'packages/cli/src/commands/schema.test.ts', action: 'refresh snapshot', autoFix: true }]
    });
    loadVerifyRules.mockResolvedValue([
      { id: 'test-triage.snapshot-refresh', description: 'refresh snapshot', check: () => true, fix: vi.fn() }
    ]);
    applyExecutionPlan.mockResolvedValue({
      results: [{ id: 'task-test-fix', ruleId: 'test-triage.snapshot-refresh', file: 'packages/cli/src/commands/schema.test.ts', action: 'refresh snapshot', autoFix: true, status: 'applied' }],
      summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'test-fix-plan.json' });

    expect(exitCode).toBe(ExitCode.Success);
    expect(parsePlanArtifact).toHaveBeenCalledWith({
      schemaVersion: '1.0',
      command: 'plan',
      tasks: createTestFixPlanPayload().tasks
    });
    expect(applyExecutionPlan).toHaveBeenCalledWith(
      tmpRoot,
      [{ id: 'task-test-fix', ruleId: 'test-triage.snapshot-refresh', file: 'packages/cli/src/commands/schema.test.ts', action: 'refresh snapshot', autoFix: true }],
      { dryRun: false, handlers: { 'test-triage.snapshot-refresh': expect.any(Function) } }
    );
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.remediation).toEqual({ status: 'ready', totalSteps: 1, unresolvedFailures: 1 });

    logSpy.mockRestore();
  });


  it('accepts docs-consolidation-plan artifacts through --from-plan and derives remediation from exclusions', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-docs-consolidation-plan-'));
    const planPath = path.join(tmpRoot, 'docs-consolidation-plan.json');

    fs.writeFileSync(planPath, JSON.stringify(createDocsConsolidationPlanPayload()));

    parsePlanArtifact.mockReturnValue({
      tasks: [createDocsConsolidationPlanPayload().tasks[0]]
    });
    loadVerifyRules.mockResolvedValue([]);
    applyExecutionPlan.mockResolvedValue({
      results: [{ ...createDocsConsolidationPlanPayload().tasks[0], status: 'applied' }],
      summary: { applied: 1, skipped: 0, unsupported: 0, failed: 0 }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'docs-consolidation-plan.json' });

    expect(exitCode).toBe(ExitCode.Success);
    expect(parsePlanArtifact).toHaveBeenCalledWith({
      schemaVersion: '1.0',
      command: 'plan',
      tasks: createDocsConsolidationPlanPayload().tasks
    });
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.remediation).toEqual({ status: 'ready', totalSteps: 1, unresolvedFailures: 1 });

    logSpy.mockRestore();
  });

  it('fails clearly when docs-consolidation-plan produces only excluded targets', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-docs-consolidation-plan-empty-'));
    const planPath = path.join(tmpRoot, 'docs-consolidation-plan.json');
    const payload = createDocsConsolidationPlanPayload();
    payload.tasks = [];
    payload.summary = { total_targets: 1, executable_targets: 0, excluded_targets: 1, auto_fix_tasks: 0 };
    fs.writeFileSync(planPath, JSON.stringify(payload));

    parsePlanArtifact.mockReturnValue({ tasks: [] });

    await expect(runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'docs-consolidation-plan.json' })).rejects.toThrow(
      'Cannot apply remediation: Docs consolidation plan produced no executable managed-write tasks. Review exclusions before attempting apply.'
    );
  });

  it('fails clearly when test-fix-plan produces only review-required exclusions', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-test-fix-plan-empty-'));
    const planPath = path.join(tmpRoot, 'test-fix-plan.json');
    const payload = createTestFixPlanPayload();
    payload.tasks = [];
    payload.summary = { total_findings: 1, eligible_findings: 0, excluded_findings: 1, auto_fix_tasks: 0 };
    fs.writeFileSync(planPath, JSON.stringify(payload));

    parsePlanArtifact.mockReturnValue({ tasks: [] });

    await expect(runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'test-fix-plan.json' })).rejects.toThrow(
      'Cannot apply remediation: Test-fix-plan produced no executable low-risk tasks. Review exclusions before attempting apply.'
    );
    expect(applyExecutionPlan).not.toHaveBeenCalled();
  });

  it('fails clearly when --from-plan envelope is invalid', async () => {
    const { runApply } = await import('./apply.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-apply-invalid-envelope-'));
    const planPath = path.join(tmpRoot, 'plan.json');

    fs.writeFileSync(planPath, JSON.stringify({ schemaVersion: '1.0', command: 'plan', remediation: { status: 'ready', totalSteps: 0, unresolvedFailures: 0 }, tasks: [] }));
    parsePlanArtifact.mockImplementation(() => {
      throw new Error('Invalid plan payload: each task must include id, ruleId, action, and autoFix.');
    });

    await expect(runApply(tmpRoot, { format: 'json', ci: false, quiet: false, fromPlan: 'plan.json' })).rejects.toThrow(
      'Invalid plan payload: each task must include id, ruleId, action, and autoFix.'
    );
    expect(generatePlanContract).not.toHaveBeenCalled();
  });

});

describe('runApply remediation status preconditions', () => {
  beforeEach(() => {
    generatePlanContract.mockReset();
    routeTask.mockReset();
    applyExecutionPlan.mockReset();
    parsePlanArtifact.mockReset();
    validateRemediationPlan.mockReset();
    getLatestMutableRun.mockReset();
    createExecutionIntent.mockReset();
    createExecutionRun.mockReset();
    appendExecutionStep.mockReset();
    executionRunPath.mockReset();
    attachSessionRunState.mockReset();
    buildPolicyPreflight.mockReset();
    pinSessionArtifact.mockReset();
    updateSession.mockReset();
    loadVerifyRules.mockReset();
    getLatestMutableRun.mockReturnValue({ id: 'run-test' });
    appendExecutionStep.mockReturnValue({ id: 'run-test' });
    executionRunPath.mockReturnValue('.playbook/runs/run-test.json');
    routeTask.mockReturnValue({
      route: 'hybrid',
      why: 'ok',
      requiredInputs: [],
      missingPrerequisites: [],
      repoMutationAllowed: true
    });
  });

  it('returns explicit no-op when remediation status is not_needed', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({ verify: { ok: true, summary: { failures: 0, warnings: 0 } }, tasks: [] });

    const exitCode = await runApply('/repo', { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(applyExecutionPlan).not.toHaveBeenCalled();
    expect(loadVerifyRules).not.toHaveBeenCalled();
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.remediation.status).toBe('not_needed');
    expect(payload.message).toBe('No verify failures were detected.');

    logSpy.mockRestore();
  });

  it('prints command help without evaluating remediation state', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runApply('/repo', { format: 'text', ci: false, quiet: false, help: true });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Usage: playbook apply [options]');
    expect(output).toContain('--from-plan <path>');
    expect(generatePlanContract).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('fails deterministically when remediation status is unavailable', async () => {
    const { runApply } = await import('./apply.js');

    generatePlanContract.mockReturnValue({
      verify: { ok: false, summary: { failures: 2, warnings: 0 } },
      tasks: []
    });

    await expect(runApply('/repo', { format: 'json', ci: false, quiet: false })).rejects.toThrow(
      'Cannot apply remediation: Verify failures were detected but no remediation tasks are currently available.'
    );
    expect(applyExecutionPlan).not.toHaveBeenCalled();
    expect(loadVerifyRules).not.toHaveBeenCalled();
  });
});

describe('runApply warning-only remediation handling', () => {
  beforeEach(() => {
    generatePlanContract.mockReset();
    routeTask.mockReset();
    applyExecutionPlan.mockReset();
    parsePlanArtifact.mockReset();
    validateRemediationPlan.mockReset();
    getLatestMutableRun.mockReset();
    createExecutionIntent.mockReset();
    createExecutionRun.mockReset();
    appendExecutionStep.mockReset();
    executionRunPath.mockReset();
    attachSessionRunState.mockReset();
    buildPolicyPreflight.mockReset();
    pinSessionArtifact.mockReset();
    updateSession.mockReset();
    loadVerifyRules.mockReset();
    getLatestMutableRun.mockReturnValue({ id: 'run-test' });
    appendExecutionStep.mockReturnValue({ id: 'run-test' });
    executionRunPath.mockReturnValue('.playbook/runs/run-test.json');
    routeTask.mockReturnValue({
      route: 'hybrid',
      why: 'ok',
      requiredInputs: [],
      missingPrerequisites: [],
      repoMutationAllowed: true
    });
  });

  it('treats warning-only verify output as apply no-op instead of unavailable remediation', async () => {
    const { runApply } = await import('./apply.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    generatePlanContract.mockReturnValue({
      verify: {
        ok: true,
        summary: { failures: 0, warnings: 1 },
        failures: [],
        warnings: [{ id: 'base-selection', message: 'Repository is not a git work tree.' }]
      },
      tasks: []
    });

    const exitCode = await runApply('/repo', { format: 'json', ci: false, quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(applyExecutionPlan).not.toHaveBeenCalled();
    expect(loadVerifyRules).not.toHaveBeenCalled();

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.remediation.status).toBe('not_needed');
    expect(payload.message).toBe('No verify failures were detected.');

    logSpy.mockRestore();
  });
});
