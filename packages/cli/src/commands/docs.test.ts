import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const createFixtureRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-docs-audit-'));
  fs.mkdirSync(path.join(root, 'docs', 'archive'), { recursive: true });

  const files: Record<string, string> = {
    'README.md': '# README\nai-context ai-contract context verify plan apply\n',
    'AGENTS.md': '# AGENTS\n',
    'docs/index.md': '# Docs Index\nai-context ai-contract context verify plan apply\n',
    'docs/ARCHITECTURE.md': '# Architecture\n',
    'docs/commands/README.md': '# Commands\n',
    'docs/commands/docs.md': '# docs audit\n',
    'docs/PLAYBOOK_PRODUCT_ROADMAP.md': '# Strategic Roadmap\n',
    'docs/PLAYBOOK_BUSINESS_STRATEGY.md': '# Business\n',
    'docs/CONSUMER_INTEGRATION_CONTRACT.md': '# Contract\n',
    'docs/AI_AGENT_CONTEXT.md': '# AI Context\nai-context ai-contract context verify plan apply\n',
    'docs/ONBOARDING_DEMO.md': '# Demo\nai-context ai-contract context verify plan apply\n',
    'docs/REFERENCE/cli.md': '# CLI\n',
    'docs/FAQ.md': '# FAQ\nai-context ai-contract context verify plan apply\n',
    'docs/GITHUB_SETUP.md': '# Setup\n',
    'docs/roadmap/README.md': '# Roadmap\n',
    'docs/roadmap/ROADMAP.json': '{}\n',
    'docs/roadmap/IMPROVEMENTS_BACKLOG.md': '# Backlog\n',
    'docs/RELEASING.md': '# Releasing\n',
    'docs/archive/README.md': '# Archive\n',
    'docs/archive/PLAYBOOK_IMPROVEMENTS_2026.md': '# Archived Improvements\n',
    'docs/contracts/command-truth.json': JSON.stringify({
      bootstrapLadder: ['ai-context', 'ai-contract', 'context'],
      remediationLoop: ['verify', 'plan', 'apply', 'verify'],
      canonicalCommands: ['ai-context'],
      compatibilityCommands: ['analyze'],
      utilityCommands: ['demo']
    }, null, 2),
    'packages/cli/README.md': '# Package\nai-context ai-contract context verify plan apply\n'
  };

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }

  return root;
};

describe('runDocs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects missing required anchors', { timeout: 15000 }, async () => {
    const repo = createFixtureRepo();
    fs.rmSync(path.join(repo, 'docs', 'roadmap', 'IMPROVEMENTS_BACKLOG.md'));
    const { runDocs } = await import('./docs.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runDocs(repo, ['audit'], { ci: false, format: 'json', quiet: true });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'docs.required-anchor.missing', path: 'docs/roadmap/IMPROVEMENTS_BACKLOG.md', level: 'error' })
      ])
    );
  });

  it('detects duplicate roadmap files', { timeout: 15000 }, async () => {
    const repo = createFixtureRepo();
    fs.writeFileSync(path.join(repo, 'docs', 'ROADMAP.md'), '# old roadmap\n', 'utf8');
    const { runDocs } = await import('./docs.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDocs(repo, ['audit'], { ci: false, format: 'json', quiet: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'docs.single-roadmap.duplicate', path: 'docs/ROADMAP.md', level: 'error' })
      ])
    );
  });

  it('detects idea leakage in non-planning docs', async () => {
    const repo = createFixtureRepo();
    fs.writeFileSync(path.join(repo, 'docs', 'AI_AGENT_CONTEXT.md'), '# AI Context\n\nUpcoming roadmap priorities for next features.\n', 'utf8');
    const { runDocs } = await import('./docs.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDocs(repo, ['audit'], { ci: false, format: 'json', quiet: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'docs.idea-leakage.detected',
          path: 'docs/AI_AGENT_CONTEXT.md',
          level: 'warning',
          suggestedDestination: 'docs/roadmap/IMPROVEMENTS_BACKLOG.md'
        })
      ])
    );
  });

  it('emits stable JSON envelope', async () => {
    const repo = createFixtureRepo();
    const { runDocs } = await import('./docs.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDocs(repo, ['audit'], { ci: false, format: 'json', quiet: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.command).toBe('docs audit');
    expect(payload.summary).toEqual(expect.objectContaining({ checksRun: 10 }));
    expect(Array.isArray(payload.findings)).toBe(true);
  });

  it('returns policy failure in ci mode when errors are present', async () => {
    const repo = createFixtureRepo();
    fs.rmSync(path.join(repo, 'docs', 'roadmap', 'IMPROVEMENTS_BACKLOG.md'));
    const { runDocs } = await import('./docs.js');

    const exitCode = await runDocs(repo, ['audit'], { ci: true, format: 'json', quiet: true });
    expect(exitCode).toBe(ExitCode.PolicyFailure);
  });
});
