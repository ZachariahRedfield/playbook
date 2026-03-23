const test = require('node:test');
const assert = require('node:assert/strict');
const { upsertReleasePullRequest } = require('./upsert-release-pr.cjs');

function makeGithub({ pulls = [] } = {}) {
  const calls = { create: [], update: [], list: [] };
  return {
    github: {
      rest: {
        pulls: {
          list: async (payload) => {
            calls.list.push(payload);
            return { data: pulls };
          },
          create: async (payload) => {
            calls.create.push(payload);
            return { data: { number: 9, html_url: 'https://example.com/pr/9' } };
          },
          update: async (payload) => {
            calls.update.push(payload);
            return { data: { number: payload.pull_number, html_url: 'https://example.com/pr/4' } };
          },
        },
      },
    },
    calls,
  };
}

test('upsertReleasePullRequest creates the release PR when none exists', async () => {
  const { github, calls } = makeGithub();
  const result = await upsertReleasePullRequest({
    github,
    owner: 'o',
    repo: 'r',
    base: 'main',
    head: 'release/prep',
    title: 'chore: prepare release 1.2.4',
    body: 'body',
  });

  assert.equal(result.action, 'created');
  assert.equal(calls.create.length, 1);
  assert.equal(calls.update.length, 0);
});

test('upsertReleasePullRequest updates the existing release PR', async () => {
  const { github, calls } = makeGithub({
    pulls: [{ number: 4, head: { ref: 'release/prep' }, base: { ref: 'main' } }],
  });
  const result = await upsertReleasePullRequest({
    github,
    owner: 'o',
    repo: 'r',
    base: 'main',
    head: 'release/prep',
    title: 'chore: prepare release 1.2.4',
    body: 'body',
  });

  assert.equal(result.action, 'updated');
  assert.equal(result.number, 4);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.update.length, 1);
});
