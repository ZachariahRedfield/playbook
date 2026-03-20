import {
  TEST_TRIAGE_ARTIFACT_KIND,
  TEST_TRIAGE_SCHEMA_VERSION,
  type TestTriageArtifact,
  type TestTriageFailureKind,
  type TestTriageFinding,
  type TestTriageRepairClass
} from '@zachariahredfield/playbook-core';

type TriageInputSource = { input: 'file' | 'stdin'; path: string | null };

type MutableFinding = {
  packageName: string | null;
  testFile: string | null;
  testName: string | null;
  block: string[];
};

const GOVERNANCE_NOTE = {
  rule: 'Automate diagnosis first, repair second, merge never.',
  pattern: 'Most repeated CI failures cluster into a small set of deterministic repair classes that can be parsed from test output.',
  failure_mode: 'Teams waste time manually re-deriving the same failure classification logic instead of encoding it as reusable automation.'
} as const;

const LOW_RISK_KINDS = new Set<TestTriageFailureKind>(['snapshot_drift', 'stale_assertion', 'fixture_drift', 'ordering_drift']);

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
const normalizePath = (value: string): string => value.replaceAll('\\', '/');
const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort(compareStrings);
const clampConfidence = (value: number): number => Math.max(0, Math.min(0.99, Number(value.toFixed(2))));

