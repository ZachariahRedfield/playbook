import { readRepositoryGraph, summarizeRepositoryGraph } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type GraphOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type GraphSummaryResult = {
  schemaVersion: '1.1';
  command: 'graph';
  graph: ReturnType<typeof summarizeRepositoryGraph>;
};

const printText = (result: GraphSummaryResult): void => {
  console.log('Repository Knowledge Graph');
  console.log('──────────────────────────');
  console.log(`Kind: ${result.graph.kind}`);
  console.log(`Schema: ${result.graph.schemaVersion}`);
  console.log(`Generated: ${result.graph.generatedAt}`);
  console.log(`Nodes: ${result.graph.stats.nodeCount}`);
  console.log(`Edges: ${result.graph.stats.edgeCount}`);
  console.log(`Node kinds: ${result.graph.nodeKinds.join(', ') || 'none'}`);
  console.log(`Edge kinds: ${result.graph.edgeKinds.join(', ') || 'none'}`);

  if (result.graph.topDependencyHubs.length > 0) {
    console.log('Top dependency hubs:');
    for (const hub of result.graph.topDependencyHubs) {
      console.log(`- ${hub.module} (${hub.incomingDependencies})`);
    }
  }
};

export const runGraph = async (cwd: string, options: GraphOptions): Promise<number> => {
  try {
    const graph = readRepositoryGraph(cwd);
    const result: GraphSummaryResult = {
      schemaVersion: '1.1',
      command: 'graph',
      graph: summarizeRepositoryGraph(graph)
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      printText(result);
    }

    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            schemaVersion: '1.1',
            command: 'graph',
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
};
