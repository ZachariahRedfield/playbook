import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { verifyRepo } from '../verify/index.js';

export type BootstrapProofStage = 'runtime' | 'cli' | 'initialization' | 'docs' | 'artifacts' | 'execution-state' | 'governance';
export type BootstrapProofFailureCategory =
  | 'runtime_unavailable'
  | 'binary_resolution_failed'
  | 'repo_not_initialized'
  | 'required_docs_missing'
  | 'required_artifacts_missing'
  | 'execution_state_missing'
  | 'governance_contract_failed';

export type BootstrapProofCheck = {
  id: string;
  stage: BootstrapProofStage;
  status: 'pass' | 'fail';
  category: BootstrapProofFailureCategory | null;
  summary: string;
  diagnostics: string[];
  next_action: string | null;
  command: string | null;
};

export type BootstrapCliResolutionCommand = {
  label: string;
  command: string;
  args: string[];
};

export type BootstrapProofResult = {
  schemaVersion: '1.0';
  kind: 'playbook-bootstrap-proof';
  repo_root: string;
  command: 'status';
  mode: 'proof';
  ok: boolean;
  current_state:
    | 'governed_consumer_ready'
    | 'runtime_blocked'
    | 'cli_blocked'
    | 'initialization_blocked'
    | 'docs_blocked'
    | 'artifacts_blocked'
    | 'execution_state_blocked'
    | 'governance_blocked';
  highest_priority_next_action: string;
  summary: {
    current_state: string;
    why: string;
    what_next: string;
  };
  diagnostics: {
    failing_stage: BootstrapProofStage | null;
    failing_category: BootstrapProofFailureCategory | null;
    checks: BootstrapProofCheck[];
  };
};

type CommandResult = {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  errorMessage?: string;
};

type RunCommand = (command: string, args: string[], cwd: string) => CommandResult;

type CliResolutionResult = {
  success: BootstrapCliResolutionCommand | null;
  diagnostics: string[];
};

const INIT_REQUIRED_DOCS = [
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/PLAYBOOK_CHECKLIST.md',
  'docs/PLAYBOOK_NOTES.md'
] as const;

const REQUIRED_ARTIFACTS = [
  {
    path: '.playbook/repo-index.json',
    summary: 'repository index',
    validator: (value: unknown) => isObject(value) && typeof value.framework === 'string',
    nextAction: 'pnpm playbook index --json'
  },
  {
    path: '.playbook/repo-graph.json',
    summary: 'repository graph',
    validator: (value: unknown) => isObject(value) && Array.isArray(value.edges),
    nextAction: 'pnpm playbook index --json'
  },
  {
    path: '.playbook/plan.json',
    summary: 'plan artifact',
    validator: (value: unknown) => isObject(value) && value.command === 'plan',
    nextAction: 'pnpm playbook verify --json && pnpm playbook plan --json'
  }
] as const;

const REQUIRED_EXECUTION_STATE = [
  {
    path: '.playbook/policy-apply-result.json',
    summary: 'policy apply result',
    validator: (value: unknown) => isObject(value),
    nextAction: 'pnpm playbook apply --json'
  }
] as const;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

const readJsonIfValid = (artifactPath: string): { ok: boolean; diagnostic?: string } => {
  if (!fs.existsSync(artifactPath)) {
    return { ok: false, diagnostic: `missing artifact: ${artifactPath}` };
  }

  try {
    JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as unknown;
    return { ok: true };
  } catch (error) {
    return { ok: false, diagnostic: `invalid JSON at ${artifactPath}: ${error instanceof Error ? error.message : String(error)}` };
  }
};

const inspectArtifact = (
  repoRoot: string,
  relativePath: string,
  validator: (value: unknown) => boolean,
  label: string
): { ok: boolean; diagnostics: string[] } => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { ok: false, diagnostics: [`missing ${label}: ${relativePath}`] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
    if (!validator(parsed)) {
      return { ok: false, diagnostics: [`invalid ${label}: ${relativePath}`] };
    }
  } catch (error) {
    return {
      ok: false,
      diagnostics: [`invalid JSON for ${label}: ${relativePath}`, error instanceof Error ? error.message : String(error)]
    };
  }

  return { ok: true, diagnostics: [] };
};

const defaultRunCommand: RunCommand = (command, args, cwd) => {
  const result: SpawnSyncReturns<string> = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    errorMessage: result.error?.message
  };
};

