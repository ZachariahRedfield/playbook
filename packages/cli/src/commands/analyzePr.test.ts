import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runAnalyzePr } from './analyzePr.js';

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

const writePromotedKnowledge = (
  repo: string,
  kind: 'decision' | 'pattern' | 'failure_mode' | 'invariant',
  entries: Array<{
    knowledgeId: string;
    candidateId: string;
    sourceCandidateIds: string[];
    sourceEventFingerprints: string[];
    title: string;
    summary: string;
    fingerprint: string;
    module: string;
    ruleId: string;
    failureShape: string;
    promotedAt: string;
    status: 'active' | 'superseded' | 'retired';
    supersedes: string[];
    supersededBy: string[];
    provenance: Array<{ eventId: string; sourcePath: string; fingerprint: string; runId: string | null }>;
  }>
): void => {
  const artifactPath = path.join(repo, '.playbook', 'memory', 'knowledge', `${kind === 'failure_mode' ? 'failure-modes' : `${kind}s`}.json`);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        artifact: 'memory-knowledge',
        kind,
        generatedAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
        entries
      },
      null,
      2
    )
  );
};

const recentPromotedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const writeMemoryEvent = (repo: string, eventId: string, fingerprint: string, summary: string): void => {
  const eventPath = path.join(repo, '.playbook', 'memory', 'events', `${eventId}.json`);
  fs.mkdirSync(path.dirname(eventPath), { recursive: true });
  fs.writeFileSync(
    eventPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        eventInstanceId: eventId,
        eventFingerprint: fingerprint,
        kind: 'verify_run',
        createdAt: new Date(recentPromotedAt).toISOString(),
        sources: [{ type: 'command', reference: 'verify' }],
        subjectModules: ['workouts'],
        ruleIds: ['PB001'],
        riskSummary: { level: 'medium', signals: ['module-risk'] },
        outcome: {
          status: 'failure',
          summary
        },
        salienceInputs: {
          command: 'verify'
        }
      },
      null,
      2
    )
  );
};

