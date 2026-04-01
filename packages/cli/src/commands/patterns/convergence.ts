import fs from 'node:fs';
import path from 'node:path';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type PatternsOptions = { format: 'text' | 'json'; quiet: boolean; outFile?: string };

type PatternConvergenceMember = {
  source: 'candidate' | 'promoted';
  id: string;
  title: string;
  intent: string;
  constraint_class: string;
  resolution_strategy: string;
};

type PatternConvergenceCluster = {
  clusterId: string;
  intent: string;
  constraint_class: string;
  resolution_strategy: string;
  members: PatternConvergenceMember[];
  shared_abstraction: string;
  convergence_confidence: number;
  recommended_higher_order_pattern: string;
};

type PatternConvergenceArtifact = {
  schemaVersion: '1.0';
  kind: 'pattern-convergence';
  generatedAt: string;
  proposalOnly: boolean;
  sourceArtifacts: string[];
  clusters: PatternConvergenceCluster[];
};

type ConvergenceFilters = {
  intent?: string;
  constraint?: string;
  resolution?: string;
  minConfidence?: number;
};

const PATTERN_CONVERGENCE_PATH = ['.playbook', 'pattern-convergence.json'] as const;

const readPatternConvergenceArtifact = (cwd: string): PatternConvergenceArtifact => {
  const filePath = path.join(cwd, ...PATTERN_CONVERGENCE_PATH);
  if (!fs.existsSync(filePath)) {
    throw new Error('playbook patterns convergence: missing artifact at .playbook/pattern-convergence.json.');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PatternConvergenceArtifact;
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const index = args.indexOf(optionName);
  return index >= 0 ? args[index + 1] ?? null : null;
};

const normalizeFilter = (value: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
};

const parseMinConfidence = (raw: string | null): number | undefined => {
  if (raw === null || raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error('playbook patterns convergence: --min-confidence must be a number between 0 and 1.');
  }
  return parsed;
};

const parseFilters = (commandArgs: string[]): ConvergenceFilters => ({
  intent: normalizeFilter(readOptionValue(commandArgs, '--intent')),
  constraint: normalizeFilter(readOptionValue(commandArgs, '--constraint')),
  resolution: normalizeFilter(readOptionValue(commandArgs, '--resolution')),
  minConfidence: parseMinConfidence(readOptionValue(commandArgs, '--min-confidence'))
});

const applyFilters = (clusters: PatternConvergenceCluster[], filters: ConvergenceFilters): PatternConvergenceCluster[] =>
  clusters.filter((cluster) => {
    if (filters.intent && cluster.intent.toLowerCase() !== filters.intent) return false;
    if (filters.constraint && cluster.constraint_class.toLowerCase() !== filters.constraint) return false;
    if (filters.resolution && cluster.resolution_strategy.toLowerCase() !== filters.resolution) return false;
    if (typeof filters.minConfidence === 'number' && cluster.convergence_confidence < filters.minConfidence) return false;
    return true;
  });

const topAbstractions = (clusters: PatternConvergenceCluster[]): string[] =>
  [...clusters]
    .sort((left, right) => right.convergence_confidence - left.convergence_confidence || left.clusterId.localeCompare(right.clusterId))
    .slice(0, 3)
    .map((cluster) => cluster.shared_abstraction);

const buildNextAction = (artifact: PatternConvergenceArtifact, filteredCount: number): string => {
  if (filteredCount === 0) {
    return 'No matching clusters. Relax filters and re-run convergence review.';
  }
  if (artifact.proposalOnly) {
    return 'Review convergence clusters and queue explicit proposal promotion decisions; convergence is confidence input only.';
  }
  return 'Review matching clusters and continue governed proposal evaluation.';
};

export const runPatternsConvergence = (cwd: string, commandArgs: string[], options: PatternsOptions): number => {
  const artifact = readPatternConvergenceArtifact(cwd);
  const filters = parseFilters(commandArgs);
  const clusters = applyFilters(artifact.clusters, filters);
  const payload = {
    schemaVersion: '1.0',
    command: 'patterns',
    action: 'convergence',
    status: artifact.proposalOnly ? 'proposal-only read surface' : 'read surface',
    artifact: {
      kind: artifact.kind,
      generatedAt: artifact.generatedAt,
      proposalOnly: artifact.proposalOnly,
      sourceArtifacts: artifact.sourceArtifacts
    },
    filters: {
      intent: filters.intent ?? null,
      constraint: filters.constraint ?? null,
      resolution: filters.resolution ?? null,
      minConfidence: filters.minConfidence ?? null
    },
    cluster_count: clusters.length,
    clusters,
    top_convergent_abstractions: topAbstractions(clusters),
    next_action: buildNextAction(artifact, clusters.length)
  };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log(`Status: ${payload.status}`);
    console.log(`Cluster count: ${payload.cluster_count}`);
    console.log(`Top convergent abstractions: ${payload.top_convergent_abstractions.length}`);
    for (const abstraction of payload.top_convergent_abstractions) {
      console.log(`- ${abstraction}`);
    }
    console.log(`Next action: ${payload.next_action}`);
  }

  return ExitCode.Success;
};
