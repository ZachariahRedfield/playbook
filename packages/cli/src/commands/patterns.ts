import { listTopPatterns, promotePatternCandidate, scorePatternGraph } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { ExitCode } from '../lib/cliContract.js';
import { findPatternNode, findRelatedPatterns, readContractPatternGraph, readPatternKnowledgeGraph, summarizePatternLayers } from './patterns/graph.js';
import { runPatternsOutcomes } from './patterns/outcomes.js';
import { runPatternsDoctrineCandidates } from './patterns/doctrineCandidates.js';
import { runPatternsAntiPatterns } from './patterns/antiPatterns.js';
import { runPatternsCrossRepo, runPatternsGeneralized, runPatternsPortability, runPatternsRepoDelta } from './patterns/crossRepo.js';
import { runPatternsCandidates } from './patterns/candidates/index.js';
import { runPatternsProposals } from './patterns/proposals.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

const readOptionValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const emitError = (cwd: string, options: PatternsOptions, message: string): number => {
  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload: { schemaVersion: '1.0', command: 'patterns', error: message }, outFile: options.outFile });
  } else {
    console.error(message);
  }
  return ExitCode.Failure;
};

const printHelp = (): void => {
  console.log('playbook patterns subcommands: list | show <id> | related <id> | layers | score | top [--limit <n>] | outcomes <patternId> | doctrine-candidates | candidates [show <id>|unmatched|link|cross-repo|generalized|portability] | anti-patterns | proposals | cross-repo [--repo <path-or-slug>] | portability | generalized | repo-delta <leftRepo> <rightRepo> | promote --id <pattern-id> --decision approve|reject');
};


const runScore = (cwd: string, options: PatternsOptions): number => {
  const graph = readContractPatternGraph(cwd);
  const scored = scorePatternGraph(graph);
  const payload = { schemaVersion: '1.0', command: 'patterns', action: 'score', graph: scored };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Pattern attractor scores computed.');
    for (const pattern of scored.patterns) {
      const latest = pattern.scores[pattern.scores.length - 1];
      console.log(`${pattern.id}: ${latest?.value ?? 0} (${pattern.status})`);
    }
  }

  return ExitCode.Success;
};

const runTop = (cwd: string, commandArgs: string[], options: PatternsOptions): number => {
  const graph = readContractPatternGraph(cwd);
  const limitRaw = readOptionValue(commandArgs, '--limit');
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 5;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;
  const top = listTopPatterns(graph, limit);

  const payload = { schemaVersion: '1.0', command: 'patterns', action: 'top', limit, patterns: top };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log(`Top ${limit} patterns by attractor score`);
    console.log('────────────────────────────────');
    for (const pattern of top) {
      const latest = pattern.scores[pattern.scores.length - 1];
      console.log(`${pattern.id}: ${latest?.value ?? 0} (${pattern.status})`);
    }
  }

  return ExitCode.Success;
};

const runPromote = (cwd: string, commandArgs: string[], options: PatternsOptions): number => {
  const id = readOptionValue(commandArgs, '--id');
  const decisionRaw = readOptionValue(commandArgs, '--decision');
  if (!id || !decisionRaw || !['approve', 'reject'].includes(decisionRaw)) {
    return emitError(cwd, options, 'playbook patterns promote: requires --id <pattern-id> and --decision approve|reject.');
  }

  const reviewRecord = promotePatternCandidate(cwd, { id, decision: decisionRaw as 'approve' | 'reject' });
  const payload = { schemaVersion: '1.0', command: 'patterns', action: 'promote', reviewRecord };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log(`Pattern ${id} ${decisionRaw}d.`);
  }
  return ExitCode.Success;
};

