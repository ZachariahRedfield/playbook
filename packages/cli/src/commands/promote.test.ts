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
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.playbook/stories.json'), 'utf8')).stories).toHaveLength(1);
    expect(fs.existsSync(path.join(home, 'patterns.json'))).toBe(false);
  });

  it('promotes global pattern candidates to patterns and stages under PLAYBOOK_HOME', () => {
    const home = mkd('playbook-home-');
    process.env.PLAYBOOK_HOME = home;
    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-1', pattern_family: 'layering', title: 'Layering', description: 'desc', source_artifact: '.playbook/pattern-candidates.json', signals: ['a'], confidence: 0.8, evidence_refs: ['ref'], status: 'observed' }]
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = runPromote(home, ['pattern', 'global/pattern-candidates/pattern-candidate-1', '--pattern-id', 'pattern.layering'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.pattern.provenance.source_ref).toBe('global/pattern-candidates/pattern-candidate-1');
    expect(fs.existsSync(path.join(home, 'staged', 'promotions', 'patterns.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(home, 'patterns.json'), 'utf8')).patterns).toHaveLength(1);
  });

  it('is idempotent for repeated promotions and fails clearly on conflicts', () => {
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

    writeJson(home, '.playbook/pattern-candidates.json', {
      schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: '2026-03-19T00:00:00.000Z',
      candidates: [{ id: 'pattern-candidate-1', pattern_family: 'layering', title: 'Different', description: 'different', source_artifact: '.playbook/pattern-candidates.json', signals: ['b'], confidence: 0.8, evidence_refs: ['ref'], status: 'observed' }]
    });
    logSpy.mockClear();
    expect(runPromote(home, ['pattern', 'global/pattern-candidates/pattern-candidate-1', '--pattern-id', 'pattern.layering'], { format: 'json', quiet: false })).toBe(ExitCode.Failure);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.error).toContain('conflict for pattern');
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
});
