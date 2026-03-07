import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runAiContract } from './aiContract.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe('runAiContract', () => {
  it('prints generated AI contract payload in JSON mode when no contract file exists', async () => {
    const repo = createRepo('playbook-cli-ai-contract-generated');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAiContract(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBe('ai-contract');
    expect(payload.source).toBe('generated');

    const contract = payload.contract as Record<string, unknown>;
    expect(contract.schemaVersion).toBe('1.0');
    expect(contract.kind).toBe('playbook-ai-contract');
    expect(contract.ai_runtime).toBe('playbook-agent');

    logSpy.mockRestore();
  });

  it('loads file-backed AI contract payload in JSON mode when contract file exists', async () => {
    const repo = createRepo('playbook-cli-ai-contract-file');
    const filePath = path.join(repo, '.playbook', 'ai-contract.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        schemaVersion: '1.0',
        kind: 'playbook-ai-contract',
        ai_runtime: 'playbook-agent',
        workflow: ['index', 'query', 'plan', 'apply', 'verify'],
        intelligence_sources: {
          repoIndex: '.playbook/repo-index.json',
          moduleOwners: '.playbook/module-owners.json'
        },
        queries: ['architecture', 'dependencies', 'impact', 'risk', 'docs-coverage', 'rule-owners', 'module-owners'],
        remediation: {
          canonicalFlow: ['verify', 'plan', 'apply', 'verify'],
          diagnosticAugmentation: ['explain']
        },
        rules: {
          requireIndexBeforeQuery: true,
          preferPlaybookCommandsOverAdHocInspection: true,
          allowDirectEditsWithoutPlan: false
        }
      })
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAiContract(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.source).toBe('file');

    logSpy.mockRestore();
  });

  it('renders text summary', async () => {
    const repo = createRepo('playbook-cli-ai-contract-text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runAiContract(repo, { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((entry) => String(entry[0]))).toContain('AI Repository Contract');
    expect(logSpy.mock.calls.map((entry) => String(entry[0]))).toContain('Runtime');

    logSpy.mockRestore();
  });

  it('fails when file-backed contract schemaVersion is invalid', async () => {
    const repo = createRepo('playbook-cli-ai-contract-invalid');
    const filePath = path.join(repo, '.playbook', 'ai-contract.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ schemaVersion: '2.0' }));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runAiContract(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('playbook ai-contract:');

    errorSpy.mockRestore();
  });

  it('registers ai-contract command metadata', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'ai-contract');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Print deterministic AI repository contract for Playbook-aware agents');
  });
});
