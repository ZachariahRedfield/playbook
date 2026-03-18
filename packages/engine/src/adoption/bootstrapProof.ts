import fs from 'node:fs';
import path from 'node:path';

export type BootstrapProofStage =
  | 'runtime'
  | 'cli_resolution'
  | 'repo_initialization'
  | 'governance_docs'
  | 'governed_artifacts'
  | 'execution_state'
  | 'governance_contract';

export type BootstrapProofFailureCategory =
  | 'runtime_unavailable'
  | 'cli_resolution_failed'
  | 'repo_not_initialized'
  | 'required_docs_missing'
  | 'required_artifacts_missing'
  | 'execution_state_missing'
  | 'governance_contract_failed';

export type BootstrapProofStatus = 'pass' | 'fail';

export type BootstrapProofCheck = {
  id: string;
  stage: BootstrapProofStage;
  status: BootstrapProofStatus;
  category: BootstrapProofFailureCategory | null;
  summary: string;
  detail: string;
  evidence: string[];
  next_action: string | null;
};

export type BootstrapProofRuntimeDiagnostic = {
  available: boolean;
  command: string;
  version: string | null;
  detail: string;
};

export type BootstrapProofCliDiagnostic = {
  resolved: boolean;
  command: string;
  detail: string;
};

export type BootstrapProofArtifactDiagnostic = {
  path: string;
  present: boolean;
  valid: boolean;
  detail: string;
};

export type BootstrapProofDocsDiagnostic = BootstrapProofArtifactDiagnostic & {
  non_empty: boolean;
};

export type BootstrapProofGovernanceDiagnostic = {
  passed: boolean;
  failures: Array<{ id: string; message: string }>;
  warnings: Array<{ id: string; message: string }>;
};

export type BootstrapProofResult = {
  schemaVersion: '1.0';
  kind: 'bootstrap-proof';
  proof_passed: boolean;
  failure_category: BootstrapProofFailureCategory | null;
  current_state: string;
  why: string;
  what_next: string;
  highest_priority_next_action: string | null;
  checks: BootstrapProofCheck[];
  diagnostics: {
    runtime: BootstrapProofRuntimeDiagnostic;
    cli_resolution: BootstrapProofCliDiagnostic;
    repo_initialization: {
      initialized: boolean;
      required_paths: BootstrapProofArtifactDiagnostic[];
    };
    governance_docs: BootstrapProofDocsDiagnostic[];
    governed_artifacts: BootstrapProofArtifactDiagnostic[];
    execution_state: BootstrapProofArtifactDiagnostic[];
    governance_contract: BootstrapProofGovernanceDiagnostic;
  };
};

export type BuildBootstrapProofInput = {
  repoRoot: string;
  runtime: BootstrapProofRuntimeDiagnostic;
  cliResolution: BootstrapProofCliDiagnostic;
  governanceContract: BootstrapProofGovernanceDiagnostic;
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const readJson = (targetPath: string): unknown => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as unknown;

const inspectJsonArtifact = (
  repoRoot: string,
  relativePath: string,
  validator: (value: unknown) => boolean,
  missingDetail: string,
  invalidDetail: string,
  validDetail: string
): BootstrapProofArtifactDiagnostic => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { path: relativePath, present: false, valid: false, detail: missingDetail };
  }

  try {
    const parsed = readJson(absolutePath);
    const valid = validator(parsed);
    return {
      path: relativePath,
      present: true,
      valid,
      detail: valid ? validDetail : invalidDetail
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      path: relativePath,
      present: true,
      valid: false,
      detail: `${invalidDetail} Parse error: ${message}`
    };
  }
};

const inspectDoc = (repoRoot: string, relativePath: string, description: string): BootstrapProofDocsDiagnostic => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      path: relativePath,
      present: false,
      valid: false,
      non_empty: false,
      detail: `${description} is missing.`
    };
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const nonEmpty = content.trim().length > 0;
  return {
    path: relativePath,
    present: true,
    valid: nonEmpty,
    non_empty: nonEmpty,
    detail: nonEmpty ? `${description} is present.` : `${description} exists but is empty.`
  };
};

const toInitializationDiagnostics = (repoRoot: string): Array<BootstrapProofArtifactDiagnostic> => [
  inspectJsonArtifact(
    repoRoot,
    '.playbook/config.json',
    (value) => isObject(value) && typeof value.version === 'number',
    'Playbook config is missing. Run `pnpm playbook init`.',
    'Playbook config exists but is invalid JSON or missing the required version field.',
    'Playbook config is present.'
  ),
  {
    path: 'playbook.config.json',
    present: fs.existsSync(path.join(repoRoot, 'playbook.config.json')),
    valid: true,
    detail: fs.existsSync(path.join(repoRoot, 'playbook.config.json'))
      ? 'playbook.config.json is present.'
      : 'playbook.config.json is not present; repository will use default settings.'
  }
];

