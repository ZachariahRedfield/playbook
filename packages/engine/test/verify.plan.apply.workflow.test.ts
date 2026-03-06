import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyExecutionPlan, generateExecutionPlan, generatePlanContract, verifyRepo } from '../src/index.js';

describe('verify -> plan -> apply -> verify workflow', () => {

  it('returns verify findings and plan tasks as an engine-backed contract', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-contract-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'PROJECT_GOVERNANCE.md'), '# Governance\n');

    const contract = generatePlanContract(root);

    expect(contract.verify.ok).toBe(false);
    expect(contract.verify.summary.failures).toBe(1);
    expect(contract.verify.failures.map((failure) => failure.id)).toEqual(['notes.missing']);
    expect(contract.tasks).toEqual([
      {
        ruleId: 'notes.missing',
        file: null,
        action: 'docs/PLAYBOOK_NOTES.md is required when docs/PROJECT_GOVERNANCE.md exists.',
        autoFix: false
      }
    ]);
  });
  it('resolves notes.missing with a fix handler', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'PROJECT_GOVERNANCE.md'), '# Governance\n');

    const initialVerify = verifyRepo(root);
    expect(initialVerify.ok).toBe(false);
    expect(initialVerify.failures.map((failure) => failure.id)).toContain('notes.missing');

    const plan = generateExecutionPlan(root);
    expect(plan.tasks.map((task) => task.ruleId)).toContain('notes.missing');

    const execution = await applyExecutionPlan(
      root,
      plan.tasks,
      {
        'notes.missing': async ({ repoRoot, dryRun }) => {
          if (!dryRun) {
            fs.writeFileSync(path.join(repoRoot, 'docs', 'PLAYBOOK_NOTES.md'), '# Playbook Notes\n\n- added\n');
          }
          return {
            filesChanged: ['docs/PLAYBOOK_NOTES.md'],
            summary: 'Created notes file'
          };
        }
      },
      { dryRun: false }
    );

    expect(execution.applied.map((item) => item.ruleId)).toContain('notes.missing');

    const finalVerify = verifyRepo(root);
    expect(finalVerify.ok).toBe(true);
  });

  it('includes plugin findings in generated plan tasks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-plugin-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture' }));
    fs.writeFileSync(
      path.join(root, 'playbook.config.json'),
      JSON.stringify({ version: 1, plugins: ['test-plugin'] })
    );

    const pluginDir = path.join(root, 'node_modules', 'test-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'index.js'),
      `module.exports = {
        name: 'test-plugin',
        rules: [{
          id: 'plugin-rule',
          description: 'plugin rule',
          check: () => ({ failures: [{ id: 'plugin.failure', message: 'plugin finding', evidence: 'docs/PLUGIN.md' }] })
        }]
      };`
    );

    const plan = generateExecutionPlan(root);
    expect(plan.tasks).toEqual([
      {
        ruleId: 'plugin.failure',
        file: 'docs/PLUGIN.md',
        action: 'plugin finding',
        autoFix: false
      }
    ]);
  });
});
