const test = require('node:test');
const assert = require('node:assert/strict');

const { extractFirstTestFailure } = require('./extract-first-test-failure.cjs');

test('extractFirstTestFailure captures first failing suite and assertion message', () => {
  const payload = extractFirstTestFailure(`
packages/core test:  FAIL  test/control-plane-runtime-contract.test.ts [ test/control-plane-runtime-contract.test.ts ]
packages/core test: Error: expected 2 to equal 3
`);

  assert.equal(payload.found, true);
  assert.equal(payload.file, 'test/control-plane-runtime-contract.test.ts');
  assert.equal(payload.message, 'Error: expected 2 to equal 3');
});

test('extractFirstTestFailure falls back to pnpm lifecycle failure context', () => {
  const payload = extractFirstTestFailure(`
Scope: 5 of 6 workspace projects
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @zachariahredfield/playbook-core@0.8.0 test: pnpm exec vitest run --passWithNoTests
`);

  assert.equal(payload.found, true);
  assert.equal(payload.message.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL'), true);
});
