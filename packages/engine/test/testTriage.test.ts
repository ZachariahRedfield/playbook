import { describe, expect, it } from 'vitest';
import { buildTestTriageArtifact, renderTestTriageMarkdown, renderTestTriageText } from '../src/testTriage.js';

describe('test triage engine', () => {
  it('classifies snapshot mismatch and plans narrow reruns deterministically', () => {
    const log = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/schema.test.ts',
      '  × renders schema snapshot',
      '    Snapshot `renders schema snapshot 1` mismatch',
      '    - Expected',
      '    + Received'
    ].join('\n');

    const artifact = buildTestTriageArtifact(log, { input: 'file', path: 'fixtures/log.txt' });
    expect(artifact.findings[0]?.failure_kind).toBe('snapshot_drift');
    expect(artifact.findings[0]?.repair_class).toBe('autofix_plan_only');
    expect(artifact.status).toBe('failed');
    expect(artifact.primaryFailureClass).toBe('snapshot_drift');
    expect(artifact.rerun_plan.commands).toEqual([
      'pnpm --filter @fawxzzy/playbook exec vitest run packages/cli/src/commands/schema.test.ts',
      'pnpm --filter @fawxzzy/playbook test',
      'pnpm -r test'
    ]);
    expect(renderTestTriageText(artifact)).toContain('Rule / Pattern / Failure Mode');
    expect(renderTestTriageMarkdown(artifact)).toContain('# Playbook Failure Summary');
  });

  it('classifies optional esbuild dependency failures as environment limitations', () => {
    const log = [
      'Error: Cannot find module @esbuild/linux-x64',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook test: `node ./scripts/run-tests.mjs`'
    ].join('\n');

    const artifact = buildTestTriageArtifact(log, { input: 'stdin', path: null });
    expect(artifact.findings.some((finding) => finding.failure_kind === 'environment_limitation')).toBe(true);
    expect(artifact.findings.some((finding) => finding.failure_kind === 'recursive_workspace_failure')).toBe(true);
  });

  it('detects ordering-only array drift from expected versus received arrays', () => {
    const log = [
      '@fawxzzy/playbook test: FAIL  packages/cli/src/commands/query.test.ts',
      '  × sorts module names deterministically',
      '    Expected: ["alpha", "beta"]',
      '    Received: ["beta", "alpha"]'
    ].join('\n');

    const artifact = buildTestTriageArtifact(log, { input: 'file', path: 'ordering.log' });
    expect(artifact.findings[0]?.failure_kind).toBe('ordering_drift');
    expect(artifact.findings[0]?.suggested_fix_strategy).toContain('deterministic ordering');
  });

  it('parses GitHub annotations and workspace/typecheck failures into one deterministic brief', () => {
    const log = [
      '::error file=packages/engine/src/schema/cliSchemas.ts,line=22,col=7,title=Typecheck::Type \"foo\" is not assignable to type \"bar\"',
      '@fawxzzy/playbook typecheck: src/index.ts(12,7): error TS2322: Type \"foo\" is not assignable to type \"bar\"',
      'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fawxzzy/playbook typecheck: `tsc -p tsconfig.json --noEmit`'
    ].join('\n');

    const artifact = buildTestTriageArtifact(log, { input: 'file', path: '.playbook/ci-failure.log' });
    expect(artifact.primaryFailureClass).toBe('recursive_workspace_failure');
    expect(artifact.crossCuttingDiagnosis.some((entry) => entry.includes('GitHub annotation'))).toBe(true);
    expect(artifact.failures[0]?.annotations[0]?.file).toBe('packages/engine/src/schema/cliSchemas.ts');
    expect(artifact.recommendedNextChecks).toContain('pnpm -r build');
  });
});
