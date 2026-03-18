import fs from 'node:fs';
import path from 'node:path';

export type DoctrineExtractionKind = 'rule' | 'pattern' | 'failure-mode';

export type DoctrineExtractionInput = {
  title?: string;
  summary: string;
  changedFiles?: string[];
  prSummary?: string;
};

export type DoctrineExtractionEntry = {
  kind: DoctrineExtractionKind;
  title: string;
  statement: string;
  rationale: string;
  confidence: 'high' | 'medium';
  sourceSignals: string[];
};

export type DoctrineExtractionSuggestion = {
  target: 'notes' | 'patterns-docs' | 'changelog' | 'verification';
  summary: string;
  rationale: string;
};

export type DoctrineCheckCandidate = {
  name: string;
  summary: string;
  scope: 'docs' | 'artifacts' | 'command-contract' | 'architecture';
};

export type DoctrineExtractionResult = {
  schemaVersion: '1.0';
  command: 'learn-doctrine';
  mode: 'report-only';
  source: {
    inputPath?: string;
    title?: string;
    changedFiles: string[];
  };
  conciseChangeSummary: string[];
  learned: {
    rules: DoctrineExtractionEntry[];
    patterns: DoctrineExtractionEntry[];
    failureModes: DoctrineExtractionEntry[];
  };
  suggestedNotesUpdate: DoctrineExtractionSuggestion[];
  candidateFutureChecks: DoctrineCheckCandidate[];
};

type DoctrineFixture = {
  id: string;
  matchAll: string[];
  rule: Omit<DoctrineExtractionEntry, 'kind'>;
  pattern: Omit<DoctrineExtractionEntry, 'kind'>;
  failureMode: Omit<DoctrineExtractionEntry, 'kind'>;
  notesSuggestion: DoctrineExtractionSuggestion;
  futureCheck: DoctrineCheckCandidate;
};

const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const containsAll = (haystack: string, needles: string[]): boolean => needles.every((needle) => haystack.includes(normalizeText(needle)));

const sortDoctrineEntries = (entries: DoctrineExtractionEntry[]): DoctrineExtractionEntry[] =>
  [...entries].sort((left, right) => left.title.localeCompare(right.title));

const sortSuggestions = (entries: DoctrineExtractionSuggestion[]): DoctrineExtractionSuggestion[] =>
  [...entries].sort((left, right) => left.summary.localeCompare(right.summary));

const sortChecks = (entries: DoctrineCheckCandidate[]): DoctrineCheckCandidate[] =>
  [...entries].sort((left, right) => left.name.localeCompare(right.name));

const summarizeLines = (input: DoctrineExtractionInput): string[] => {
  const rawSegments = [input.title ?? '', input.summary, input.prSummary ?? '']
    .join('\n')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const summary = rawSegments.slice(0, 3);
  if (input.changedFiles && input.changedFiles.length > 0) {
    summary.push(`Touched ${input.changedFiles.length} file(s): ${input.changedFiles.join(', ')}`);
  }
  return summary;
};

