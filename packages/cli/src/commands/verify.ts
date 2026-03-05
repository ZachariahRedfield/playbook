import { formatHuman, verify } from '@zachariahredfield/playbook-core';
import { createNodeContext } from '@zachariahredfield/playbook-node';
import { emitResult, ExitCode } from '../lib/cliContract.js';

export type VerifyReport = Awaited<ReturnType<typeof verify>>;
type VerifyFailure = VerifyReport['failures'][number];
type VerifyWarning = VerifyReport['warnings'][number];

export const collectVerifyReport = async (cwd: string): Promise<VerifyReport> => verify(createNodeContext({ cwd }));

export const runVerify = async (
  cwd: string,
  options: { format: 'text' | 'json'; ci: boolean; quiet: boolean }
): Promise<number> => {
  const report = await collectVerifyReport(cwd);

  if (options.format === 'text' && !options.ci) {
    console.log(formatHuman(report));
    return report.ok ? ExitCode.Success : ExitCode.PolicyFailure;
  }

  if (options.format === 'text' && options.ci) {
    if (!options.quiet || !report.ok) {
      console.log(report.ok ? 'playbook verify: PASS' : 'playbook verify: FAIL');
    }
    return report.ok ? ExitCode.Success : ExitCode.PolicyFailure;
  }

  emitResult({
    format: options.format,
    quiet: options.quiet,
    command: 'verify',
    ok: report.ok,
    exitCode: report.ok ? ExitCode.Success : ExitCode.PolicyFailure,
    summary: report.ok ? 'Verification passed.' : 'Verification failed.',
    findings: [
      ...report.failures.map((failure: VerifyFailure) => ({
        id: `verify.failure.${failure.id}`,
        level: 'error' as const,
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
      .filter((fix: string | undefined): fix is string => Boolean(fix))
  });

  return report.ok ? ExitCode.Success : ExitCode.PolicyFailure;
};
