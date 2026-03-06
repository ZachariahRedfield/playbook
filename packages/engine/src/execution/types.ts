export type RuleFailure = {
  id: string;
  message: string;
  evidence?: string;
  fix?: string;
};

export type Rule = {
  id: string;
  description: string;
  check(context: { repoRoot: string; changedFiles: string[] }): { failures: RuleFailure[] };
};

export type PlanTask = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
};

export type FixHandlerContext = {
  repoRoot: string;
  dryRun: boolean;
  task: Readonly<PlanTask>;
};

export type FixHandlerStatus = 'applied' | 'skipped' | 'unsupported';

export type FixHandlerResult = {
  status: FixHandlerStatus;
  filesChanged?: string[];
  summary?: string;
  message?: string;
};

/**
 * Deterministic execution contract for apply handlers.
 *
 * Handler boundary:
 * - Accept only repoRoot/dryRun/task input.
 * - Return an explicit status result (applied/skipped/unsupported).
 * - Throw to signal failed execution.
 * - Keep mutations bounded to deterministic file edits that correspond to the task.
 */
export type FixHandler = (context: FixHandlerContext) => Promise<FixHandlerResult>;