const fixtures: DoctrineFixture[] = [
  {
    id: 'artifact-governance-staged-promotion',
    matchAll: ['artifact governance', 'staged promotion'],
    rule: {
      title: 'Generated artifacts must be staged and promoted only after validation succeeds.',
      statement: 'Generated artifacts must be produced in staging and promoted only after validation succeeds.',
      rationale: 'The merged work reinforced that repo-visible outputs need a gated candidate lifecycle instead of direct writes.',
      confidence: 'high',
      sourceSignals: ['artifact governance', 'staged promotion']
    },
    pattern: {
      title: 'Generate -> validate -> promote for artifact workflows.',
      statement: 'Use isolated candidate generation plus gated promotion for deterministic artifact workflows.',
      rationale: 'The change summary points to artifact creation and validation happening as a staged workflow, not inline mutation.',
      confidence: 'high',
      sourceSignals: ['artifact governance', 'staged promotion']
    },
    failureMode: {
      title: 'Premature artifact writes create governance drift.',
      statement: 'Writing or validating committed outputs too early causes false failures, drift, and unsafe partial promotion.',
      rationale: 'The pilot examples explicitly identify early committed-output writes as the fragile path to avoid.',
      confidence: 'high',
      sourceSignals: ['artifact governance', 'staged promotion']
    },
    notesSuggestion: {
      target: 'notes',
      summary: 'Document that post-merge learning should capture staged-promotion lessons as reusable doctrine rather than leaving them only in PR context.',
      rationale: 'This keeps artifact-governance lessons searchable in Playbook notes after merge.'
    },
    futureCheck: {
      name: 'staged-artifact-promotion-contract',
      summary: 'Verify that durable artifact writers expose staged candidate generation and promotion metadata instead of direct committed writes.',
      scope: 'artifacts'
    }
  },
  {
    id: 'workflow-promotion-contract',
    matchAll: ['workflow-promotion contract'],
    rule: {
      title: 'Durable workflow outputs must expose normalized promotion metadata.',
      statement: 'Durable workflow outputs must expose normalized staged-promotion metadata when they write repo-visible state.',
      rationale: 'The merged work indicates workflow promotion is a shared contract, not command-local shape drift.',
      confidence: 'high',
      sourceSignals: ['workflow-promotion contract']
    },
    pattern: {
      title: 'Shared workflow-promotion contract.',
      statement: 'Reuse one shared workflow-promotion contract instead of command-local promotion result shapes.',
      rationale: 'A shared receipt lets humans and automation reason about durable writeback semantics consistently.',
      confidence: 'high',
      sourceSignals: ['workflow-promotion contract']
    },
    failureMode: {
      title: 'Workflow promotion metadata fragments across commands.',
      statement: 'Ad hoc workflow promotion metadata fragments governance semantics and makes higher-level reasoning inconsistent.',
      rationale: 'If each command invents its own promotion shape, doctrine extraction and observer surfaces drift.',
      confidence: 'high',
      sourceSignals: ['workflow-promotion contract']
    },
    notesSuggestion: {
      target: 'patterns-docs',
      summary: 'Add the shared workflow-promotion contract to doctrine notes as the standard durable-write receipt boundary.',
      rationale: 'This turns a one-off implementation detail into reusable guidance for future commands.'
    },
    futureCheck: {
      name: 'workflow-promotion-shape-regression',
      summary: 'Validate that commands writing durable repo-visible artifacts return the shared workflow-promotion receipt shape.',
      scope: 'command-contract'
    }
  },
  {
    id: 'shared-aggregation-boundary',
    matchAll: ['shared aggregation boundary'],
    rule: {
      title: 'Read interpretation should converge on one aggregation boundary.',
      statement: 'Read models should compose through one shared aggregation boundary so interpretation and diagnostics read the same truth.',
      rationale: 'The merged summary highlights a boundary for shared reads instead of duplicated local aggregators.',
      confidence: 'high',
      sourceSignals: ['shared aggregation boundary']
    },
    pattern: {
      title: 'Shared aggregation boundary for reads.',
      statement: 'Shared aggregation boundary for reads, targeted invalidation boundary for writes.',
      rationale: 'The read path should centralize interpretation while the write path stays explicit about invalidation.',
      confidence: 'high',
      sourceSignals: ['shared aggregation boundary']
    },
    failureMode: {
      title: 'Split read models drift apart.',
      statement: 'If interpretation and diagnostics rely on different aggregation paths, humans and automation stop reading the same truth.',
      rationale: 'The pilot examples show that duplicated read composition creates doctrine and debugging drift.',
      confidence: 'medium',
      sourceSignals: ['shared aggregation boundary']
    },
    notesSuggestion: {
      target: 'patterns-docs',
      summary: 'Record the shared-read-boundary lesson in patterns/docs so future architecture changes reuse one interpretation seam.',
      rationale: 'This lesson is architectural doctrine, not just implementation detail.'
    },
    futureCheck: {
      name: 'shared-aggregation-boundary-usage',
      summary: 'Check that read-oriented command/report surfaces route through shared aggregation helpers instead of bespoke local aggregation.',
      scope: 'architecture'
    }
  },
  {
    id: 'centralized-recompute',
    matchAll: ['centralized recompute'],
    rule: {
      title: 'Mutation handling should flow through canonical ids and centralized recompute.',
      statement: 'Mutation handling should flow through canonical IDs and centralized recompute rather than distributed bespoke refresh logic.',
      rationale: 'The merged work explicitly connects writes to targeted invalidation and one recompute path.',
      confidence: 'high',
      sourceSignals: ['centralized recompute']
    },
    pattern: {
      title: 'Mutation path -> affected canonical IDs -> centralized recompute.',
      statement: 'Mutation path -> affected canonical IDs -> centralized recompute.',
      rationale: 'This preserves deterministic recomputation boundaries after local mutations.',
      confidence: 'high',
      sourceSignals: ['centralized recompute']
    },
    failureMode: {
      title: 'Refresh logic scatters across mutation sites.',
      statement: 'Distributed bespoke refresh logic makes cache invalidation and post-merge recompute behavior inconsistent.',
      rationale: 'Without one recompute path, doctrine and runtime state drift per mutation site.',
      confidence: 'medium',
      sourceSignals: ['centralized recompute']
    },
    notesSuggestion: {
      target: 'notes',
      summary: 'Capture the centralized recompute doctrine so future write paths map mutations to canonical IDs before refresh.',
      rationale: 'This preserves the pilot lesson for later subsystems.'
    },
    futureCheck: {
      name: 'canonical-id-recompute-path',
      summary: 'Add regression coverage that mutations invalidate affected canonical IDs and trigger centralized recompute helpers instead of local bespoke refresh.',
      scope: 'architecture'
    }
  }
];

