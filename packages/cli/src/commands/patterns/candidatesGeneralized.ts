import { readCrossRepoPatternsArtifact, type CrossRepoPatternsArtifact } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

type AggregateEntry = CrossRepoPatternsArtifact['aggregates'][number];

type GeneralizedFamilyRow = {
  pattern_id: string;
  repo_count: number;
  instance_count: number;
  outcome_consistency_signal: number;
  instance_diversity_signal: number;
  governance_stability_signal: number;
};

const toGeneralizedFamilies = (artifact: CrossRepoPatternsArtifact): GeneralizedFamilyRow[] =>
  artifact.aggregates
    .filter((entry: AggregateEntry) => entry.repo_count > 1)
    .map((entry: AggregateEntry) => ({
      pattern_id: entry.pattern_id,
      repo_count: entry.repo_count,
      instance_count: entry.instance_count,
      outcome_consistency_signal: entry.outcome_consistency,
      instance_diversity_signal: entry.instance_diversity,
      governance_stability_signal: entry.governance_stability
    }))
    .sort((left: GeneralizedFamilyRow, right: GeneralizedFamilyRow) => right.repo_count - left.repo_count || right.instance_count - left.instance_count || left.pattern_id.localeCompare(right.pattern_id));

export const runPatternsCandidatesGeneralized = (cwd: string, options: PatternsOptions): number => {
  const artifact = readCrossRepoPatternsArtifact(cwd);
  const generalized = toGeneralizedFamilies(artifact);

  const payload = {
    schemaVersion: '1.0',
    command: 'patterns',
    action: 'candidates-generalized',
    generalized
  };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Generalized candidate families');
    console.log('──────────────────────────────');
    for (const entry of generalized) {
      console.log(`${entry.pattern_id}\trepos ${entry.repo_count}\tinstances ${entry.instance_count}`);
    }
  }

  return ExitCode.Success;
};
