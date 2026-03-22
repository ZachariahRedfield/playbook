import {
  TEST_TRIAGE_ARTIFACT_KIND,
  TEST_TRIAGE_SCHEMA_VERSION,
  type TestTriageArtifact,
  type TestTriageFailureKind,
  type TestTriageFinding,
  type TestTriageRepairClass
} from '@zachariahredfield/playbook-core';
import { buildFailureSignature } from './testAutofix/failureSignature.js';

type TriageInputSource = { input: 'file' | 'stdin'; path: string | null };

type Annotation = TestTriageFinding['annotations'][number];
type MutableFinding = {
  packageName: string | null;
  testFile: string | null;
  testName: string | null;
  block: string[];
  annotations: Annotation[];
};

const GOVERNANCE_NOTE = {
  rule: 'Any Playbook-managed CI/test failure must emit both raw output and a deterministic normalized summary.',
  pattern: 'Failure summarization is a contract surface, not a convenience logger.',
  failure_mode: 'Raw stderr alone creates re-interpretation work and slows remediation across repeated CI loops.'
} as const;

const LOW_RISK_KINDS = new Set<TestTriageFailureKind>(['snapshot_drift', 'stale_assertion', 'fixture_drift', 'ordering_drift', 'test_expectation_drift']);
const compareStrings = (left: string, right: string): number => left.localeCompare(right);
const normalizePath = (value: string): string => value.replaceAll('\\', '/');
const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort(compareStrings);
const clampConfidence = (value: number): number => Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
const uniqueAnnotations = (annotations: Annotation[]): Annotation[] => {
  const seen = new Set<string>();
  return annotations.filter((annotation) => {
    const key = JSON.stringify(annotation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const readArrayLiteral = (text: string): string[] => {
  const matches = [...text.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return uniqueSorted(matches);
};

const parseGithubAnnotation = (line: string): Annotation | null => {
  const match = line.match(/^::(error|warning|notice)(?:\s+([^:]+))?::(.*)$/);
  if (!match) return null;
  const [, level, rawMeta, message] = match;
  const meta = Object.fromEntries((rawMeta ?? '').split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [key, ...rest] = entry.split('=');
    return [key, rest.join('=')];
  }));
  const lineNumber = meta.line ? Number(meta.line) : null;
  const columnNumber = meta.col ? Number(meta.col) : meta.column ? Number(meta.column) : null;
  return {
    level: level as Annotation['level'],
    message: message.trim(),
    file: meta.file ? normalizePath(meta.file) : null,
    line: Number.isFinite(lineNumber ?? NaN) ? lineNumber : null,
    column: Number.isFinite(columnNumber ?? NaN) ? columnNumber : null,
    title: meta.title ?? null
  };
};

const classifyFailure = (joinedBlock: string): { kind: TestTriageFailureKind; confidence: number; strategy: string; docs: string } => {
  if (/ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL|recursive run first fail/i.test(joinedBlock)) {
    return {
      kind: 'recursive_workspace_failure',
      confidence: 0.98,
      strategy: 'Identify the first failing workspace command, summarize its root failure, and avoid treating downstream package noise as separate root causes.',
      docs: 'Document workspace-level failure routing only if CI or contributor workflows changed.'
    };
  }
  if (/eslint|lint\s+failed|✖\s+\d+ problems/i.test(joinedBlock)) {
    return {
      kind: 'lint_failure',
      confidence: 0.97,
      strategy: 'Fix the reported lint violations directly and rerun the narrow lint command before broader test reruns.',
      docs: 'No docs update needed unless lint policy or workflow expectations changed.'
    };
  }
  if (/tsc|Type '\S+' is not assignable|Cannot find name|Found \d+ errors?/i.test(joinedBlock)) {
    return {
      kind: 'typecheck_failure',
      confidence: 0.97,
      strategy: 'Correct the type error at the reported source location and rerun the narrow typecheck surface before workspace-wide validation.',
      docs: 'Update docs only if the type contract intentionally changed.'
    };
  }
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
  if (/missing expected finding|expected finding.*not found|toContain\([^)]*finding/i.test(joinedBlock)) {
    return {
      kind: 'missing_expected_finding',
      confidence: 0.92,
      strategy: 'Check whether the expected diagnostic should still be emitted; if yes, restore the narrow producer path, otherwise update the governed expectation.',
      docs: 'Update rule or diagnostics docs if the expected finding contract changed intentionally.'
    };
  }
  if (/schemaVersion|contract|snapshot.*contract|expected.*schema|received.*schema/i.test(joinedBlock)) {
    return {
      kind: 'contract_drift',
      confidence: 0.9,
      strategy: 'Compare the producer and consumer contract surfaces, then update the bounded contract/snapshot pair instead of patching downstream assertions blindly.',
      docs: 'Update contract docs, changelog notes, and command docs if the contract change is intended.'
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
      kind: /AssertionError|expect\(/i.test(joinedBlock) ? 'test_expectation_drift' : 'stale_assertion',
      confidence: 0.81,
      strategy: 'Compare the current deterministic behavior with the asserted expectation and update the narrow assertion only if the new behavior is intended.',
      docs: 'Update docs if the assertion reflects an operator-facing text or contract change.'
    };
  }
  if (/ReferenceError|TypeError|SyntaxError|runtime|thrown|Unhandled/i.test(joinedBlock)) {
    return {
      kind: 'runtime_failure',
      confidence: 0.82,
      strategy: 'Trace the runtime exception to the failing code path and fix the execution-time defect before adjusting test expectations.',
      docs: 'Document only if runtime behavior changed intentionally.'
    };
  }
  return {
    kind: 'likely_regression',
    confidence: 0.67,
    strategy: 'Treat the failure as a likely behavioral regression until a narrow deterministic explanation is proven.',
    docs: 'Document the behavioral change only after confirming the regression is intentional.'
  };
};

const deriveLikelyFiles = (kind: TestTriageFailureKind, testFile: string | null, block: string[], annotations: Annotation[]): string[] => {
  const joined = block.join('\n');
  const files = new Set<string>();
  if (testFile) files.add(testFile);
  if (kind === 'snapshot_drift' && testFile) files.add(`${testFile}.snap`);
  for (const annotation of annotations) if (annotation.file) files.add(annotation.file);
  for (const match of joined.matchAll(/([\w./-]+\.(?:ts|tsx|js|jsx|json|md|snap|yml|yaml))/g)) files.add(normalizePath(match[1]));
  return [...files].sort(compareStrings);
};

const buildVerificationCommands = (packageName: string | null, testFile: string | null, kind: TestTriageFailureKind): string[] => {
  const commands: string[] = [];
  if (kind === 'lint_failure') {
    if (packageName) commands.push(`pnpm --filter ${packageName} lint`);
    commands.push('pnpm lint');
    return uniqueSorted(commands);
  }
  if (kind === 'typecheck_failure') {
    if (packageName) commands.push(`pnpm --filter ${packageName} exec tsc -p tsconfig.json --noEmit`);
    commands.push('pnpm -r build');
    return uniqueSorted(commands);
  }
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
  let currentAnnotations: Annotation[] = [];

  const pushCurrent = (): void => {
    if (currentBlock.length === 0 && currentAnnotations.length === 0) return;
    findings.push({ packageName: currentPackage, testFile: currentTestFile, testName: currentTestName, block: [...currentBlock], annotations: uniqueAnnotations(currentAnnotations) });
    currentTestFile = null;
    currentTestName = null;
    currentBlock = [];
    currentAnnotations = [];
  };

  for (const line of lines) {
    const annotation = parseGithubAnnotation(line);
    if (annotation) {
      if (currentBlock.length === 0) currentBlock.push(line);
      else currentBlock.push(line);
      currentAnnotations.push(annotation);
      if (annotation.file && !currentTestFile && /\.(test|spec)\.[jt]sx?$/.test(annotation.file)) currentTestFile = annotation.file;
      continue;
    }

    const packageMatch = line.match(/(?:^|\s)(@[^\s:]+\/[^\s:]+|packages\/[\w./-]+)\s+(?:test|lint|typecheck|build):/);
    if (packageMatch) currentPackage = packageMatch[1];

    const fileMatch = line.match(/(?:FAIL|×|❯)\s+([\w./-]+\.(?:test|spec)\.[jt]sx?)/);
    if (fileMatch) {
      pushCurrent();
      currentTestFile = normalizePath(fileMatch[1]);
      currentBlock.push(line);
      continue;
    }

    const pnpmRecursiveMatch = line.match(/ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL.*?(?:in\s+)?(@[^\s]+\/[^\s]+|packages\/[\w./-]+)/);
    if (pnpmRecursiveMatch) {
      currentPackage = pnpmRecursiveMatch[1];
      if (currentBlock.length === 0) currentBlock.push(line); else currentBlock.push(line);
      continue;
    }

    const testNameMatch = line.match(/^\s*(?:×|✕|❯)\s+(.+?)\s*$/);
    if (testNameMatch && !currentTestName) currentTestName = testNameMatch[1].trim();

    if (/AssertionError|Error:|Snapshot|Expected:|Received:|Cannot find module|ENOENT|ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL|eslint|TypeError|ReferenceError|SyntaxError|tsc|error TS\d+/i.test(line)) {
      if (currentBlock.length === 0) currentBlock.push(line); else currentBlock.push(line);
      continue;
    }

    if (currentBlock.length > 0) {
      if (line.trim().length === 0) pushCurrent();
      else currentBlock.push(line);
    }
  }

  pushCurrent();
  if (findings.length > 0) return findings;
  return rawLog.trim().length === 0 ? [] : [{ packageName: null, testFile: null, testName: null, block: rawLog.split(/\r?\n/).filter(Boolean), annotations: [] }];
};

const buildCrossCuttingDiagnosis = (findings: TestTriageFinding[]): string[] => {
  const diagnoses: string[] = [];
  const uniqueKinds = uniqueSorted(findings.map((finding) => finding.failure_kind));
  if (uniqueKinds.length > 1) diagnoses.push(`Multiple failure classes detected: ${uniqueKinds.join(', ')}.`);
  if (findings.some((finding) => finding.failure_kind === 'recursive_workspace_failure')) diagnoses.push('pnpm recursive noise detected; prioritize the first failing package or command before treating downstream failures as independent.');
  if (findings.some((finding) => finding.annotations.length > 0)) diagnoses.push('GitHub annotation lines were normalized into structured evidence so CI summaries can be copied without re-reading raw logs.');
  if (findings.filter((finding) => LOW_RISK_KINDS.has(finding.failure_kind)).length > 1) diagnoses.push('Several findings map to bounded low-risk remediation classes, so narrow test/fixture/snapshot updates should be attempted before broader behavioral edits.');
  return uniqueSorted(diagnoses);
};

const summarizeArtifact = (findings: TestTriageFinding[]): string => {
  if (findings.length === 0) return 'No recognizable CI/test failures were detected in the provided log.';
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(finding.failure_kind, (counts.get(finding.failure_kind) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return `Detected ${findings.length} normalized failure${findings.length === 1 ? '' : 's'}: ${ordered.map(([kind, count]) => `${kind} (${count})`).join(', ')}.`;
};

export const buildTestTriageArtifact = (rawLog: string, source: TriageInputSource): TestTriageArtifact => {
  const parsedBlocks = parseFailureBlocks(rawLog);
  const findings: TestTriageFinding[] = parsedBlocks.map((entry) => {
    const joined = entry.block.join('\n');
    const classification = classifyFailure(joined);
    const repairClass: TestTriageRepairClass = LOW_RISK_KINDS.has(classification.kind) ? 'autofix_plan_only' : 'review_required';
    const verificationCommands = buildVerificationCommands(entry.packageName, entry.testFile, classification.kind);
    const baseFinding: Omit<TestTriageFinding, 'failure_signature'> = {
      failure_kind: classification.kind,
      confidence: clampConfidence(classification.confidence),
      package: entry.packageName,
      test_file: entry.testFile,
      test_name: entry.testName,
      likely_files_to_modify: deriveLikelyFiles(classification.kind, entry.testFile, entry.block, entry.annotations),
      suggested_fix_strategy: classification.strategy,
      verification_commands: verificationCommands,
      docs_update_recommendation: classification.docs,
      rule_pattern_failure_mode: GOVERNANCE_NOTE,
      repair_class: repairClass,
      summary: entry.block[0] ?? 'Unclassified test failure block',
      evidence: uniqueSorted(entry.block.map((line) => line.trim()).filter(Boolean)).slice(0, 8),
      annotations: uniqueAnnotations(entry.annotations)
    };
    return { failure_signature: buildFailureSignature(baseFinding), ...baseFinding };
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
    'Summarize the normalized failure artifact before proposing edits.',
    'Keep raw stdout/stderr as audit evidence; use the normalized summary for diagnosis and copy-paste remediation context.',
    'Allowed low-risk repair classes: snapshot_drift, stale_assertion, fixture_drift, ordering_drift, test_expectation_drift.',
    'Do not auto-edit production logic for review_required findings.',
    ...findings.map((finding, index) => `${index + 1}. ${finding.failure_kind} :: ${finding.test_file ?? 'unknown file'} :: ${finding.suggested_fix_strategy}`)
  ].join('\n');
  const counts = new Map<TestTriageFailureKind, number>();
  for (const finding of findings) counts.set(finding.failure_kind, (counts.get(finding.failure_kind) ?? 0) + 1);
  const primaryFailureClass = findings.length === 0
    ? 'none'
    : [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const crossCuttingDiagnosis = buildCrossCuttingDiagnosis(findings);
  const recommendedNextChecks = uniqueSorted([
    ...rerunCommands,
    ...crossCuttingDiagnosis.map((entry) => `Review: ${entry}`)
  ]);

  return {
    schemaVersion: TEST_TRIAGE_SCHEMA_VERSION,
    kind: TEST_TRIAGE_ARTIFACT_KIND,
    command: 'test-triage',
    generatedAt: new Date(0).toISOString(),
    source,
    status: findings.length === 0 ? 'no_failures_detected' : 'failed',
    summary: summarizeArtifact(findings),
    primaryFailureClass,
    failures: findings,
    crossCuttingDiagnosis,
    recommendedNextChecks,
    findings,
    rerun_plan: { strategy: 'file_first_then_package_then_workspace', commands: rerunCommands },
    repair_plan: {
      summary: `${lowRisk.length} low-risk findings can be planned without mutating production logic; ${risky.length} findings require review.`,
      codex_prompt: codexPrompt,
      suggested_actions: suggestedActions
    }
  };
};

const renderFindingMarkdown = (finding: TestTriageFinding): string => [
  `- **${finding.failure_kind}** (${finding.repair_class}, confidence=${finding.confidence.toFixed(2)})`,
  `  - Package: ${finding.package ?? 'unknown'}`,
  `  - Test: ${finding.test_file ?? 'unknown'}${finding.test_name ? ` :: ${finding.test_name}` : ''}`,
  `  - Summary: ${finding.summary}`,
  `  - Fix: ${finding.suggested_fix_strategy}`,
  finding.annotations.length > 0 ? `  - GitHub annotations: ${finding.annotations.map((annotation) => `${annotation.level}${annotation.file ? ` @ ${annotation.file}` : ''}: ${annotation.message}`).join(' | ')}` : ''
].filter(Boolean).join('\n');

export const renderTestTriageMarkdown = (artifact: TestTriageArtifact): string => {
  const lines = [
    '# Playbook Failure Summary',
    '',
    `- Status: ${artifact.status}`,
    `- Primary failure class: ${artifact.primaryFailureClass}`,
    `- Summary: ${artifact.summary}`,
    '',
    '## Failures',
    artifact.failures.length === 0 ? '- No normalized failures detected.' : artifact.failures.map(renderFindingMarkdown).join('\n'),
    '',
    '## Cross-cutting diagnosis',
    ...(artifact.crossCuttingDiagnosis.length === 0 ? ['- None.'] : artifact.crossCuttingDiagnosis.map((entry) => `- ${entry}`)),
    '',
    '## Recommended next checks',
    ...(artifact.recommendedNextChecks.length === 0 ? ['- None.'] : artifact.recommendedNextChecks.map((entry) => `- ${entry}`))
  ];
  return `${lines.join('\n')}\n`;
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
    `Status: ${artifact.status}`,
    `Primary failure class: ${artifact.primaryFailureClass}`,
    artifact.summary,
    `Findings: ${artifact.findings.length}`,
    artifact.findings.map(renderFinding).join('\n'),
    'Cross-cutting diagnosis:',
    ...artifact.crossCuttingDiagnosis.map((entry) => `- ${entry}`),
    'Recommended next checks:',
    ...artifact.recommendedNextChecks.map((command) => `- ${command}`),
    `Repair plan: ${artifact.repair_plan.summary}`
  ].filter(Boolean);

  return sections.join('\n');
};
