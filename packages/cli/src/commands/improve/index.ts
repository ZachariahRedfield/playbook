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
import { renderBriefOutput } from '../../lib/briefOutput.js';

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
  type ImprovementCandidate = ImprovementCandidatesArtifact['candidates'][number];
  type DoctrineTransition = ImprovementCandidatesArtifact['doctrine_promotions']['transitions'][number];
  const topCandidate = artifact.candidates[0];
  const blockedCandidate = artifact.rejected_candidates[0];
  const topRouterRecommendation = artifact.router_recommendations.recommendations[0];

  console.log(renderBriefOutput({
    title: 'Improve',
    decision: artifact.candidates.length > 0 ? 'proposal_set_ready' : 'no_promotable_candidates',
    status: `${artifact.candidates.length} accepted, ${artifact.rejected_candidates.length} rejected`,
    why: topCandidate
      ? topCandidate.observation
      : 'No candidate met the deterministic recurrence/confidence thresholds.',
    affectedSurfaces: [
      '.playbook/improvement-candidates.json',
      '.playbook/command-improvements.json',
      `${artifact.router_recommendations.recommendations.length} router recommendation(s)`,
      `${artifact.doctrine_promotions.transitions.length} doctrine transition(s)`
    ],
    blockers: [
      blockedCandidate ? `${blockedCandidate.candidate_id}: ${blockedCandidate.blocking_reasons.join(', ')}` : '',
      artifact.open_questions?.[0] ?? ''
    ].filter(Boolean),
    nextAction: topCandidate
      ? `${topCandidate.suggested_action}${topCandidate.improvement_tier === 'governance' ? ' Then review policy/approval flow before any mutation.' : ''}`
      : 'Review rejected candidates and opportunity analysis before changing thresholds or doctrine.',
    artifactRefs: ['.playbook/improvement-candidates.json', '.playbook/command-improvements.json'],
    extraSections: [
      {
        label: 'Top accepted proposals',
        items: artifact.candidates.slice(0, 3).map((candidate: ImprovementCandidate) => `${candidate.candidate_id} [${candidate.gating_tier}] — ${candidate.suggested_action}`)
      },
      {
        label: 'Top router/doctrine signals',
        items: [
          topRouterRecommendation
            ? `${topRouterRecommendation.recommendation_id} — ${topRouterRecommendation.current_strategy} -> ${topRouterRecommendation.recommended_strategy}`
            : '',
          ...artifact.doctrine_promotions.transitions.slice(0, 2).map((transition: DoctrineTransition) => `${transition.candidate_id}: ${transition.from_stage} -> ${transition.to_stage}`)
        ].filter(Boolean)
      }
    ]
  }));
};

const renderOpportunityText = (artifact: ImprovementCandidatesArtifact['opportunity_analysis']): void => {
  const items = artifact.top_recommendation ? [artifact.top_recommendation, ...artifact.secondary_queue] : artifact.secondary_queue;
  const top = items[0];

  console.log(renderBriefOutput({
    title: 'Improve opportunities',
    decision: top ? 'ranked_opportunity_available' : 'no_high_confidence_opportunity',
    status: `${items.length} ranked opportunity item(s)`,
    why: top?.why_it_matters ?? 'No high-confidence opportunities detected in the current artifact scan.',
    affectedSurfaces: [
      '.playbook/next-best-improvement.json',
      `${artifact.sourceArtifacts.filesScanned} file(s) scanned`
    ],
    blockers: [],
    nextAction: top ? top.likely_change_shape : 'Collect more evidence before acting on opportunity heuristics.',
    artifactRefs: ['.playbook/next-best-improvement.json'],
    extraSections: [{
      label: 'Ranked queue',
      items: items.slice(0, 3).map((entry: typeof items[number], index: number) => `#${index + 1} ${entry.title} (${entry.heuristic_class}, priority ${entry.priority_score}, confidence ${entry.confidence})`)
    }]
  }));
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
  console.log(renderBriefOutput({
    title: 'Improve commands',
    decision: topProposal ? 'command_proposals_ready' : 'no_command_proposals',
    status: `${artifact.proposals.length} accepted, ${artifact.rejected_proposals.length} rejected`,
    why: topProposal?.rationale ?? 'No command-level evidence crossed the current proposal thresholds.',
    affectedSurfaces: [
      '.playbook/command-improvements.json',
      `${artifact.runtime_hardening.proposals.length} runtime hardening proposal(s)`
    ],
    blockers: [
      artifact.rejected_proposals[0] ? `${artifact.rejected_proposals[0].proposal_id}: ${artifact.rejected_proposals[0].blocking_reasons.join(', ')}` : '',
      artifact.runtime_hardening.open_questions[0]?.question ?? ''
    ].filter(Boolean),
    nextAction: topProposal
      ? `Inspect ${topProposal.command_name} for ${topProposal.issue_type} and review ${topProposal.proposal_id}.`
      : 'Collect more governed command-quality evidence before changing command surfaces.',
    artifactRefs: ['.playbook/command-improvements.json'],
    extraSections: [{
      label: 'Top command proposals',
      items: artifact.proposals.slice(0, 3).map((proposal) => `${proposal.proposal_id} (${proposal.command_name}) — ${proposal.proposed_improvement}`)
    }]
  }));
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
    console.log('');
    renderOpportunityText(artifact.opportunity_analysis);
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
