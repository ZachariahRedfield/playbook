import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const routeTask = vi.fn();

vi.mock('@zachariahredfield/playbook-engine', () => ({ routeTask }));

describe('runRoute', () => {
  it('emits deterministic json route output', async () => {
    const { runRoute } = await import('./route.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    routeTask.mockReturnValue({
      route: 'deterministic_local',
      why: 'Artifact read tasks are deterministic.',
      requiredInputs: ['task kind'],
      missingPrerequisites: [],
      repoMutationAllowed: false
    });

    const exitCode = await runRoute('/repo', ['summarize', 'current', 'repo', 'state'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('route');
    expect(payload.selectedRoute).toBe('deterministic_local');
    expect(payload.task).toBe('summarize current repo state');

    logSpy.mockRestore();
  });
});
