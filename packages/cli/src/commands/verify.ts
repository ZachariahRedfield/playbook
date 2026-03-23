import * as engine from '@zachariahredfield/playbook-engine';
import { buildResult, emitResult, ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { printCommandHelp } from '../lib/commandSurface.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';
import { createCommandQualityTracker } from '../lib/commandQuality.js';

export type VerifyReport = {
  ok: boolean;
  summary: {
    failures: number;
    warnings: number;
    baseRef?: string;
    baseSha?: string;
    phase?: string;
    ruleIds?: string[];
  };
  failures: Array<{ id: string; message: string; evidence?: string; fix?: string }>;
  warnings: Array<{ id: string; message: string }>;
};
type VerifyFailure = VerifyReport['failures'][number];
type VerifyWarning = VerifyReport['warnings'][number];
type PolicyEvaluation = {
  failureId: string;
  policyId: string;
  ruleId: string;
  message: string;
  remediation?: string[];
};

type VerifyPhase = 'preflight';
const VERIFY_PHASE_RULES = { preflight: ['release.version-governance'] } as const;

type VerifyRunOptions = {
  format: 'text' | 'json';
  ci: boolean;
  quiet: boolean;
  explain: boolean;
  policy: boolean;
  outFile?: string;
  runId?: string;
  help?: boolean;
  phase?: VerifyPhase;
  ruleIds?: string[];
};

const resolveFailureGuidance = (
  verifyRules: Awaited<ReturnType<typeof loadVerifyRules>>,
  failure: VerifyFailure
): { explanation?: string; remediation?: string[] } => {
  const rule = verifyRules.find((candidate) => candidate.check({ failure }));
  return {
    explanation: rule?.explanation,
    remediation: rule?.remediation ?? (failure.fix ? [failure.fix] : undefined)
  };
};

const collectNextActions = (report: VerifyReport, verifyRules: Awaited<ReturnType<typeof loadVerifyRules>>): string[] => {
  const actions = report.failures
    .flatMap((failure: VerifyFailure) => resolveFailureGuidance(verifyRules, failure).remediation ?? (failure.fix ? [failure.fix] : []))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return [...new Set(actions)].slice(0, 4);
};

const printCompactNextActions = (actions: string[]): void => {
  if (actions.length === 0) {
    return;
  }

  console.log('Next actions:');
  for (const action of actions) {
    console.log(`- ${action}`);
  }
};

const parseRuleIds = (ruleIds: string[] | undefined): string[] | undefined => {
  const normalized = [...new Set((ruleIds ?? []).flatMap((entry) => entry.split(',')).map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  return normalized.length > 0 ? normalized : undefined;
};

const validateVerifyOptions = (options: VerifyRunOptions): void => {
  if (options.phase && !(options.phase in VERIFY_PHASE_RULES)) {
    const supported = Object.keys(VERIFY_PHASE_RULES).sort().join(', ');
    throw new Error(`playbook verify: unsupported phase "${options.phase}". Supported phases: ${supported}.`);
  }
};

export const collectVerifyReport = async (cwd: string, options: { phase?: VerifyPhase; ruleIds?: string[] } = {}): Promise<VerifyReport> => (
  engine.verifyRepo(cwd, options) as VerifyReport
);

const resolveRunId = (cwd: string, requestedRunId: string | undefined): string => {
  if (requestedRunId) {
    return requestedRunId;
  }

  const latest = engine.getLatestMutableRun ? engine.getLatestMutableRun(cwd) : null;
  if (latest) {
    return latest.id;
  }

  const intent = engine.createExecutionIntent('verify repository governance', ['repository'], ['deterministic-cli-only-writes'], 'user');
  return engine.createExecutionRun(cwd, intent).id;
};

export const runVerify = async (cwd: string, options: VerifyRunOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook verify [options]',
      description: 'Verify repository governance rules and optional policy gating.',
      options: [
        '--phase <name>             Run a named low-cost verify subset (currently: preflight)',
        '--rule <id>                Restrict verify to one or more rule ids (repeatable or comma-separated)',
        '--policy                   Enable policy mode for configured policy rules',
        '--ci                       CI mode summary in text output',
        '--explain                  Show why findings matter and remediation in text mode',
        '--out <path>               Write JSON artifact envelope for verify result',
        '--run-id <id>              Attach verify step to an existing execution run',
        '--json                     Alias for --format=json',
        '--format <text|json>       Output format',
        '--quiet                    Suppress success output in text mode',
        '--help                     Show help'
      ],
      artifacts: ['.playbook/findings*.json (optional via --out)', '.playbook/execution/runs/** (session runtime state)']
    });
    return ExitCode.Success;
  }

  const normalizedRuleIds = parseRuleIds(options.ruleIds);
  validateVerifyOptions({ ...options, ruleIds: normalizedRuleIds });
  const tracker = createCommandQualityTracker(cwd, 'verify');

  const verifyRules = await loadVerifyRules(cwd);
  const report = await collectVerifyReport(cwd, { phase: options.phase, ruleIds: normalizedRuleIds });
  const nextActions = collectNextActions(report, verifyRules);

  const { config } = await Promise.resolve(engine.loadConfig(cwd));
  const configuredPolicyRules = new Set(config.verify.policy.rules);
  const policyEvaluation: PolicyEvaluation[] = report.failures
    .map((failure: VerifyFailure): PolicyEvaluation | undefined => {
      const rule = verifyRules.find((candidate) => candidate.check({ failure }));
      if (!rule?.policy) {
        return undefined;
      }
      if (!configuredPolicyRules.has(rule.policy.id)) {
        return undefined;
      }

      return {
        failureId: failure.id,
        policyId: rule.policy.id,
        ruleId: rule.id,
        message: failure.message,
        remediation: rule.remediation ?? (failure.fix ? [failure.fix] : undefined)
      };
    })
    .filter((policy): policy is PolicyEvaluation => Boolean(policy));

  const policyFailureIds = new Set(policyEvaluation.map((policy) => policy.failureId));
  const policyViolations: Array<Omit<PolicyEvaluation, 'failureId'>> = policyEvaluation
    .map((policy: PolicyEvaluation) => ({
      policyId: policy.policyId,
      ruleId: policy.ruleId,
      message: policy.message,
      remediation: policy.remediation
    }))
    .sort((left: Omit<PolicyEvaluation, 'failureId'>, right: Omit<PolicyEvaluation, 'failureId'>) => {
      const idDiff = left.policyId.localeCompare(right.policyId);
      if (idDiff !== 0) {
        return idDiff;
      }
      return left.message.localeCompare(right.message);
    });

  const inPolicyMode = options.policy;
  const ok = inPolicyMode ? policyViolations.length === 0 : report.ok;
  const exitCode = ok ? ExitCode.Success : ExitCode.PolicyFailure;
  const runId = resolveRunId(cwd, options.runId);
  const run = engine.appendExecutionStep(cwd, runId, {
    kind: 'verify',
    status: ok ? 'passed' : 'failed',
    inputs: { policyMode: inPolicyMode, phase: options.phase, ruleIds: normalizedRuleIds },
    outputs: {
      failures: report.failures.length,
      warnings: report.warnings.length,
      ok
    },
    evidence: [
      ...(options.outFile ? [{ id: 'evidence-findings-artifact', kind: 'artifact' as const, ref: options.outFile }] : []),
      ...report.failures.map((failure, index) => ({
        id: `evidence-finding-${String(index + 1).padStart(3, '0')}`,
        kind: 'finding' as const,
        ref: `verify.failure.${failure.id}`,
        note: failure.message
      }))
    ]
  });

  const runArtifactPath = engine.executionRunPath(cwd, runId);
  engine.attachSessionRunState(cwd, {
    step: 'verify',
    runId,
    goal: inPolicyMode ? 'verify repository policy posture' : 'verify repository governance',
    artifacts: [
      { artifact: runArtifactPath, kind: 'run' },
      ...(options.outFile ? [{ artifact: options.outFile, kind: 'finding' as const }] : [])
    ]
  });
  const hasApplyStep = run.steps.some((step: { kind: string }) => step.kind === 'apply');
  if (hasApplyStep) {
    engine.completeExecutionRun(cwd, runId, ok
      ? { status: 'passed', summary: 'Remediation run completed and verification passed.' }
      : { status: 'partial', summary: 'Remediation run completed but verification failed.', failure_cause: 'verification_failed' });
  }

  if (options.format === 'text' && !options.ci && !options.explain && !inPolicyMode) {
    console.log(engine.formatHuman(report));
    if (!report.ok) {
      printCompactNextActions(nextActions);
    }
    tracker.finish({
      inputsSummary: `policy=${inPolicyMode ? 'on' : 'off'}; phase=${options.phase ?? 'full'}; rules=${normalizedRuleIds?.join(',') ?? 'all'}`,
      artifactsWritten: options.outFile ? [options.outFile] : [],
      downstreamArtifactsProduced: options.outFile ? [options.outFile] : [],
      successStatus: ok ? 'success' : 'failure',
      warningsCount: report.warnings.length,
      confidenceScore: ok ? 0.9 : 0.3
    });
    return exitCode;
  }

  if (options.format === 'text' && options.ci && !options.explain && !inPolicyMode) {
    if (!options.quiet || !ok) {
      console.log(ok ? 'playbook verify: PASS' : 'playbook verify: FAIL');
      if (!ok) {
        printCompactNextActions(nextActions);
      }
    }
    tracker.finish({
      inputsSummary: `policy=${inPolicyMode ? 'on' : 'off'}; phase=${options.phase ?? 'full'}; rules=${normalizedRuleIds?.join(',') ?? 'all'}`,
      artifactsWritten: options.outFile ? [options.outFile] : [],
      downstreamArtifactsProduced: options.outFile ? [options.outFile] : [],
      successStatus: ok ? 'success' : 'failure',
      warningsCount: report.warnings.length,
      confidenceScore: ok ? 0.9 : 0.3
    });
    return exitCode;
  }

  const resultPayload = {
    command: 'verify',
    ok,
    exitCode,
    summary: ok ? 'Verification passed.' : inPolicyMode ? 'Policy verification failed.' : 'Verification failed.',
    phase: options.phase,
    selectedRules: normalizedRuleIds ?? report.summary.ruleIds,
    findings: [
      ...report.failures.map((failure: VerifyFailure) => ({
        ...resolveFailureGuidance(verifyRules, failure),
        id: inPolicyMode ? `verify.rule.${failure.id}` : `verify.failure.${failure.id}`,
        level: inPolicyMode ? (policyFailureIds.has(failure.id) ? ('error' as const) : ('info' as const)) : ('error' as const),
        message: failure.message,
        evidence: failure.evidence
      })),
      ...report.warnings.map((warning: VerifyWarning) => ({
        id: `verify.warning.${warning.id}`,
        level: 'warning' as const,
        message: warning.message
      }))
    ],
    nextActions,
    policyViolations: inPolicyMode ? policyViolations : undefined
  };

  if (options.format === 'json' && options.outFile) {
    emitJsonOutput({ cwd, command: 'verify', payload: buildResult(resultPayload), outFile: options.outFile });
    tracker.finish({
      inputsSummary: `policy=${inPolicyMode ? 'on' : 'off'}; phase=${options.phase ?? 'full'}; rules=${normalizedRuleIds?.join(',') ?? 'all'}`,
      artifactsWritten: options.outFile ? [options.outFile] : [],
      downstreamArtifactsProduced: options.outFile ? [options.outFile] : [],
      successStatus: ok ? 'success' : 'failure',
      warningsCount: report.warnings.length,
      confidenceScore: ok ? 0.9 : 0.3
    });
    return exitCode;
  }

  emitResult({
    format: options.format,
    quiet: options.quiet,
    explain: options.explain,
    ...resultPayload
  });

  tracker.finish({
    inputsSummary: `policy=${inPolicyMode ? 'on' : 'off'}; phase=${options.phase ?? 'full'}; rules=${normalizedRuleIds?.join(',') ?? 'all'}`,
    artifactsWritten: options.outFile ? [options.outFile] : [],
    downstreamArtifactsProduced: options.outFile ? [options.outFile] : [],
    successStatus: ok ? 'success' : 'failure',
    warningsCount: report.warnings.length,
    confidenceScore: ok ? 0.9 : 0.3
  });
  return exitCode;
};
