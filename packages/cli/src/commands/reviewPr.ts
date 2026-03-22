import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzePullRequest,
  evaluateImprovementPolicy,
  generateImprovementCandidates,
  type ImprovementCandidatesArtifact,
  type PolicyEvaluationArtifact
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { createCommandQualityTracker } from '../lib/commandQuality.js';
import { emitCommandFailure, printCommandHelp } from '../lib/commandSurface.js';

type ReviewPrFormat = 'text' | 'json' | 'github-comment';

type ReviewPrOptions = {
  format: ReviewPrFormat;
  quiet: boolean;
  help?: boolean;
  baseRef?: string;
};

type AnalyzePullRequestResult = ReturnType<typeof analyzePullRequest>;

type PolicyEvaluationEntry = PolicyEvaluationArtifact['evaluations'][number];

export type ReviewPrArtifact = {
  schemaVersion: '1.0';
  kind: 'pr-review';
  findings: AnalyzePullRequestResult['findings'];
  proposals: ImprovementCandidatesArtifact['candidates'];
  policy: {
    safe: PolicyEvaluationEntry[];
    requires_review: PolicyEvaluationEntry[];
    blocked: PolicyEvaluationEntry[];
  };
  summary: {
    findings: number;
    proposals: number;
    safe: number;
    requires_review: number;
    blocked: number;
  };
};


const REVIEW_PR_ARTIFACT_RELATIVE_PATH = '.playbook/pr-review.json' as const;

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const writeReviewPrArtifact = (cwd: string, artifact: ReviewPrArtifact): void => {
  const artifactPath = path.join(cwd, REVIEW_PR_ARTIFACT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, deterministicStringify(artifact), 'utf8');
};

const printReviewPrHelp = (): void => {
  printCommandHelp({
    usage: 'playbook review-pr [options]',
    description: 'Run governed read-only PR review by composing analyze-pr, improve, and policy evaluate outputs.',
    options: [
      '--base <ref>                 Optional git base ref used for diff resolution',
      '--json                       Alias for --format=json',
      '--format <text|json|github-comment>  Output format',
      '--quiet                      Suppress success output in text mode',
      '--help                       Show help'
    ],
    artifacts: [
      '.playbook/repo-index.json (read)',
      '.playbook/memory/events/* (read)',
      '.playbook/learning-state.json (read)',
      '.playbook/cycle-history.json (read)',
      '.playbook/pr-review.json (write)'
    ]
  });
};

const toFailureRuntime = (options: ReviewPrOptions): { format: 'text' | 'json'; quiet: boolean } => ({
  format: options.format === 'json' ? 'json' : 'text',
  quiet: options.quiet
});

const validateReviewPrFormat = (format: ReviewPrFormat): string | null => {
  if (format === 'text' || format === 'json' || format === 'github-comment') {
    return null;
  }

  return `Unsupported review-pr format "${format}". Use one of: text, json, github-comment.`;
};

const toPolicyGroups = (evaluations: PolicyEvaluationArtifact['evaluations']): ReviewPrArtifact['policy'] => ({
  safe: evaluations.filter((evaluation: PolicyEvaluationEntry) => evaluation.decision === 'safe'),
  requires_review: evaluations.filter((evaluation: PolicyEvaluationEntry) => evaluation.decision === 'requires_review'),
  blocked: evaluations.filter((evaluation: PolicyEvaluationEntry) => evaluation.decision === 'blocked')
});

const createPolicyArtifactFromCandidates = (
  improvementArtifact: ImprovementCandidatesArtifact,
  cwd: string
): PolicyEvaluationArtifact => {
  const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-review-pr-'));

  try {
    const tempImprovementPath = path.join(tempRepo, '.playbook', 'improvement-candidates.json');
    fs.mkdirSync(path.dirname(tempImprovementPath), { recursive: true });
    fs.writeFileSync(tempImprovementPath, JSON.stringify(improvementArtifact, null, 2));

    const cycleHistoryPath = path.join(cwd, '.playbook', 'cycle-history.json');
    const tempCycleHistoryPath = path.join(tempRepo, '.playbook', 'cycle-history.json');
    if (fs.existsSync(cycleHistoryPath)) {
      fs.mkdirSync(path.dirname(tempCycleHistoryPath), { recursive: true });
      fs.copyFileSync(cycleHistoryPath, tempCycleHistoryPath);
    }

    return evaluateImprovementPolicy(tempRepo);
  } finally {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  }
};

