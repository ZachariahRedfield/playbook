import type { KnowledgeQueryOptions } from '@zachariahredfield/playbook-engine';

type KnowledgeType = NonNullable<KnowledgeQueryOptions['type']>;
type KnowledgeStatus = NonNullable<KnowledgeQueryOptions['status']>;

const knowledgeTypes: readonly KnowledgeType[] = ['evidence', 'candidate', 'promoted', 'superseded'] as const;
const knowledgeStatuses: readonly KnowledgeStatus[] = ['observed', 'active', 'stale', 'retired', 'superseded'] as const;

export type KnowledgeCommandOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

export const printKnowledgeHelp = (): void => {
  console.log(`Usage: playbook knowledge <subcommand> [options]

Inspect repository knowledge artifacts through read-only deterministic surfaces.

Subcommands:
  list                            List evidence, candidate, promoted, and superseded knowledge records
  query                           Filter knowledge records
  inspect <id>                    Inspect one knowledge record by id
  timeline                        Show the knowledge timeline
  provenance <id>                 Show provenance and related evidence for one record
  stale                           Show stale, retired, and superseded records
  portability                     Inspect cross-repo portability scoring evidence

Options:
  --type <type>                Filter by type (evidence|candidate|promoted|superseded)
  --status <status>            Filter by status (observed|active|stale|retired|superseded)
  --module <module>            Filter by module
  --rule <rule-id>             Filter by rule id
  --text <query>               Full-text filter across serialized records
  --limit <n>                  Limit returned records
  --order <asc|desc>           Ordering for list/timeline/stale (default desc)
  --days <n>                   Override stale threshold in days
  --json                       Print machine-readable JSON output
  --help                       Show help`);
};

export const printKnowledgePortabilityHelp = (): void => {
  console.log(`Usage: playbook knowledge portability [--view <view>] [--json]

Inspect cross-repo portability records through deterministic read-only views.

Views:
  overview                      Baseline portability scoring evidence (default)
  recommendations               Pattern transfer recommendations by source/target repo
  outcomes                      Adoption decisions and observed outcomes
  recalibration                 Confidence recalibration records with evidence/sample sizes

Options:
  --view <view>                 Select portability view (overview|recommendations|outcomes|recalibration)
  --json                        Print machine-readable JSON output
  --help                        Show help`);
};

export const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1] ?? null;
  }

  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  if (!prefixed) {
    return null;
  }

  return prefixed.slice(optionName.length + 1) || null;
};

export const parseIntegerOption = (raw: string | null, optionName: string): number | undefined => {
  if (raw === null) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`playbook knowledge: invalid ${optionName} value "${raw}"; expected a non-negative integer`);
  }

  return parsed;
};

export const parseOrderOption = (raw: string | null): 'asc' | 'desc' => {
  if (raw === null || raw === 'desc') {
    return 'desc';
  }
  if (raw === 'asc') {
    return 'asc';
  }
  throw new Error(`playbook knowledge: invalid --order value "${raw}"; expected asc or desc`);
};

export const parseTypeOption = (raw: string | null): KnowledgeType | undefined => {
  if (raw === null) {
    return undefined;
  }
  if ((knowledgeTypes as readonly string[]).includes(raw)) {
    return raw as KnowledgeType;
  }
  throw new Error(`playbook knowledge: invalid --type value "${raw}"`);
};

export const parseStatusOption = (raw: string | null): KnowledgeStatus | undefined => {
  if (raw === null) {
    return undefined;
  }
  if ((knowledgeStatuses as readonly string[]).includes(raw)) {
    return raw as KnowledgeStatus;
  }
  throw new Error(`playbook knowledge: invalid --status value "${raw}"`);
};

export const resolveSubcommandArgument = (args: string[]): string | null => {
  const positional = args.filter((arg) => !arg.startsWith('-'));
  if (positional.length < 2) {
    return null;
  }
  return positional[1] ?? null;
};

export const parseKnowledgeFilters = (args: string[]): KnowledgeQueryOptions => ({
  type: parseTypeOption(readOptionValue(args, '--type')),
  status: parseStatusOption(readOptionValue(args, '--status')),
  module: readOptionValue(args, '--module') ?? undefined,
  ruleId: readOptionValue(args, '--rule') ?? undefined,
  text: readOptionValue(args, '--text') ?? undefined,
  limit: parseIntegerOption(readOptionValue(args, '--limit'), '--limit'),
  order: parseOrderOption(readOptionValue(args, '--order')),
  staleDays: parseIntegerOption(readOptionValue(args, '--days'), '--days')
});
