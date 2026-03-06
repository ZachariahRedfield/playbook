import type { FixHandler, FixHandlerResult, PlanTask } from './types.js';

export type ApplyTaskStatus = 'applied' | 'skipped' | 'unsupported' | 'failed';

export type HandlerSource = 'builtin' | 'plugin';

export type ResolvedHandler = {
  source: HandlerSource;
  handlerId: string;
  handler: FixHandler;
};

export type HandlerRegistry = {
  builtIn: Record<string, FixHandler>;
  plugin?: Record<string, FixHandler | undefined>;
};

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

const validateFilesChanged = (filesChanged: unknown): string[] => {
  if (!Array.isArray(filesChanged)) {
    throw new Error('Fix handler contract violation: filesChanged must be an array.');
  }

  if (filesChanged.some((file) => typeof file !== 'string' || file.trim().length === 0)) {
    throw new Error('Fix handler contract violation: filesChanged entries must be non-empty strings.');
  }

  return filesChanged;
};

const validateAppliedHandlerResult = (result: FixHandlerResult, task: PlanTask): void => {
  const filesChanged = validateFilesChanged(result.filesChanged);

  if (typeof result.summary !== 'string' || result.summary.trim().length === 0) {
    throw new Error('Fix handler contract violation: summary must be a non-empty string for applied handlers.');
  }

  if (task.file && !filesChanged.includes(task.file)) {
    throw new Error(`Fix handler contract violation: filesChanged must include ${task.file}.`);
  }
};

const validateNonAppliedHandlerResult = (result: FixHandlerResult, status: 'skipped' | 'unsupported'): void => {
  if (typeof result.message !== 'string' || result.message.trim().length === 0) {
    throw new Error(`Fix handler contract violation: message must be a non-empty string for ${status} handlers.`);
  }

  if (result.filesChanged !== undefined) {
    throw new Error(`Fix handler contract violation: ${status} handlers must not return filesChanged.`);
  }
};

const validateHandlerResult = (result: FixHandlerResult, task: PlanTask): void => {
  if (!result || typeof result !== 'object') {
    throw new Error('Fix handler contract violation: handler must return an object result.');
  }

  if (result.status === 'applied') {
    validateAppliedHandlerResult(result, task);
    return;
  }

  if (result.status === 'skipped' || result.status === 'unsupported') {
    validateNonAppliedHandlerResult(result, result.status);
    return;
  }

  throw new Error('Fix handler contract violation: status must be one of applied, skipped, or unsupported.');
};

const summarize = (results: ApplyTaskResult[]): ApplySummary => ({
  applied: results.filter((result) => result.status === 'applied').length,
  skipped: results.filter((result) => result.status === 'skipped').length,
  unsupported: results.filter((result) => result.status === 'unsupported').length,
  failed: results.filter((result) => result.status === 'failed').length
});

export class HandlerResolver {
  constructor(private readonly registry: HandlerRegistry) {}

  resolve(task: PlanTask): ResolvedHandler | null {
    const pluginHandler = this.registry.plugin?.[task.ruleId];
    if (pluginHandler) {
      return {
        source: 'plugin',
        handlerId: task.ruleId,
        handler: pluginHandler
      };
    }

    const builtInHandler = this.registry.builtIn[task.ruleId];
    if (builtInHandler) {
      return {
        source: 'builtin',
        handlerId: task.ruleId,
        handler: builtInHandler
      };
    }

    return null;
  }
}

export class FixExecutor {
  constructor(private readonly resolver: HandlerResolver) {}

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

      const resolved = this.resolver.resolve(task);
      if (!resolved) {
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
        const handlerResult = await resolved.handler({ repoRoot: options.repoRoot, dryRun: options.dryRun, task });
        validateHandlerResult(handlerResult, task);
        results.push({
          id: task.id,
          ruleId: task.ruleId,
          file: task.file,
          action: task.action,
          autoFix: task.autoFix,
          status: handlerResult.status,
          message: handlerResult.message
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
