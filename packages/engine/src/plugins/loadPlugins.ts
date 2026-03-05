import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { registerPlugin } from './pluginRegistry.js';
import type { PlaybookPlugin } from './pluginTypes.js';

type PluginConfig = {
  plugins?: string[];
};

export const loadPlugins = (repoRoot: string): void => {
  const configPath = path.join(repoRoot, 'playbook.config.json');
  if (!fs.existsSync(configPath)) return;

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as PluginConfig;
  const plugins = Array.isArray(parsed.plugins) ? parsed.plugins : [];
  if (!plugins.length) return;

  const requireFromRepo = createRequire(path.join(repoRoot, 'package.json'));

  for (const pluginName of plugins) {
    const loaded = requireFromRepo(pluginName) as PlaybookPlugin | { default?: PlaybookPlugin };
    const plugin = ('name' in loaded ? loaded : loaded.default) as PlaybookPlugin | undefined;
    if (!plugin) continue;
    registerPlugin(plugin);
  }
};
