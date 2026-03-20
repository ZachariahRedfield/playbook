import { describe, expect, it } from 'vitest';
import { TEST_AUTOFIX_ARTIFACT_KIND, TEST_AUTOFIX_SCHEMA_VERSION, testAutofixFinalStatuses } from '../src/contracts/testAutofix.js';

describe('test-autofix contract constants', () => {
  it('exports stable schema metadata', () => {
    expect(TEST_AUTOFIX_SCHEMA_VERSION).toBe('1.0');
    expect(TEST_AUTOFIX_ARTIFACT_KIND).toBe('test-autofix');
  });

  it('exports deterministic final statuses', () => {
    expect(testAutofixFinalStatuses).toEqual(['fixed', 'partially_fixed', 'not_fixed', 'blocked', 'review_required_only']);
  });
});