const buildCheck = (input: BootstrapProofCheck): BootstrapProofCheck => input;

const firstFail = (checks: BootstrapProofCheck[]): BootstrapProofCheck | null => checks.find((check) => check.status === 'fail') ?? null;

const toCurrentState = (check: BootstrapProofCheck | null): BootstrapProofResult['current_state'] => {
  if (!check) return 'governed_consumer_ready';
  switch (check.stage) {
    case 'runtime': return 'runtime_blocked';
    case 'cli': return 'cli_blocked';
    case 'initialization': return 'initialization_blocked';
    case 'docs': return 'docs_blocked';
    case 'artifacts': return 'artifacts_blocked';
    case 'execution-state': return 'execution_state_blocked';
    case 'governance': return 'governance_blocked';
  }
};

const describeState = (state: BootstrapProofResult['current_state']): string => {
  switch (state) {
    case 'governed_consumer_ready': return 'Repo passed the governed Playbook bootstrap proof.';
    case 'runtime_blocked': return 'Repo cannot prove Playbook runtime availability.';
    case 'cli_blocked': return 'Repo cannot prove local Playbook CLI resolution.';
    case 'initialization_blocked': return 'Repo is not initialized as a Playbook consumer.';
    case 'docs_blocked': return 'Repo is missing required bootstrap docs/governance surfaces.';
    case 'artifacts_blocked': return 'Repo is missing required bootstrap artifacts.';
    case 'execution_state_blocked': return 'Repo is missing required execution/runtime state.';
    case 'governance_blocked': return 'Repo failed the governed bootstrap contract.';
  }
};

export const defaultBootstrapCliResolutionCommands = (): BootstrapCliResolutionCommand[] => [
  { label: 'pnpm exec playbook --version', command: 'pnpm', args: ['exec', 'playbook', '--version'] },
  { label: 'pnpm playbook --version', command: 'pnpm', args: ['playbook', '--version'] }
];

