import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runStory } from './story.js';

const tempDirs: string[] = [];
const makeRepo = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-story-'));
  tempDirs.push(dir);
  return dir;
};

const writeArtifact = (repo: string, relativePath: string, value: unknown): void => {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2));
};

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('runStory', () => {
  it('creates, lists, shows, and updates stories', async () => {
    const repo = makeRepo();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    let exitCode = await runStory(repo, ['create', '--id', 'story-1', '--title', 'Backlog MVP', '--type', 'feature', '--source', 'manual', '--severity', 'medium', '--priority', 'high', '--confidence', 'high', '--rationale', 'Need durable planning', '--acceptance', 'List stories', '--acceptance', 'Update stories', '--evidence', 'objective'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    let payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.promotion.promoted).toBe(true);
    expect(payload.story.id).toBe('story-1');

    logSpy.mockClear();
    exitCode = await runStory(repo, ['list'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.stories).toHaveLength(1);

    logSpy.mockClear();
    exitCode = await runStory(repo, ['show', 'story-1'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.story.title).toBe('Backlog MVP');

    logSpy.mockClear();
    exitCode = await runStory(repo, ['status', 'story-1', '--status', 'ready'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.story.status).toBe('ready');

    const artifact = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/stories.json'), 'utf8')) as { stories: Array<{ status: string }> };
    expect(artifact.stories[0]?.status).toBe('ready');
  });


  it('routes a canonical story through the story plan subcommand', async () => {
    const repo = makeRepo();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    let exitCode = await runStory(repo, ['create', '--id', 'story-plan', '--title', 'Update command docs', '--type', 'governance', '--source', 'manual', '--severity', 'medium', '--priority', 'high', '--confidence', 'high', '--rationale', 'Need linked planning', '--acceptance', 'Emit route plan', '--suggested-route', 'docs_only'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    logSpy.mockClear();
    exitCode = await runStory(repo, ['status', 'story-plan', '--status', 'ready'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);

    logSpy.mockClear();
    exitCode = await runStory(repo, ['plan', 'story-plan'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.command).toBe('route');
    expect(payload.story.id).toBe('story-plan');
    expect(payload.executionPlan.story_reference.id).toBe('story-plan');
  });

  it('derives read-only story candidates and promotes one explicitly into the canonical backlog artifact', async () => {
    const repo = makeRepo();
    writeArtifact(repo, '.playbook/improvement-candidates.json', {
      schemaVersion: '1.0',
      kind: 'improvement-candidates',
      generatedAt: '2026-03-18T00:00:00.000Z',
      opportunity_analysis: {
        top_recommendation: {
          opportunity_id: 'shared_read_aggregation_boundary',
          title: 'Converge broad artifact fanout through a shared read aggregation boundary',
          heuristic_class: 'broad_query_fanout',
          confidence: 0.92,
          why_it_matters: 'Direct artifact fanout should be grouped into one durable architecture change.',
          likely_change_shape: 'Extract a shared read model.',
          rationale: ['Many surfaces read the same governed artifacts.'],
          evidence: [{ file: 'packages/cli/src/commands/observer/index.ts', detail: 'multiple .playbook artifact reads' }]
        },
        secondary_queue: []
      }
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    let exitCode = await runStory(repo, ['candidates', '--explain'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    let payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.readOnly).toBe(true);
    expect(payload.candidates.length).toBeGreaterThan(0);
    const candidateId = payload.candidates[0].id as string;
    expect(fs.existsSync(path.join(repo, '.playbook/story-candidates.json'))).toBe(true);
    expect(fs.existsSync(path.join(repo, '.playbook/stories.json'))).toBe(false);

    const candidateArtifactBefore = fs.readFileSync(path.join(repo, '.playbook/story-candidates.json'), 'utf8');
    logSpy.mockClear();
    exitCode = await runStory(repo, ['promote', candidateId], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.promotion.promoted).toBe(true);
    expect(payload.story.id).toBe(candidateId);
    expect(fs.readFileSync(path.join(repo, '.playbook/story-candidates.json'), 'utf8')).toBe(candidateArtifactBefore);
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.playbook/stories.json'), 'utf8')).stories.map((story: { id: string }) => story.id)).toContain(candidateId);
  });

  it('preserves committed backlog state when promotion is blocked', async () => {
    const repo = makeRepo();
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook/stories.json'), JSON.stringify({
      schemaVersion: '1.0',
      repo: path.basename(repo),
      stories: [{
        id: 'story-1', repo: path.basename(repo), title: 'Existing', type: 'feature', source: 'manual', severity: 'medium', priority: 'high', confidence: 'high', status: 'proposed', evidence: [], rationale: 'Preserve committed state while validation blocks promotion', acceptance_criteria: [], dependencies: [], execution_lane: null, suggested_route: null
      }]
    }, null, 2));
    const before = fs.readFileSync(path.join(repo, '.playbook/stories.json'), 'utf8');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runStory(repo, ['status', 'story-1', '--status', 'not-real'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.PolicyFailure);
    const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(payload.promotion.promoted).toBe(false);
    expect(payload.promotion.committed_state_preserved).toBe(true);
    expect(fs.readFileSync(path.join(repo, '.playbook/stories.json'), 'utf8')).toBe(before);
  });
});
