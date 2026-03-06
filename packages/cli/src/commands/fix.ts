import { applyExecutionPlan, generateExecutionPlan } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { collectVerifyReport } from './verify.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';

type FixOptions = {
  dryRun: boolean;
  yes: boolean;
  only?: string;
  format: 'text' | 'json';
  ci: boolean;
  quiet: boolean;
  explain: boolean;
};

type AppliedFix = {
  findingId: string;
  filesChanged: string[];
  summary: string;
};

type SkippedFix = {
  findingId: string;
  reason: string;
};

type FixJsonResult = {
  schemaVersion: '1.0';
  command: 'fix';
  ok: boolean;
  exitCode: number;
  dryRun: boolean;
  applied: AppliedFix[];
  skipped: SkippedFix[];
  reverify?: {
    ok: boolean;
    failures: number;
    warnings: number;
    exitCode: number;
  };
  summary: string;
};

const parseOnlyFilter = (only: string | undefined): Set<string> | undefined => {
  if (!only) {
    return undefined;
  }

  const ids = only
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return ids.length > 0 ? new Set(ids) : undefined;
};

const outputText = (
  options: FixOptions,
  applied: AppliedFix[],
  skipped: SkippedFix[],
  reverify: FixJsonResult['reverify']
): void => {
  if (options.quiet && applied.length === 0 && skipped.length === 0 && (!reverify || reverify.ok)) {
    return;
  }

  console.log(options.dryRun ? 'Planned fixes:' : 'Applied fixes:');
  if (applied.length === 0) {
    console.log('  (none)');
  } else {
    for (const fix of applied) {
      const mode = options.dryRun ? 'would apply' : 'applied';
      console.log(`  - ${fix.findingId}: ${mode}; ${fix.summary}`);
      if (options.explain) {
        for (const file of fix.filesChanged) {
          console.log(`    file: ${file}`);
        }
      }
    }
  }

  console.log('Skipped findings:');
  if (skipped.length === 0) {
    console.log('  (none)');
  } else {
    for (const entry of skipped) {
      console.log(`  - ${entry.findingId}: ${entry.reason}`);
    }
  }

  if (reverify) {
    console.log('Re-verify:');
    console.log(`  - ok: ${reverify.ok}`);
    console.log(`  - failures: ${reverify.failures}`);
    console.log(`  - warnings: ${reverify.warnings}`);
    console.log(`  - exitCode: ${reverify.exitCode}`);
  }
};

const outputJson = (result: FixJsonResult): void => {
  console.log(JSON.stringify(result, null, 2));
};

export const runFix = async (cwd: string, options: FixOptions): Promise<number> => {
  try {
    const verifyRules = await loadVerifyRules(cwd);
    const onlyFilter = parseOnlyFilter(options.only);
    const generatedPlan = generateExecutionPlan(cwd);

    const tasks = generatedPlan.tasks.filter((task: { ruleId: string }) => {
      if (!onlyFilter) {
        return true;
      }
      return onlyFilter.has(task.ruleId);
    });

    const handlers = Object.fromEntries(
      tasks.map((task: { ruleId: string }) => {
        const pluginRule = verifyRules.find((rule) => rule.id === task.ruleId);
        return [task.ruleId, pluginRule?.fix];
      })
    );

    const applied: AppliedFix[] = [];
    const skipped: SkippedFix[] = [];

    if (!options.dryRun && !options.yes && !options.ci && tasks.length > 0) {
      const reason = 'Interactive prompts are not available; re-run with --yes to apply fixes.';
      const fullSkipped = skipped.concat(tasks.map((entry: { ruleId: string }) => ({ findingId: entry.ruleId, reason })));
      const result: FixJsonResult = {
        schemaVersion: '1.0',
        command: 'fix',
        ok: false,
        exitCode: ExitCode.Failure,
        dryRun: options.dryRun,
        applied: [],
        skipped: fullSkipped,
        summary: reason
      };

      if (options.format === 'json') {
        outputJson(result);
      } else {
        outputText(options, [], fullSkipped, undefined);
        console.log(reason);
      }
      return ExitCode.Failure;
    }

    const execution = await applyExecutionPlan(cwd, tasks, { dryRun: options.dryRun, handlers });

    for (const resultItem of execution.results) {
      if (resultItem.status === 'applied') {
        applied.push({
          findingId: resultItem.ruleId,
          filesChanged: resultItem.file ? [resultItem.file] : [],
          summary: resultItem.action
        });
        continue;
      }

      skipped.push({
        findingId: resultItem.ruleId,
        reason: resultItem.message ?? `Task ${resultItem.status}.`
      });
    }

    const reverify = options.dryRun
      ? undefined
      : await collectVerifyReport(cwd).then((report) => ({
          ok: report.ok,
          failures: report.failures.length,
          warnings: report.warnings.length,
          exitCode: report.ok ? ExitCode.Success : ExitCode.PolicyFailure
        }));

    const exitCode = options.dryRun ? ExitCode.Success : (reverify?.exitCode ?? ExitCode.Success);

    const result: FixJsonResult = {
      schemaVersion: '1.0',
      command: 'fix',
      ok: exitCode === ExitCode.Success,
      exitCode,
      dryRun: options.dryRun,
      applied,
      skipped,
      reverify,
      summary: options.dryRun ? 'Dry-run completed.' : 'Fix command completed.'
    };

    if (options.format === 'json') {
      outputJson(result);
    } else {
      outputText(options, applied, skipped, reverify);
    }

    return exitCode;
  } catch (error) {
    if (options.format === 'json') {
      outputJson({
        schemaVersion: '1.0',
        command: 'fix',
        ok: false,
        exitCode: ExitCode.Failure,
        dryRun: options.dryRun,
        applied: [],
        skipped: [],
        summary: String(error)
      });
    } else {
      console.error('playbook fix failed with an internal error.');
      console.error(String(error));
    }
    return ExitCode.Failure;
  }
};
