import type { FixHandler, PlanTask } from './types.js';

export type ApplyTaskStatus = 'applied' | 'skipped' | 'unsupported' | 'failed';

export type ApplyTaskResult = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
  status: ApplyTaskStatus;
  message?: string;
};

export type ApplySummary = {
  applied: number;
  skipped: number;
  unsupported: number;
  failed: number;
};

export type FixExecutionResult = {
  results: ApplyTaskResult[];
  summary: ApplySummary;
};

const toMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
};

const validateHandlerResult = (result: { filesChanged: string[]; summary: string }, task: PlanTask): void => {
  if (!Array.isArray(result.filesChanged)) {
    throw new Error('Fix handler contract violation: filesChanged must be an array.');
  }

  if (result.filesChanged.some((file) => typeof file !== 'string' || file.trim().length === 0)) {
    throw new Error('Fix handler contract violation: filesChanged entries must be non-empty strings.');
  }

  if (typeof result.summary !== 'string' || result.summary.trim().length === 0) {
    throw new Error('Fix handler contract violation: summary must be a non-empty string.');
  }

  if (task.file && !result.filesChanged.includes(task.file)) {
    throw new Error(`Fix handler contract violation: filesChanged must include ${task.file}.`);
  }
};

const summarize = (results: ApplyTaskResult[]): ApplySummary => ({
  applied: results.filter((result) => result.status === 'applied').length,
  skipped: results.filter((result) => result.status === 'skipped').length,
  unsupported: results.filter((result) => result.status === 'unsupported').length,
  failed: results.filter((result) => result.status === 'failed').length
});

export class FixExecutor {
  constructor(private readonly handlers: Record<string, FixHandler | undefined>) {}

  async apply(tasks: PlanTask[], options: { repoRoot: string; dryRun: boolean }): Promise<FixExecutionResult> {
    const results: ApplyTaskResult[] = [];

    for (const task of tasks) {
      if (!task.autoFix) {
        results.push({
          id: task.id,
          ruleId: task.ruleId,
          file: task.file,
          action: task.action,
          autoFix: task.autoFix,
          status: 'skipped',
          message: 'Task is not marked auto-fixable.'
        });
        continue;
      }

      const handler = this.handlers[task.ruleId];
      if (!handler) {
        results.push({
          id: task.id,
          ruleId: task.ruleId,
          file: task.file,
          action: task.action,
          autoFix: task.autoFix,
          status: 'unsupported',
          message: 'No deterministic handler is registered for this task.'
        });
        continue;
      }

      try {
        const handlerResult = await handler({ repoRoot: options.repoRoot, dryRun: options.dryRun });
        validateHandlerResult(handlerResult, task);
        results.push({
          id: task.id,
          ruleId: task.ruleId,
          file: task.file,
          action: task.action,
          autoFix: task.autoFix,
          status: 'applied'
        });
      } catch (error) {
        results.push({
          id: task.id,
          ruleId: task.ruleId,
          file: task.file,
          action: task.action,
          autoFix: task.autoFix,
          status: 'failed',
          message: toMessage(error)
        });
      }
    }

    return { results, summary: summarize(results) };
  }
}