const readArrayLiteral = (text: string): string[] => {
  const matches = [...text.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return uniqueSorted(matches);
};

const classifyFailure = (joinedBlock: string): { kind: TestTriageFailureKind; confidence: number; strategy: string; docs: string } => {
  if (/@esbuild\/linux-x64|Cannot find module ['"]@esbuild\//i.test(joinedBlock)) {
    return {
      kind: 'environment_limitation',
      confidence: 0.98,
      strategy: 'Re-run in a fully provisioned environment and verify optional native dependencies are installed before changing repository code.',
      docs: 'No docs update needed unless CI environment requirements changed.'
    };
  }

  if (/Snapshot .*mismatch|snapshot mismatch|Snapshots?\s+\d+\s+failed|\.snap/i.test(joinedBlock)) {
    return {
      kind: 'snapshot_drift',
      confidence: 0.95,
      strategy: 'Review the snapshot diff, confirm the current output is expected, and update the affected snapshot or fixture only after verifying behavior.',
      docs: 'Update docs only if the snapshot reflects an intentional command or contract surface change.'
    };
  }

  if (/ENOENT|missing artifact|no such file or directory/i.test(joinedBlock)) {
    return {
      kind: 'missing_artifact',
      confidence: 0.93,
      strategy: 'Restore or regenerate the missing artifact before considering any broader code change.',
      docs: 'Document the required artifact if operators can realistically miss the prerequisite.'
    };
  }

  if (/expected\s+undefined|Received:\s+undefined|received\s+undefined/i.test(joinedBlock)) {
    return {
      kind: 'fixture_drift',
      confidence: 0.88,
      strategy: 'Inspect the test fixture or seeded contract data and realign it with the current deterministic output shape.',
      docs: 'Consider updating contract docs if the fixture drift reflects an intentional schema change.'
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
        docs: 'No docs update needed unless ordering guarantees are operator-visible.'
      };
    }
  }

  if (/Expected:|Received:|expected .* to (be|equal|contain|match)/i.test(joinedBlock)) {
    return {
      kind: 'stale_assertion',
      confidence: 0.81,
      strategy: 'Compare the current deterministic behavior with the asserted expectation and update the narrow assertion only if the new behavior is intended.',
      docs: 'Update docs if the assertion reflects an operator-facing text or contract change.'
    };
  }

  return {
    kind: 'likely_regression',
    confidence: 0.67,
    strategy: 'Treat the failure as a likely behavioral regression until a narrow deterministic explanation is proven.',
    docs: 'Document the behavioral change only after confirming the regression is intentional.'
  };
};

const deriveLikelyFiles = (kind: TestTriageFailureKind, testFile: string | null, block: string[]): string[] => {
  const joined = block.join('\n');
  const files = new Set<string>();
  if (testFile) files.add(testFile);
  if (kind === 'snapshot_drift' && testFile) files.add(`${testFile}.snap`);
  for (const match of joined.matchAll(/([\w./-]+\.(?:ts|tsx|js|jsx|json|md|snap))/g)) {
    files.add(normalizePath(match[1]));
  }
  return [...files].sort(compareStrings);
};

const buildVerificationCommands = (packageName: string | null, testFile: string | null): string[] => {
  const commands: string[] = [];
  if (packageName && testFile) commands.push(`pnpm --filter ${packageName} exec vitest run ${testFile}`);
  if (packageName) commands.push(`pnpm --filter ${packageName} test`);
  commands.push('pnpm -r test');
  return uniqueSorted(commands);
};

const parseFailureBlocks = (rawLog: string): MutableFinding[] => {
  const lines = rawLog.split(/\r?\n/);
  const findings: MutableFinding[] = [];
  let currentPackage: string | null = null;
  let currentTestFile: string | null = null;
  let currentTestName: string | null = null;
  let currentBlock: string[] = [];

  const pushCurrent = (): void => {
    if (currentBlock.length === 0) return;
    findings.push({
      packageName: currentPackage,
      testFile: currentTestFile,
      testName: currentTestName,
      block: [...currentBlock]
    });
    currentTestFile = null;
    currentTestName = null;
    currentBlock = [];
  };

  for (const line of lines) {
    const packageMatch = line.match(/(?:^|\s)(@[^\s:]+\/[^\s:]+|packages\/[\w./-]+)\s+test:/);
    if (packageMatch) {
      currentPackage = packageMatch[1];
    }

    const fileMatch = line.match(/(?:FAIL|×|❯)\s+([\w./-]+\.(?:test|spec)\.[jt]sx?)/);
    if (fileMatch) {
      pushCurrent();
      currentTestFile = normalizePath(fileMatch[1]);
      currentBlock.push(line);
      continue;
    }

    const pnpmRecursiveMatch = line.match(/ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL.*?(?:in\s+)?(@[^\s]+\/[^\s]+|packages\/[\w./-]+)/);
    if (pnpmRecursiveMatch && !currentPackage) {
      currentPackage = pnpmRecursiveMatch[1];
    }

    const testNameMatch = line.match(/^\s*(?:×|✕|❯)\s+(.+?)\s*$/);
    if (testNameMatch && !currentTestName) {
      currentTestName = testNameMatch[1].trim();
    }

    if (/AssertionError|Error:|Snapshot|Expected:|Received:|Cannot find module|ENOENT|ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL/i.test(line)) {
      if (currentBlock.length === 0) currentBlock.push(line);
      else currentBlock.push(line);
      continue;
    }

    if (currentBlock.length > 0) {
      if (line.trim().length === 0) {
        pushCurrent();
      } else {
        currentBlock.push(line);
      }
    }
  }

  pushCurrent();
  if (findings.length > 0) return findings;

  return rawLog.trim().length === 0
    ? []
    : [{ packageName: null, testFile: null, testName: null, block: rawLog.split(/\r?\n/).filter(Boolean) }];
};

export const buildTestTriageArtifact = (rawLog: string, source: TriageInputSource): TestTriageArtifact => {
  const parsedBlocks = parseFailureBlocks(rawLog);
  const findings: TestTriageFinding[] = parsedBlocks.map((entry) => {
    const joined = entry.block.join('\n');
    const classification = classifyFailure(joined);
    const repairClass: TestTriageRepairClass = LOW_RISK_KINDS.has(classification.kind) ? 'autofix_plan_only' : 'review_required';
    const verificationCommands = buildVerificationCommands(entry.packageName, entry.testFile);
    return {
      failure_kind: classification.kind,
      confidence: clampConfidence(classification.confidence),
      package: entry.packageName,
      test_file: entry.testFile,
      test_name: entry.testName,
      likely_files_to_modify: deriveLikelyFiles(classification.kind, entry.testFile, entry.block),
      suggested_fix_strategy: classification.strategy,
      verification_commands: verificationCommands,
      docs_update_recommendation: classification.docs,
      rule_pattern_failure_mode: GOVERNANCE_NOTE,
      repair_class: repairClass,
      summary: entry.block[0] ?? 'Unclassified test failure block',
      evidence: uniqueSorted(entry.block.map((line) => line.trim()).filter(Boolean)).slice(0, 8)
    };
  }).sort((left, right) => {
    const packageOrder = (left.package ?? '').localeCompare(right.package ?? '');
    if (packageOrder !== 0) return packageOrder;
    const fileOrder = (left.test_file ?? '').localeCompare(right.test_file ?? '');
    if (fileOrder !== 0) return fileOrder;
    return (left.test_name ?? '').localeCompare(right.test_name ?? '');
  });

  const rerunCommands = uniqueSorted(findings.flatMap((finding) => finding.verification_commands));
  const lowRisk = findings.filter((finding) => finding.repair_class === 'autofix_plan_only');
  const risky = findings.filter((finding) => finding.repair_class === 'review_required');
  const suggestedActions = [
    ...lowRisk.map((finding) => `Plan a narrow, non-production-code repair for ${finding.failure_kind} in ${finding.test_file ?? 'the failing test surface'}.`),
    ...risky.map((finding) => `Require human review before changing behavior for ${finding.failure_kind} in ${finding.test_file ?? 'the failing surface'}.`)
  ];

  const codexPrompt = [
    'Diagnose the captured test failures without mutating production logic blindly.',
    'Allowed low-risk repair classes: snapshot_drift, stale_assertion, fixture_drift, ordering_drift.',
    'Do not auto-edit production logic for review_required findings.',
    ...findings.map((finding, index) => `${index + 1}. ${finding.failure_kind} :: ${finding.test_file ?? 'unknown file'} :: ${finding.suggested_fix_strategy}`)
  ].join('\n');

  return {
    schemaVersion: TEST_TRIAGE_SCHEMA_VERSION,
    kind: TEST_TRIAGE_ARTIFACT_KIND,
    command: 'test-triage',
    generatedAt: new Date(0).toISOString(),
    source,
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

const renderFinding = (finding: TestTriageFinding): string => [
  `- ${finding.failure_kind} (${finding.repair_class}, confidence=${finding.confidence.toFixed(2)})`,
  `  package: ${finding.package ?? 'unknown'}`,
  `  test: ${finding.test_file ?? 'unknown'}${finding.test_name ? ` :: ${finding.test_name}` : ''}`,
  `  fix: ${finding.suggested_fix_strategy}`,
  `  Rule / Pattern / Failure Mode: ${finding.rule_pattern_failure_mode.rule} / ${finding.rule_pattern_failure_mode.pattern} / ${finding.rule_pattern_failure_mode.failure_mode}`
].join('\n');

export const renderTestTriageText = (artifact: TestTriageArtifact): string => {
  const sections = [
    'Playbook Test Triage',
    `Findings: ${artifact.findings.length}`,
    artifact.findings.map(renderFinding).join('\n'),
    'Rerun plan:',
    ...artifact.rerun_plan.commands.map((command) => `- ${command}`),
    `Repair plan: ${artifact.repair_plan.summary}`
  ].filter(Boolean);

  return sections.join('\n');
};
