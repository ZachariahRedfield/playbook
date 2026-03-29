import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runAi } from './ai.js';

const createRepo = (name: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.playbook', 'repo-index.json'),
    JSON.stringify({ schemaVersion: '1.0', command: 'index', modules: [] }, null, 2)
  );
  return repo;
};

describe('runAi', () => {
  it('emits ai-propose JSON payload', async () => {
    const repo = createRepo('playbook-cli-ai-propose-json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAi(repo, ['propose'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBe('ai-propose');
    expect(payload.suggestedArtifactPath).toBe('.playbook/ai-proposal.json');

    logSpy.mockRestore();
  });

  it('writes artifact when --out is provided', async () => {
    const repo = createRepo('playbook-cli-ai-propose-out');
    const outPath = '.playbook/ai-proposal.json';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAi(repo, ['propose'], { format: 'json', quiet: false, outFile: outPath });

    expect(exitCode).toBe(ExitCode.Success);
    expect(fs.existsSync(path.join(repo, outPath))).toBe(true);
    logSpy.mockRestore();
  });

  it('rejects unknown include values', async () => {
    const repo = createRepo('playbook-cli-ai-propose-invalid');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runAi(repo, ['propose', '--include', 'invalid'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('unsupported --include');

    errorSpy.mockRestore();
  });

  it('registers ai command metadata', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'ai');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Emit proposal-only AI artifacts from deterministic context and contract surfaces');
  });
});
