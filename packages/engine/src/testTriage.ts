import {
  TEST_TRIAGE_ARTIFACT_KIND,
  TEST_TRIAGE_SCHEMA_VERSION,
  type TestTriageArtifact,
  type TestTriageAutomationEligibility,
  type TestTriageFailure,
  type TestTriageFailureKind,
  type TestTriageFailureLayer,
  type TestTriageFinding,
  type TestTriageRepairClass
} from '@zachariahredfield/playbook-core';
import { buildFailureSignature } from './testAutofix/failureSignature.js';

type TriageInputSource = { input: 'file' | 'stdin'; path: string | null };

type MutableFinding = {
  workspace: string | null;
  suite: string | null;
  testName: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  annotationTitle: string | null;
  block: string[];
};

type FailureClassification = {
  kind: TestTriageFailureKind;
  confidence: number;
  strategy: string;
  docs: string;
  likelyCauses: string[];
};

const GOVERNANCE_NOTE = {
  rule: 'Any Playbook-managed CI/test failure must emit both raw output and a deterministic normalized summary.',
  pattern: 'Failure summarization is a contract surface, not a convenience logger.',
  failure_mode: 'Raw stderr alone creates re-interpretation work and slows remediation across repeated CI loops.'
} as const;

const LOW_RISK_KINDS = new Set<TestTriageFailureKind>(['snapshot_drift', 'stale_assertion', 'fixture_drift', 'ordering_drift']);
const EMPTY_ARTIFACT_SUMMARY = 'No failure signatures were parsed from the provided log.';

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
const normalizePath = (value: string): string => value.replaceAll('\\', '/');
const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();
const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort(compareStrings);
const clampConfidence = (value: number): number => Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
const toBlockSummary = (block: string[]): string => normalizeWhitespace(block.find((line) => line.trim().length > 0) ?? 'Unclassified test failure block');

