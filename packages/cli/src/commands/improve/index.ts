import {
  applyAutoSafeImprovements,
  approveGovernanceImprovement,
  generateImprovementCandidates,
  writeImprovementCandidatesArtifact,
  type ImprovementCandidatesArtifact
} from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';
import { emitCommandFailure, printCommandHelp } from '../../lib/commandSurface.js';
import { createCommandQualityTracker } from '../../lib/commandQuality.js';
import { renderBriefReport } from '../../lib/briefText.js';

type ImproveOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  help?: boolean;
};

const printImproveHelp = (): void => {
  printCommandHelp({
    usage: 'playbook improve [opportunities|commands|apply-safe|approve <proposal_id>] [options]',
    description: 'Generate, apply, and approve deterministic improvement proposals.',
    options: ['opportunities             Report ranked next-best improvement opportunities', 'commands                  Emit command improvement recommendations', 'apply-safe                Apply auto-safe improvement proposals', 'approve <proposal_id>      Approve governance-gated proposal', '--json                     Alias for --format=json', '--format <text|json>       Output format', '--quiet                    Suppress success output in text mode', '--help                     Show help'],
    artifacts: ['.playbook/improvement-candidates.json (write/read)', '.playbook/command-improvements.json (write/read via improve commands)', '.playbook/improvement-approvals.json (write for approve)']
  });
};

const renderText = (artifact: ImprovementCandidatesArtifact): void => {
  const topCandidate = artifact.candidates[0];
  const topRejected = artifact.rejected_candidates[0];
  const nextAction = topCandidate
    ? topCandidate.required_review
      ? `Review ${topCandidate.candidate_id} in .playbook/improvement-candidates.json before approving changes`
      : topCandidate.suggested_action
    : 'Inspect .playbook/improvement-candidates.json for candidate-only detail';

  console.log(
    renderBriefReport({
      title: 'Improve',
      decision: artifact.candidates.length > 0 ? `${artifact.candidates.length} candidate(s) surfaced` : 'no candidate cleared deterministic thresholds',
      affectedSurfaces: [
        '.playbook/improvement-candidates.json',
        '.playbook/command-improvements.json',
        `${artifact.summary.total} total candidate(s)`
      ],
      blockers: [
        artifact.rejected_candidates.length > 0 ? `${artifact.rejected_candidates.length} candidate(s) stayed below evidence/confidence gates` : null,
        topRejected ? `${topRejected.candidate_id}: ${topRejected.blocking_reasons.join(', ')}` : null
      ],
      nextAction,
      sections: [
        {
          heading: 'Why',
          items: [
            `AUTO-SAFE: ${artifact.summary.AUTO_SAFE}`,
            `CONVERSATIONAL: ${artifact.summary.CONVERSATIONAL}`,
            `GOVERNANCE: ${artifact.summary.GOVERNANCE}`,
            `Router recommendations accepted: ${artifact.router_recommendations.recommendations.length}`
          ]
        },
        {
          heading: 'Priority candidates',
          items: artifact.candidates.slice(0, 3).map((candidate: ImprovementCandidatesArtifact['candidates'][number]) => `${candidate.candidate_id} [${candidate.gating_tier}] — ${candidate.suggested_action}`),
          emptyText: 'No candidates met recurrence/confidence thresholds.'
        }
      ]
    })
  );
};

const printConversationPrompts = (artifact: ImprovementCandidatesArtifact): void => {
  const conversational = artifact.candidates.filter((candidate: { improvement_tier: string }) => candidate.improvement_tier === 'conversation');

  for (const candidate of conversational) {
    console.log(`Approval needed (conversation): ${candidate.candidate_id}`);
    console.log(`- observation: ${candidate.observation}`);
    console.log(`- suggested action: ${candidate.suggested_action}`);
  }
};



