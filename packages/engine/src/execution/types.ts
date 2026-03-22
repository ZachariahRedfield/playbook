export type RuleFailure = {
  id: string;
  message: string;
  evidence?: string;
  fix?: string;
};

export type Rule = {
  id: string;
  description: string;
  check(context: { repoRoot: string; changedFiles: string[]; baseRef?: string; baseSha?: string }): { failures: RuleFailure[] };
};

export type DocsWritePreconditions = {
  target_path: string;
  target_file_fingerprint: string;
  managed_block_fingerprint?: string;
  anchor_context_hash?: string;
  approved_fragment_ids: string[];
  planned_operation: 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor';
};

export type PlanTask = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
  task_kind?: string;
  write?: {
    operation: 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor';
    blockId: string;
    startMarker: string;
    endMarker: string;
    anchor?: string;
    content: string;
  };
  provenance?: Record<string, unknown>;
  preconditions?: DocsWritePreconditions;
  advisory?: {
    outcomeLearning?: {
      influencedByKnowledgeIds: string[];
      rationale: string;
      scope: {
        ruleIdMatched: boolean;
        moduleMatched: boolean;
        failureShapeMatched: boolean;
      };
      support: {
        sourceCandidateCount: number;
        provenanceCount: number;
        eventFingerprintCount: number;
      };
      confidence: number;
    };
  };
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
  details?: Record<string, unknown>;
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
