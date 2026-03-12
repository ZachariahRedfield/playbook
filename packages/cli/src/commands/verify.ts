import * as engine from '@zachariahredfield/playbook-engine';
import { buildResult, emitResult, ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';

export type VerifyReport = {
  ok: boolean;
  summary: {
    failures: number;
    warnings: number;
    baseRef?: string;
    baseSha?: string;
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

export const collectVerifyReport = async (cwd: string): Promise<VerifyReport> => engine.verifyRepo(cwd) as VerifyReport;

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

export const runVerify = async (
  cwd: string,
  options: { format: 'text' | 'json'; ci: boolean; quiet: boolean; explain: boolean; policy: boolean; outFile?: string; runId?: string }
): Promise<number> => {
  const verifyRules = await loadVerifyRules(cwd);
  const report = await collectVerifyReport(cwd);

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
    inputs: { policyMode: inPolicyMode },
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

  const hasApplyStep = run.steps.some((step: { kind: string }) => step.kind === 'apply');
  if (hasApplyStep) {
    engine.completeExecutionRun(cwd, runId, ok
      ? { status: 'passed', summary: 'Remediation run completed and verification passed.' }
      : { status: 'partial', summary: 'Remediation run completed but verification failed.', failure_cause: 'verification_failed' });
  }

  if (options.format === 'text' && !options.ci && !options.explain && !inPolicyMode) {
    console.log(engine.formatHuman(report));
    return exitCode;
  }

  if (options.format === 'text' && options.ci && !options.explain && !inPolicyMode) {
    if (!options.quiet || !ok) {
      console.log(ok ? 'playbook verify: PASS' : 'playbook verify: FAIL');
    }
    return exitCode;
  }

  const resultPayload = {
    command: 'verify',
    ok,
    exitCode,
    summary: ok ? 'Verification passed.' : inPolicyMode ? 'Policy verification failed.' : 'Verification failed.',
    findings: [
      ...report.failures.map((failure: VerifyFailure) => ({
        ...resolveFailureGuidance(verifyRules, failure),
        id: inPolicyMode ? `verify.rule.${failure.id}` : `verify.failure.${failure.id}`,
        level: inPolicyMode ? (policyFailureIds.has(failure.id) ? ('error' as const) : ('info' as const)) : ('error' as const),
        message: failure.message
      })),
      ...report.warnings.map((warning: VerifyWarning) => ({
        id: `verify.warning.${warning.id}`,
        level: 'warning' as const,
        message: warning.message
      }))
    ],
    nextActions: report.failures
      .map((failure: VerifyFailure) => failure.fix)
      .filter((fix: string | undefined): fix is string => Boolean(fix)),
    policyViolations: inPolicyMode ? policyViolations : undefined
  };

  if (options.format === 'json' && options.outFile) {
    emitJsonOutput({ cwd, command: 'verify', payload: buildResult(resultPayload), outFile: options.outFile });
    return exitCode;
  }

  emitResult({
    format: options.format,
    quiet: options.quiet,
    explain: options.explain,
    ...resultPayload
  });

  return exitCode;
};
