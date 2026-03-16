import { evaluateImprovementPolicy, type PolicyEvaluationArtifact } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';
import { emitCommandFailure, printCommandHelp } from '../../lib/commandSurface.js';
import { createCommandQualityTracker } from '../../lib/commandQuality.js';

type PolicyOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  help?: boolean;
};

const printPolicyHelp = (): void => {
  printCommandHelp({
    usage: 'playbook policy evaluate [options]',
    description: 'Evaluate improvement proposals with deterministic, governed runtime evidence. Read-only control-plane only.',
    options: [
      '--json                     Alias for --format=json',
      '--format <text|json>       Output format',
      '--quiet                    Suppress success output in text mode',
      '--help                     Show help'
    ],
    artifacts: ['.playbook/improvement-candidates.json (read)', '.playbook/cycle-history.json (read)']
  });
};

const renderText = (artifact: PolicyEvaluationArtifact): void => {
  console.log('Policy evaluation (read-only control-plane)');
  console.log('──────────────────────────────────────────');
  console.log(`Generated at: ${artifact.generatedAt}`);
  console.log(`Evaluations: ${artifact.summary.total}`);
  console.log(`safe: ${artifact.summary.safe}  requires_review: ${artifact.summary.requires_review}  blocked: ${artifact.summary.blocked}`);

  if (artifact.evaluations.length === 0) {
    console.log('No proposals found to evaluate.');
    return;
  }

  for (const evaluation of artifact.evaluations) {
    console.log(`- ${evaluation.proposal_id}: ${evaluation.decision}`);
    console.log(`  reason: ${evaluation.reason}`);
    console.log(`  evidence: frequency=${evaluation.evidence.frequency}, confidence=${evaluation.evidence.confidence}`);
  }
};

export const runPolicy = async (cwd: string, args: string[], options: PolicyOptions): Promise<number> => {
  const tracker = createCommandQualityTracker(cwd, 'policy');

  if (options.help) {
    printPolicyHelp();
    tracker.finish({ inputsSummary: 'help=true', successStatus: 'success' });
    return ExitCode.Success;
  }

  const subcommand = args.find((arg) => !arg.startsWith('-'));
  if (subcommand !== 'evaluate') {
    const exitCode = emitCommandFailure('policy', options, {
      summary: 'Policy command failed: unsupported subcommand.',
      findingId: 'policy.subcommand.unsupported',
      message: 'Use `playbook policy evaluate`.',
      nextActions: ['Run `playbook policy evaluate --json` for deterministic policy output.']
    });
    tracker.finish({ inputsSummary: `subcommand=${subcommand ?? 'none'}`, successStatus: 'failure', warningsCount: 1 });
    return exitCode;
  }

  const artifact = evaluateImprovementPolicy(cwd);

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'policy', payload: artifact });
    tracker.finish({
      inputsSummary: 'subcommand=evaluate',
      artifactsRead: ['.playbook/improvement-candidates.json', '.playbook/cycle-history.json'],
      successStatus: 'success'
    });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderText(artifact);
  }

  tracker.finish({
    inputsSummary: 'subcommand=evaluate',
    artifactsRead: ['.playbook/improvement-candidates.json', '.playbook/cycle-history.json'],
    successStatus: 'success'
  });

  return ExitCode.Success;
};