describe('analyze-pr', () => {
  it('returns deterministic PR analysis JSON', async () => {
    const repo = createRepo('playbook-cli-analyze-pr');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.changedFiles).toEqual(['src/workouts/index.ts']);
    expect(payload.affectedModules).toEqual(['workouts']);
    expect(payload.summary.changedFileCount).toBe(1);
    expect(Array.isArray(payload.findings)).toBe(true);
    expect(Array.isArray(payload.reviewGuidance)).toBe(true);
    expect(payload.contractSurface).toEqual({
      hasImpact: false,
      categories: [],
      changedFiles: [],
      requiredUpdates: [],
      changelogUpdated: false
    });

    logSpy.mockRestore();
  });


  it('renders GitHub comment markdown when --format github-comment is provided', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-github-comment');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'github-comment'], { format: 'github-comment', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = String(logSpy.mock.calls[0]?.[0]);
    expect(output).toContain('## 🧠 Playbook PR Analysis');
    expect(output).toContain('### Affected Modules');
    expect(output).toContain('### Governance Findings');
    expect(output).toContain('Confirm contract-surface impact');

    logSpy.mockRestore();
  });



  it('renders GitHub review diagnostics JSON when --format github-review is provided', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-github-review');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'github-review'], { format: 'github-review', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(Array.isArray(output)).toBe(true);

    logSpy.mockRestore();
  });

  it('renders text summary when --format text is provided', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-text');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'text'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const output = String(logSpy.mock.calls[0]?.[0]);
    expect(output).toContain('Playbook Pull Request Analysis');
    expect(output).toContain('Changed files');

    logSpy.mockRestore();
  });

  it('fails with deterministic message for unsupported --format values', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-invalid-format');
    initGitRepo(repo);
    writeRepoIndex(repo);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--format', 'markdown'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('Unsupported analyze-pr format "markdown"');

    errorSpy.mockRestore();
  });

  it('fails deterministically when repo index is missing', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-missing-index');
    initGitRepo(repo);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.error).toContain('missing repository index');

    logSpy.mockRestore();
  });



  it('scopes related rules for docs-only diffs to avoid repo-wide governance noise', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-docs-only');
    initGitRepo(repo);

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
          modules: [{ name: 'workouts', dependencies: [] }],
          database: 'postgres',
          rules: ['PB001', 'requireNotesOnChanges', 'verify.rule.tests.required']
        },
        null,
        2
      )
    );

    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# guide\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# updated guide\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.rules.related).toEqual(['PB001']);

    logSpy.mockRestore();
  });

  it('handles detached HEAD deterministically', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-detached-head');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);
    runGit(repo, ['checkout', '--detach']);

    fs.writeFileSync(path.join(repo, 'README.md'), '# detached change\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.summary.changedFileCount).toBeGreaterThan(0);

    logSpy.mockRestore();
  });

  it('detects contract-surface changes and recommends snapshot-first follow-up', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-contract-surface');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'packages', 'cli', 'src', 'commands'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'tests', 'contracts'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'packages', 'cli', 'src', 'commands', 'demo.ts'), 'export const demo = 1;\n');
    fs.writeFileSync(path.join(repo, 'tests', 'contracts', 'demo.snapshot.json'), '{"ok":true}\n');
    fs.writeFileSync(path.join(repo, 'docs', 'CHANGELOG.md'), '# Changelog\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'packages', 'cli', 'src', 'commands', 'demo.ts'), 'export const demo = 2;\n');
    fs.writeFileSync(path.join(repo, 'tests', 'contracts', 'demo.snapshot.json'), '{"ok":false}\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.contractSurface.hasImpact).toBe(true);
    expect(payload.contractSurface.categories).toEqual(['cli-json-output', 'snapshot-fixture']);
    expect(payload.contractSurface.changedFiles).toEqual([
      'packages/cli/src/commands/demo.ts',
      'tests/contracts/demo.snapshot.json'
    ]);
    expect(payload.contractSurface.changelogUpdated).toBe(false);
    expect(payload.reviewGuidance).toContain(
      'Run `pnpm exec vitest run packages/cli/test/cliContracts.test.ts` before broader verification when contract surfaces change.'
    );
    expect(payload.findings).toContainEqual(expect.objectContaining({ ruleId: 'playbook.pr.contract-surface' }));

    logSpy.mockRestore();
  });

  it('excludes ephemeral memory event artifacts from contract-surface detection', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-ephemeral-memory-events');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');
    fs.mkdirSync(path.join(repo, '.playbook', 'memory', 'events'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.playbook', 'memory', 'events', 'event-1.json'),
      JSON.stringify({ schemaVersion: '1.0', event_id: 'event-1' }, null, 2)
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.contractSurface).toEqual({
      hasImpact: false,
      categories: [],
      changedFiles: [],
      requiredUpdates: [],
      changelogUpdated: false
    });
    expect(payload.findings).not.toContainEqual(expect.objectContaining({ ruleId: 'playbook.pr.contract-surface' }));

    logSpy.mockRestore();
  });



  it('reports multi-boundary PRs with deterministic boundary summary', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-multi-boundary');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# guide\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 2;\n');
    fs.writeFileSync(path.join(repo, 'docs', 'guide.md'), '# updated guide\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.architecture.boundariesTouched).toEqual(['docs', 'source']);

    logSpy.mockRestore();
  });

  it('fails deterministically when an explicit base ref cannot be resolved', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-missing-base');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.writeFileSync(path.join(repo, 'README.md'), '# shallow-like base failure\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json', '--base', 'origin/main'], { format: 'json', quiet: false, baseRef: 'origin/main' });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.error).toContain('unable to determine git diff from base "origin/main"');

    logSpy.mockRestore();
  });

  it('fails deterministically when there are no changed files', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-no-diff');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe('analyze-pr');
    expect(payload.error).toContain('no changed files were detected');

    logSpy.mockRestore();
  });

  it('keeps default analyze-pr behavior when no promoted knowledge matches', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-no-knowledge-match');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    writePromotedKnowledge(repo, 'pattern', [
      {
        knowledgeId: 'pattern-auth-only',
        candidateId: 'cand-auth-only',
        sourceCandidateIds: ['cand-auth-only'],
        sourceEventFingerprints: ['fp-auth-only'],
        title: 'Auth rule lesson',
        summary: 'Applies to auth only',
        fingerprint: 'fp-auth-only',
        module: 'auth',
        ruleId: 'PB999',
        failureShape: 'auth-gap',
        promotedAt: recentPromotedAt,
        provenance: [{ eventId: 'evt-auth-only', sourcePath: 'events/evt-auth-only.json', fingerprint: 'fp-auth-only', runId: null }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      }
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.reviewGuidance.length).toBeGreaterThan(0);
    expect(payload.preventionGuidance).toEqual([]);
    expect(payload.context.sources).toContainEqual({ type: 'promoted-knowledge', knowledgeIds: [] });

    logSpy.mockRestore();
  });

  it('adds prevention targeting with provenance from matching promoted knowledge', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-knowledge-match');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    writeMemoryEvent(repo, 'evt-knowledge-match', 'fp-knowledge-match', 'historical failure from missing review gate');
    writePromotedKnowledge(repo, 'pattern', [
      {
        knowledgeId: 'pattern-workouts-risk',
        candidateId: 'cand-workouts-risk',
        sourceCandidateIds: ['cand-workouts-risk'],
        sourceEventFingerprints: ['fp-knowledge-match'],
        title: 'Workouts risk regression',
        summary: 'Historically, workouts changes failed when verify was skipped.',
        fingerprint: 'fp-knowledge-match',
        module: 'workouts',
        ruleId: 'PB001',
        failureShape: 'missing-verify-step',
        promotedAt: recentPromotedAt,
        provenance: [{ eventId: 'evt-knowledge-match', sourcePath: 'events/evt-knowledge-match.json', fingerprint: 'fp-knowledge-match', runId: null }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      }
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.preventionGuidance).toHaveLength(1);
    expect(payload.preventionGuidance[0].target).toEqual({
      module: 'workouts',
      ruleId: 'PB001',
      failureShape: 'missing-verify-step'
    });
    expect(payload.preventionGuidance[0].provenance.knowledgeId).toBe('pattern-workouts-risk');
    expect(payload.preventionGuidance[0].provenance.evidenceChain).toEqual([
      {
        eventId: 'evt-knowledge-match',
        sourcePath: 'events/evt-knowledge-match.json',
        fingerprint: 'fp-knowledge-match',
        runId: null,
        outcomeStatus: 'failure',
        outcomeSummary: 'historical failure from missing review gate'
      }
    ]);
    expect(payload.context.sources).toContainEqual({ type: 'promoted-knowledge', knowledgeIds: ['pattern-workouts-risk'] });

    logSpy.mockRestore();
  });

  it('excludes stale and superseded promoted knowledge and keeps prevention guidance ordering deterministic', async () => {
    const repo = createRepo('playbook-cli-analyze-pr-knowledge-ordering');
    initGitRepo(repo);
    writeRepoIndex(repo);

    fs.mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'auth', 'index.ts'), 'export const auth = 1;\n');
    runGit(repo, ['add', '.']);
    runGit(repo, ['commit', '-m', 'initial']);

    fs.mkdirSync(path.join(repo, 'src', 'workouts'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'workouts', 'index.ts'), 'export const workouts = 2;\n');

    writeMemoryEvent(repo, 'evt-recent-a', 'fp-recent-a', 'recent a');
    writeMemoryEvent(repo, 'evt-recent-b', 'fp-recent-b', 'recent b');
    writePromotedKnowledge(repo, 'pattern', [
      {
        knowledgeId: 'pattern-z-recent',
        candidateId: 'cand-z-recent',
        sourceCandidateIds: ['cand-z-recent'],
        sourceEventFingerprints: ['fp-recent-a'],
        title: 'Recent z',
        summary: 'Recent promoted knowledge z',
        fingerprint: 'fp-recent-a',
        module: 'workouts',
        ruleId: 'PB001',
        failureShape: 'shape-z',
        promotedAt: recentPromotedAt,
        provenance: [{ eventId: 'evt-recent-a', sourcePath: 'events/evt-recent-a.json', fingerprint: 'fp-recent-a', runId: null }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      },
      {
        knowledgeId: 'pattern-a-recent',
        candidateId: 'cand-a-recent',
        sourceCandidateIds: ['cand-a-recent'],
        sourceEventFingerprints: ['fp-recent-b'],
        title: 'Recent a',
        summary: 'Recent promoted knowledge a',
        fingerprint: 'fp-recent-b',
        module: 'workouts',
        ruleId: 'PB001',
        failureShape: 'shape-a',
        promotedAt: recentPromotedAt,
        provenance: [{ eventId: 'evt-recent-b', sourcePath: 'events/evt-recent-b.json', fingerprint: 'fp-recent-b', runId: null }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      },
      {
        knowledgeId: 'pattern-old-stale',
        candidateId: 'cand-old-stale',
        sourceCandidateIds: ['cand-old-stale'],
        sourceEventFingerprints: ['fp-old-stale'],
        title: 'Old stale',
        summary: 'Should be filtered as stale',
        fingerprint: 'fp-old-stale',
        module: 'workouts',
        ruleId: 'PB001',
        failureShape: 'shape-old',
        promotedAt: '2020-01-01T00:00:00.000Z',
        provenance: [{ eventId: 'evt-old-stale', sourcePath: 'events/evt-old-stale.json', fingerprint: 'fp-old-stale', runId: null }],
        status: 'active',
        supersedes: [],
        supersededBy: []
      },
      {
        knowledgeId: 'pattern-superseded',
        candidateId: 'cand-superseded',
        sourceCandidateIds: ['cand-superseded'],
        sourceEventFingerprints: ['fp-superseded'],
        title: 'Superseded',
        summary: 'Should be excluded as superseded',
        fingerprint: 'fp-superseded',
        module: 'workouts',
        ruleId: 'PB001',
        failureShape: 'shape-superseded',
        promotedAt: recentPromotedAt,
        provenance: [{ eventId: 'evt-superseded', sourcePath: 'events/evt-superseded.json', fingerprint: 'fp-superseded', runId: null }],
        status: 'superseded',
        supersedes: [],
        supersededBy: ['pattern-z-recent']
      }
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runAnalyzePr(repo, ['--json'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.preventionGuidance.map((entry: { provenance: { knowledgeId: string } }) => entry.provenance.knowledgeId)).toEqual([
      'pattern-a-recent',
      'pattern-z-recent'
    ]);

    logSpy.mockRestore();
  });
});
