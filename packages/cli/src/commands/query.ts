import {
  queryDependencies,
  queryImpact,
  queryRisk,
  queryDocsCoverage,
  queryRepositoryIndex,
  queryRuleOwners,
  queryModuleOwners,
  queryTestHotspots,
  queryPatterns,
  listExecutionRuns,
  readExecutionRun,
  SUPPORTED_QUERY_FIELDS,
  type DependenciesQueryResult,
  type ImpactQueryResult,
  type RiskQueryResult,
  type DocsCoverageQueryResult,
  type DocsCoverageModuleResult,
  type RepositoryModule,
  type RepositoryQueryField,
  type RuleOwnersQueryResult,
  type ModuleOwnersQueryResult,
  type TestHotspotsQueryResult,
  type GraphNeighborhoodSummary
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';

type QueryOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

type QueryResult = {
  command: 'query';
  field: RepositoryQueryField;
  result: string | string[] | RepositoryModule[] | Array<Record<string, unknown>>;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

const firstPositionalArg = (args: string[]): string | undefined => args.find((arg) => !arg.startsWith('-'));

const printText = (field: RepositoryQueryField, result: string | string[] | RepositoryModule[] | Array<Record<string, unknown>>): void => {
  const heading = field.charAt(0).toUpperCase() + field.slice(1);
  console.log(heading);
  console.log('───────');

  if (Array.isArray(result)) {
    if (result.length === 0) {
      console.log('none');
      return;
    }

    const firstValue = result[0];
    if (typeof firstValue === 'object' && firstValue !== null && 'name' in firstValue && 'dependencies' in firstValue) {
      for (const moduleEntry of result as RepositoryModule[]) {
        console.log(`${moduleEntry.name}: ${moduleEntry.dependencies.length > 0 ? moduleEntry.dependencies.join(', ') : 'none'}`);
      }
      return;
    }

    if (typeof firstValue === 'string') {
      for (const value of result as string[]) {
        console.log(value);
      }
      return;
    }

    for (const value of result as Array<Record<string, unknown>>) {
      console.log(JSON.stringify(value));
    }
    return;
  }

  console.log(result);
};

const printDependenciesText = (payload: DependenciesQueryResult): void => {
  console.log('Dependencies');
  console.log('────────────');

  if (payload.module) {
    const values = payload.dependencies as string[];
    console.log(`${payload.module}: ${values.length > 0 ? values.join(', ') : 'none'}`);
    return;
  }

  const graph = payload.dependencies as RepositoryModule[];
  if (graph.length === 0) {
    console.log('none');
    return;
  }

  for (const moduleEntry of graph) {
    console.log(`${moduleEntry.name}: ${moduleEntry.dependencies.length > 0 ? moduleEntry.dependencies.join(', ') : 'none'}`);
  }
};

const printImpactText = (payload: ImpactQueryResult): void => {
  console.log('Impact Analysis');
  console.log('───────────────');
  console.log('');
  console.log(`Target module: ${payload.module.name}`);
  console.log(`Module path: ${payload.module.path}`);
  console.log('');
  console.log(`Dependencies: ${payload.impact.dependencies.length > 0 ? payload.impact.dependencies.join(', ') : 'none'}`);
  console.log(
    `Direct dependents: ${payload.impact.directDependents.length > 0 ? payload.impact.directDependents.join(', ') : 'none'}`
  );
  console.log(
    `Transitive dependents: ${payload.impact.dependents.length > 0 ? payload.impact.dependents.join(', ') : 'none'}`
  );
  console.log(`Risk: ${payload.impact.risk.level} (${payload.impact.risk.score.toFixed(2)})`);
};

const printDocsCoverageText = (payload: DocsCoverageQueryResult): void => {
  console.log('Documentation Coverage');
  console.log('──────────────────────');
  console.log('');
  console.log('Documented modules');

  const documented = payload.modules.filter((entry: DocsCoverageModuleResult) => entry.documented);
  if (documented.length === 0) {
    console.log('  none');
  } else {
    for (const moduleEntry of documented) {
      console.log(`  ${moduleEntry.module}`);
    }
  }

  console.log('');
  console.log('Undocumented modules');

  const undocumented = payload.modules.filter((entry: DocsCoverageModuleResult) => !entry.documented);
  if (undocumented.length === 0) {
    console.log('  none');
  } else {
    for (const moduleEntry of undocumented) {
      console.log(`  ${moduleEntry.module}`);
    }
  }

  console.log('');
  console.log('Summary');
  console.log(`  ${payload.summary.documentedModules} / ${payload.summary.totalModules} modules documented`);
};


const printRuleOwnersText = (payload: RuleOwnersQueryResult): void => {
  if ('rule' in payload) {
    const entry = payload.rule;
    console.log('Rule Ownership');
    console.log('──────────────');
    console.log('');
    console.log(`Rule: ${entry.ruleId}`);
    console.log(`Area: ${entry.area}`);
    console.log(`Owners: ${entry.owners.join(', ')}`);
    console.log(`Remediation type: ${entry.remediationType}`);
    return;
  }

  console.log('Rule Owners');
  console.log('───────────');

  if (payload.rules.length === 0) {
    console.log('none');
    return;
  }

  for (const entry of payload.rules) {
    console.log('');
    console.log(entry.ruleId);
    console.log(`  Area: ${entry.area}`);
    console.log(`  Owners: ${entry.owners.join(', ')}`);
    console.log(`  Remediation type: ${entry.remediationType}`);
  }
};


const printModuleOwnersText = (payload: ModuleOwnersQueryResult): void => {
  if ('module' in payload) {
    const entry = payload.module;
    console.log('Module Ownership');
    console.log('────────────────');
    console.log('');
    console.log(`Module: ${entry.name}`);
    console.log(`Owners: ${entry.owners.length > 0 ? entry.owners.join(', ') : 'none'}`);
    console.log(`Area: ${entry.area}`);
    console.log(`Ownership status: ${entry.ownership.status}`);
    console.log(`Ownership source: ${entry.ownership.source}`);
    if (entry.ownership.sourceLocation) {
      console.log(`Ownership source location: ${entry.ownership.sourceLocation}`);
    }
    return;
  }

  console.log('Module Owners');
  console.log('─────────────');

  if (payload.modules.length === 0) {
    console.log('none');
    return;
  }

  for (const entry of payload.modules) {
    console.log('');
    console.log(entry.name);
    console.log(`  Owners: ${entry.owners.length > 0 ? entry.owners.join(', ') : 'none'}`);
    console.log(`  Area: ${entry.area}`);
    console.log(`  Ownership status: ${entry.ownership.status}`);
    console.log(`  Ownership source: ${entry.ownership.source}`);
    if (entry.ownership.sourceLocation) {
      console.log(`  Ownership source location: ${entry.ownership.sourceLocation}`);
    }
  }

  if (payload.diagnostics.length > 0) {
    console.log('');
    console.log('Diagnostics');
    for (const diagnostic of payload.diagnostics) {
      console.log(`  - ${diagnostic}`);
    }
  }
};


const printTestHotspotsText = (payload: TestHotspotsQueryResult): void => {
  console.log('Test Hotspots');
  console.log('─────────────');

  if (payload.hotspots.length === 0) {
    console.log('none');
    return;
  }

  for (const hotspot of payload.hotspots) {
    console.log('');
    console.log(`${hotspot.file}:${hotspot.line}`);
    console.log(`  Type: ${hotspot.type}`);
    console.log(`  Confidence: ${hotspot.confidence}`);
    console.log(`  Current pattern: ${hotspot.currentPattern}`);
    console.log(`  Suggested helper: ${hotspot.suggestedReplacementHelper}`);
    console.log(`  Automation safety: ${hotspot.automationSafety}`);
  }

  console.log('');
  console.log('Summary');
  console.log(`  Total hotspots: ${payload.summary.totalHotspots}`);
  for (const entry of payload.summary.byType) {
    console.log(`  ${entry.type}: ${entry.count}`);
  }
};

const printRiskText = (payload: RiskQueryResult): void => {
  console.log('Risk Analysis');
  console.log('─────────────');
  console.log('');
  console.log(`Module: ${payload.module}`);
  console.log(`Risk score: ${payload.riskScore.toFixed(2)}`);
  console.log(`Risk level: ${payload.riskLevel}`);
  console.log('');
  console.log('Signals');
  console.log(`  Direct dependencies: ${payload.signals.directDependencies}`);
  console.log(`  Dependents: ${payload.signals.dependents}`);
  console.log(`  Transitive impact: ${payload.signals.transitiveImpact}`);
  console.log(`  Verify failures: ${payload.signals.verifyFailures}`);
  console.log(`  Architectural hub: ${payload.signals.isArchitecturalHub ? 'yes' : 'no'}`);
  console.log('');
  console.log('Reasons');

  for (const reason of payload.reasons) {
    console.log(`  - ${reason}`);
  }

  if (payload.warnings && payload.warnings.length > 0) {
    console.log('');
    console.log('Warnings');
    for (const warning of payload.warnings) {
      console.log(`  - ${warning}`);
    }
  }
};

export const runQuery = async (cwd: string, commandArgs: string[], options: QueryOptions): Promise<number> => {
  const fieldArg = firstPositionalArg(commandArgs);
  if (!fieldArg) {
    console.error('playbook query: missing required <field> argument');
    return ExitCode.Failure;
  }

  if (fieldArg === 'dependencies') {
    const moduleArg = commandArgs.find((arg, index) => index > commandArgs.indexOf(fieldArg) && !arg.startsWith('-'));

    try {
      const payload = queryDependencies(cwd, moduleArg);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printDependenciesText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'dependencies',
              module: moduleArg ?? null,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }

  if (fieldArg === 'impact') {
    const moduleArg = commandArgs.find((arg, index) => index > commandArgs.indexOf(fieldArg) && !arg.startsWith('-'));

    if (!moduleArg) {
      const message = 'playbook query impact: missing required <module> argument';
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              query: 'impact',
              target: null,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }

    try {
      const payload = queryImpact(cwd, moduleArg);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printImpactText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              query: 'impact',
              target: moduleArg,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }

  if (fieldArg === 'docs-coverage') {
    const moduleArg = commandArgs.find((arg, index) => index > commandArgs.indexOf(fieldArg) && !arg.startsWith('-'));

    try {
      const payload = queryDocsCoverage(cwd, moduleArg);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printDocsCoverageText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'docs-coverage',
              module: moduleArg ?? null,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }


  if (fieldArg === 'rule-owners') {
    const ruleIdArg = commandArgs.find((arg, index) => index > commandArgs.indexOf(fieldArg) && !arg.startsWith('-'));

    try {
      const payload = queryRuleOwners(ruleIdArg);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printRuleOwnersText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'rule-owners',
              ruleId: ruleIdArg ?? null,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }


  if (fieldArg === 'module-owners') {
    const moduleArg = commandArgs.find((arg, index) => index > commandArgs.indexOf(fieldArg) && !arg.startsWith('-'));

    try {
      const payload = queryModuleOwners(cwd, moduleArg);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printModuleOwnersText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'module-owners',
              module: moduleArg ?? null,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }


  if (fieldArg === 'test-hotspots') {
    try {
      const payload = queryTestHotspots(cwd);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printTestHotspotsText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'test-hotspots',
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }


  if (fieldArg === 'patterns') {
    try {
      const payload = queryPatterns(cwd);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        console.log('Patterns');
        console.log('────────');
        if (payload.patterns.length === 0) {
          console.log('none');
        } else {
          for (const pattern of payload.patterns) {
            console.log(`${pattern.id} (${pattern.bucket}) x${pattern.occurrences}`);
          }
        }
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'patterns',
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }


  if (fieldArg === 'runs') {
    try {
      const payload = { schemaVersion: '1.0', command: 'query', type: 'runs', runs: listExecutionRuns(cwd) };
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        console.log('Execution Runs');
        console.log('──────────────');
        if (payload.runs.length === 0) {
          console.log('none');
        } else {
          for (const run of payload.runs) {
            console.log(`${run.id} ${run.frozen ? 'frozen' : 'open'} steps=${run.steps.length}`);
          }
        }
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: { schemaVersion: '1.0', command: 'query', type: 'runs', error: message }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }

  if (fieldArg === 'run') {
    const idFlagIndex = commandArgs.indexOf('--id');
    const runId = idFlagIndex >= 0 ? commandArgs[idFlagIndex + 1] : undefined;

    if (!runId) {
      const message = 'playbook query run: missing required --id <run-id> argument';
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: { schemaVersion: '1.0', command: 'query', type: 'run', error: message }, outFile: options.outFile });
      } else {
        console.error(message);
      }
      return ExitCode.Failure;
    }

    try {
      const payload = { schemaVersion: '1.0', command: 'query', type: 'run', run: readExecutionRun(cwd, runId) };
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        console.log('Execution Run');
        console.log('────────────');
        console.log(`id: ${payload.run.id}`);
        console.log(`frozen: ${payload.run.frozen}`);
        console.log(`steps: ${payload.run.steps.length}`);
      }
      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: { schemaVersion: '1.0', command: 'query', type: 'run', runId, error: message }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }

  if (fieldArg === 'risk') {
    const moduleArg = commandArgs.find((arg, index) => index > commandArgs.indexOf(fieldArg) && !arg.startsWith('-'));

    if (!moduleArg) {
      const message = 'playbook query risk: missing required <module> argument';
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'risk',
              module: null,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }

    try {
      const payload = queryRisk(cwd, moduleArg);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload, outFile: options.outFile });
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printRiskText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'query', payload: {
              schemaVersion: '1.0',
              command: 'query',
              type: 'risk',
              module: moduleArg,
              error: message
            }, outFile: options.outFile });
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }
  }

  try {
    const query = queryRepositoryIndex(cwd, fieldArg);
    const result: QueryResult = {
      command: 'query',
      field: query.field,
      result: query.result,
      graphNeighborhood: query.graphNeighborhood
    };

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'query', payload: result, outFile: options.outFile });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      printText(result.field, result.result);
    }

    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'query', payload: {
            command: 'query',
            field: fieldArg,
            error: message,
            supportedFields: [...SUPPORTED_QUERY_FIELDS, 'dependencies', 'impact', 'risk', 'docs-coverage', 'rule-owners', 'module-owners', 'test-hotspots', 'patterns', 'runs', 'run']
          }, outFile: options.outFile });
    } else {
      console.error(message);
    }

    return ExitCode.Failure;
  }
};
