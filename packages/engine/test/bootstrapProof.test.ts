import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runBootstrapProof } from '../src/adoption/bootstrapProof.js';

const repos: string[] = [];

const createRepo = (): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-bootstrap-proof-'));
  repos.push(repo);
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'bootstrap-proof-fixture', private: true }, null, 2));
  return repo;
};

const writeJson = (repo: string, relativePath: string, value: unknown): void => {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2));
};

const writeReadyRepo = (repo: string): void => {
  fs.writeFileSync(path.join(repo, 'playbook.config.json'), JSON.stringify({ version: 1 }, null, 2));
  fs.writeFileSync(path.join(repo, 'docs', 'ARCHITECTURE.md'), '# Architecture\n');
  fs.writeFileSync(path.join(repo, 'docs', 'CHANGELOG.md'), '# Changelog\n');
  fs.writeFileSync(path.join(repo, 'docs', 'PLAYBOOK_CHECKLIST.md'), '# Checklist\n');
  fs.writeFileSync(path.join(repo, 'docs', 'PLAYBOOK_NOTES.md'), '# Playbook Notes\n\n- Ready fixture.\n');
  writeJson(repo, '.playbook/repo-index.json', { framework: 'node', modules: [] });
  writeJson(repo, '.playbook/repo-graph.json', { edges: [] });
  writeJson(repo, '.playbook/plan.json', { command: 'plan', tasks: [] });
  writeJson(repo, '.playbook/policy-apply-result.json', { ok: true });
};

afterEach(() => {
  while (repos.length > 0) {
    fs.rmSync(repos.pop() as string, { recursive: true, force: true });
  }
});

describe('runBootstrapProof', () => {
  it('passes for a fully ready governed consumer repo', () => {
    const repo = createRepo();
    writeReadyRepo(repo);

    const result = runBootstrapProof(repo, {
      runCommand: () => ({ ok: true, status: 0, stdout: '0.1.2\n', stderr: '' })
    });

    expect(result.ok).toBe(true);
    expect(result.current_state).toBe('governed_consumer_ready');
    expect(result.diagnostics.failing_stage).toBeNull();
  });

  it('classifies missing bootstrap docs as docs_blocked', () => {
    const repo = createRepo();
    writeReadyRepo(repo);
    fs.rmSync(path.join(repo, 'docs', 'ARCHITECTURE.md'));

    const result = runBootstrapProof(repo, {
      runCommand: () => ({ ok: true, status: 0, stdout: '0.1.2\n', stderr: '' })
    });

    expect(result.ok).toBe(false);
    expect(result.current_state).toBe('docs_blocked');
    expect(result.diagnostics.failing_stage).toBe('docs');
    expect(result.diagnostics.failing_category).toBe('required_docs_missing');
  });

  it('classifies missing execution state clearly', () => {
    const repo = createRepo();
    writeReadyRepo(repo);
    fs.rmSync(path.join(repo, '.playbook', 'policy-apply-result.json'));

    const result = runBootstrapProof(repo, {
      runCommand: () => ({ ok: true, status: 0, stdout: '0.1.2\n', stderr: '' })
    });

    expect(result.ok).toBe(false);
    expect(result.current_state).toBe('execution_state_blocked');
    expect(result.diagnostics.failing_stage).toBe('execution-state');
    expect(result.diagnostics.failing_category).toBe('execution_state_missing');
    expect(result.highest_priority_next_action).toContain('pnpm playbook apply --json');
  });


  it('continues to repo blockers when an injected canonical CLI resolver succeeds', () => {
    const repo = createRepo();
    writeReadyRepo(repo);
    fs.rmSync(path.join(repo, '.playbook', 'policy-apply-result.json'));

    const result = runBootstrapProof(repo, {
      cliResolutionCommands: [
        { label: 'current Playbook CLI --version', command: process.execPath, args: ['fake-cli.js', '--version'] },
        { label: 'pnpm exec playbook --version', command: 'pnpm', args: ['exec', 'playbook', '--version'] },
        { label: 'pnpm playbook --version', command: 'pnpm', args: ['playbook', '--version'] }
      ],
      runCommand: (command, args) => {
        if (command === process.execPath && args[0] === 'fake-cli.js') {
          return { ok: true, status: 0, stdout: '0.1.2\n', stderr: '' };
        }
        if (command === 'pnpm' && (args[0] === 'exec' || args[0] === 'playbook')) {
          return { ok: false, status: 1, stdout: '', stderr: 'Command "playbook" not found' };
        }
        return { ok: true, status: 0, stdout: '0.1.2\n', stderr: '' };
      }
    });

    expect(result.ok).toBe(false);
    expect(result.current_state).toBe('execution_state_blocked');
    expect(result.diagnostics.failing_stage).toBe('execution-state');
  });

  it('accepts pnpm playbook fallback when pnpm exec playbook fails', () => {
    const repo = createRepo();
    writeReadyRepo(repo);

    const result = runBootstrapProof(repo, {
      runCommand: (command, args) => {
        if (command === 'pnpm' && args[0] === 'exec') {
          return { ok: false, status: 1, stdout: '', stderr: 'Command "playbook" not found' };
        }
        return { ok: true, status: 0, stdout: '0.1.2\n', stderr: '' };
      }
    });

    expect(result.ok).toBe(true);
    expect(result.current_state).toBe('governed_consumer_ready');
    expect(result.diagnostics.failing_stage).toBeNull();
  });

  it('classifies definitive cli resolution failure before repo checks', () => {
    const repo = createRepo();
    writeReadyRepo(repo);

    const result = runBootstrapProof(repo, {
      runCommand: (command, args) => {
        if (command === 'pnpm' && (args[0] === 'exec' || args[0] === 'playbook')) {
          return { ok: false, status: 1, stdout: '', stderr: 'Command "playbook" not found' };
        }
        return { ok: true, status: 0, stdout: '0.1.2\n', stderr: '' };
      }
    });

    expect(result.ok).toBe(false);
    expect(result.current_state).toBe('cli_blocked');
    expect(result.diagnostics.failing_stage).toBe('cli');
    expect(result.diagnostics.failing_category).toBe('binary_resolution_failed');
  });
});