const toGovernedArtifactDiagnostics = (repoRoot: string): Array<BootstrapProofArtifactDiagnostic> => [
  inspectJsonArtifact(repoRoot, '.playbook/repo-index.json', (value) => isObject(value) && typeof value.framework === 'string', 'Repository intelligence index is missing.', 'Repository intelligence index is invalid.', 'Repository intelligence index is present.'),
  inspectJsonArtifact(repoRoot, '.playbook/repo-graph.json', (value) => isObject(value) && Array.isArray(value.edges), 'Repository graph is missing.', 'Repository graph is invalid.', 'Repository graph is present.'),
  inspectJsonArtifact(repoRoot, '.playbook/plan.json', (value) => isObject(value) && value.command === 'plan', 'Plan artifact is missing.', 'Plan artifact is invalid.', 'Plan artifact is present.'),
  inspectJsonArtifact(repoRoot, '.playbook/policy-apply-result.json', (value) => isObject(value) && (value.kind === 'policy-apply-result' || value.kind === undefined), 'Policy apply result is missing.', 'Policy apply result is invalid.', 'Policy apply result is present.')
];

const toExecutionStateDiagnostics = (repoRoot: string): Array<BootstrapProofArtifactDiagnostic> => [
  inspectJsonArtifact(repoRoot, '.playbook/last-run.json', (value) => isObject(value) && typeof value.command === 'string', 'Execution state artifact .playbook/last-run.json is missing.', 'Execution state artifact .playbook/last-run.json is invalid.', 'Execution state artifact .playbook/last-run.json is present.')
];

const firstFailure = (checks: BootstrapProofCheck[]): BootstrapProofCheck | undefined => checks.find((check) => check.status === 'fail');