const renderOpportunityText = (artifact: ImprovementCandidatesArtifact['opportunity_analysis']): void => {
  const items = artifact.top_recommendation ? [artifact.top_recommendation, ...artifact.secondary_queue] : artifact.secondary_queue;
  console.log(
    renderBriefReport({
      title: 'Next best improvement',
      decision: items.length > 0 ? `${items.length} opportunity candidate(s) ranked` : 'no high-confidence opportunity detected',
      affectedSurfaces: [`${artifact.sourceArtifacts.filesScanned} file(s) scanned`, '.playbook/next-best-improvement.json'],
      blockers: [],
      nextAction: items[0] ? `Inspect evidence for ${items[0].title} in .playbook/next-best-improvement.json` : 'Gather more evidence before re-running improve opportunities',
      sections: [
        {
          heading: 'Why',
          items: items.slice(0, 3).map((entry: ImprovementCandidatesArtifact['opportunity_analysis']['secondary_queue'][number], index: number) => `${index === 0 ? 'best target' : `queue #${index}`}: ${entry.title} (${entry.heuristic_class}, confidence ${entry.confidence})`),
          emptyText: 'No high-confidence opportunities detected.'
        }
      ]
    })
  );
};

const renderCommandImprovementsText = (artifact: {
  generatedAt: string;
  proposals: Array<{
    gating_tier: string;
    proposal_id: string;
    command_name: string;
    issue_type: string;
    evidence_count: number;
    supporting_runs: number;
    average_failure_rate: number;
    average_confidence_score: number;
    average_duration_ms: number;
    rationale: string;
    proposed_improvement: string;
  }>;
  runtime_hardening: {
    proposals: Array<{
      gating_tier: string;
      proposal_id: string;
      issue_type: string;
      evidence_count: number;
      supporting_runs: number;
      rationale: string;
      proposed_improvement: string;
    }>;
    rejected_proposals: Array<{ proposal_id: string; blocking_reasons: string[] }>;
    open_questions: Array<{ question_id: string; question: string; rationale: string }>;
  };
  rejected_proposals: Array<{ proposal_id: string; blocking_reasons: string[] }>;
}): void => {
  const topProposal = artifact.proposals[0];
  console.log(
    renderBriefReport({
      title: 'Command improvements',
      decision: artifact.proposals.length > 0 ? `${artifact.proposals.length} proposal(s) accepted` : 'no command proposal cleared deterministic thresholds',
      affectedSurfaces: ['.playbook/command-improvements.json', `${artifact.runtime_hardening.proposals.length} runtime hardening proposal(s)`],
      blockers: [artifact.rejected_proposals[0] ? `${artifact.rejected_proposals[0].proposal_id}: ${artifact.rejected_proposals[0].blocking_reasons.join(', ')}` : null],
      nextAction: topProposal ? `Inspect ${topProposal.proposal_id} for ${topProposal.command_name} in .playbook/command-improvements.json` : 'Gather more governed runtime evidence before re-running improve commands',
      sections: [
        {
          heading: 'Why',
          items: artifact.proposals.slice(0, 3).map((proposal) => `${proposal.proposal_id} [${proposal.gating_tier}] — ${proposal.command_name}: ${proposal.proposed_improvement}`),
          emptyText: 'No command proposals accepted.'
        }
      ]
    })
  );
};

export const runImproveOpportunities = async (cwd: string, options: ImproveOptions): Promise<number> => {
  if (options.help) {
    printImproveHelp();
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'improve-opportunities');
  const artifact = generateImprovementCandidates(cwd).opportunity_analysis;

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'improve-opportunities', payload: artifact });
    tracker.finish({
      inputsSummary: 'mode=opportunities',
      successStatus: 'success',
      warningsCount: artifact.secondary_queue.length
    });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderOpportunityText(artifact);
  }

  tracker.finish({
    inputsSummary: 'mode=opportunities',
    downstreamArtifactsProduced: ['.playbook/next-best-improvement.json'],
    successStatus: 'success',
    warningsCount: artifact.secondary_queue.length
  });
  return ExitCode.Success;
};