export const runPatterns = async (cwd: string, commandArgs: string[], options: PatternsOptions): Promise<number> => {
  try {
    const subcommand = commandArgs[0];

    if (!subcommand || subcommand === '--help' || subcommand === '-h') {
      if (options.format === 'json') {
        emitJsonOutput({
          cwd,
          command: 'patterns',
          payload: {
            schemaVersion: '1.0',
            command: 'patterns',
            subcommands: ['list', 'show', 'related', 'layers', 'score', 'top', 'outcomes', 'doctrine-candidates', 'candidates', 'anti-patterns', 'proposals', 'cross-repo', 'portability', 'generalized', 'repo-delta', 'promote']
          },
          outFile: options.outFile
        });
      } else {
        printHelp();
      }
      return ExitCode.Success;
    }

    if (subcommand === 'promote') {
      return runPromote(cwd, commandArgs, options);
    }

    if (subcommand === 'score') {
      return runScore(cwd, options);
    }

    if (subcommand === 'top') {
      return runTop(cwd, commandArgs, options);
    }


    if (subcommand === 'outcomes') {
      return runPatternsOutcomes(cwd, commandArgs, options);
    }

    if (subcommand === 'doctrine-candidates') {
      return runPatternsDoctrineCandidates(cwd, options);
    }

    if (subcommand === 'candidates') {
      return runPatternsCandidates(cwd, commandArgs.slice(1), options);
    }

    if (subcommand === 'anti-patterns') {
      return runPatternsAntiPatterns(cwd, options);
    }

    if (subcommand === 'proposals') {
      return runPatternsProposals(cwd, options);
    }

    if (subcommand === 'cross-repo') {
      return runPatternsCrossRepo(cwd, commandArgs, options);
    }

    if (subcommand === 'portability') {
      return runPatternsPortability(cwd, options);
    }

    if (subcommand === 'generalized') {
      return runPatternsGeneralized(cwd, options);
    }

    if (subcommand === 'repo-delta') {
      return runPatternsRepoDelta(cwd, commandArgs, options);
    }

    const graph = readPatternKnowledgeGraph(cwd);

    if (subcommand === 'list') {
      const payload = { schemaVersion: '1.0', command: 'patterns', action: 'list', patterns: graph.nodes };
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
      } else {
        console.log('Pattern Knowledge Graph Nodes');
        console.log('─────────────────────────────');
        for (const pattern of graph.nodes) {
          console.log(`${pattern.knowledgeId} (${pattern.status})`);
        }
      }
      return ExitCode.Success;
    }

    if (subcommand === 'show') {
      const id = commandArgs[1];
      if (!id) {
        return emitError(cwd, options, 'playbook patterns show: requires <id>.');
      }
      const pattern = findPatternNode(graph, id);
      const payload = { schemaVersion: '1.0', command: 'patterns', action: 'show', pattern };
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
      } else {
        console.log(`Pattern ${pattern.knowledgeId}`);
        console.log('────────────────');
        console.log(`Title: ${pattern.title}`);
        console.log(`Status: ${pattern.status}`);
        console.log(`Module: ${pattern.module}`);
        console.log(`Rule: ${pattern.ruleId}`);
        console.log(`Failure shape: ${pattern.failureShape}`);
      }
      return ExitCode.Success;
    }

    if (subcommand === 'related') {
      const id = commandArgs[1];
      if (!id) {
        return emitError(cwd, options, 'playbook patterns related: requires <id>.');
      }
      findPatternNode(graph, id);
      const related = findRelatedPatterns(graph, id);
      const payload = { schemaVersion: '1.0', command: 'patterns', action: 'related', id, related };
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
      } else {
        console.log(`Patterns related to ${id}`);
        console.log('────────────────────────');
        for (const entry of related) {
          console.log(`${entry.relation}: ${entry.pattern.knowledgeId}`);
        }
      }
      return ExitCode.Success;
    }

    if (subcommand === 'layers') {
      const layers = summarizePatternLayers(graph);
      const payload = { schemaVersion: '1.0', command: 'patterns', action: 'layers', layers };
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
      } else {
        console.log('Pattern Graph Layers');
        console.log('────────────────────');
        for (const [layer, values] of Object.entries(layers)) {
          console.log(layer);
          for (const value of values) {
            console.log(`  ${value.value}: ${value.count}`);
          }
        }
      }
      return ExitCode.Success;
    }

    return emitError(
      cwd,
      options,
      'playbook patterns: unsupported subcommand. Use list, show <id>, related <id>, layers, score, top [--limit <n>], outcomes <patternId>, doctrine-candidates, candidates [show <id>|unmatched|link|cross-repo|generalized|portability], anti-patterns, proposals, cross-repo [--repo <path-or-slug>], portability, generalized, repo-delta <leftRepo> <rightRepo>, or promote --id <pattern-id> --decision approve|reject.'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emitError(cwd, options, message);
  }
};
