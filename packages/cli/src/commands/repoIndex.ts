import {
  buildModuleContextDigests,
  generateCompactionCandidateArtifact,
  generateRepositoryGraph,
  generateRepositoryIndex,
  MODULE_CONTEXT_DIR_RELATIVE_PATH,
  REPOSITORY_GRAPH_RELATIVE_PATH,
  SYSTEM_MAP_RELATIVE_PATH,
  writeModuleContextDigests,
  writeSystemMapArtifact
} from '@zachariahredfield/playbook-engine';
import fs from 'node:fs';
import path from 'node:path';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput, writeJsonArtifactAbsolute } from '../lib/jsonArtifact.js';

type IndexOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

type IndexResult = {
  command: 'index';
  ok: true;
  indexFile: '.playbook/repo-index.json';
  graphFile: '.playbook/repo-graph.json';
  systemMapFile: '.playbook/system-map.json';
  contextDir: '.playbook/context/modules';
  framework: string;
  architecture: string;
  modules: string[];
};

const INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;
const ARCHITECTURE_REGISTRY_RELATIVE_PATH = '.playbook/architecture/subsystems.json' as const;

const writeRepositoryIndex = (cwd: string): { indexPath: string; result: IndexResult } => {
  const index = generateRepositoryIndex(cwd);
  const graph = generateRepositoryGraph(index);
  const indexPath = path.join(cwd, INDEX_RELATIVE_PATH);
  const graphPath = path.join(cwd, REPOSITORY_GRAPH_RELATIVE_PATH);

  writeJsonArtifactAbsolute(indexPath, index as Record<string, unknown>, 'index', { envelope: false });
  writeJsonArtifactAbsolute(graphPath, graph as Record<string, unknown>, 'index', { envelope: false });
  const moduleDigests = buildModuleContextDigests(cwd, index, graph);
  writeModuleContextDigests(cwd, moduleDigests);
  generateCompactionCandidateArtifact({ repoRoot: cwd, index, graph });

  const architectureRegistryPath = path.join(cwd, ARCHITECTURE_REGISTRY_RELATIVE_PATH);
  if (fs.existsSync(architectureRegistryPath)) {
    writeSystemMapArtifact(cwd);
  }

  return {
    indexPath,
    result: {
      command: 'index',
      ok: true,
      indexFile: INDEX_RELATIVE_PATH,
      graphFile: REPOSITORY_GRAPH_RELATIVE_PATH,
      systemMapFile: SYSTEM_MAP_RELATIVE_PATH,
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
    emitJsonOutput({ cwd, command: 'index', payload: result, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Repository Intelligence');
    console.log('───────────────────────');
    console.log(`Index file: ${result.indexFile}`);
    console.log(`Graph file: ${result.graphFile}`);
    console.log(`System map file: ${result.systemMapFile}`);
    console.log(`Context digests: ${result.contextDir}`);
    console.log(`Framework: ${result.framework}`);
    console.log(`Architecture: ${result.architecture}`);
    console.log(`Modules: ${result.modules.length > 0 ? result.modules.join(', ') : 'none'}`);
  }

  return ExitCode.Success;
};