export const runImproveCommands = async (cwd: string, options: ImproveOptions): Promise<number> => {
  if (options.help) {
    printImproveHelp();
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'improve-commands');
  const artifact = generateImprovementCandidates(cwd).command_improvements;

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'improve-commands', payload: artifact });
    tracker.finish({
      inputsSummary: 'mode=commands',
      artifactsWritten: ['.playbook/command-improvements.json'],
      downstreamArtifactsProduced: ['.playbook/command-improvements.json'],
      successStatus: 'success',
      warningsCount: artifact.rejected_proposals.length
    });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderCommandImprovementsText(artifact);
  }

  tracker.finish({
    inputsSummary: 'mode=commands',
    artifactsWritten: ['.playbook/command-improvements.json'],
    downstreamArtifactsProduced: ['.playbook/command-improvements.json'],
    successStatus: 'success',
    warningsCount: artifact.rejected_proposals.length
  });
  return ExitCode.Success;
};
export const runImprove = async (cwd: string, options: ImproveOptions): Promise<number> => {
  if (options.help) {
    printImproveHelp();
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'improve');

  const artifact = generateImprovementCandidates(cwd);
  writeImprovementCandidatesArtifact(cwd, artifact);

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'improve', payload: artifact });
    tracker.finish({
      inputsSummary: 'mode=generate',
      artifactsWritten: ['.playbook/improvement-candidates.json', '.playbook/command-improvements.json'],
      downstreamArtifactsProduced: ['.playbook/improvement-candidates.json', '.playbook/command-improvements.json'],
      successStatus: 'success',
      warningsCount: artifact.rejected_candidates.length,
      openQuestionsCount: artifact.open_questions?.length ?? 0
    });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderText(artifact);
  }

  tracker.finish({
    inputsSummary: 'mode=generate',
    artifactsWritten: ['.playbook/improvement-candidates.json', '.playbook/command-improvements.json'],
    downstreamArtifactsProduced: ['.playbook/improvement-candidates.json', '.playbook/command-improvements.json'],
    successStatus: 'success',
    warningsCount: artifact.rejected_candidates.length,
    openQuestionsCount: artifact.open_questions?.length ?? 0
  });
  return ExitCode.Success;
};

export const runImproveApplySafe = async (cwd: string, options: ImproveOptions): Promise<number> => {
  if (options.help) {
    printImproveHelp();
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'improve-apply-safe');

  const artifact = applyAutoSafeImprovements(cwd);

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'improve-apply-safe', payload: artifact });
    tracker.finish({
      inputsSummary: 'mode=apply-safe',
      successStatus: 'success',
      warningsCount: artifact.pending_conversation.length + artifact.pending_governance.length
    });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('Applied auto-safe improvements');
    console.log('────────────────────────────');
    console.log(`Applied: ${artifact.applied.length}`);
    console.log(`Pending conversational: ${artifact.pending_conversation.length}`);
    console.log(`Pending governance: ${artifact.pending_governance.length}`);
  }

  tracker.finish({
    inputsSummary: 'mode=apply-safe',
    successStatus: 'success',
    warningsCount: artifact.pending_conversation.length + artifact.pending_governance.length
  });
  return ExitCode.Success;
};

export const runImproveApprove = async (cwd: string, proposalId: string | undefined, options: ImproveOptions): Promise<number> => {
  if (options.help) {
    printImproveHelp();
    return ExitCode.Success;
  }

  const tracker = createCommandQualityTracker(cwd, 'improve-approve');

  if (!proposalId) {
    const exitCode = emitCommandFailure('improve-approve', options, {
      summary: 'Improve approve failed: missing proposal id.',
      findingId: 'improve.approve.proposal-id.required',
      message: 'Missing required argument: <proposal_id>.',
      nextActions: ['Run `playbook improve approve <proposal_id>` with a deterministic proposal identifier.']
    });
    tracker.finish({ inputsSummary: 'missing proposal id', successStatus: 'failure', warningsCount: 1 });
    return exitCode;
  }

  try {
    const artifact = approveGovernanceImprovement(cwd, proposalId);
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'improve-approve', payload: artifact });
      tracker.finish({ inputsSummary: `proposal=${proposalId}`, successStatus: 'success' });
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(`Approved governance improvement: ${proposalId}`);
    }
    tracker.finish({ inputsSummary: `proposal=${proposalId}`, successStatus: 'success' });
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while approving governance improvement.';
    const exitCode = emitCommandFailure('improve-approve', options, {
      summary: 'Improve approve failed: approval operation did not complete.',
      findingId: 'improve.approve.failed',
      message,
      nextActions: ['Validate proposal id exists in .playbook/improvement-candidates.json and retry.']
    });
    tracker.finish({ inputsSummary: `proposal=${proposalId}`, successStatus: 'failure', warningsCount: 1 });
    return exitCode;
  }
};
