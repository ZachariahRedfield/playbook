import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayMemoryToCandidates } from '../src/memory/replay.js';

const setupFixtureRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-replay-'));
  const fixtureRoot = path.join(process.cwd(), 'test/__fixtures__/memory-replay');

  fs.mkdirSync(path.join(root, '.playbook/memory/events'), { recursive: true });
  fs.copyFileSync(path.join(fixtureRoot, 'index.json'), path.join(root, '.playbook/memory/index.json'));

  const eventsDir = path.join(fixtureRoot, 'events');
  for (const fileName of fs.readdirSync(eventsDir)) {
    fs.copyFileSync(path.join(eventsDir, fileName), path.join(root, '.playbook/memory/events', fileName));
  }

  return root;
};

describe('replayMemoryToCandidates', () => {
  it('replays fixture events into deterministically sorted candidates', () => {
    const root = setupFixtureRepo();

    const output = replayMemoryToCandidates(root);

    expect(output.totalEvents).toBe(4);
    expect(output.clustersEvaluated).toBe(2);
    expect(output.candidates.map((candidate) => candidate.kind)).toEqual(['open_question', 'pattern']);
    expect(output.candidates[0]?.provenance.map((entry) => entry.eventId)).toEqual(['evt-plan-1', 'evt-verify-1']);
    expect(output.candidates[0]?.lastSeenAt).toBeDefined();

    const written = JSON.parse(
      fs.readFileSync(path.join(root, '.playbook/memory/candidates.json'), 'utf8')
    ) as typeof output;

    expect(written.candidates.map((candidate) => candidate.candidateId)).toEqual(
      output.candidates.map((candidate) => candidate.candidateId)
    );
  });

  it('returns stable scores and ordering for identical inputs', () => {
    const root = setupFixtureRepo();

    const first = replayMemoryToCandidates(root);
    const second = replayMemoryToCandidates(root);

    expect(second.candidates).toEqual(first.candidates);
    expect(second.candidates.map((candidate) => candidate.salienceScore)).toEqual(
      first.candidates.map((candidate) => candidate.salienceScore)
    );
  });
});