const fallbackEntry = (kind: DoctrineExtractionKind, statement: string): DoctrineExtractionEntry => ({
  kind,
  title: kind === 'rule'
    ? 'Post-merge learning should extract reusable doctrine from real code changes.'
    : kind === 'pattern'
      ? 'Real merged changes should become reusable learning artifacts.'
      : 'Doctrine remains trapped in conversation without extraction.',
  statement,
  rationale: 'No seeded pilot fixture matched exactly, so the command fell back to the repository-wide post-merge learning doctrine.',
  confidence: 'medium',
  sourceSignals: ['fallback']
});

export const readDoctrineExtractionInput = (projectRoot: string, inputPath: string): DoctrineExtractionInput => {
  const resolvedPath = path.resolve(projectRoot, inputPath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');

  if (resolvedPath.endsWith('.json')) {
    const parsed = JSON.parse(raw) as DoctrineExtractionInput;
    return {
      title: parsed.title,
      summary: String(parsed.summary ?? parsed.prSummary ?? ''),
      changedFiles: Array.isArray(parsed.changedFiles) ? parsed.changedFiles.map(String) : [],
      prSummary: typeof parsed.prSummary === 'string' ? parsed.prSummary : undefined
    };
  }

  return { summary: raw };
};

export const extractDoctrineFromSummary = (
  input: DoctrineExtractionInput,
  options?: { inputPath?: string }
): DoctrineExtractionResult => {
  const corpus = normalizeText([input.title ?? '', input.summary, input.prSummary ?? '', ...(input.changedFiles ?? [])].join('\n'));
  const matched = fixtures.filter((fixture) => containsAll(corpus, fixture.matchAll));

  const rules: DoctrineExtractionEntry[] = matched.map((fixture) => ({ kind: 'rule' as const, ...fixture.rule }));
  const patterns: DoctrineExtractionEntry[] = matched.map((fixture) => ({ kind: 'pattern' as const, ...fixture.pattern }));
  const failureModes: DoctrineExtractionEntry[] = matched.map((fixture) => ({ kind: 'failure-mode' as const, ...fixture.failureMode }));
  const suggestedNotesUpdate: DoctrineExtractionSuggestion[] = matched.map((fixture) => fixture.notesSuggestion);
  const candidateFutureChecks: DoctrineCheckCandidate[] = matched.map((fixture) => fixture.futureCheck);

  if (matched.length === 0) {
    rules.push(
      fallbackEntry('rule', 'Post-merge learning should extract reusable doctrine from real code changes.')
    );
    patterns.push(
      fallbackEntry('pattern', 'Summarize merged changes into reusable Rule/Pattern/Failure Mode outputs before the context is lost.')
    );
    failureModes.push(
      fallbackEntry('failure-mode', 'Valuable engineering doctrine remains trapped in conversations and PR context unless extracted into reusable system knowledge.')
    );
    suggestedNotesUpdate.push({
      target: 'notes',
      summary: 'Add the merged change summary to notes as reusable doctrine and link the next verification candidate.',
      rationale: 'Fallback mode still preserves the post-merge learning loop without mutating source-of-truth docs automatically.'
    });
    candidateFutureChecks.push({
      name: 'post-merge-doctrine-coverage',
      summary: 'Add fixture-based regression coverage that ensures merged change summaries always yield report-only doctrine output.',
      scope: 'command-contract'
    });
  }

  return {
    schemaVersion: '1.0',
    command: 'learn-doctrine',
    mode: 'report-only',
    source: {
      inputPath: options?.inputPath,
      title: input.title,
      changedFiles: [...(input.changedFiles ?? [])].sort((left, right) => left.localeCompare(right))
    },
    conciseChangeSummary: summarizeLines(input),
    learned: {
      rules: sortDoctrineEntries(rules),
      patterns: sortDoctrineEntries(patterns),
      failureModes: sortDoctrineEntries(failureModes)
    },
    suggestedNotesUpdate: sortSuggestions(suggestedNotesUpdate),
    candidateFutureChecks: sortChecks(candidateFutureChecks)
  };
};
