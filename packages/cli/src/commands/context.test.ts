import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runContext } from './context.js';

describe('runContext', () => {
  it('prints JSON output with required fields', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runContext('/repo', { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.command).toBe('context');
    expect(payload.architecture).toBe('modular-monolith');
    expect(payload.workflow).toEqual(['verify', 'plan', 'apply']);

    const repositoryIntelligence = payload.repositoryIntelligence as Record<string, unknown>;
    expect(repositoryIntelligence.artifact).toBe('.playbook/repo-index.json');
    expect(repositoryIntelligence.commands).toEqual(['index', 'query', 'ask', 'explain']);

    const controlPlaneArtifacts = payload.controlPlaneArtifacts as Record<string, unknown>;
    expect(controlPlaneArtifacts.policyEvaluation).toBe('.playbook/policy-evaluation.json');
    expect(controlPlaneArtifacts.policyApplyResult).toBe('.playbook/policy-apply-result.json');
    expect(controlPlaneArtifacts.session).toBe('.playbook/session.json');
    expect(controlPlaneArtifacts.cycleState).toBe('.playbook/cycle-state.json');
    expect(controlPlaneArtifacts.cycleHistory).toBe('.playbook/cycle-history.json');
    expect(controlPlaneArtifacts.improvementCandidates).toBe('.playbook/improvement-candidates.json');

    const cli = payload.cli as Record<string, unknown>;
    expect(Array.isArray(cli.commands)).toBe(true);
    expect(cli.commands).toContain('context');

    logSpy.mockRestore();
  });

  it('registers the context command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'context');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Print deterministic CLI and architecture context for tools and agents');
  });
});
