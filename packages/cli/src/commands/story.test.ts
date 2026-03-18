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

  it('preserves committed backlog state when promotion is blocked', async () => {
    const repo = makeRepo();
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook/stories.json'), JSON.stringify({
      schemaVersion: '1.0',
      repo: path.basename(repo),
      stories: [{
        id: 'story-1', repo: path.basename(repo), title: 'Existing', type: 'feature', source: 'manual', severity: 'medium', priority: 'high', confidence: 'high', status: 'proposed', evidence: [], rationale: '', acceptance_criteria: [], dependencies: [], execution_lane: null, suggested_route: null
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
