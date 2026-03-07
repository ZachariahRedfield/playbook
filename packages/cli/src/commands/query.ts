import {
  queryDependencies,
  queryImpact,
  queryRisk,
  queryRepositoryIndex,
  SUPPORTED_QUERY_FIELDS,
  type DependenciesQueryResult,
  type ImpactQueryResult,
  type RiskQueryResult,
  type RepositoryModule,
  type RepositoryQueryField
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type QueryOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type QueryResult = {
  command: 'query';
  field: RepositoryQueryField;
  result: string | string[] | RepositoryModule[];
};

const firstPositionalArg = (args: string[]): string | undefined => args.find((arg) => !arg.startsWith('-'));

const printText = (field: RepositoryQueryField, result: string | string[] | RepositoryModule[]): void => {
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

    for (const value of result as string[]) {
      console.log(value);
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
  console.log(`Changing module: ${payload.module}`);
  console.log('');
  console.log('Affected modules:');
  console.log('');

  if (payload.affectedModules.length === 0) {
    console.log('none');
    return;
  }

  for (const moduleName of payload.affectedModules) {
    console.log(moduleName);
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
        console.log(JSON.stringify(payload, null, 2));
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printDependenciesText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        console.log(
          JSON.stringify(
            {
              schemaVersion: '1.0',
              command: 'query',
              type: 'dependencies',
              module: moduleArg ?? null,
              error: message
            },
            null,
            2
          )
        );
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
        console.log(
          JSON.stringify(
            {
              schemaVersion: '1.0',
              command: 'query',
              type: 'impact',
              module: null,
              error: message
            },
            null,
            2
          )
        );
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }

    try {
      const payload = queryImpact(cwd, moduleArg);
      if (options.format === 'json') {
        console.log(JSON.stringify(payload, null, 2));
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printImpactText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        console.log(
          JSON.stringify(
            {
              schemaVersion: '1.0',
              command: 'query',
              type: 'impact',
              module: moduleArg,
              error: message
            },
            null,
            2
          )
        );
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
        console.log(
          JSON.stringify(
            {
              schemaVersion: '1.0',
              command: 'query',
              type: 'risk',
              module: null,
              error: message
            },
            null,
            2
          )
        );
      } else {
        console.error(message);
      }

      return ExitCode.Failure;
    }

    try {
      const payload = queryRisk(cwd, moduleArg);
      if (options.format === 'json') {
        console.log(JSON.stringify(payload, null, 2));
        return ExitCode.Success;
      }

      if (!options.quiet) {
        printRiskText(payload);
      }

      return ExitCode.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options.format === 'json') {
        console.log(
          JSON.stringify(
            {
              schemaVersion: '1.0',
              command: 'query',
              type: 'risk',
              module: moduleArg,
              error: message
            },
            null,
            2
          )
        );
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
      result: query.result
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      printText(result.field, result.result);
    }

    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            command: 'query',
            field: fieldArg,
            error: message,
            supportedFields: [...SUPPORTED_QUERY_FIELDS, 'dependencies', 'impact', 'risk']
          },
          null,
          2
        )
      );
    } else {
      console.error(message);
    }

    return ExitCode.Failure;
  }
};