const toReviewPrArtifact = (input: {
  analysis: AnalyzePullRequestResult;
  improvements: ImprovementCandidatesArtifact;
  policy: PolicyEvaluationArtifact;
}): ReviewPrArtifact => {
  const findings = [...input.analysis.findings].sort((left, right) => {
    const byRule = left.ruleId.localeCompare(right.ruleId);
    if (byRule !== 0) {
      return byRule;
    }

    return left.message.localeCompare(right.message);
  });
  const proposals = [...input.improvements.candidates].sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  const policy = toPolicyGroups(input.policy.evaluations);

  return {
    schemaVersion: '1.0',
    kind: 'pr-review',
    findings,
    proposals,
    policy,
    summary: {
      findings: findings.length,
      proposals: proposals.length,
      safe: policy.safe.length,
      requires_review: policy.requires_review.length,
      blocked: policy.blocked.length
    }
  };
};

const renderText = (artifact: ReviewPrArtifact): void => {
  console.log('PR review (governed, read-only)');
  console.log('───────────────────────────────');
  console.log(`Findings: ${artifact.summary.findings}`);
  console.log(`Proposals: ${artifact.summary.proposals}`);
  console.log(`Policy: safe=${artifact.summary.safe}, requires_review=${artifact.summary.requires_review}, blocked=${artifact.summary.blocked}`);
};

const renderGithubComment = (artifact: ReviewPrArtifact): string => {
  const lines: string[] = [
    '## ✅ Playbook PR Review',
    '',
    '| Category | Count |',
    '| --- | ---: |',
    `| Findings | ${artifact.summary.findings} |`,
    `| Proposals | ${artifact.summary.proposals} |`,
    `| Policy safe | ${artifact.summary.safe} |`,
    `| Policy requires_review | ${artifact.summary.requires_review} |`,
    `| Policy blocked | ${artifact.summary.blocked} |`
  ];

  if (artifact.policy.requires_review.length > 0) {
    lines.push('', '### Requires review');
    for (const evaluation of artifact.policy.requires_review) {
      lines.push(`- \`${evaluation.proposal_id}\`: ${evaluation.reason}`);
    }
  }

  if (artifact.policy.blocked.length > 0) {
    lines.push('', '### Blocked');
    for (const evaluation of artifact.policy.blocked) {
      lines.push(`- \`${evaluation.proposal_id}\`: ${evaluation.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

export const runReviewPr = async (cwd: string, options: ReviewPrOptions): Promise<number> => {
  const tracker = createCommandQualityTracker(cwd, 'review-pr');

  if (options.help) {
    printReviewPrHelp();
    tracker.finish({ inputsSummary: 'help=true', successStatus: 'success' });
    return ExitCode.Success;
  }

  const formatError = validateReviewPrFormat(options.format);
  if (formatError) {
    const exitCode = emitCommandFailure('review-pr', toFailureRuntime(options), {
      summary: 'Review-pr failed: unsupported format.',
      findingId: 'review-pr.format.unsupported',
      message: formatError,
      nextActions: ['Use `--format text`, `--format json`, or `--format github-comment`.']
    });
    tracker.finish({ inputsSummary: `format=${options.format}`, successStatus: 'failure', warningsCount: 1 });
    return exitCode;
  }

  try {
    const analysis = analyzePullRequest(cwd, {
      baseRef: options.baseRef,
      excludePaths: ['.playbook/pr-review.json'],
      excludePrefixes: ['.playbook/memory/events/']
    });
    const improvements = generateImprovementCandidates(cwd);
    const policy = createPolicyArtifactFromCandidates(improvements, cwd);

    const artifact = toReviewPrArtifact({ analysis, improvements, policy });
    writeReviewPrArtifact(cwd, artifact);

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'review-pr', payload: artifact });
    } else if (!options.quiet) {
      if (options.format === 'github-comment') {
        console.log(renderGithubComment(artifact));
      } else {
        renderText(artifact);
      }
    }

    tracker.finish({
      inputsSummary: `format=${options.format}`,
      artifactsRead: ['.playbook/repo-index.json', '.playbook/memory/events', '.playbook/learning-state.json', '.playbook/cycle-history.json'],
      artifactsWritten: ['.playbook/pr-review.json'],
      successStatus: 'success',
      warningsCount: artifact.summary.blocked + artifact.summary.requires_review
    });
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exitCode = emitCommandFailure('review-pr', toFailureRuntime(options), {
      summary: 'Review-pr failed: governed review pipeline did not complete.',
      findingId: 'review-pr.pipeline.failed',
      message,
      nextActions: [
        'Run `pnpm playbook index --json` to refresh repository intelligence.',
        'Validate diff context with `pnpm playbook analyze-pr --json` and retry.'
      ]
    });

    tracker.finish({ inputsSummary: `format=${options.format}`, successStatus: 'failure', warningsCount: 1 });
    return exitCode;
  }
};
