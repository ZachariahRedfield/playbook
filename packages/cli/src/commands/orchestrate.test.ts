import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const buildOrchestratorPlan = vi.fn();
const writeOrchestratorArtifacts = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({
  buildOrchestratorPlan,
  writeOrchestratorArtifacts
}));

describe('runOrchestrate', () => {
  beforeEach(() => {
    buildOrchestratorPlan.mockReset();
    writeOrchestratorArtifacts.mockReset();
    buildOrchestratorPlan.mockReturnValue({ schemaVersion: '1.0', goal: 'default-goal', lanes: [] });
    writeOrchestratorArtifacts.mockImplementation((outDir: string) => {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'orchestrator.plan.json'), '{}\n', 'utf8');
      fs.writeFileSync(path.join(outDir, 'orchestrator.lanes.json'), '{}\n', 'utf8');
      return {
        planPath: path.join(outDir, 'orchestrator.plan.json'),
        lanesPath: path.join(outDir, 'orchestrator.lanes.json')
      };
    });
  });

  it('requires --goal', async () => {
    const { runOrchestrate } = await import('./orchestrate.js');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const code = await runOrchestrate('/repo', [], { format: 'json', quiet: false });

    expect(code).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook orchestrate: missing required --goal');
    errorSpy.mockRestore();
  });

  it('uses deterministic defaults and creates the output directory with plan files', async () => {
    const { runOrchestrate } = await import('./orchestrate.js');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrate-cli-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const code = await runOrchestrate(repo, ['--goal', 'stabilize test contracts'], { format: 'json', quiet: false });

    expect(code).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('orchestrate');
    expect(payload.goal).toBe('stabilize test contracts');

    const outDir = path.join(repo, '.playbook', 'orchestrate');
    expect(fs.existsSync(outDir)).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'orchestrator.plan.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'orchestrator.lanes.json'))).toBe(true);

    logSpy.mockRestore();
  });

  it('respects --out-dir override and writes deterministic artifacts there', async () => {
    const { runOrchestrate } = await import('./orchestrate.js');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrate-cli-out-'));

    const code = await runOrchestrate(repo, ['--goal', 'route lanes', '--out-dir', 'tmp/contracts'], { format: 'text', quiet: true });

    expect(code).toBe(ExitCode.Success);
    const outDir = path.join(repo, 'tmp', 'contracts');
    expect(fs.existsSync(path.join(outDir, 'orchestrator.plan.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'orchestrator.lanes.json'))).toBe(true);
  });
});
