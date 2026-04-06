import { collectScmContext } from '@zachariahredfield/playbook-core';
import { loadConfig } from '../config/load.js';
import { getChangedFiles } from '../git/diff.js';
import type { VerifyReport } from '../report/types.js';
import { loadPlugins } from '../plugins/loadPlugins.js';
import { getRegisteredRules, registerRule, resetPluginRegistry } from '../plugins/pluginRegistry.js';
import { getCoreRules } from '../rules/coreRules.js';
import { RuleRunner } from '../execution/ruleRunner.js';
import { compactPatterns } from '../compaction/compactPatterns.js';
import { buildVerifyMemoryEvent, captureMemoryRuntimeEventSafe } from '../memory/runtimeEvents.js';

export const VERIFY_PHASE_RULES = {
  preflight: ['release.version-governance']
} as const;

export type VerifyPhase = keyof typeof VERIFY_PHASE_RULES;

export type VerifyRepoOptions = {
  phase?: VerifyPhase;
  ruleIds?: string[];
};

const filterRulesForExecution = <T extends { id: string }>(rules: T[], options: VerifyRepoOptions): T[] => {
  const phaseRuleIds = options.phase ? VERIFY_PHASE_RULES[options.phase] : undefined;
  const requestedRuleIds = options.ruleIds?.filter((ruleId) => ruleId.trim().length > 0);
  const selectedRuleIds = requestedRuleIds && requestedRuleIds.length > 0
    ? new Set(phaseRuleIds ? requestedRuleIds.filter((ruleId) => phaseRuleIds.includes(ruleId as (typeof phaseRuleIds)[number])) : requestedRuleIds)
    : (phaseRuleIds ? new Set(phaseRuleIds) : null);

  if (!selectedRuleIds) {
    return rules;
  }

  return rules.filter((rule) => selectedRuleIds.has(rule.id));
};

export const verifyRepo = (repoRoot: string, options: VerifyRepoOptions = {}): VerifyReport => {
  const warnings: VerifyReport['warnings'] = [];
  const { config, warning: cfgWarning } = loadConfig(repoRoot);
  if (cfgWarning) warnings.push({ id: 'config-missing', message: cfgWarning });

  const scmContext = collectScmContext(repoRoot);
  if (scmContext.diffBase.warning) warnings.push({ id: 'base-selection', message: scmContext.diffBase.warning });

  const changedFiles = scmContext.diffBase.baseSha ? getChangedFiles(repoRoot, scmContext.diffBase.baseSha) : [];

  resetPluginRegistry();
  getCoreRules(config).forEach(registerRule);
  loadPlugins(repoRoot);

  const runner = new RuleRunner(filterRulesForExecution(getRegisteredRules(), options));
  const { failures } = runner.run({
    repoRoot,
    changedFiles,
    baseRef: scmContext.diffBase.baseRef,
    baseSha: scmContext.diffBase.baseSha
  });

  const report: VerifyReport = {
    ok: failures.length === 0,
    summary: {
      failures: failures.length,
      warnings: warnings.length,
      baseRef: scmContext.diffBase.baseRef,
      baseSha: scmContext.diffBase.baseSha,
      phase: options.phase,
      ruleIds: options.ruleIds
    },
    failures,
    warnings
  };

  try {
    compactPatterns(repoRoot, report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.warnings.push({ id: 'pattern-compaction', message: `Pattern compaction skipped: ${message}` });
    report.summary.warnings = report.warnings.length;
  }

  captureMemoryRuntimeEventSafe(
    repoRoot,
    buildVerifyMemoryEvent({
      repoId: repoRoot,
      report
    })
  );

  return report;
};
