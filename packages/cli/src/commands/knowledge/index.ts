import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';
import { runKnowledgeInspect } from './inspect.js';
import { runKnowledgeList } from './list.js';
import { runKnowledgePortability, parsePortabilityView } from './portability.js';
import { runKnowledgeProvenance } from './provenance.js';
import { runKnowledgeQuery } from './query.js';
import { printKnowledgeHelp, printKnowledgePortabilityHelp, type KnowledgeCommandOptions } from './shared.js';
import { runKnowledgeStale } from './stale.js';
import { runKnowledgeTimeline } from './timeline.js';

const renderPortabilityText = (payload: Record<string, unknown>): string => {
  const portability = payload.portability as Array<Record<string, unknown>> | undefined;
  if (!portability || portability.length === 0) {
    return 'No portability records found.';
  }

  return portability
    .map(
      (entry) =>
        `Pattern: ${String(entry.pattern_id)}

Source Repo:
${String(entry.source_repo)}

Portability Score:
${String(entry.portability_score)}

Evidence Runs:
${String(entry.evidence_runs)}

Compatible Subsystems:
${((entry.compatible_subsystems as unknown[] | undefined) ?? []).map(String).join('\n')}

Risk Signals:
${((entry.risk_signals as unknown[] | undefined) ?? []).map(String).join('\n')}`
    )
    .join('\n\n---\n\n');
};

const renderPortabilityRecommendationsText = (payload: Record<string, unknown>): string => {
  const recommendations = payload.recommendations as Array<Record<string, unknown>> | undefined;
  if (!recommendations || recommendations.length === 0) {
    return 'No portability recommendations found.';
  }

  return recommendations
    .map(
      (entry) =>
        `Pattern: ${String(entry.pattern)}
Source Repo: ${String(entry.source_repo)}
Target Repo: ${String(entry.target_repo)}
Initial Portability Score: ${String(entry.initial_portability_score)}
Decision Status: ${String(entry.decision_status)}
Evidence Count: ${String(entry.evidence_count)}`
    )
    .join('\n\n---\n\n');
};

const renderPortabilityOutcomesText = (payload: Record<string, unknown>): string => {
  const outcomes = payload.outcomes as Array<Record<string, unknown>> | undefined;
  if (!outcomes || outcomes.length === 0) {
    return 'No portability outcomes found.';
  }

  return outcomes
    .map(
      (entry) =>
        `Pattern: ${String(entry.pattern)}
Source Repo: ${String(entry.source_repo)}
Target Repo: ${String(entry.target_repo)}
Initial Portability Score: ${String(entry.initial_portability_score)}
Adoption Status: ${String(entry.adoption_status)}
Observed Outcome: ${String(entry.observed_outcome)}
Sample Size: ${String(entry.sample_size)}`
    )
    .join('\n\n---\n\n');
};

const renderPortabilityRecalibrationText = (payload: Record<string, unknown>): string => {
  const recalibration = payload.recalibration as Array<Record<string, unknown>> | undefined;
  if (!recalibration || recalibration.length === 0) {
    return 'No portability confidence recalibration records found.';
  }

  return recalibration
    .map(
      (entry) =>
        `Pattern: ${String(entry.pattern)}
Source Repo: ${String(entry.source_repo)}
Target Repo: ${String(entry.target_repo)}
Initial Portability Score: ${String(entry.initial_portability_score)}
Recalibrated Confidence: ${String(entry.recalibrated_confidence)}
Evidence Count: ${String(entry.evidence_count)}
Sample Size: ${String(entry.sample_size)}`
    )
    .join('\n\n---\n\n');
};

const renderText = (subcommand: string, payload: Record<string, unknown>): string => {
  if (subcommand === 'inspect') {
    const knowledge = payload.knowledge as Record<string, unknown>;
    return `Knowledge ${String(payload.id)} (${String(knowledge.type ?? 'unknown')}).`;
  }

  if (subcommand === 'provenance') {
    const provenance = payload.provenance as { evidence?: unknown[]; relatedRecords?: unknown[] } | undefined;
    return `Resolved provenance for ${String(payload.id)} (${provenance?.evidence?.length ?? 0} evidence records, ${provenance?.relatedRecords?.length ?? 0} related records).`;
  }

  if (subcommand === 'portability') {
    const command = String(payload.command ?? '');
    if (command === 'knowledge-portability-recommendations') {
      return renderPortabilityRecommendationsText(payload);
    }
    if (command === 'knowledge-portability-outcomes') {
      return renderPortabilityOutcomesText(payload);
    }
    if (command === 'knowledge-portability-recalibration') {
      return renderPortabilityRecalibrationText(payload);
    }
    return renderPortabilityText(payload);
  }

  const knowledge = payload.knowledge as unknown[] | undefined;
  return `Found ${knowledge?.length ?? 0} knowledge records.`;
};

export const runKnowledge = async (cwd: string, args: string[], options: KnowledgeCommandOptions): Promise<number> => {
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  if (!subcommand || args.includes('--help') || args.includes('-h')) {
    if (subcommand === 'portability') {
      printKnowledgePortabilityHelp();
      return ExitCode.Success;
    }

    printKnowledgeHelp();
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  try {
    const payload = (() => {
      if (subcommand === 'list') {
        return runKnowledgeList(cwd, args);
      }
      if (subcommand === 'query') {
        return runKnowledgeQuery(cwd, args);
      }
      if (subcommand === 'inspect') {
        return runKnowledgeInspect(cwd, args);
      }
      if (subcommand === 'timeline') {
        return runKnowledgeTimeline(cwd, args);
      }
      if (subcommand === 'provenance') {
        return runKnowledgeProvenance(cwd, args);
      }
      if (subcommand === 'stale') {
        return runKnowledgeStale(cwd, args);
      }
      if (subcommand === 'portability') {
        return runKnowledgePortability(cwd, parsePortabilityView(args));
      }

      throw new Error('playbook knowledge: unsupported subcommand. Use list, query, inspect, timeline, provenance, stale, or portability.');
    })();

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: `knowledge ${subcommand}`, payload });
    } else if (!options.quiet) {
      console.log(renderText(subcommand, payload as Record<string, unknown>));
    }

    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: `knowledge-${subcommand}`, error: message }, null, 2));
    } else {
      console.error(message);
    }

    return ExitCode.Failure;
  }
};
