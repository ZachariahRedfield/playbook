import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runReviewPr } from './reviewPr.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
const runGit = (repo: string, args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const initGitRepo = (repo: string): void => {
  runGit(repo, ['init']);
  runGit(repo, ['config', 'user.email', 'bot@example.com']);
  runGit(repo, ['config', 'user.name', 'Playbook Bot']);
  runGit(repo, ['checkout', '-b', 'main']);
};

const writeRepoIndex = (repo: string): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        framework: 'node',
        language: 'typescript',
        architecture: 'modular-monolith',
        modules: [
          { name: 'auth', dependencies: [] },
          { name: 'workouts', dependencies: ['auth'] }
        ],
        database: 'postgres',
        rules: ['PB001']
      },
      null,
      2
    )
  );
};

const seedImproveInputs = (repo: string): void => {
  const learningPath = path.join(repo, '.playbook', 'learning-state.json');
  fs.mkdirSync(path.dirname(learningPath), { recursive: true });
  fs.writeFileSync(
    learningPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'learning-state-snapshot',
        generatedAt: '2026-01-01T00:00:00.000Z',
        proposalOnly: true,
        sourceArtifacts: {
          outcomeTelemetry: { available: true, recordCount: 1, artifactPath: '.playbook/outcome-telemetry.json' },
          processTelemetry: { available: true, recordCount: 1, artifactPath: '.playbook/process-telemetry.json' },
          taskExecutionProfile: { available: true, recordCount: 1, artifactPath: '.playbook/task-execution-profile.json' }
        },
        metrics: {
          sample_size: 4,
          first_pass_yield: 0.9,
          retry_pressure: { docs_only: 0 },
          validation_load_ratio: 0.7,
          route_efficiency_score: { docs_only: 0.9 },
          smallest_sufficient_route_score: 0.8,
          parallel_safety_realized: 0.9,
          router_fit_score: 0.85,
          reasoning_scope_efficiency: 0.8,
          validation_cost_pressure: 0.9,
          pattern_family_effectiveness_score: { docs_only: 0.9 },
          portability_confidence: 0.7
        },
        confidenceSummary: {
          sample_size_score: 0.7,
          coverage_score: 0.7,
          evidence_completeness_score: 0.8,
          overall_confidence: 0.9,
          open_questions: []
        }
      },
      null,
      2
    )
  );

  const eventsDir = path.join(repo, '.playbook', 'memory', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  for (let i = 0; i < 3; i += 1) {
    fs.writeFileSync(
      path.join(eventsDir, `event-${i}.json`),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          event_type: 'improvement_candidate',
          event_id: `event-${i}`,
          timestamp: `2026-01-0${i + 1}T00:00:00.000Z`,
          source: 'ontology-observer',
          summary: 'Ontology drift in route taxonomy',
          confidence: 0.9
        },
        null,
        2
      )
    );
  }
};

const seedRepoWithDiff = (repo: string): void => {
  writeRepoIndex(repo);
  seedImproveInputs(repo);

  fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
  runGit(repo, ['add', '.']);
  runGit(repo, ['commit', '-m', 'initial']);

  fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');
};

describe('runReviewPr', () => {
  it('fails deterministically when there are no changed files', async () => {
    const repo = createRepo('playbook-review-pr-empty');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runReviewPr(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('review-pr');
    expect(payload.findings[0].id).toBe('review-pr.pipeline.failed');

    logSpy.mockRestore();
  });

  it('returns review output with findings, proposals, policy buckets, and stable schema', async () => {
    const repo = createRepo('playbook-review-pr');
    initGitRepo(repo);
    seedRepoWithDiff(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runReviewPr(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({ schemaVersion: '1.0', kind: 'pr-review' });
    expect(Object.keys(payload)).toEqual(['schemaVersion', 'kind', 'findings', 'proposals', 'policy', 'summary']);
    expect(Array.isArray(payload.findings)).toBe(true);
    expect(Array.isArray(payload.proposals)).toBe(true);
    expect(Array.isArray(payload.policy.safe)).toBe(true);
    expect(Array.isArray(payload.policy.requires_review)).toBe(true);
    expect(Array.isArray(payload.policy.blocked)).toBe(true);

    expect(payload.summary.findings).toBe(payload.findings.length);
    expect(payload.summary.proposals).toBe(payload.proposals.length);
    expect(payload.summary.safe).toBe(payload.policy.safe.length);
    expect(payload.summary.requires_review).toBe(payload.policy.requires_review.length);
    expect(payload.summary.blocked).toBe(payload.policy.blocked.length);

    const persisted = JSON.parse(fs.readFileSync(path.join(repo, '.playbook', 'pr-review.json'), 'utf8')) as Record<string, unknown>;
    expect(persisted).toEqual(payload);

    logSpy.mockRestore();
  });

  it('groups policy evaluations into expected classification buckets', async () => {
    const repo = createRepo('playbook-review-pr-policy');
    initGitRepo(repo);
    seedRepoWithDiff(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runReviewPr(repo, { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const allPolicyIds = [...payload.policy.safe, ...payload.policy.requires_review, ...payload.policy.blocked].map((entry: { proposal_id: string }) => entry.proposal_id);
    const proposalIds = (payload.proposals as Array<{ candidate_id: string }>).map((entry) => entry.candidate_id);

    expect(new Set(allPolicyIds)).toEqual(new Set(proposalIds));

    logSpy.mockRestore();
  });

  it('is deterministic for repeated json invocations', async () => {
    const repo = createRepo('playbook-review-pr-deterministic');
    initGitRepo(repo);
    seedRepoWithDiff(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const firstExitCode = await runReviewPr(repo, { format: 'json', quiet: false });
    const firstPayload = String(logSpy.mock.calls[0]?.[0]);
    logSpy.mockClear();

    const secondExitCode = await runReviewPr(repo, { format: 'json', quiet: false });
    const secondPayload = String(logSpy.mock.calls[0]?.[0]);

    expect(firstExitCode).toBe(ExitCode.Success);
    expect(secondExitCode).toBe(ExitCode.Success);
    expect(secondPayload).toBe(firstPayload);

    const reviewArtifact = JSON.parse(firstPayload) as { findings: Array<{ ruleId?: string }> };
    expect(reviewArtifact.findings).not.toContainEqual(expect.objectContaining({ ruleId: 'playbook.pr.contract-surface' }));

    const firstArtifact = fs.readFileSync(path.join(repo, '.playbook', 'pr-review.json'), 'utf8');
    await runReviewPr(repo, { format: 'text', quiet: true });
    const secondArtifact = fs.readFileSync(path.join(repo, '.playbook', 'pr-review.json'), 'utf8');
    expect(secondArtifact).toBe(firstArtifact);

    logSpy.mockRestore();
  });

  it('renders github-comment format', async () => {
    const repo = createRepo('playbook-review-pr-gh-comment');
    initGitRepo(repo);
    seedRepoWithDiff(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runReviewPr(repo, { format: 'github-comment', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = String(logSpy.mock.calls[0]?.[0]);
    expect(output).toContain('## ✅ Playbook PR Review');
    expect(output).toContain('| Findings |');

    logSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers review-pr command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'review-pr');
    expect(command).toBeDefined();
    expect(command?.description).toContain('read-only PR review');
  });
});
