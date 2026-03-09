import { buildModuleContextDigests, generateCompactionCandidateArtifact, generateRepositoryGraph, generateRepositoryIndex, MODULE_CONTEXT_DIR_RELATIVE_PATH, REPOSITORY_GRAPH_RELATIVE_PATH, writeModuleContextDigests } from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import path from 'node:path';
import { ExitCode } from '../lib/cliContract.js';

type IndexOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type IndexResult = {
  command: 'index';
  ok: true;
  indexFile: '.playbook/repo-index.json';
  graphFile: '.playbook/repo-graph.json';
  contextDir: '.playbook/context/modules';
  framework: string;
  architecture: string;
  modules: string[];
};

const INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;

const writeRepositoryIndex = (cwd: string): { indexPath: string; result: IndexResult } => {
  const index = generateRepositoryIndex(cwd);
  const graph = generateRepositoryGraph(index);
  const indexPath = path.join(cwd, INDEX_RELATIVE_PATH);
  const graphPath = path.join(cwd, REPOSITORY_GRAPH_RELATIVE_PATH);

  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
  writeModuleContextDigests(cwd, buildModuleContextDigests(cwd, index, graph));
  generateCompactionCandidateArtifact({ repoRoot: cwd, index, graph });

  return {
    indexPath,
    result: {
      command: 'index',
      ok: true,
      indexFile: INDEX_RELATIVE_PATH,
      graphFile: REPOSITORY_GRAPH_RELATIVE_PATH,
      contextDir: MODULE_CONTEXT_DIR_RELATIVE_PATH,
      framework: index.framework,
      architecture: index.architecture,
      modules: index.modules.map((moduleEntry: { name: string }) => moduleEntry.name)
    }
  };
};

export const runIndex = async (cwd: string, options: IndexOptions): Promise<number> => {
  const { result } = writeRepositoryIndex(cwd);

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Repository Intelligence');
    console.log('───────────────────────');
    console.log(`Index file: ${result.indexFile}`);
    console.log(`Graph file: ${result.graphFile}`);
    console.log(`Context digests: ${result.contextDir}`);
    console.log(`Framework: ${result.framework}`);
    console.log(`Architecture: ${result.architecture}`);
    console.log(`Modules: ${result.modules.length > 0 ? result.modules.join(', ') : 'none'}`);
  }

  return ExitCode.Success;
};
