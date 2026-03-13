import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runAiContext } from './aiContext.js';

describe('runAiContext', () => {
  it('prints JSON output with required AI bootstrap fields', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAiContext('/repo', { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.command).toBe('ai-context');

    const repo = payload.repo as Record<string, unknown>;
    expect(repo.architecture).toBe('modular-monolith');
    expect(repo.localCliPreferred).toBe(true);

    const operatingLadder = payload.operatingLadder as Record<string, unknown>;
    expect(operatingLadder.preferredCommandOrder).toEqual([
      'ai-context',
      'ai-contract',
      'context',
      'index',
      'query',
      'explain',
      'ask --repo-context',
      'rules',
      'verify',
      'direct-file-inspection-if-needed'
    ]);

    const guidance = payload.guidance as Record<string, unknown>;
    expect(guidance.preferPlaybookCommands).toBe(true);
    expect((guidance.memoryCommandFamily as Record<string, unknown>).available).toBe(true);
    expect(guidance.promotedKnowledgeGuidance).toBeTruthy();
    expect(guidance.candidateKnowledgeGuidance).toBeTruthy();

    logSpy.mockRestore();
  });


  it('produces deterministic JSON ordering/stability', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const firstExit = await runAiContext('/repo', { format: 'json', quiet: false });
    const first = String(logSpy.mock.calls[0]?.[0]);

    logSpy.mockClear();
    const secondExit = await runAiContext('/repo', { format: 'json', quiet: false });
    const second = String(logSpy.mock.calls[0]?.[0]);

    expect(firstExit).toBe(ExitCode.Success);
    expect(secondExit).toBe(ExitCode.Success);
    expect(second).toBe(first);

    logSpy.mockRestore();
  });
  it('registers the ai-context command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'ai-context');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Print deterministic AI bootstrap context for Playbook-aware agents');
  });
});