export const buildBootstrapProof = ({ repoRoot, runtime, cliResolution, governanceContract }: BuildBootstrapProofInput): BootstrapProofResult => {
  const initialization = toInitializationDiagnostics(repoRoot);
  const docs = [
    inspectDoc(repoRoot, 'docs/ARCHITECTURE.md', 'Architecture document'),
    inspectDoc(repoRoot, 'docs/CHANGELOG.md', 'Changelog'),
    inspectDoc(repoRoot, 'docs/PLAYBOOK_CHECKLIST.md', 'Playbook checklist'),
    inspectDoc(repoRoot, 'docs/PLAYBOOK_NOTES.md', 'Playbook notes')
  ];
  const governedArtifacts = toGovernedArtifactDiagnostics(repoRoot);
  const executionState = toExecutionStateDiagnostics(repoRoot);

  const initialized = initialization[0]?.valid ?? false;
  const missingDocs = docs.filter((entry) => !entry.valid);
  const missingArtifacts = governedArtifacts.filter((entry) => !entry.valid);
  const missingExecutionState = executionState.filter((entry) => !entry.valid);

  const checks: BootstrapProofCheck[] = [
    {
      id: 'bootstrap-proof.runtime',
      stage: 'runtime',
      status: runtime.available ? 'pass' : 'fail',
      category: runtime.available ? null : 'runtime_unavailable',
      summary: runtime.available ? 'Runtime is available.' : 'Runtime is unavailable.',
      detail: runtime.detail,
      evidence: [runtime.command, runtime.version ? `version=${runtime.version}` : 'version=unavailable'],
      next_action: runtime.available ? null : 'Install Node.js and verify `node --version` succeeds.'
    },
    {
      id: 'bootstrap-proof.cli-resolution',
      stage: 'cli_resolution',
      status: cliResolution.resolved ? 'pass' : 'fail',
      category: cliResolution.resolved ? null : 'cli_resolution_failed',
      summary: cliResolution.resolved ? 'Playbook CLI resolves from this repository.' : 'Playbook CLI resolution failed.',
      detail: cliResolution.detail,
      evidence: [cliResolution.command],
      next_action: cliResolution.resolved ? null : 'Reinstall or re-expose the Playbook CLI so `playbook context --json` can run from this repository.'
    },
    {
      id: 'bootstrap-proof.repo-initialization',
      stage: 'repo_initialization',
      status: initialized ? 'pass' : 'fail',
      category: initialized ? null : 'repo_not_initialized',
      summary: initialized ? 'Repository initialization artifacts are present.' : 'Repository initialization is incomplete.',
      detail: initialized ? 'Required Playbook initialization state exists.' : initialization.filter((entry) => !entry.valid).map((entry) => entry.detail).join(' '),
      evidence: initialization.map((entry) => `${entry.path}:${entry.present ? (entry.valid ? 'valid' : 'invalid') : 'missing'}`),
      next_action: initialized ? null : 'Run `pnpm playbook init` to scaffold the baseline Playbook contract files.'
    },
    {
      id: 'bootstrap-proof.governance-docs',
      stage: 'governance_docs',
      status: missingDocs.length === 0 ? 'pass' : 'fail',
      category: missingDocs.length === 0 ? null : 'required_docs_missing',
      summary: missingDocs.length === 0 ? 'Required governance docs are present.' : 'Required governance docs are missing or empty.',
      detail: missingDocs.length === 0 ? 'Governance docs satisfy the bootstrap contract.' : missingDocs.map((entry) => entry.detail).join(' '),
      evidence: docs.map((entry) => `${entry.path}:${entry.present ? (entry.non_empty ? 'present' : 'empty') : 'missing'}`),
      next_action: missingDocs.length === 0 ? null : 'Create or fill the required docs under `docs/` so the repository exposes its governance contract.'
    },
    {
      id: 'bootstrap-proof.governed-artifacts',
      stage: 'governed_artifacts',
      status: missingArtifacts.length === 0 ? 'pass' : 'fail',
      category: missingArtifacts.length === 0 ? null : 'required_artifacts_missing',
      summary: missingArtifacts.length === 0 ? 'Governed artifacts are present.' : 'Governed artifacts are missing or invalid.',
      detail: missingArtifacts.length === 0 ? 'Indexed/bootstrap artifacts satisfy the contract.' : missingArtifacts.map((entry) => entry.detail).join(' '),
      evidence: governedArtifacts.map((entry) => `${entry.path}:${entry.present ? (entry.valid ? 'valid' : 'invalid') : 'missing'}`),
      next_action: missingArtifacts.length === 0 ? null : 'Run `pnpm playbook index --json && pnpm playbook verify --json && pnpm playbook plan --json && pnpm playbook apply --json` to materialize governed artifacts.'
    },
    {
      id: 'bootstrap-proof.execution-state',
      stage: 'execution_state',
      status: missingExecutionState.length === 0 ? 'pass' : 'fail',
      category: missingExecutionState.length === 0 ? null : 'execution_state_missing',
      summary: missingExecutionState.length === 0 ? 'Execution runtime state is present.' : 'Execution runtime state is missing or invalid.',
      detail: missingExecutionState.length === 0 ? 'Execution-state artifacts satisfy the bootstrap contract.' : missingExecutionState.map((entry) => entry.detail).join(' '),
      evidence: executionState.map((entry) => `${entry.path}:${entry.present ? (entry.valid ? 'valid' : 'invalid') : 'missing'}`),
      next_action: missingExecutionState.length === 0 ? null : 'Run a governed Playbook command that writes execution state, then rerun bootstrap proof.'
    },
    {
      id: 'bootstrap-proof.governance-contract',
      stage: 'governance_contract',
      status: governanceContract.passed ? 'pass' : 'fail',
      category: governanceContract.passed ? null : 'governance_contract_failed',
      summary: governanceContract.passed ? 'Governance contract passed.' : 'Governance contract failed.',
      detail: governanceContract.passed
        ? `Verify completed with ${governanceContract.warnings.length} warnings.`
        : governanceContract.failures.map((entry) => `${entry.id}: ${entry.message}`).join(' '),
      evidence: [
        `failures=${governanceContract.failures.length}`,
        `warnings=${governanceContract.warnings.length}`
      ],
      next_action: governanceContract.passed ? null : 'Run `pnpm playbook verify --json` and resolve the reported governance failures before claiming consumer readiness.'
    }
  ];

  const failure = firstFailure(checks);

  return {
    schemaVersion: '1.0',
    kind: 'bootstrap-proof',
    proof_passed: failure === undefined,
    failure_category: failure?.category ?? null,
    current_state: failure === undefined ? 'Repository passed the external-consumer bootstrap proof.' : `Repository failed bootstrap proof at ${failure.stage}.`,
    why: failure === undefined ? 'Runtime, CLI resolution, initialization, governance docs, governed artifacts, execution state, and verify contract checks all passed.' : failure.detail,
    what_next: failure === undefined ? 'No remediation is required; this repo is ready to act as a governed Playbook consumer.' : (failure.next_action ?? 'Address the failing bootstrap stage and rerun the proof.'),
    highest_priority_next_action: failure?.next_action ?? null,
    checks,
    diagnostics: {
      runtime,
      cli_resolution: cliResolution,
      repo_initialization: {
        initialized,
        required_paths: initialization
      },
      governance_docs: docs,
      governed_artifacts: governedArtifacts,
      execution_state: executionState,
      governance_contract: governanceContract
    }
  };
};