const readArrayLiteral = (text: string): string[] => {
  const matches = [...text.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return uniqueSorted(matches);
};

const classifyFailure = (joinedBlock: string): FailureClassification => {
  if (/ERR_PNPM_FETCH|ERR_SOCKET_TIMEOUT|ETIMEDOUT|registry\.npmjs\.org|request to .*registry.*failed/i.test(joinedBlock)) {
    return {
      kind: 'registry_timeout_install_failure',
      confidence: 0.98,
      strategy: 'Treat this as infra-first. Re-run install with registry diagnostics before changing repository code.',
      docs: 'No docs update needed unless CI install policy changed intentionally.',
      likelyCauses: ['Registry timeout or package-fetch instability interrupted dependency install.', 'The CI run failed before repository logic could be validated.']
    };
  }
  if (/cache (?:restore|download).*failed|Failed to restore cache|Unable to reserve cache/i.test(joinedBlock)) {
    return {
      kind: 'cache_restore_failure',
      confidence: 0.97,
      strategy: 'Treat this as infra-first. Re-run without relying on restored cache and confirm cache backend health.',
      docs: 'Update CI docs only if cache policy changed intentionally.',
      likelyCauses: ['CI cache restore failed and interrupted the deterministic setup path.', 'The run may be infra-limited rather than product-regressed.']
    };
  }
  if (/Error:.*action\.yml|composite action|Unexpected value .*steps|manifest parse/i.test(joinedBlock)) {
    return {
      kind: 'composite_action_manifest_parse_failure',
      confidence: 0.99,
      strategy: 'Fix the composite action manifest syntax/keys before running product remediation.',
      docs: 'Update CI workflow/composite-action docs when action contract changes intentionally.',
      likelyCauses: ['Composite action manifest parse failure blocked execution before tests.', 'Workflow-only keys may have been mixed into composite action step schema.']
    };
  }
  if (/Cannot find module ['"]@rollup\/rollup-linux-x64-gnu|Rollup native optional package missing|tool bootstrap failure|bootstrap failed/i.test(joinedBlock)) {
    return {
      kind: 'tool_bootstrap_failure',
      confidence: 0.98,
      strategy: 'Reconcile missing optional/native tool bootstrap prerequisites before attempting code-level fixes.',
      docs: 'Document bootstrap prerequisites only if environment requirements changed intentionally.',
      likelyCauses: ['Optional/native bootstrap binary was unavailable.', 'CI tooling prerequisites failed before product checks could run.']
    };
  }
  if (/Preflight verify failed before pnpm test|release sync --check|Release drift detected before verify/i.test(joinedBlock)) {
    return {
      kind: 'release_governance_preflight_failure',
      confidence: 0.98,
      strategy: 'Run release governance sync/apply locally, commit governed outputs, and re-run CI.',
      docs: 'Keep release-governance workflow docs aligned if command behavior changed intentionally.',
      likelyCauses: ['Release governance preflight failed before product tests.', 'Governed release state drifted from repository changes.']
    };
  }
  if (/contracts:check|contract snapshot|snapshot drift|generated schema drift|contracts snapshot drift/i.test(joinedBlock)) {
    return {
      kind: 'contracts_snapshot_drift',
      confidence: 0.93,
      strategy: 'Regenerate and review governed contract snapshots; do not run product autofix mutation.',
      docs: 'Update contract/docs surfaces together if snapshot drift is intentional.',
      likelyCauses: ['Contract snapshot drift triggered governance failure.', 'Command contract output changed without synchronized snapshots.']
    };
  }
  if (/docs audit|docs contract failure|documentation governance/i.test(joinedBlock)) {
    return {
      kind: 'docs_audit_contract_failure',
      confidence: 0.94,
      strategy: 'Resolve docs-audit governance findings and rerun governance checks before product remediation.',
      docs: 'Update owning command/governance docs in the same change.',
      likelyCauses: ['Documentation governance contract check failed.', 'Required docs surfaces are not aligned with command/workflow behavior.']
    };
  }
  if (/doctor.*failed|command-governance enforcement|governance enforcement failure|protected-doc\./i.test(joinedBlock)) {
    return {
      kind: 'command_governance_enforcement_failure',
      confidence: 0.94,
      strategy: 'Address command-governance/doctor findings directly; no product autofix mutation should run.',
      docs: 'Update governance docs when enforcement contracts intentionally change.',
      likelyCauses: ['Doctor or command-governance enforcement blocked CI.', 'Governed command/doc surfaces drifted from policy expectations.']
    };
  }
  if (/::(error|warning)\s+file=.*line=.*col=.*/i.test(joinedBlock)) {
    if (/contract drift|schema drift|schema mismatch|contract snapshot|cliSchemas|invalid contract|generated .*schema/i.test(joinedBlock)) {
      return {
        kind: 'contract_drift',
        confidence: 0.93,
        strategy: 'Treat annotation-reported schema/contract drift as governance-first and reconcile the contract/schema surface before product remediation.',
        docs: 'Update command contract docs, schema snapshots, and related governance docs together when intentional.',
        likelyCauses: ['GitHub Actions annotation points to schema/contract drift.', 'Contract artifacts changed without aligned schema/snapshot updates.']
      };
    }
    return {
      kind: 'runtime_failure',
      confidence: 0.88,
      strategy: 'Start from the referenced GitHub Actions annotation location, then confirm whether the annotation reflects the root runtime failure or a downstream symptom.',
      docs: 'No docs update needed unless the annotation reveals an intentional workflow contract change.',
      likelyCauses: ['GitHub Actions surfaced an explicit annotation for a failing file location.', 'The underlying failure may already be present in the surrounding test or build output.']
    };
  }
  if (/@esbuild\/linux-x64|Cannot find module ['"]@esbuild\/|optional native dependency/i.test(joinedBlock)) {
    return {
      kind: 'environment_limitation',
      confidence: 0.98,
      strategy: 'Re-run in a fully provisioned environment and verify optional native dependencies are installed before changing repository code.',
      docs: 'No docs update needed unless CI environment requirements changed.',
      likelyCauses: ['A native optional dependency is missing in the execution environment.', 'The failure may be environmental rather than a repository regression.']
    };
  }
  if (/ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL|recursive run first fail/i.test(joinedBlock)) {
    return {
      kind: 'recursive_workspace_failure',
      confidence: 0.97,
      strategy: 'Identify the first failing workspace command, repair the narrow package-level failure, then re-run the recursive workspace command.',
      docs: 'Document the workspace orchestration dependency only if it changed intentionally.',
      likelyCauses: ['A workspace-level recursive command stopped after the first package failure.', 'One package likely failed first and caused downstream workspace noise.']
    };
  }
  if (/eslint|biome|prettier|stylelint|lint failed|lint error/i.test(joinedBlock)) {
    return {
      kind: 'lint_failure',
      confidence: 0.94,
      strategy: 'Run the narrow lint command for the referenced workspace or file and fix the formatting or rule violation before rerunning the broader suite.',
      docs: 'No docs update is needed unless lint policy changed.',
      likelyCauses: ['A lint rule violation is blocking the suite.', 'Formatting or local rule conformance drifted from the enforced baseline.']
    };
  }
  if (/TS\d{4}|type error|typescript|tsc -p|Found \d+ errors?/i.test(joinedBlock)) {
    return {
      kind: 'typecheck_failure',
      confidence: 0.95,
      strategy: 'Run the narrow typecheck command for the failing workspace and reconcile the referenced types before rerunning the suite.',
      docs: 'Update docs only if a public type contract changed intentionally.',
      likelyCauses: ['A TypeScript compile-time incompatibility was detected.', 'A type contract changed without aligned call sites or fixtures.']
    };
  }
  if (/Snapshot .*mismatch|snapshot mismatch|Snapshots?\s+\d+\s+failed|\.snap/i.test(joinedBlock)) {
    return {
      kind: 'snapshot_drift',
      confidence: 0.95,
      strategy: 'Review the snapshot diff, confirm the current output is expected, and update the affected snapshot or fixture only after verifying behavior.',
      docs: 'Update docs only if the snapshot reflects an intentional command or contract surface change.',
      likelyCauses: ['The deterministic output no longer matches the stored snapshot.', 'A contract, formatting, or fixture change may not have been reflected in snapshots.']
    };
  }
  if (/missing expected finding|expected finding.*not found|did not find expected/i.test(joinedBlock)) {
    return {
      kind: 'missing_expected_finding',
      confidence: 0.91,
      strategy: 'Check whether the rule or detector still emits the expected finding and confirm fixture inputs still exercise the intended path.',
      docs: 'Update governance docs if the expected finding contract changed intentionally.',
      likelyCauses: ['A rule or detector no longer emits an expected finding.', 'Fixtures no longer trigger the governed behavior being asserted.']
    };
  }
  if (/contract drift|schema mismatch|contract snapshot|expected .*schema|invalid contract/i.test(joinedBlock)) {
    return {
      kind: 'contract_drift',
      confidence: 0.92,
      strategy: 'Compare the emitted contract against the authoritative schema or snapshot, then update the producer or contract docs in the same change.',
      docs: 'Update command, contract, and roadmap docs together if the contract surface changed intentionally.',
      likelyCauses: ['A command output or schema changed without aligned contract updates.', 'Fixtures or snapshots still reflect an older contract version.']
    };
  }
  if (/ENOENT|missing artifact|no such file or directory/i.test(joinedBlock)) {
    return {
      kind: 'missing_artifact',
      confidence: 0.93,
      strategy: 'Restore or regenerate the missing artifact before considering any broader code change.',
      docs: 'Document the required artifact if operators can realistically miss the prerequisite.',
      likelyCauses: ['A required fixture, snapshot, or generated artifact is missing.', 'A producer step may not have run before the consumer step.']
    };
  }
  if (/expected\s+undefined|Received:\s+undefined|received\s+undefined/i.test(joinedBlock)) {
    return {
      kind: 'fixture_drift',
      confidence: 0.88,
      strategy: 'Inspect the test fixture or seeded contract data and realign it with the current deterministic output shape.',
      docs: 'Consider updating contract docs if the fixture drift reflects an intentional schema change.',
      likelyCauses: ['Seeded test data is stale for the current output shape.', 'A fixture producer/consumer dependency is no longer aligned.']
    };
  }

  const expectedArrayMatch = joinedBlock.match(/Expected[^\[]*(\[[^\]]+\])/i);
  const receivedArrayMatch = joinedBlock.match(/Received[^\[]*(\[[^\]]+\])/i);
  if (expectedArrayMatch?.[1] && receivedArrayMatch?.[1]) {
    const expected = readArrayLiteral(expectedArrayMatch[1]);
    const received = readArrayLiteral(receivedArrayMatch[1]);
    if (expected.length > 1 && expected.join('|') === received.join('|') && expectedArrayMatch[1] !== receivedArrayMatch[1]) {
      return {
        kind: 'ordering_drift',
        confidence: 0.9,
        strategy: 'Preserve deterministic ordering by sorting the producer output or the fixture setup rather than relaxing the assertion.',
        docs: 'No docs update needed unless ordering guarantees are operator-visible.',
        likelyCauses: ['The same values are present but in a different order.', 'Deterministic ordering guarantees are missing or not enforced.']
      };
    }
  }

  if (/Expected:|Received:|expected .* to (be|equal|contain|match)/i.test(joinedBlock)) {
    return {
      kind: /contract drift|schema mismatch|contract snapshot|invalid contract/i.test(joinedBlock) ? 'contract_drift' : 'test_expectation_drift',
      confidence: 0.84,
      strategy: 'Compare the current deterministic behavior with the asserted expectation and update the narrow assertion only if the new behavior is intended.',
      docs: 'Update docs if the assertion reflects an operator-facing text or contract change.',
      likelyCauses: ['The asserted expectation no longer matches current behavior.', 'Behavior, fixtures, or the test expectation changed without synchronized updates.']
    };
  }

  if (/ReferenceError|TypeError|SyntaxError|Error:/i.test(joinedBlock)) {
    return {
      kind: 'runtime_failure',
      confidence: 0.8,
      strategy: 'Start from the narrow failing test or workspace, reproduce the runtime error locally, and inspect the top stack frame before changing assertions.',
      docs: 'No docs update needed unless runtime behavior changed intentionally.',
      likelyCauses: ['Code threw at runtime before assertions completed.', 'A partially integrated feature may have left dependencies unsatisfied.']
    };
  }

  return {
    kind: 'likely_regression',
    confidence: 0.67,
    strategy: 'Treat the failure as a likely behavioral regression until a narrow deterministic explanation is proven.',
    docs: 'Document the behavioral change only after confirming the regression is intentional.',
    likelyCauses: ['No stronger deterministic heuristic matched the failure block.', 'The failure may require manual debugging or a new classification heuristic.']
  };
};

const deriveLikelyFiles = (kind: TestTriageFailureKind, testFile: string | null, block: string[]): string[] => {
  const joined = block.join('\n');
  const files = new Set<string>();
  if (testFile) files.add(testFile);
  if (kind === 'snapshot_drift' && testFile) files.add(`${testFile}.snap`);
  for (const match of joined.matchAll(/([\w./-]+\.(?:ts|tsx|js|jsx|json|md|snap|yml|yaml))/g)) {
    files.add(normalizePath(match[1]));
  }
  return [...files].sort(compareStrings);
};

const buildVerificationCommands = (workspace: string | null, file: string | null, kind: TestTriageFailureKind): string[] => {
  const commands: string[] = [];
  if (workspace && file) commands.push(`pnpm --filter ${workspace} exec vitest run ${file}`);
  if (workspace && kind === 'lint_failure') commands.push(`pnpm --filter ${workspace} lint`);
  if (workspace && kind === 'typecheck_failure') commands.push(`pnpm --filter ${workspace} exec tsc -p tsconfig.json --noEmit`);
  if (workspace) commands.push(`pnpm --filter ${workspace} test`);
  commands.push(kind === 'lint_failure' ? 'pnpm -r lint' : kind === 'typecheck_failure' ? 'pnpm -r build' : 'pnpm -r test');
  return uniqueSorted(commands);
};

const maybeReadGithubAnnotation = (line: string): { title: string | null; file: string | null; line: number | null; column: number | null } | null => {
  const match = line.match(/^::(?:error|warning)\s+file=([^,\n]+)(?:,line=(\d+))?(?:,col=(\d+))?(?:,[^:]*)?::(.*)$/i);
  if (!match) return null;
  return {
    file: normalizePath(match[1]),
    line: match[2] ? Number(match[2]) : null,
    column: match[3] ? Number(match[3]) : null,
    title: normalizeWhitespace(match[4]) || null
  };
};

const parseFailureBlocks = (rawLog: string): MutableFinding[] => {
  const lines = rawLog.split(/\r?\n/);
  const findings: MutableFinding[] = [];
  let currentWorkspace: string | null = null;
  let currentSuite: string | null = null;
  let currentTestName: string | null = null;
  let currentFile: string | null = null;
  let currentLine: number | null = null;
  let currentColumn: number | null = null;
  let currentAnnotationTitle: string | null = null;
  let currentBlock: string[] = [];

  const pushCurrent = (): void => {
    if (currentBlock.length === 0) return;
    findings.push({
      workspace: currentWorkspace,
      suite: currentSuite,
      testName: currentTestName,
      file: currentFile,
      line: currentLine,
      column: currentColumn,
      annotationTitle: currentAnnotationTitle,
      block: [...currentBlock]
    });
    currentSuite = null;
    currentTestName = null;
    currentFile = null;
    currentLine = null;
    currentColumn = null;
    currentAnnotationTitle = null;
    currentBlock = [];
  };

  for (const line of lines) {
    const workspaceMatch = line.match(/(?:^|\s)(@[^\s:]+\/[^\s:]+|packages\/[\w./-]+)\s+(?:test|lint|build|typecheck):/);
    if (workspaceMatch) currentWorkspace = workspaceMatch[1];

    const recursiveMatch = line.match(/ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL.*?(?:in\s+)?(@[^\s]+\/[^\s]+|packages\/[\w./-]+)/);
    if (recursiveMatch) {
      pushCurrent();
      currentWorkspace = recursiveMatch[1];
      currentBlock = [line];
      continue;
    }

    const annotation = maybeReadGithubAnnotation(line);
    if (annotation) {
      pushCurrent();
      currentFile = annotation.file;
      currentLine = annotation.line;
      currentColumn = annotation.column;
      currentAnnotationTitle = annotation.title;
      currentBlock = [line];
      continue;
    }

    const suiteMatch = line.match(/(?:FAIL|×|❯)\s+([\w./-]+\.(?:test|spec)\.[jt]sx?)/);
    if (suiteMatch) {
      pushCurrent();
      currentSuite = normalizePath(suiteMatch[1]);
      currentFile = currentFile ?? currentSuite;
      currentBlock = [line];
      continue;
    }

    const testNameMatch = line.match(/^\s*(?:×|✕|❯)\s+(.+?)\s*$/);
    if (testNameMatch && !currentTestName) {
      currentTestName = normalizeWhitespace(testNameMatch[1]);
      if (currentBlock.length > 0) currentBlock.push(line);
      continue;
    }

    if (/AssertionError|Error:|Snapshot|Expected:|Received:|Cannot find module|ENOENT|ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL|eslint|TS\d{4}|missing expected finding|contract drift|runtime/i.test(line)) {
      if (currentBlock.length === 0) currentBlock = [line];
      else currentBlock.push(line);
      continue;
    }

    if (currentBlock.length > 0) {
      if (line.trim().length === 0) pushCurrent();
      else currentBlock.push(line);
    }
  }

  pushCurrent();
  if (findings.length > 0) return findings;
  return rawLog.trim().length === 0 ? [] : [{ workspace: null, suite: null, testName: null, file: null, line: null, column: null, annotationTitle: null, block: rawLog.split(/\r?\n/).filter(Boolean) }];
};

const buildNormalizedFailure = (entry: MutableFinding, classification: FailureClassification): TestTriageFailure => ({
  type: classification.kind,
  workspace: entry.workspace,
  suite: entry.suite,
  test: entry.testName,
  file: entry.file,
  line: entry.line,
  column: entry.column,
  message: normalizeWhitespace(entry.annotationTitle ?? entry.block.find((line) => /AssertionError|Error:|Snapshot|Expected:|Received:|ERR_PNPM|eslint|TS\d{4}|missing expected finding|contract drift/i.test(line)) ?? toBlockSummary(entry.block)),
  likelyCauses: classification.likelyCauses
});

const summarizeFailures = (failures: TestTriageFailure[]): { summary: string; primaryFailureClass: TestTriageArtifact['primaryFailureClass'] } => {
  if (failures.length === 0) return { summary: EMPTY_ARTIFACT_SUMMARY, primaryFailureClass: 'unknown' };
  const counts = new Map<TestTriageFailureKind, number>();
  failures.forEach((failure) => counts.set(failure.type, (counts.get(failure.type) ?? 0) + 1));
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || compareStrings(left[0], right[0]));
  const [primaryFailureClass, primaryCount] = ranked[0];
  const workspaceCount = new Set(failures.map((failure) => failure.workspace).filter(Boolean)).size;
  const suiteCount = new Set(failures.map((failure) => failure.suite ?? failure.file).filter(Boolean)).size;
  return {
    primaryFailureClass,
    summary: `${failures.length} normalized failure${failures.length === 1 ? '' : 's'} detected across ${Math.max(workspaceCount, 1)} workspace${workspaceCount === 1 ? '' : 's'} and ${Math.max(suiteCount, 1)} suite${suiteCount === 1 ? '' : 's'}; primary failure class: ${primaryFailureClass} (${primaryCount}).`
  };
};

const deriveFailureLayer = (failureKinds: TestTriageFailureKind[]): TestTriageFailureLayer => {
  if (failureKinds.length === 0) return 'unknown';
  const infraKinds = new Set<TestTriageFailureKind>(['registry_timeout_install_failure', 'cache_restore_failure', 'composite_action_manifest_parse_failure', 'tool_bootstrap_failure', 'environment_limitation']);
  const governanceKinds = new Set<TestTriageFailureKind>(['release_governance_preflight_failure', 'contracts_snapshot_drift', 'docs_audit_contract_failure', 'command_governance_enforcement_failure', 'missing_expected_finding', 'contract_drift']);
  if (failureKinds.some((kind) => infraKinds.has(kind))) return 'infra_failure';
  if (failureKinds.some((kind) => governanceKinds.has(kind))) return 'governance_failure';
  return 'product_failure';
};

const deriveAutomationEligibility = (status: TestTriageArtifact['status'], layer: TestTriageFailureLayer): TestTriageAutomationEligibility => {
  if (status !== 'failed') return 'not_applicable';
  if (layer === 'infra_failure') return 'blocked_infra_failure';
  if (layer === 'governance_failure') return 'blocked_governance_failure';
  return 'eligible_for_product_remediation';
};

const buildCrossCuttingDiagnosis = (failures: TestTriageFailure[]): string[] => {
  const diagnoses = new Set<string>();
  const byWorkspace = new Map<string, TestTriageFailure[]>();
  failures.forEach((failure) => {
    const key = failure.workspace ?? 'workspace:unknown';
    byWorkspace.set(key, [...(byWorkspace.get(key) ?? []), failure]);
  });
  byWorkspace.forEach((workspaceFailures, workspace) => {
    const kinds = uniqueSorted(workspaceFailures.map((failure) => failure.type));
    if (workspaceFailures.length > 1 && kinds.length > 1) {
      diagnoses.add(`${workspace.replace(/^workspace:/, '')}: multiple failure classes (${kinds.join(', ')}) suggest a partially integrated feature or a shared fixture/contract dependency.`);
    }
    if (kinds.includes('recursive_workspace_failure')) {
      diagnoses.add(`${workspace.replace(/^workspace:/, '')}: recursive workspace failure likely amplifies a narrower package-level error; repair the first failing workspace before re-running the full recursive command.`);
    }
    if (kinds.includes('contract_drift') || (kinds.includes('snapshot_drift') && kinds.includes('missing_expected_finding'))) {
      diagnoses.add(`${workspace.replace(/^workspace:/, '')}: contract drift is appearing alongside snapshot or finding drift, so update command output, snapshots, and contract docs together if intentional.`);
    }
  });
  if (failures.some((failure) => failure.type === 'lint_failure') && failures.some((failure) => failure.type === 'typecheck_failure')) {
    diagnoses.add('Lint and typecheck failures appeared together, which often indicates a partially integrated refactor rather than isolated assertion drift.');
  }
  return [...diagnoses].sort(compareStrings);
};

const buildRecommendedNextChecks = (findings: TestTriageFinding[], crossCuttingDiagnosis: string[]): string[] => {
  const commands = uniqueSorted(findings.flatMap((finding) => finding.verification_commands));
  const checks = new Set<string>(commands);
  if (findings.some((finding) => finding.failure_kind === 'snapshot_drift')) checks.add('Inspect the referenced snapshot diff before refreshing snapshots.');
  if (findings.some((finding) => finding.failure_kind === 'contract_drift')) checks.add('Compare the emitted JSON against the canonical schema or contract snapshot before changing fixtures.');
  if (findings.some((finding) => finding.failure_kind === 'missing_expected_finding')) checks.add('Confirm the governed rule or detector still emits the expected finding for the current fixture input.');
  if (findings.some((finding) => finding.failure_kind === 'registry_timeout_install_failure')) checks.add('Infra failure: validate npm/pnpm registry reachability and rerun install before any repository mutation.');
  if (findings.some((finding) => finding.failure_kind === 'release_governance_preflight_failure')) checks.add('Governance failure: run `pnpm playbook release sync` (or `pnpm playbook commit`) and commit governed release outputs.');
  if (findings.some((finding) => finding.failure_kind === 'docs_audit_contract_failure')) checks.add('Governance failure: run `pnpm playbook docs audit --json` locally and resolve reported doc contract drift.');
  if (crossCuttingDiagnosis.length > 0) checks.add('Review cross-cutting diagnoses before applying any broad multi-file repair.');
  return [...checks].sort(compareStrings);
};

export const buildTestTriageArtifact = (rawLog: string, source: TriageInputSource): TestTriageArtifact => {
  const parsedBlocks = parseFailureBlocks(rawLog);
  const findings: TestTriageFinding[] = parsedBlocks.map((entry) => {
    const joined = entry.block.join('\n');
    const classification = classifyFailure(joined);
    const repairClass: TestTriageRepairClass = LOW_RISK_KINDS.has(classification.kind) ? 'autofix_plan_only' : 'review_required';
    const verificationCommands = buildVerificationCommands(entry.workspace, entry.file, classification.kind);
    const normalizedFailure = buildNormalizedFailure(entry, classification);
    const baseFinding: Omit<TestTriageFinding, 'failure_signature'> = {
      failure_kind: classification.kind,
      confidence: clampConfidence(classification.confidence),
      package: entry.workspace,
      test_file: entry.file,
      test_name: entry.testName,
      likely_files_to_modify: deriveLikelyFiles(classification.kind, entry.file, entry.block),
      suggested_fix_strategy: classification.strategy,
      verification_commands: verificationCommands,
      docs_update_recommendation: classification.docs,
      rule_pattern_failure_mode: GOVERNANCE_NOTE,
      repair_class: repairClass,
      summary: toBlockSummary(entry.block),
      evidence: uniqueSorted(entry.block.map((line) => normalizeWhitespace(line)).filter(Boolean)).slice(0, 8),
      normalized_failure: normalizedFailure
    };
    return {
      failure_signature: buildFailureSignature(baseFinding),
      ...baseFinding
    };
  }).sort((left, right) => {
    const packageOrder = (left.package ?? '').localeCompare(right.package ?? '');
    if (packageOrder !== 0) return packageOrder;
    const fileOrder = (left.test_file ?? '').localeCompare(right.test_file ?? '');
    if (fileOrder !== 0) return fileOrder;
    return (left.test_name ?? '').localeCompare(right.test_name ?? '');
  });

  const failures = findings.map((finding) => finding.normalized_failure);
  const { summary, primaryFailureClass } = summarizeFailures(failures);
  const failureLayer = deriveFailureLayer(failures.map((failure) => failure.type));
  const automationEligibility = deriveAutomationEligibility(findings.length > 0 ? 'failed' : rawLog.trim().length === 0 ? 'unknown' : 'passed', failureLayer);
  const crossCuttingDiagnosis = buildCrossCuttingDiagnosis(failures);
  const recommendedNextChecks = buildRecommendedNextChecks(findings, crossCuttingDiagnosis);
  const rerunCommands = uniqueSorted(findings.flatMap((finding) => finding.verification_commands));
  const lowRisk = findings.filter((finding) => finding.repair_class === 'autofix_plan_only');
  const risky = findings.filter((finding) => finding.repair_class === 'review_required');
  const suggestedActions = [
    ...lowRisk.map((finding) => `Plan a narrow, non-production-code repair for ${finding.failure_kind} in ${finding.test_file ?? 'the failing test surface'}.`),
    ...risky.map((finding) => `Require human review before changing behavior for ${finding.failure_kind} in ${finding.test_file ?? 'the failing surface'}.`)
  ];

  const codexPrompt = [
    'Summarize and diagnose the captured CI/test failures without mutating production logic blindly.',
    'Use the normalized failure-summary fields first, and consult the raw log only when details are missing.',
    'Allowed low-risk repair classes: snapshot_drift, stale_assertion, fixture_drift, ordering_drift.',
    'Do not auto-edit production logic for review_required findings.',
    `Summary: ${summary}`,
    ...findings.map((finding, index) => `${index + 1}. ${finding.failure_kind} :: ${finding.test_file ?? 'unknown file'} :: ${finding.suggested_fix_strategy}`)
  ].join('\n');

  return {
    schemaVersion: TEST_TRIAGE_SCHEMA_VERSION,
    kind: TEST_TRIAGE_ARTIFACT_KIND,
    command: 'test-triage',
    status: findings.length > 0 ? 'failed' : rawLog.trim().length === 0 ? 'unknown' : 'passed',
    summary,
    failureLayer,
    primaryFailureClass,
    automationEligibility,
    generatedAt: new Date(0).toISOString(),
    source,
    failures,
    crossCuttingDiagnosis,
    recommendedNextChecks,
    findings,
    rerun_plan: {
      strategy: 'file_first_then_package_then_workspace',
      commands: rerunCommands
    },
    repair_plan: {
      summary: `${lowRisk.length} low-risk findings can be planned without mutating production logic; ${risky.length} findings require review.`,
      codex_prompt: codexPrompt,
      suggested_actions: suggestedActions
    }
  };
};

export const renderTestTriageMarkdown = (artifact: TestTriageArtifact): string => {
  const lines = [
    '# Playbook Failure Summary',
    '',
    `- Status: ${artifact.status}`,
    `- Failure layer: ${artifact.failureLayer}`,
    `- Primary failure class: ${artifact.primaryFailureClass}`,
    `- Automation eligibility: ${artifact.automationEligibility}`,
    `- Summary: ${artifact.summary}`,
    artifact.source.path ? `- Source log: \`${artifact.source.path}\`` : '- Source log: stdin',
    ''
  ];

  if (artifact.failures.length > 0) {
    lines.push('## Failures', '');
    artifact.failures.forEach((failure, index) => {
      const location = failure.file ? `${failure.file}${failure.line ? `:${failure.line}${failure.column ? `:${failure.column}` : ''}` : ''}` : 'unknown location';
      lines.push(`${index + 1}. **${failure.type}** — ${failure.message}`);
      lines.push(`   - Workspace: ${failure.workspace ?? 'unknown'}`);
      lines.push(`   - Suite/Test: ${(failure.suite ?? failure.file) ?? 'unknown'}${failure.test ? ` :: ${failure.test}` : ''}`);
      lines.push(`   - Location: ${location}`);
      if (failure.likelyCauses.length > 0) lines.push(`   - Likely causes: ${failure.likelyCauses.join('; ')}`);
      lines.push('');
    });
  }

  if (artifact.crossCuttingDiagnosis.length > 0) {
    lines.push('## Cross-cutting diagnosis', '');
    artifact.crossCuttingDiagnosis.forEach((entry) => lines.push(`- ${entry}`));
    lines.push('');
  }

  if (artifact.recommendedNextChecks.length > 0) {
    lines.push('## Recommended next checks', '');
    artifact.recommendedNextChecks.forEach((entry) => lines.push(`- ${entry}`));
    lines.push('');
  }

  lines.push('## Governance');
  lines.push(`- Rule: ${GOVERNANCE_NOTE.rule}`);
  lines.push(`- Pattern: ${GOVERNANCE_NOTE.pattern}`);
  lines.push(`- Failure Mode: ${GOVERNANCE_NOTE.failure_mode}`);
  lines.push('');

  return lines.join('\n');
};

export const renderTestTriageText = (artifact: TestTriageArtifact): string => renderTestTriageMarkdown(artifact);