const dedupeResolutionCommands = (commands: BootstrapCliResolutionCommand[]): BootstrapCliResolutionCommand[] => {
  const seen = new Set<string>();
  const deduped: BootstrapCliResolutionCommand[] = [];
  for (const command of commands) {
    const key = `${command.command}::${command.args.join('\u0000')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(command);
  }
  return deduped;
};

export const resolveBootstrapCliAvailability = (
  repoRoot: string,
  input?: {
    runCommand?: RunCommand;
    commands?: BootstrapCliResolutionCommand[];
  }
): CliResolutionResult => {
  const runCommand = input?.runCommand ?? defaultRunCommand;
  const commands = dedupeResolutionCommands(input?.commands ?? defaultBootstrapCliResolutionCommands());
  const diagnostics: string[] = [];

  for (const candidate of commands) {
    const result = runCommand(candidate.command, candidate.args, repoRoot);
    if (result.ok) {
      return { success: candidate, diagnostics: [result.stdout.trim() || `${candidate.label} succeeded`] };
    }

    const attemptDiagnostics = [result.errorMessage, result.stderr.trim()].filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    );
    diagnostics.push(...(attemptDiagnostics.length > 0 ? attemptDiagnostics.map((value) => `${candidate.label}: ${value}`) : [`${candidate.label}: command returned non-zero exit status`]));
  }

  return { success: null, diagnostics };
};

export const runBootstrapProof = (
  repoRoot: string,
  options?: {
    runCommand?: RunCommand;
    cliResolutionCommands?: BootstrapCliResolutionCommand[];
  }
): BootstrapProofResult => {
  const runCommand = options?.runCommand ?? defaultRunCommand;
  const checks: BootstrapProofCheck[] = [];

  const nodeCheck = runCommand(process.execPath, ['--version'], repoRoot);
  checks.push(buildCheck({
    id: 'runtime.node',
    stage: 'runtime',
    status: nodeCheck.ok ? 'pass' : 'fail',
    category: nodeCheck.ok ? null : 'runtime_unavailable',
    summary: nodeCheck.ok ? 'Node runtime is available.' : 'Node runtime check failed.',
    diagnostics: nodeCheck.ok ? [`resolved via ${process.execPath}`] : [(nodeCheck.errorMessage ?? nodeCheck.stderr.trim()) || 'node runtime check returned non-zero exit status'],
    next_action: nodeCheck.ok ? null : 'Install or repair the Node.js runtime used to invoke Playbook.',
    command: `${process.execPath} --version`
  }));

  const pnpmCheck = runCommand('pnpm', ['--version'], repoRoot);
  checks.push(buildCheck({
    id: 'runtime.pnpm',
    stage: 'runtime',
    status: pnpmCheck.ok ? 'pass' : 'fail',
    category: pnpmCheck.ok ? null : 'runtime_unavailable',
    summary: pnpmCheck.ok ? 'pnpm runtime is available.' : 'pnpm runtime check failed.',
    diagnostics: pnpmCheck.ok ? [pnpmCheck.stdout.trim() || 'pnpm resolved successfully'] : [(pnpmCheck.errorMessage ?? pnpmCheck.stderr.trim()) || 'pnpm runtime check returned non-zero exit status'],
    next_action: pnpmCheck.ok ? null : 'Install pnpm so Playbook can resolve the local CLI in this repository.',
    command: 'pnpm --version'
  }));

  const cliResolution = pnpmCheck.ok
    ? resolveBootstrapCliAvailability(repoRoot, {
        runCommand,
        commands: options?.cliResolutionCommands ?? defaultBootstrapCliResolutionCommands()
      })
    : { success: null, diagnostics: ['skipped because pnpm runtime is unavailable'] };
  checks.push(buildCheck({
    id: 'cli.playbook-resolution',
    stage: 'cli',
    status: cliResolution.success ? 'pass' : 'fail',
    category: cliResolution.success ? null : 'binary_resolution_failed',
    summary: cliResolution.success ? `Local Playbook CLI resolves via ${cliResolution.success.label}.` : 'Local Playbook CLI resolution failed.',
    diagnostics: cliResolution.diagnostics,
    next_action: cliResolution.success ? null : 'Ensure this repository can resolve Playbook through one of the canonical bootstrap CLI resolution paths.',
    command: cliResolution.success?.label ?? defaultBootstrapCliResolutionCommands()[0].label
  }));

  const initialized =
    fs.existsSync(path.join(repoRoot, '.playbook')) ||
    fs.existsSync(path.join(repoRoot, '.playbook', 'config.json')) ||
    fs.existsSync(path.join(repoRoot, 'playbook.config.json'));
  checks.push(buildCheck({
    id: 'initialization.playbook-config',
    stage: 'initialization',
    status: initialized ? 'pass' : 'fail',
    category: initialized ? null : 'repo_not_initialized',
    summary: initialized ? 'Playbook initialization artifacts are present.' : 'Playbook initialization artifacts are missing.',
    diagnostics: initialized
      ? [fs.existsSync(path.join(repoRoot, 'playbook.config.json')) ? 'found playbook.config.json' : 'found .playbook/config.json']
      : ['expected .playbook/, playbook.config.json, or .playbook/config.json'],
    next_action: initialized ? null : 'Run `pnpm playbook init` and commit the generated bootstrap artifacts.',
    command: null
  }));

  const missingDocs = INIT_REQUIRED_DOCS.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
  checks.push(buildCheck({
    id: 'docs.bootstrap-required',
    stage: 'docs',
    status: missingDocs.length === 0 ? 'pass' : 'fail',
    category: missingDocs.length === 0 ? null : 'required_docs_missing',
    summary: missingDocs.length === 0 ? 'Bootstrap docs are present.' : 'Bootstrap docs are missing.',
    diagnostics: missingDocs.length === 0 ? [...INIT_REQUIRED_DOCS] : missingDocs.map((entry) => `missing required bootstrap doc: ${entry}`),
    next_action: missingDocs.length === 0 ? null : 'Run `pnpm playbook init` and fill in the required docs/governance files.',
    command: null
  }));

  const artifactDiagnostics: Array<{ diagnostic: string; nextAction: string }> = REQUIRED_ARTIFACTS.flatMap((artifact) => {
    const result = inspectArtifact(repoRoot, artifact.path, artifact.validator, artifact.summary);
    return result.ok ? [] : result.diagnostics.map((diagnostic) => ({ diagnostic, nextAction: artifact.nextAction }));
  });
  checks.push(buildCheck({
    id: 'artifacts.bootstrap-required',
    stage: 'artifacts',
    status: artifactDiagnostics.length === 0 ? 'pass' : 'fail',
    category: artifactDiagnostics.length === 0 ? null : 'required_artifacts_missing',
    summary: artifactDiagnostics.length === 0 ? 'Bootstrap artifacts are present and valid.' : 'Bootstrap artifacts are missing or invalid.',
    diagnostics: artifactDiagnostics.length === 0 ? REQUIRED_ARTIFACTS.map((artifact) => `validated ${artifact.path}`) : artifactDiagnostics.map((entry) => entry.diagnostic),
    next_action: artifactDiagnostics.length === 0 ? null : artifactDiagnostics[0]?.nextAction ?? 'Run the missing bootstrap artifact producer command.',
    command: null
  }));

  const executionDiagnostics: Array<{ diagnostic: string; nextAction: string }> = REQUIRED_EXECUTION_STATE.flatMap((artifact) => {
    const result = inspectArtifact(repoRoot, artifact.path, artifact.validator, artifact.summary);
    return result.ok ? [] : result.diagnostics.map((diagnostic) => ({ diagnostic, nextAction: artifact.nextAction }));
  });
  const lastRunPath = path.join(repoRoot, '.playbook', 'last-run.json');
  if (fs.existsSync(path.join(repoRoot, 'docs', 'PROJECT_GOVERNANCE.md')) && !fs.existsSync(lastRunPath)) {
    executionDiagnostics.push({
      diagnostic: 'missing execution-state artifact: .playbook/last-run.json',
      nextAction: 'Run `pnpm playbook apply --json` so the repo records a governed last-run artifact.'
    });
  } else if (fs.existsSync(lastRunPath)) {
    const lastRun = readJsonIfValid(lastRunPath);
    if (!lastRun.ok) {
      executionDiagnostics.push({
        diagnostic: lastRun.diagnostic ?? 'invalid .playbook/last-run.json',
        nextAction: 'Re-run `pnpm playbook apply --json` to refresh .playbook/last-run.json.'
      });
    }
  }
  checks.push(buildCheck({
    id: 'execution-state.required',
    stage: 'execution-state',
    status: executionDiagnostics.length === 0 ? 'pass' : 'fail',
    category: executionDiagnostics.length === 0 ? null : 'execution_state_missing',
    summary: executionDiagnostics.length === 0 ? 'Execution/runtime state prerequisites are present.' : 'Execution/runtime state prerequisites are missing or invalid.',
    diagnostics: executionDiagnostics.length === 0 ? [...REQUIRED_EXECUTION_STATE.map((artifact) => `validated ${artifact.path}`)] : executionDiagnostics.map((entry) => entry.diagnostic),
    next_action: executionDiagnostics.length === 0 ? null : executionDiagnostics[0]?.nextAction ?? 'Run the required execution-state producer command.',
    command: null
  }));

  const verifyReport = verifyRepo(repoRoot);
  const governanceFailures = verifyReport.failures.map((failure) => `${failure.id}: ${failure.message}`);
  const governanceWarnings = verifyReport.warnings.map((warning) => `${warning.id}: ${warning.message}`);
  checks.push(buildCheck({
    id: 'governance.contract',
    stage: 'governance',
    status: governanceFailures.length === 0 ? 'pass' : 'fail',
    category: governanceFailures.length === 0 ? null : 'governance_contract_failed',
    summary: governanceFailures.length === 0 ? 'Governance bootstrap contract passed.' : 'Governance bootstrap contract failed.',
    diagnostics: governanceFailures.length === 0 ? (governanceWarnings.length > 0 ? governanceWarnings : ['verify clean']) : [...governanceFailures, ...governanceWarnings],
    next_action:
      governanceFailures.length === 0
        ? null
        : 'Run `pnpm playbook verify --json`, fix the reported governance failures, then re-run bootstrap proof.',
    command: null
  }));

  const failure = firstFail(checks);
  const currentState = toCurrentState(failure);
  const highestPriorityNextAction = failure?.next_action ?? 'No action required.';

  return {
    schemaVersion: '1.0',
    kind: 'playbook-bootstrap-proof',
    repo_root: repoRoot,
    command: 'status',
    mode: 'proof',
    ok: failure === null,
    current_state: currentState,
    highest_priority_next_action: highestPriorityNextAction,
    summary: {
      current_state: describeState(currentState),
      why: failure ? `${failure.summary} ${failure.diagnostics[0] ?? ''}`.trim() : 'Runtime, CLI resolution, initialization, docs, artifacts, execution state, and governance checks all passed.',
      what_next: highestPriorityNextAction
    },
    diagnostics: {
      failing_stage: failure?.stage ?? null,
      failing_category: failure?.category ?? null,
      checks
    }
  };
};
