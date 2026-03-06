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

export type FixHandler = (context: { repoRoot: string; dryRun: boolean }) => Promise<{ filesChanged: string[]; summary: string }>;
