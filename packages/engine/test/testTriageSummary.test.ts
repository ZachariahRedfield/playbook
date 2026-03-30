import { describe, expect, it } from 'vitest';
import { buildTestTriageArtifact, renderTestTriageMarkdown } from '../src/testTriage.js';

describe('test triage failure summary', () => {
  it('parses multi-failure logs deterministically and groups cross-cutting diagnoses', () => {
    const log = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch',
      '',
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/contracts.test.ts',
      '  × includes command contracts',
      '    Error: missing expected finding `test-triage` in command registry',
      '',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook test: `vitest run`'
    ].join('\n');

    const first = buildTestTriageArtifact(log, { input: 'file', path: '.playbook/ci-failure.log' });
    const second = buildTestTriageArtifact(log, { input: 'file', path: '.playbook/ci-failure.log' });

    expect(first).toEqual(second);
    expect(first.summary).toContain('3 normalized failures');
    expect(first.failureLayer).toBe('governance_failure');
    expect(first.primaryFailureClass).toBe('missing_expected_finding');
    expect(first.failures).toHaveLength(3);
    expect(first.failures.map((failure) => failure.type).sort()).toEqual([
      'missing_expected_finding',
      'recursive_workspace_failure',
      'snapshot_drift'
    ]);
    expect(first.crossCuttingDiagnosis).toEqual([
      '@fawxzzy/playbook: contract drift is appearing alongside snapshot or finding drift, so update command output, snapshots, and contract docs together if intentional.',
      '@fawxzzy/playbook: multiple failure classes (missing_expected_finding, recursive_workspace_failure, snapshot_drift) suggest a partially integrated feature or a shared fixture/contract dependency.',
      '@fawxzzy/playbook: recursive workspace failure likely amplifies a narrower package-level error; repair the first failing workspace before re-running the full recursive command.'
    ]);
  });

  it('renders markdown and preserves the collapsed GitHub annotation failure contract', () => {
    const log = [
      '::error file=packages/engine/src/schema/cliSchemas.ts,line=2034,col=17::contract drift in generated test-triage schema',
      '@fawxzzy/playbook build: src/index.ts(14,7): error TS2322: Type "x" is not assignable to type "y".',
      'Error: contract drift while generating schemas'
    ].join('\n');

    const artifact = buildTestTriageArtifact(log, { input: 'stdin', path: null });
    const markdown = renderTestTriageMarkdown(artifact);

    expect(artifact.failures).toHaveLength(1);
    expect(artifact.failures[0]).toMatchObject({
      type: 'contract_drift',
      file: 'packages/engine/src/schema/cliSchemas.ts',
      line: 2034,
      column: 17,
      message: 'contract drift in generated test-triage schema'
    });
    expect(artifact.summary).toContain('1 normalized failure');
    expect(artifact.failureLayer).toBe('governance_failure');
    expect(markdown).toContain('# Playbook Failure Summary');
    expect(markdown).toContain('- Failure layer: governance_failure');
    expect(markdown).toContain('## Recommended next checks');
    expect(markdown).toContain('contract drift in generated test-triage schema');
  });
});
