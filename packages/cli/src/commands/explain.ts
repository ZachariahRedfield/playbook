import { explainTarget, type ExplainTargetResult } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';

type ExplainOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type ExplainOutput = {
  command: 'explain';
  target: string;
  type: ExplainTargetResult['type'];
  explanation: Record<string, unknown>;
};

const positionalArgs = (args: string[]): string[] => args.filter((arg) => !arg.startsWith('-'));

const toExplainTarget = (args: string[]): string | undefined => {
  const positional = positionalArgs(args);
  if (positional.length === 0) {
    return undefined;
  }

  if ((positional[0] === 'subsystem' || positional[0] === 'artifact' || positional[0] === 'command') && positional.length >= 2) {
    return `${positional[0]} ${positional.slice(1).join(' ')}`;
  }

  return positional[0];
};

const hasWithMemoryFlag = (args: string[]): boolean => args.includes('--with-memory');

const toOutput = (target: string, explanation: ExplainTargetResult): ExplainOutput => {
  if (explanation.type === 'unknown') {
    return {
      command: 'explain',
      target,
      type: 'unknown',
      explanation: {
        resolvedTarget: explanation.resolvedTarget,
        message: explanation.message
      }
    };
  }

  const payload = { ...explanation } as Record<string, unknown>;
  delete (payload as { type?: string }).type;

  if (explanation.type === 'artifact') {
    payload.artifact_lineage = {
      ownerSubsystem: explanation.ownerSubsystem,
      upstreamSubsystem: explanation.upstreamSubsystem,
      downstreamConsumers: explanation.downstreamConsumers
    };

    if (explanation.cycleState) {
      payload.cycle_state = explanation.cycleState;
    }

    if (explanation.cycleHistory) {
      payload.cycle_history = explanation.cycleHistory;
    }

    if (explanation.policyEvaluation) {
      payload.policy_evaluation = explanation.policyEvaluation;
    }

    if (explanation.policyApplyResult) {
      payload.policy_apply_result = explanation.policyApplyResult;
    }

    if (explanation.sessionEvidenceEnvelope) {
      payload.session_evidence_envelope = explanation.sessionEvidenceEnvelope;
    }
  }

  if (explanation.type === 'subsystem') {
    payload.subsystem_dependencies = {
      upstream: explanation.upstream ?? [],
      downstream: explanation.downstream ?? []
    };
  }

  if (explanation.type === 'command') {
    payload.command_inspection = {
      subsystemOwnership: explanation.subsystemOwnership,
      artifactsRead: explanation.artifactsRead,
      artifactsWritten: explanation.artifactsWritten,
      rationaleSummary: explanation.rationaleSummary,
      downstreamConsumers: explanation.downstreamConsumers,
      commonFailurePrerequisites: explanation.commonFailurePrerequisites
    };
  }

  return {
    command: 'explain',
    target,
    type: explanation.type,
    explanation: payload
  };
};

