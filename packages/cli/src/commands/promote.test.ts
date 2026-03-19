import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPromote } from './promote.js';
import { ExitCode } from '../lib/cliContract.js';

const tempDirs: string[] = [];
const mkd = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
const writeJson = (root: string, relativePath: string, value: unknown): void => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PLAYBOOK_HOME;
  while (tempDirs.length > 0) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('runPromote', () => {
  it('promotes repo story candidates into the target repo backlog', () => {
    const home = mkd('playbook-home-');
    const repo = mkd('repo-a-');
    process.env.PLAYBOOK_HOME = home;
    writeJson(home, '.playbook/observer/repos.json', { schemaVersion: '1.0', kind: 'repo-registry', repos: [{ id: path.basename(repo), root: repo }] });
    writeJson(repo, '.playbook/story-candidates.json', {
      schemaVersion: '1.0', kind: 'story-candidates', generatedAt: '2026-03-19T00:00:00.000Z', repo: path.basename(repo), readOnly: true,
      sourceArtifacts: { readiness: [], improvementCandidatesPath: '.playbook/improvement-candidates.json', updatedStatePath: '.playbook/execution-updated-state.json', routerRecommendationsPath: '.playbook/router-recommendations.json' },
      candidates: [{ id: 'story-candidate-1', repo: path.basename(repo), title: 'Candidate', type: 'feature', source: 'manual', severity: 'medium', priority: 'high', confidence: 'high', status: 'proposed', evidence: [], rationale: 'r', acceptance_criteria: [], dependencies: [], execution_lane: null, suggested_route: null, candidate_fingerprint: 'fp-1', candidate_id: 'story-candidate-1', grouping_keys: ['g'], source_signals: ['s'], source_artifacts: ['.playbook/story-candidates.json'], promotion_hint: 'x', explanation: [] }]
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = runPromote(home, ['story', `repo/${path.basename(repo)}/story-candidates/story-candidate-1`], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.story.provenance.source_ref).toContain('/story-candidates/');
    expect(payload.receipt.outcome).toBe('promoted');
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.playbook/stories.json'), 'utf8')).stories).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.playbook/promotion-receipts.json'), 'utf8')).receipts).toHaveLength(1);
    expect(fs.existsSync(path.join(home, 'patterns.json'))).toBe(false);
  });

  it('promotes global pattern candidates to patterns and stages under PLAYBOOK_HOME', () => {
    const home = mkd('playbook-home-');
    process.env.PLAYBOOK_HOME = home;
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{
        id: 'pattern-candidate-1',
        pattern_family: 'layering',
        title: 'Layering',
        description: 'desc',
        storySeed: { title: 'Seed layering story', summary: 'Seed summary', acceptance: ['Check layering evidence'] },
        source_artifact: '.playbook/pattern-candidates.json',
        signals: ['a'],
        confidence: 0.8,
        evidence_refs: ['ref'],
        status: 'observed'
      }]
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = runPromote(home, ['pattern', 'global/pattern-candidates/pattern-candidate-1', '--pattern-id', 'pattern.layering'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.pattern.provenance.source_ref).toBe('global/pattern-candidates/pattern-candidate-1');
    expect(payload.pattern.storySeed.title).toBe('Seed layering story');
    expect(payload.receipt.outcome).toBe('promoted');
    expect(fs.existsSync(path.join(home, 'staged', 'promotions', 'patterns.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(home, '.playbook/patterns.json'), 'utf8')).patterns).toHaveLength(1);
  });

  it('persists repeated promotion receipts in deterministic canonical order', () => {
    const home = mkd('playbook-home-');
    process.env.PLAYBOOK_HOME = home;
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-1', pattern_family: 'layering', title: 'Layering', description: 'desc', source_artifact: '.playbook/pattern-candidates.json', signals: ['a'], confidence: 0.8, evidence_refs: ['ref'], status: 'observed' }]
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(runPromote(home, ['pattern', 'global/pattern-candidates/pattern-candidate-1', '--pattern-id', 'pattern.layering'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    logSpy.mockClear();
    expect(runPromote(home, ['pattern', 'global/pattern-candidates/pattern-candidate-1', '--pattern-id', 'pattern.layering'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    let payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.noop).toBe(true);
    expect(payload.outcome).toBe('noop');
    expect(payload.receipt.outcome).toBe('noop');

    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-1', pattern_family: 'layering', title: 'Different', description: 'different', source_artifact: '.playbook/pattern-candidates.json', signals: ['b'], confidence: 0.8, evidence_refs: ['ref'], status: 'observed' }]
    });
    logSpy.mockClear();
    expect(runPromote(home, ['pattern', 'global/pattern-candidates/pattern-candidate-1', '--pattern-id', 'pattern.layering'], { format: 'json', quiet: false })).toBe(ExitCode.Failure);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.outcome).toBe('conflict');
    expect(payload.receipt.outcome).toBe('conflict');
    expect(payload.receipt.before_fingerprint).toBe(payload.receipt.after_fingerprint);
    const receiptLog = JSON.parse(fs.readFileSync(path.join(home, '.playbook/promotion-receipts.json'), 'utf8')) as { receipts: Array<{ outcome: string; generated_at: string; promotion_kind: string; target_artifact_path: string; target_id: string; receipt_id: string }> };
    expect(receiptLog.receipts).toHaveLength(3);
    expect(receiptLog.receipts.map((entry) => entry.outcome).sort()).toEqual(['conflict', 'noop', 'promoted']);
    const persistedOrdering = receiptLog.receipts.map((entry) => `${entry.generated_at}|${entry.promotion_kind}|${entry.target_artifact_path}|${entry.target_id}|${entry.receipt_id}`);
    const canonicalOrdering = [...persistedOrdering].sort((left, right) => left.localeCompare(right));
    expect(persistedOrdering).toEqual(canonicalOrdering);
    expect(receiptLog.receipts.map((entry) => entry.receipt_id)).toEqual([...receiptLog.receipts.map((entry) => entry.receipt_id)].sort());
  });

  it('promotes global pattern candidates to repo-local stories and mutates only the target repo scope artifact', () => {
    const home = mkd('playbook-home-');
    const repo = mkd('repo-b-');
    process.env.PLAYBOOK_HOME = home;
    writeJson(home, '.playbook/observer/repos.json', { schemaVersion: '1.0', kind: 'repo-registry', repos: [{ id: path.basename(repo), root: repo }] });
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-2', pattern_family: 'governance', title: 'Governance', description: 'desc', source_artifact: '.playbook/pattern-candidates.json', signals: ['a'], confidence: 0.7, evidence_refs: ['ref'], status: 'observed' }]
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = runPromote(home, ['story', 'global/pattern-candidates/pattern-candidate-2', '--repo', path.basename(repo), '--story-id', 'story.governance'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.story.id).toBe('story.governance');
    expect(fs.existsSync(path.join(repo, '.playbook/stories.json'))).toBe(true);
    expect(fs.existsSync(path.join(home, 'patterns.json'))).toBe(false);
  });

  it('promotes a promoted global pattern into a repo-local story using storySeed metadata while keeping planning story-driven', () => {
    const home = mkd('playbook-home-');
    const repo = mkd('repo-pattern-seed-');
    process.env.PLAYBOOK_HOME = home;
    writeJson(home, '.playbook/observer/repos.json', { schemaVersion: '1.0', kind: 'repo-registry', repos: [{ id: path.basename(repo), root: repo }] });
    // `.playbook/patterns.json` is the canonical promoted-pattern artifact under PLAYBOOK_HOME.
    writeJson(home, '.playbook/patterns.json', {
      schemaVersion: '1.0',
      kind: 'promoted-patterns',
      patterns: [{
        id: 'pattern.layering',
        pattern_family: 'layering',
        title: 'Layering',
        description: 'desc',
        storySeed: {
          title: 'Adopt layering locally',
          summary: 'Seed a repo-local story from promoted knowledge.',
          acceptance: ['Verify lineage', 'Preserve story-only planning']
        },
        source_artifact: '.playbook/pattern-candidates.json',
        signals: ['a'],
        confidence: 0.9,
        evidence_refs: ['ref'],
        status: 'promoted',
        provenance: {
          source_ref: 'global/pattern-candidates/pattern-candidate-1',
          candidate_id: 'pattern-candidate-1',
          candidate_fingerprint: 'fp-pattern-1',
          promoted_at: '2026-03-19T00:00:00.000Z'
        }
      }]
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = runPromote(home, ['story', 'global/patterns/pattern.layering', '--repo', path.basename(repo), '--story-id', 'story.layering'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.story.id).toBe('story.layering');
    expect(payload.story.title).toBe('Adopt layering locally');
    expect(payload.story.rationale).toBe('Seed a repo-local story from promoted knowledge.');
    expect(payload.story.acceptance_criteria).toEqual(['Preserve story-only planning', 'Verify lineage']);
    expect(payload.story.provenance.pattern_id).toBe('pattern.layering');
    expect(payload.story.provenance.source_ref).toBe('global/patterns/pattern.layering');
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.playbook/stories.json'), 'utf8')).stories).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(home, '.playbook/patterns.json'), 'utf8')).patterns).toHaveLength(1);
  });

  it('emits deterministic receipts for lifecycle mutations including supersede and idempotent no-op retries', () => {
    const home = mkd('playbook-home-lifecycle-');
    process.env.PLAYBOOK_HOME = home;
    writeJson(home, '.playbook/patterns.json', {
      schemaVersion: '1.0',
      kind: 'promoted-patterns',
      patterns: [
        {
          id: 'pattern.legacy',
          pattern_family: 'docs',
          title: 'Legacy docs',
          description: 'legacy',
          storySeed: { title: 'Legacy', summary: 'Legacy', acceptance: ['legacy'] },
          source_artifact: '.playbook/pattern-candidates.json',
          signals: [],
          confidence: 0.7,
          evidence_refs: ['ref-legacy'],
          status: 'active',
          provenance: {
            source_ref: 'global/pattern-candidates/pattern-candidate-legacy',
            candidate_id: 'pattern-candidate-legacy',
            candidate_fingerprint: 'fp-legacy',
            promoted_at: '2026-03-19T00:00:00.000Z'
          },
          lifecycle_events: []
        },
        {
          id: 'pattern.current',
          pattern_family: 'docs',
          title: 'Current docs',
          description: 'current',
          storySeed: { title: 'Current', summary: 'Current', acceptance: ['current'] },
          source_artifact: '.playbook/pattern-candidates.json',
          signals: [],
          confidence: 0.9,
          evidence_refs: ['ref-current'],
          status: 'demoted',
          provenance: {
            source_ref: 'global/pattern-candidates/pattern-candidate-current',
            candidate_id: 'pattern-candidate-current',
            candidate_fingerprint: 'fp-current',
            promoted_at: '2026-03-19T00:00:00.000Z'
          },
          lifecycle_events: []
        }
      ]
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(runPromote(home, ['pattern-retire', 'pattern.legacy', '--reason', 'obsolete'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    let payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.receipt.workflow_kind).toBe('promote-pattern-retire');
    expect(payload.receipt.outcome).toBe('promoted');

    logSpy.mockClear();
    expect(runPromote(home, ['pattern-supersede', 'pattern.legacy', '--by', 'pattern.current', '--reason', 'replacement approved'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.receipt.workflow_kind).toBe('promote-pattern-supersede');
    expect(payload.pattern.status).toBe('superseded');
    expect(payload.pattern.superseded_by).toBe('pattern.current');

    logSpy.mockClear();
    expect(runPromote(home, ['pattern-supersede', 'pattern.legacy', '--by', 'pattern.current', '--reason', 'replacement approved'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.outcome).toBe('noop');
    expect(payload.receipt.outcome).toBe('noop');

    const stored = JSON.parse(fs.readFileSync(path.join(home, '.playbook/patterns.json'), 'utf8')) as {
      patterns: Array<{ id: string; status: string; supersedes?: string[] }>;
    };
    expect(stored.patterns.find((entry) => entry.id === 'pattern.legacy')?.status).toBe('superseded');
    expect(stored.patterns.find((entry) => entry.id === 'pattern.current')?.status).toBe('active');
    expect(stored.patterns.find((entry) => entry.id === 'pattern.current')?.supersedes).toEqual(['pattern.legacy']);

    const receiptLog = JSON.parse(fs.readFileSync(path.join(home, '.playbook/promotion-receipts.json'), 'utf8')) as {
      receipts: Array<{ workflow_kind: string; outcome: string }>;
    };
    expect(receiptLog.receipts.map((entry) => `${entry.workflow_kind}:${entry.outcome}`)).toEqual([
      'promote-pattern-retire:promoted',
      'promote-pattern-supersede:promoted',
      'promote-pattern-supersede:noop'
    ]);
  });
});
