import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNPM_BIN, run } from './exec-runner.mjs';

const repoRoot = path.resolve('.');
const nodeBin = process.execPath;
const cliPath = path.resolve(repoRoot, 'packages/cli/dist/main.js');
const bundledTemplatePath = path.resolve(repoRoot, 'packages/cli/dist/templates/repo');
const nodeVersion = run(nodeBin, ['-v']).trim();
const pnpmVersion = run(PNPM_BIN, ['-v']).trim();

const ensureFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`smoke-test failed: missing ${label} at ${filePath}`);
  }
};

const ensurePlaybookConfig = (projectRoot) => {
  const configCandidates = [
    path.join(projectRoot, 'playbook.config.json'),
    path.join(projectRoot, '.playbook', 'config.json')
  ];

  if (!configCandidates.some((configPath) => fs.existsSync(configPath))) {
    throw new Error(
      'smoke-test failed: expected init to create playbook config file (playbook.config.json or .playbook/config.json)'
    );
  }
};

console.log(`[smoke] node=${nodeVersion} pnpm=${pnpmVersion}`);
console.log(`[smoke] cli=${cliPath}`);

if (!fs.existsSync(cliPath)) {
  const msg =
    'packages/cli/dist/main.js missing. ' +
    'Run "pnpm -r build" to generate CLI dist output before smoke-test.';
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error(`smoke-test failed: ${msg}`);
  }
  console.log(`[smoke] skipped: ${msg}`);
  process.exit(0);
}

if (!fs.existsSync(bundledTemplatePath)) {
  throw new Error(
    `smoke-test failed: bundled templates missing at ${bundledTemplatePath}. ` +
      'Run "pnpm -r build" before smoke-test.'
  );
}

run(nodeBin, [cliPath, '--help']);

const runWithStatus = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
    env: { ...process.env, ...(options.env ?? {}) }
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-smoke-'));
const projectDir = path.join(tempRoot, 'project');
fs.mkdirSync(projectDir, { recursive: true });