const printText = (target: string, explanation: ExplainTargetResult): void => {
  if (explanation.type === 'rule') {
    console.log(`Rule: ${explanation.id}`);
    console.log('');
    console.log('Purpose');
    console.log(explanation.purpose);
    console.log('');
    console.log('Reason');
    console.log(explanation.reason);
    console.log('');
    console.log('How to fix');
    for (const step of explanation.fix) {
      console.log(`- ${step}`);
    }
    return;
  }

  if (explanation.type === 'module') {
    console.log(`Module: ${explanation.name}`);
    console.log('');
    console.log(`Architecture: ${explanation.architecture}`);
    console.log('');
    console.log('Responsibilities');
    for (const item of explanation.responsibilities) {
      console.log(`- ${item}`);
    }
    console.log('');
    console.log('Dependencies');
    if (explanation.dependencies.length === 0) {
      console.log('- none (not yet inferred)');
      return;
    }

    for (const item of explanation.dependencies) {
      console.log(`- ${item}`);
    }
    return;
  }

  if (explanation.type === 'architecture') {
    console.log(`Architecture: ${explanation.architecture}`);
    console.log('');
    console.log('Structure');
    console.log(explanation.structure);
    console.log('');
    console.log('Reasoning');
    console.log(explanation.reasoning);
    return;
  }

  if (explanation.type === 'subsystem') {
    console.log(`Subsystem: ${explanation.name}`);
    console.log('');
    console.log('Purpose');
    console.log(explanation.purpose);
    console.log('');
    console.log('Owned commands');
    for (const command of explanation.commands) {
      console.log(`- ${command}`);
    }
    console.log('');
    console.log('Owned artifacts');
    if (explanation.artifacts.length === 0) {
      console.log('- none');
    } else {
      for (const artifact of explanation.artifacts) {
        console.log(`- ${artifact}`);
      }
    }

    console.log('');
    console.log('Upstream');
    const upstream = explanation.upstream ?? [];
    if (upstream.length === 0) {
      console.log('- none');
    } else {
      for (const subsystem of upstream) {
        console.log(`- ${subsystem}`);
      }
    }

    console.log('');
    console.log('Downstream');
    const downstream = explanation.downstream ?? [];
    if (downstream.length === 0) {
      console.log('- none');
    } else {
      for (const subsystem of downstream) {
        console.log(`- ${subsystem}`);
      }
    }
    return;
  }

  if (explanation.type === 'command') {
    console.log(`Command: ${explanation.command}`);
    console.log('');
    console.log('Subsystem ownership');
    console.log(explanation.subsystemOwnership);
    console.log('');
    console.log('Artifacts read');
    if (explanation.artifactsRead.length === 0) {
      console.log('- none');
    } else {
      for (const artifact of explanation.artifactsRead) {
        console.log(`- ${artifact}`);
      }
    }
    console.log('');
    console.log('Artifacts written');
    if (explanation.artifactsWritten.length === 0) {
      console.log('- none');
    } else {
      for (const artifact of explanation.artifactsWritten) {
        console.log(`- ${artifact}`);
      }
    }
    console.log('');
    console.log('Rationale summary');
    console.log(explanation.rationaleSummary);
    console.log('');
    console.log('Downstream consumers');
    if (explanation.downstreamConsumers.length === 0) {
      console.log('- none');
    } else {
      for (const consumer of explanation.downstreamConsumers) {
        console.log(`- ${consumer}`);
      }
    }
    console.log('');
    console.log('Common failure prerequisites');
    if (explanation.commonFailurePrerequisites.length === 0) {
      console.log('- none');
    } else {
      for (const prerequisite of explanation.commonFailurePrerequisites) {
        console.log(`- ${prerequisite}`);
      }
    }
    return;
  }

  if (explanation.type === 'artifact') {
    console.log(`Artifact: ${explanation.artifact}`);
    console.log('');

    if (explanation.cycleState) {
      const cycleState = explanation.cycleState;
      console.log('Artifact type: cycle-state');
      console.log('');
      console.log(`Cycle ID: ${cycleState.cycle_id}`);
      console.log(`Started at: ${cycleState.started_at}`);
      console.log(`Result: ${cycleState.result}`);
      if (cycleState.failed_step) {
        console.log(`Failed step: ${cycleState.failed_step}`);
      }
      console.log('');
      console.log('Steps');
      if (cycleState.steps.length === 0) {
        console.log('- none');
      } else {
        for (const step of cycleState.steps) {
          console.log(`- ${step.name}: ${step.status} (${step.duration_ms}ms)`);
        }
      }
      console.log('');
      console.log('Artifacts written');
      if (cycleState.artifacts_written.length === 0) {
        console.log('- none');
      } else {
        for (const artifact of cycleState.artifacts_written) {
          console.log(`- ${artifact}`);
        }
      }
      return;
    }

    if (explanation.cycleHistory) {
      const cycleHistory = explanation.cycleHistory;
      console.log('Artifact type: cycle-history');
      console.log('');
      console.log(`History version: ${cycleHistory.history_version}`);
      console.log(`Repository: ${cycleHistory.repo}`);
      console.log('');
      console.log('Cycles');
      if (cycleHistory.cycles.length === 0) {
        console.log('- none');
      } else {
        for (const cycle of cycleHistory.cycles) {
          const failedSuffix = cycle.failed_step ? `, failed_step=${cycle.failed_step}` : '';
          console.log(`- ${cycle.cycle_id}: ${cycle.result}, started_at=${cycle.started_at}, duration_ms=${cycle.duration_ms}${failedSuffix}`);
        }
      }
      return;
    }

    if (explanation.policyApplyResult) {
      const policyApplyResult = explanation.policyApplyResult;
      console.log('Execution result summary');
      console.log('');
      console.log(`Executed: ${policyApplyResult.summary.executed}`);
      console.log(`Skipped (requires review): ${policyApplyResult.summary.skipped_requires_review}`);
      console.log(`Skipped (blocked): ${policyApplyResult.summary.skipped_blocked}`);
      console.log(`Failed execution: ${policyApplyResult.summary.failed_execution}`);
      console.log(`Total: ${policyApplyResult.summary.total}`);
      console.log('');

      const printProposalList = (heading: string, entries: Array<{ proposal_id: string }>): void => {
        console.log(heading);
        if (entries.length === 0) {
          console.log('- none');
        } else {
          for (const entry of entries) {
            console.log(`- ${entry.proposal_id}`);
          }
        }
        console.log('');
      };

      printProposalList('Executed proposals:', policyApplyResult.executed);
      printProposalList('Skipped (requires review):', policyApplyResult.skipped_requires_review);
      printProposalList('Skipped (blocked):', policyApplyResult.skipped_blocked);
      printProposalList('Failed execution:', policyApplyResult.failed_execution);
      return;
    }

    if (explanation.sessionEvidenceEnvelope) {
      const sessionEvidenceEnvelope = explanation.sessionEvidenceEnvelope;
      console.log('Artifact type: session-evidence-envelope');
      console.log('');
      console.log(`Session ID: ${sessionEvidenceEnvelope.session_id}`);
      console.log(`Selected run: ${sessionEvidenceEnvelope.selected_run_id ?? 'none'}`);
      console.log(`Cycle ID: ${sessionEvidenceEnvelope.cycle_id ?? 'none'}`);
      console.log(`Generated from: ${sessionEvidenceEnvelope.generated_from_last_updated_time}`);
      console.log('');
      console.log('Lineage');
      if (sessionEvidenceEnvelope.lineage.length === 0) {
        console.log('- none');
      } else {
        for (const entry of sessionEvidenceEnvelope.lineage) {
          console.log(`- [${entry.order}] ${entry.stage}: ${entry.artifact} (present=${entry.present})`);
        }
      }
      console.log('');
      console.log('Proposals');
      if (sessionEvidenceEnvelope.proposal_ids.length === 0) {
        console.log('- none');
      } else {
        for (const proposalId of sessionEvidenceEnvelope.proposal_ids) {
          console.log(`- ${proposalId}`);
        }
      }
      return;
    }


    if (explanation.policyEvaluation) {
      const policyEvaluation = explanation.policyEvaluation;
      console.log('Policy evaluation summary');
      console.log('');
      console.log(`Safe: ${policyEvaluation.summary.safe}`);
      console.log(`Requires review: ${policyEvaluation.summary.requires_review}`);
      console.log(`Blocked: ${policyEvaluation.summary.blocked}`);
      console.log(`Total: ${policyEvaluation.summary.total}`);
      console.log('');

      if (policyEvaluation.evaluations.length === 0) {
        console.log('No policy proposals evaluated.');
        return;
      }

      for (const evaluation of policyEvaluation.evaluations) {
        console.log(`Proposal ${evaluation.proposal_id} → ${evaluation.decision}`);
        console.log(`Reason: ${evaluation.reason}`);
        if (evaluation.evidence && Object.keys(evaluation.evidence).length > 0) {
          const evidenceSignals = Array.isArray(evaluation.evidence.signals)
            ? evaluation.evidence.signals.map((entry: unknown) => String(entry)).join(', ')
            : null;
          if (evidenceSignals) {
            console.log(`Evidence signals: ${evidenceSignals}`);
          }
        }
        console.log('');
      }
      return;
    }

    console.log('Owner Subsystem:');
    console.log(explanation.ownerSubsystem);
    console.log('');
    console.log('Upstream:');
    console.log(explanation.upstreamSubsystem ?? 'none');
    console.log('');
    console.log('Consumers:');
    if (explanation.downstreamConsumers.length === 0) {
      console.log('- none');
      return;
    }

    for (const consumer of explanation.downstreamConsumers) {
      console.log(`- ${consumer}`);
    }
    return;
  }

  console.log(`Target: ${target}`);
  console.log('');
  console.log(explanation.message);
};

export const runExplain = async (cwd: string, commandArgs: string[], options: ExplainOptions): Promise<number> => {
  const target = toExplainTarget(commandArgs);
  if (!target) {
    console.error('playbook explain: missing required <target> argument');
    return ExitCode.Failure;
  }

  try {
    const explanation = explainTarget(cwd, target, { withMemory: hasWithMemoryFlag(commandArgs) });
    const output = toOutput(target, explanation);

    if (options.format === 'json') {
      console.log(JSON.stringify(output, null, 2));
      return explanation.type === 'unknown' ? ExitCode.Failure : ExitCode.Success;
    }

    if (!options.quiet) {
      printText(target, explanation);
    }

    return explanation.type === 'unknown' ? ExitCode.Failure : ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            command: 'explain',
            target,
            error: message
          },
          null,
          2
        )
      );
    } else {
      console.error(message);
    }

    return ExitCode.Failure;
  }
};
