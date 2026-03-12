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
        id: expect.any(String),
        ruleId: 'notes.missing',
        file: null,
        action: 'create playbook notes file',
        autoFix: true
      }
    ]);
  });

  it('resolves notes.missing with engine default handlers', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'PROJECT_GOVERNANCE.md'), '# Governance\n');

    const initialVerify = verifyRepo(root);
    expect(initialVerify.ok).toBe(false);
    expect(initialVerify.failures.map((failure) => failure.id)).toContain('notes.missing');

    const plan = generateExecutionPlan(root);
    expect(plan.tasks.map((task) => task.ruleId)).toContain('notes.missing');

    const execution = await applyExecutionPlan(root, plan.tasks, { dryRun: false });

    expect(execution.summary.applied).toBe(1);
    expect(execution.summary.failed).toBe(0);

    const finalVerify = verifyRepo(root);
    expect(finalVerify.ok).toBe(true);
  });



  it('generates deterministic pattern compaction artifact during verify', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-patterns-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'PROJECT_GOVERNANCE.md'), '# Governance\n');

    const report = verifyRepo(root);
    expect(report.ok).toBe(false);

    const patternsPath = path.join(root, '.playbook', 'patterns.json');
    expect(fs.existsSync(patternsPath)).toBe(true);

    const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8')) as {
      command: string;
      patterns: Array<{ id: string }>;
    };
    expect(patterns.command).toBe('pattern-compaction');
    expect(patterns.patterns.length).toBeGreaterThan(0);
  });
  it('supports plugin-derived auto-fixable tasks when handler is provided', async () => {
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
          check: () => ({ failures: [{ id: 'plugin.failure', message: 'plugin finding', evidence: 'docs/PLUGIN.md', fix: 'create plugin doc' }] })
        }]
      };`
    );

    const plan = generateExecutionPlan(root);
    expect(plan.tasks).toEqual([
      {
        id: expect.any(String),
        ruleId: 'plugin.failure',
        file: 'docs/PLUGIN.md',
        action: 'create plugin doc',
        autoFix: true
      }
    ]);

    const execution = await applyExecutionPlan(root, plan.tasks, {
      dryRun: false,
      handlers: {
        'plugin.failure': async ({ repoRoot }) => {
          fs.mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
          fs.writeFileSync(path.join(repoRoot, 'docs', 'PLUGIN.md'), '# Plugin\n');
          return { status: 'applied', filesChanged: ['docs/PLUGIN.md'], summary: 'Created plugin doc.' };
        }
      }
    });

    expect(execution.summary.applied).toBe(1);
    expect(fs.existsSync(path.join(root, 'docs', 'PLUGIN.md'))).toBe(true);
  });

  it('returns no-op result for empty plans', async () => {
    const execution = await applyExecutionPlan('.', [], { dryRun: false });
    expect(execution.results).toEqual([]);
    expect(execution.summary).toEqual({ applied: 0, skipped: 0, unsupported: 0, failed: 0 });
  });

  it('keeps built-in handlers when plugin handler map includes undefined', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-workflow-undefined-handler-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'PROJECT_GOVERNANCE.md'), '# Governance\n');

    const plan = generateExecutionPlan(root);
    const execution = await applyExecutionPlan(root, plan.tasks, {
      dryRun: false,
      handlers: {
        'notes.missing': undefined
      }
    });

    expect(execution.summary).toEqual({ applied: 1, skipped: 0, unsupported: 0, failed: 0 });
    expect(fs.existsSync(path.join(root, 'docs', 'PLAYBOOK_NOTES.md'))).toBe(true);
  });
});
