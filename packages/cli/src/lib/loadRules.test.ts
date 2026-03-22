import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAnalyzeRules } from './loadAnalyzeRules.js';
import { loadVerifyRules } from './loadVerifyRules.js';

describe('rule loaders', () => {
  it('loads verify rules with unique ids', async () => {
    const rules = await loadVerifyRules(process.cwd());
    const ids = rules.map((rule) => rule.id);

    expect(ids).toEqual(['notes.missing', 'notes.empty', 'requireNotesOnChanges', 'verify.rule.tests.required', 'protected-doc.governance']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('loads analyze rules with unique ids', async () => {
    const rules = await loadAnalyzeRules();
    const ids = rules.map((rule) => rule.id);

    expect(ids).toEqual(['analyze-no-signals', 'analyze-run-init', 'analyze-run-verify']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('loads plugin verify rules from playbook-plugin-* dependencies', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cli-plugin-test-'));
    fs.mkdirSync(path.join(root, 'node_modules', 'playbook-plugin-mock'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        dependencies: {
          'playbook-plugin-mock': '1.0.0'
        }
      })
    );
    fs.writeFileSync(
      path.join(root, 'node_modules', 'playbook-plugin-mock', 'index.js'),
      `module.exports = {
        rules: [{
          id: 'plugin-rule',
          description: 'Plugin-provided verify rule',
          verify: ({ failure }) => failure.id === 'plugin.failure'
        }]
      };`
    );

    const rules = await loadVerifyRules(root);
    expect(rules.map((rule) => rule.id)).toContain('plugin-rule');
  });
});
