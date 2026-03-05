import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPlugins } from '../src/plugins/loadPlugins.js';
import {
  getRegisteredDetectors,
  getRegisteredRules,
  resetPluginRegistry
} from '../src/plugins/pluginRegistry.js';

describe('plugin loader', () => {
  it('loads plugin rules and detectors from node_modules', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-plugin-test-'));
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture"}');
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
        rules: [{ id: 'plugin-rule', run: () => [] }],
        detectors: [{
          id: 'plugin-detector',
          label: 'Plugin Detector',
          detect: () => ({ confidence: 1, evidence: ['plugin'] })
        }]
      };`
    );

    resetPluginRegistry();
    loadPlugins(root);

    expect(getRegisteredRules().map((rule) => rule.id)).toContain('plugin-rule');
    expect(getRegisteredDetectors().map((detector) => detector.id)).toContain('plugin-detector');
  });
});