let smokePassed = false;
try {
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'playbook-smoke', private: true, version: '1.0.0' }, null, 2)
  );


  run(nodeBin, [cliPath, 'init'], { cwd: projectDir });
  run(nodeBin, [cliPath, 'analyze'], { cwd: projectDir });

  const indexResult = runWithStatus(nodeBin, [cliPath, 'index', '--json'], { cwd: projectDir });
  const indexJson = JSON.parse(indexResult.stdout);

  if (indexJson.command !== 'index' || indexJson.ok !== true || typeof indexJson.indexFile !== 'string') {
    throw new Error('smoke-test failed: expected index --json to include command=index, ok=true, and indexFile');
  }

  if (!Array.isArray(indexJson.modules)) {
    throw new Error('smoke-test failed: expected index --json modules to be an array');
  }

  fs.mkdirSync(path.join(projectDir, 'tmp'), { recursive: true });
  const diagramOut = path.join(projectDir, 'tmp', 'diagram.md');
  run(nodeBin, [cliPath, 'diagram', '--repo', '.', '--out', 'tmp/diagram.md'], { cwd: projectDir });
  if (!fs.existsSync(diagramOut)) {
    throw new Error('smoke-test failed: expected diagram output at tmp/diagram.md');
  }

  run(nodeBin, [cliPath, 'ask', 'what architecture is this repo?'], { cwd: projectDir });
  run(nodeBin, [cliPath, 'query', 'list modules'], { cwd: projectDir });

  const analyzeJson = runWithStatus(nodeBin, [cliPath, 'analyze', '--json', '--explain'], { cwd: projectDir });
  const analyzeJsonResult = JSON.parse(analyzeJson.stdout);

  const noSignalsRecommendation = Array.isArray(analyzeJsonResult.findings)
    ? analyzeJsonResult.findings.find((finding) => finding.id === 'analyze.recommendation.analyze-no-signals')
    : undefined;

  if (!noSignalsRecommendation) {
    throw new Error('smoke-test failed: expected analyze --json --explain to include analyze.recommendation.analyze-no-signals finding');
  }

  run(nodeBin, [cliPath, 'verify'], { cwd: projectDir });
  const planPlain = runWithStatus(nodeBin, [cliPath, 'plan'], { cwd: projectDir });
  if (planPlain.status !== 0) {
    throw new Error(`smoke-test failed: expected plan exit status=0 in initialized non-git fixture, got ${planPlain.status}`);
  }
  if (planPlain.stderr.includes('fatal: not a git repository')) {
    throw new Error('smoke-test failed: expected plan to avoid raw git fatal stderr output in non-git fixture');
  }

  const applyPlain = runWithStatus(nodeBin, [cliPath, 'apply'], { cwd: projectDir });
  if (applyPlain.status !== 0) {
    throw new Error(`smoke-test failed: expected apply exit status=0 in initialized non-git fixture, got ${applyPlain.status}`);
  }
  if (applyPlain.stderr.includes('fatal: not a git repository')) {
    throw new Error('smoke-test failed: expected apply to avoid raw git fatal stderr output in non-git fixture');
  }

  run(nodeBin, [cliPath, 'status'], { cwd: projectDir });


  const applyJson = runWithStatus(nodeBin, [cliPath, 'apply', '--json'], { cwd: projectDir });
  const applyJsonResult = JSON.parse(applyJson.stdout);

  if (applyJsonResult.schemaVersion !== '1.0' || applyJsonResult.command !== 'apply' || !Array.isArray(applyJsonResult.results)) {
    throw new Error('smoke-test failed: expected apply --json to return schemaVersion=1.0, command=apply, and results array');
  }

  if (applyJsonResult.remediation?.status !== 'not_needed') {
    throw new Error(`smoke-test failed: expected apply --json remediation.status=not_needed in initialized non-git fixture, got ${String(applyJsonResult.remediation?.status)}`);
  }

  const planJson = runWithStatus(nodeBin, [cliPath, 'plan', '--json'], { cwd: projectDir });
  const planJsonResult = JSON.parse(planJson.stdout);

  if (planJsonResult.schemaVersion !== '1.0' || planJsonResult.command !== 'plan' || !Array.isArray(planJsonResult.tasks)) {
    throw new Error('smoke-test failed: expected plan --json to return schemaVersion=1.0, command=plan, and tasks array');
  }

  if (planJsonResult.remediation?.status !== 'not_needed') {
    throw new Error(`smoke-test failed: expected plan --json remediation.status=not_needed in initialized non-git fixture, got ${String(planJsonResult.remediation?.status)}`);
  }

  if (applyJson.stderr.includes('fatal: not a git repository')) {
    throw new Error('smoke-test failed: expected apply --json to avoid raw git fatal stderr output in non-git fixture');
  }

  const rulesJson = runWithStatus(nodeBin, [cliPath, 'rules', '--json'], { cwd: projectDir });
  const rulesJsonResult = JSON.parse(rulesJson.stdout);

  if (rulesJsonResult.schemaVersion !== '1.0' || rulesJsonResult.command !== 'rules') {
    throw new Error('smoke-test failed: expected rules --json to include schemaVersion=1.0 and command=rules');
  }

  if (!Array.isArray(rulesJsonResult.verify) || !Array.isArray(rulesJsonResult.analyze)) {
    throw new Error('smoke-test failed: expected rules --json to include verify and analyze arrays');
  }

  const explainRuleJson = runWithStatus(nodeBin, [cliPath, 'explain', 'PB001', '--json'], { cwd: projectDir });
  const explainRuleJsonResult = JSON.parse(explainRuleJson.stdout);

  if (explainRuleJsonResult.command !== 'explain' || explainRuleJsonResult.target !== 'PB001') {
    throw new Error('smoke-test failed: expected explain PB001 --json to include command=explain and target=PB001');
  }

  if (explainRuleJsonResult.type !== 'rule' || typeof explainRuleJsonResult.explanation !== 'object') {
    throw new Error('smoke-test failed: expected explain PB001 --json to include type=rule and explanation object');
  }

  const explainArchitectureJson = runWithStatus(nodeBin, [cliPath, 'explain', 'architecture', '--json'], { cwd: projectDir });
  const explainArchitectureJsonResult = JSON.parse(explainArchitectureJson.stdout);

  if (explainArchitectureJsonResult.command !== 'explain' || explainArchitectureJsonResult.target !== 'architecture') {
    throw new Error('smoke-test failed: expected explain architecture --json to include command=explain and target=architecture');
  }

  if (explainArchitectureJsonResult.type !== 'architecture' || typeof explainArchitectureJsonResult.explanation !== 'object') {
    throw new Error('smoke-test failed: expected explain architecture --json to include type=architecture and explanation object');
  }

  const statusJsonHealthy = runWithStatus(nodeBin, [cliPath, 'status', '--json'], { cwd: projectDir });
  const statusJsonHealthyResult = JSON.parse(statusJsonHealthy.stdout);

  if (statusJsonHealthyResult.schemaVersion !== '1.0') {
    throw new Error(`smoke-test failed: expected status --json schemaVersion=1.0, got ${String(statusJsonHealthyResult.schemaVersion)}`);
  }

  if (statusJsonHealthyResult.command !== 'status') {
    throw new Error(`smoke-test failed: expected status --json command=status, got ${String(statusJsonHealthyResult.command)}`);
  }

  fs.writeFileSync(path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md'), '', 'utf8');
  const verifyJson = runWithStatus(nodeBin, [cliPath, 'verify', '--json', '--explain'], { cwd: projectDir });
  const verifyJsonResult = JSON.parse(verifyJson.stdout);

  if (typeof verifyJsonResult.ok !== 'boolean') {
    throw new Error(`smoke-test failed: expected verify --json ok to be boolean, got ${String(verifyJsonResult.ok)}`);
  }

  if (verifyJsonResult.exitCode !== verifyJson.status) {
    throw new Error(
      `smoke-test failed: verify --json exitCode (${verifyJsonResult.exitCode}) did not match process exit status (${verifyJson.status})`
    );
  }


  if (!Array.isArray(verifyJsonResult.findings)) {
    throw new Error('smoke-test failed: verify findings missing');
  }

  if (verifyJsonResult.ok === false && verifyJsonResult.findings.length === 0) {
    throw new Error('smoke-test failed: expected verify --json --explain to include findings when ok=false');
  }

  const malformedFinding = verifyJsonResult.findings.find(
    (finding) => typeof finding?.id !== 'string' || finding.id.length === 0 || typeof finding?.level !== 'string'
  );

  if (malformedFinding) {
    throw new Error('smoke-test failed: expected verify --json findings to include id and level fields');
  }

  const statusJsonAfterVerify = runWithStatus(nodeBin, [cliPath, 'status', '--json'], { cwd: projectDir });
  const statusJsonAfterVerifyResult = JSON.parse(statusJsonAfterVerify.stdout);

  if (verifyJsonResult.ok === false) {
    if (statusJsonAfterVerify.status !== 3) {
      throw new Error(`smoke-test failed: expected status --json exit status=3 when verify fails, got ${statusJsonAfterVerify.status}`);
    }

    if (statusJsonAfterVerifyResult.verification?.ok !== false) {
      throw new Error(`smoke-test failed: expected status --json verification.ok=false, got ${String(statusJsonAfterVerifyResult.verification?.ok)}`);
    }
  }

  const doctorJsonReport = runWithStatus(nodeBin, [cliPath, 'doctor', '--json'], {
    cwd: projectDir,
    env: { PATH: '' }
  });
  const doctorJsonReportResult = JSON.parse(doctorJsonReport.stdout);

  if (doctorJsonReportResult.command !== 'doctor' || doctorJsonReportResult.schemaVersion !== '1.0') {
    throw new Error('smoke-test failed: expected doctor --json to include schemaVersion=1.0 and command=doctor');
  }

  if (!['ok', 'warning', 'error'].includes(doctorJsonReportResult.status)) {
    throw new Error(`smoke-test failed: expected doctor --json status in ok|warning|error, got ${String(doctorJsonReportResult.status)}`);
  }

  if (!doctorJsonReportResult.summary || typeof doctorJsonReportResult.summary !== 'object') {
    throw new Error('smoke-test failed: expected doctor --json to include a summary object');
  }

  const { errors, warnings, info } = doctorJsonReportResult.summary;
  if (typeof errors !== 'number' || typeof warnings !== 'number' || typeof info !== 'number') {
    throw new Error('smoke-test failed: expected doctor --json summary.errors|warnings|info to be numbers');
  }

  if (!Array.isArray(doctorJsonReportResult.findings)) {
    throw new Error('smoke-test failed: expected doctor --json to include findings array');
  }

  const expectedDoctorExit = errors > 0 ? 1 : 0;
  if (doctorJsonReport.status !== expectedDoctorExit) {
    throw new Error(
      `smoke-test failed: expected doctor --json exit status=${expectedDoctorExit} from summary.errors=${errors}, got ${doctorJsonReport.status}`
    );
  }

  const upgradePlanJson = runWithStatus(nodeBin, [cliPath, 'upgrade', '--json'], { cwd: projectDir });
  const upgradePlanResult = JSON.parse(upgradePlanJson.stdout);

  if (upgradePlanResult.schemaVersion !== '1.0' || upgradePlanResult.command !== 'upgrade') {
    throw new Error('smoke-test failed: expected upgrade --json to return schemaVersion=1.0 and command=upgrade');
  }

  const upgradeCheckJson = runWithStatus(nodeBin, [cliPath, 'upgrade', '--check', '--from', '0.1.0', '--json'], { cwd: projectDir });
  const upgradeCheckResult = JSON.parse(upgradeCheckJson.stdout);

  if (!Array.isArray(upgradeCheckResult.migrationsNeeded)) {
    throw new Error('smoke-test failed: expected upgrade --check --json to include migrationsNeeded array');
  }

  const upgradeApplyDryRunJson = runWithStatus(
    nodeBin,
    [cliPath, 'upgrade', '--apply', '--dry-run', '--from', '0.1.0', '--json'],
    { cwd: projectDir }
  );
  const upgradeApplyDryRunResult = JSON.parse(upgradeApplyDryRunJson.stdout);

  if (upgradeApplyDryRunResult.dryRun !== true) {
    throw new Error('smoke-test failed: expected upgrade --apply --dry-run --json to return dryRun=true');
  }

  const fixJson = runWithStatus(nodeBin, [cliPath, 'fix', '--json', '--yes'], { cwd: projectDir });
  const fixJsonResult = JSON.parse(fixJson.stdout);

  if (!Array.isArray(fixJsonResult.applied)) {
    throw new Error('smoke-test failed: expected fix --json to include applied array');
  }

  const notesPath = path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md');
  if (!fs.existsSync(notesPath)) {
    throw new Error('smoke-test failed: expected fix to create docs/PLAYBOOK_NOTES.md');
  }

  if (verifyJsonResult.ok === false) {
    const appliedFindingIds = fixJsonResult.applied.map((entry) => entry.findingId);
    if (!appliedFindingIds.includes('notes.empty') && !appliedFindingIds.includes('notes.missing')) {
      throw new Error('smoke-test failed: expected fix --json to apply notes.empty or notes.missing when verify fails');
    }

    const notesContent = fs.readFileSync(notesPath, 'utf8');
    if (notesContent.trim().length === 0) {
      throw new Error('smoke-test failed: expected docs/PLAYBOOK_NOTES.md to be non-empty after fix when verify fails');
    }
  }

  if (typeof fixJsonResult.reverify?.exitCode !== 'number') {
    throw new Error('smoke-test failed: expected fix --json to include numeric reverify exitCode');
  }

  if (verifyJsonResult.ok === false && fixJsonResult.reverify.exitCode === 3) {
    throw new Error(`smoke-test failed: expected fix --json reverify exitCode to not be 3 when verify fails, got ${String(fixJsonResult.reverify?.exitCode)}`);
  }

  ensurePlaybookConfig(projectDir);

  ensureFile(path.join(projectDir, 'docs', 'PLAYBOOK_NOTES.md'), 'docs/PLAYBOOK_NOTES.md');

  smokePassed = true;
  console.log('[smoke] passed');
} finally {
  if (smokePassed) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`[smoke] retained temp repo for debugging: ${tempRoot}`);
  }
}
