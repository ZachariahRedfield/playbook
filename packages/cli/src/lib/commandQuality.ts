import {
  appendCommandExecutionQualityRecord,
  recordCommandExecution,
  recordCommandQuality,
  safeRecordRepositoryEvent} from '@zachariahredfield/playbook-engine';
type CommandSuccessStatus = 'success' | 'failure' | 'partial';

export type CommandQualityTracker = {
  runId: string;
  finish: (input: {
    inputsSummary: string;
    artifactsRead?: string[];
    artifactsWritten?: string[];
    downstreamArtifactsProduced?: string[];
    successStatus: CommandSuccessStatus;
    warningsCount?: number;
    openQuestionsCount?: number;
    confidenceScore?: number;
  }) => void;
};

export const createCommandQualityTracker = (cwd: string, commandName: string): CommandQualityTracker => {
  const start = Date.now();
  const runId = `${commandName}-${start}`;

  return {
    runId,
    finish: (input) => {
      const durationMs = Date.now() - start;
      const warningsCount = input.warningsCount ?? 0;
      const openQuestionsCount = input.openQuestionsCount ?? 0;
      const confidenceScore = input.confidenceScore ?? (input.successStatus === 'success' ? 0.8 : input.successStatus === 'partial' ? 0.5 : 0.2);
      const artifactsRead = input.artifactsRead ?? [];
      const artifactsWritten = input.artifactsWritten ?? [];
      const downstreamArtifactsProduced = input.downstreamArtifactsProduced ?? [];

      try {
        appendCommandExecutionQualityRecord(cwd, {
          command_name: commandName,
          run_id: runId,
          inputs_summary: input.inputsSummary,
          artifacts_read: artifactsRead,
          artifacts_written: artifactsWritten,
          success_status: input.successStatus,
          duration_ms: durationMs,
          warnings_count: warningsCount,
          open_questions_count: openQuestionsCount,
          confidence_score: confidenceScore,
          downstream_artifacts_produced: downstreamArtifactsProduced
        });
      } catch {
        // Command-quality telemetry is best-effort and must never mask command outcomes.
      }

      safeRecordRepositoryEvent(() => {
        recordCommandExecution(cwd, {
          run_id: runId,
          command_name: commandName,
          success_status: input.successStatus,
          duration_ms: durationMs,
          artifacts_read: artifactsRead,
          artifacts_written: artifactsWritten,
          related_artifacts: [{ path: '.playbook/telemetry/command-quality.json', kind: 'command_quality' }]
        });

        recordCommandQuality(cwd, {
          run_id: runId,
          command_name: commandName,
          success_status: input.successStatus,
          confidence_score: confidenceScore,
          warnings_count: warningsCount,
          open_questions_count: openQuestionsCount,
          related_artifacts: [{ path: '.playbook/telemetry/command-quality.json', kind: 'command_quality' }]
        });
      });
    }
  };
};
