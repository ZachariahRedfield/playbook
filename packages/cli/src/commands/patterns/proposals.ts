import { generatePatternProposalArtifact, writePatternProposalArtifact } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

export const runPatternsProposals = (cwd: string, options: PatternsOptions): number => {
  const artifact = generatePatternProposalArtifact(cwd);
  writePatternProposalArtifact(cwd, artifact);

  const payload = {
    schemaVersion: '1.0',
    command: 'patterns',
    action: 'proposals',
    proposals: artifact.proposals
  };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Pattern proposal bridge candidates');
    console.log('────────────────────────────────');
    if (artifact.proposals.length === 0) {
      console.log('none');
    } else {
      for (const proposal of artifact.proposals) {
        console.log(`${proposal.proposal_id}\t${proposal.portability_score.toFixed(4)}\t${proposal.target_pattern}`);
      }
    }
  }

  return ExitCode.Success;
};
