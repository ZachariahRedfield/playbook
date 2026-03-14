import { readCrossRepoPatternsArtifact, type CrossRepoPatternsArtifact } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

type AggregateEntry = CrossRepoPatternsArtifact['aggregates'][number];

type CandidateFamilyRow = {
  pattern_id: string;
  repo_count: number;
  instance_count: number;
  mean_attractor: number;
  mean_fitness: number;
};

const toCandidateFamilyRows = (artifact: CrossRepoPatternsArtifact): CandidateFamilyRow[] =>
  artifact.aggregates
    .map((entry: AggregateEntry) => ({
      pattern_id: entry.pattern_id,
      repo_count: entry.repo_count,
      instance_count: entry.instance_count,
      mean_attractor: entry.mean_attractor,
      mean_fitness: entry.mean_fitness
    }))
    .sort((left: CandidateFamilyRow, right: CandidateFamilyRow) => right.repo_count - left.repo_count || right.instance_count - left.instance_count || left.pattern_id.localeCompare(right.pattern_id));

export const runPatternsCandidatesCrossRepo = (cwd: string, options: PatternsOptions): number => {
  const artifact = readCrossRepoPatternsArtifact(cwd);
  const families = toCandidateFamilyRows(artifact);

  const payload = {
    schemaVersion: '1.0',
    command: 'patterns',
    action: 'candidates-cross-repo',
    families
  };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Cross-repo candidate families');
    console.log('─────────────────────────────');
    for (const family of families) {
      console.log(`${family.pattern_id}\trepos ${family.repo_count}\tinstances ${family.instance_count}`);
    }
  }

  return ExitCode.Success;
};
