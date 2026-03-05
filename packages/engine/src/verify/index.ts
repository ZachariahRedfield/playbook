import { loadConfig } from '../config/load.js';
import { getChangedFiles } from '../git/diff.js';
import { resolveDiffBase } from '../git/base.js';
import type { VerifyReport } from '../report/types.js';
import { loadPlugins } from '../plugins/loadPlugins.js';
import {
  getRegisteredRules,
  registerRule,
  resetPluginRegistry
} from '../plugins/pluginRegistry.js';
import type { PlaybookRule } from '../plugins/pluginTypes.js';
import { requireNotesOnChanges } from './rules/requireNotesOnChanges.js';

const coreRules = (config: ReturnType<typeof loadConfig>['config']): PlaybookRule[] => [
  {
    id: 'requireNotesOnChanges',
    run: ({ changedFiles }) => requireNotesOnChanges(changedFiles, config.verify.rules.requireNotesOnChanges)
  }
];

export const verifyRepo = (repoRoot: string): VerifyReport => {
  const warnings: VerifyReport['warnings'] = [];
  const { config, warning: cfgWarning } = loadConfig(repoRoot);
  if (cfgWarning) warnings.push({ id: 'config-missing', message: cfgWarning });

  const base = resolveDiffBase(repoRoot);
  if (base.warning) warnings.push({ id: 'base-selection', message: base.warning });

  const changedFiles = base.baseSha ? getChangedFiles(repoRoot, base.baseSha) : [];

  resetPluginRegistry();
  coreRules(config).forEach(registerRule);
  loadPlugins(repoRoot);

  const failures = getRegisteredRules().flatMap((rule) =>
    rule.run({ repoRoot, changedFiles, config })
  );

  return {
    ok: failures.length === 0,
    summary: {
      failures: failures.length,
      warnings: warnings.length,
      baseRef: base.baseRef,
      baseSha: base.baseSha
    },
    failures,
    warnings
  };
};
