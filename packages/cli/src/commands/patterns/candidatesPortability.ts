import { readCrossRepoPatternsArtifact, type CrossRepoPatternsArtifact } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

type AggregateEntry = CrossRepoPatternsArtifact['aggregates'][number];

type PortabilityRow = {
  pattern_id: string;
  portability_score: number;
  repo_count_signal: number;
  outcome_consistency_signal: number;
  instance_diversity_signal: number;
  governance_stability_signal: number;
};

const round4 = (value: number): number => Number(value.toFixed(4));

const computeRepoCountSignal = (repoCount: number, maxRepoCount: number): number => {
  if (maxRepoCount <= 0) return 0;
  return round4(repoCount / maxRepoCount);
};

const computePortabilityScore = (
  repoCountSignal: number,
  outcomeConsistencySignal: number,
  instanceDiversitySignal: number,
  governanceStabilitySignal: number
): number =>
  round4(
    0.35 * repoCountSignal +
      0.25 * outcomeConsistencySignal +
      0.2 * instanceDiversitySignal +
      0.2 * governanceStabilitySignal
  );

const toPortabilityRows = (artifact: CrossRepoPatternsArtifact): PortabilityRow[] => {
  const maxRepoCount = artifact.aggregates.reduce((max: number, entry: AggregateEntry) => Math.max(max, entry.repo_count), 0);

  return artifact.aggregates
    .map((entry: AggregateEntry) => {
      const repo_count_signal = computeRepoCountSignal(entry.repo_count, maxRepoCount);
      const outcome_consistency_signal = round4(entry.outcome_consistency);
      const instance_diversity_signal = round4(entry.instance_diversity);
      const governance_stability_signal = round4(entry.governance_stability);

      return {
        pattern_id: entry.pattern_id,
        portability_score: computePortabilityScore(
          repo_count_signal,
          outcome_consistency_signal,
          instance_diversity_signal,
          governance_stability_signal
        ),
        repo_count_signal,
        outcome_consistency_signal,
        instance_diversity_signal,
        governance_stability_signal
      };
    })
    .sort((left: PortabilityRow, right: PortabilityRow) => right.portability_score - left.portability_score || left.pattern_id.localeCompare(right.pattern_id));
};

export const runPatternsCandidatesPortability = (cwd: string, options: PatternsOptions): number => {
  const artifact = readCrossRepoPatternsArtifact(cwd);
  const portability = toPortabilityRows(artifact);

  const payload = {
    schemaVersion: '1.0',
    command: 'patterns',
    action: 'candidates-portability',
    portability,
    formula: {
      portability:
        '0.35 * repo_count_signal + 0.25 * outcome_consistency_signal + 0.20 * instance_diversity_signal + 0.20 * governance_stability_signal'
    }
  };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Candidate portability scores');
    console.log('────────────────────────────');
    for (const entry of portability) {
      console.log(`${entry.pattern_id}\t${entry.portability_score.toFixed(4)}`);
    }
  }

  return ExitCode.Success;
};
