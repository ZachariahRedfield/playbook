import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBootstrapProof } from '../src/index.js';

const mk = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-proof-'));
const write = (root: string, rel: string, contents: string): void => {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
};
const writeJson = (root: string, rel: string, value: unknown): void => write(root, rel, `${JSON.stringify(value, null, 2)}\n`);

const makeInput = (repoRoot: string) => ({
  repoRoot,
  runtime: { available: true, command: 'node --version', version: 'v22.0.0', detail: 'Node runtime resolved.' },
  cliResolution: { resolved: true, command: 'playbook context --json', detail: 'CLI self-check passed.' },
  governanceContract: { passed: true, failures: [], warnings: [] }
});

describe('buildBootstrapProof', () => {
  it('passes for a fully ready governed repo', () => {
    const root = mk();
    writeJson(root, '.playbook/config.json', { version: 1 });
    write(root, 'docs/ARCHITECTURE.md', '# Architecture\n');
    write(root, 'docs/CHANGELOG.md', '# Changelog\n');
    write(root, 'docs/PLAYBOOK_CHECKLIST.md', '# Checklist\n');
    write(root, 'docs/PLAYBOOK_NOTES.md', '# Notes\n\n- entry\n');
    writeJson(root, '.playbook/repo-index.json', { framework: 'node' });
    writeJson(root, '.playbook/repo-graph.json', { edges: [] });
    writeJson(root, '.playbook/plan.json', { command: 'plan' });
    writeJson(root, '.playbook/policy-apply-result.json', { kind: 'policy-apply-result' });
    writeJson(root, '.playbook/last-run.json', { command: 'apply' });

    const proof = buildBootstrapProof(makeInput(root));

    expect(proof.proof_passed).toBe(true);
    expect(proof.failure_category).toBeNull();
    expect(proof.highest_priority_next_action).toBeNull();
  });

  it('fails clearly when docs are missing', () => {
    const root = mk();
    writeJson(root, '.playbook/config.json', { version: 1 });

    const proof = buildBootstrapProof(makeInput(root));

    expect(proof.proof_passed).toBe(false);
    expect(proof.failure_category).toBe('required_docs_missing');
    expect(proof.current_state).toContain('governance_docs');
  });

  it('fails clearly when execution state is missing even if artifacts exist', () => {
    const root = mk();
    writeJson(root, '.playbook/config.json', { version: 1 });
    write(root, 'docs/ARCHITECTURE.md', '# Architecture\n');
    write(root, 'docs/CHANGELOG.md', '# Changelog\n');
    write(root, 'docs/PLAYBOOK_CHECKLIST.md', '# Checklist\n');
    write(root, 'docs/PLAYBOOK_NOTES.md', '# Notes\n\n- entry\n');
    writeJson(root, '.playbook/repo-index.json', { framework: 'node' });
    writeJson(root, '.playbook/repo-graph.json', { edges: [] });
    writeJson(root, '.playbook/plan.json', { command: 'plan' });
    writeJson(root, '.playbook/policy-apply-result.json', { kind: 'policy-apply-result' });

    const proof = buildBootstrapProof(makeInput(root));

    expect(proof.proof_passed).toBe(false);
    expect(proof.failure_category).toBe('execution_state_missing');
    expect(proof.diagnostics.execution_state[0]).toMatchObject({ path: '.playbook/last-run.json', present: false, valid: false });
  });

  it('fails clearly when governance contract fails', () => {
    const root = mk();
    const proof = buildBootstrapProof({
      ...makeInput(root),
      governanceContract: {
        passed: false,
        failures: [{ id: 'notes.missing', message: 'docs/PLAYBOOK_NOTES.md is required.' }],
        warnings: []
      }
    });

    expect(proof.proof_passed).toBe(false);
    expect(proof.failure_category).toBe('repo_not_initialized');
    expect(proof.checks.at(-1)).toMatchObject({
      stage: 'governance_contract',
      status: 'fail',
      category: 'governance_contract_failed'
    });
  });
});
