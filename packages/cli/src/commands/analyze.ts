import { analyze, formatAnalyzeCi, formatAnalyzeHuman } from '@zachariahredfield/playbook-core';
import { createNodeContext } from '@zachariahredfield/playbook-node';
import { emitResult, ExitCode } from '../lib/cliContract.js';

export type AnalyzeReport = Awaited<ReturnType<typeof analyze>>;
type AnalyzeRecommendation = AnalyzeReport['recommendations'][number];

type AnalyzeOptions = {
  ci: boolean;
  format: 'text' | 'json';
  quiet: boolean;
};

export const collectAnalyzeReport = async (cwd: string): Promise<AnalyzeReport> => analyze(createNodeContext({ cwd }));

export const runAnalyze = async (cwd: string, opts: AnalyzeOptions): Promise<number> => {
  const result = await collectAnalyzeReport(cwd);

  if (opts.format === 'text' && !opts.ci) {
    console.log(formatAnalyzeHuman(result));
    return ExitCode.Success;
  }

  if (opts.format === 'text' && opts.ci) {
    if (!opts.quiet || !result.ok) {
      console.log(formatAnalyzeCi(result));
    }
    return result.ok ? ExitCode.Success : ExitCode.Failure;
  }

  emitResult({
    format: opts.format,
    quiet: opts.quiet,
    command: 'analyze',
    ok: result.ok,
    exitCode: result.ok ? ExitCode.Success : ExitCode.Failure,
    summary: result.ok ? 'Analyze completed successfully.' : 'Analyze completed with findings.',
    findings: result.recommendations.map((rec: AnalyzeRecommendation) => ({
      id: `analyze.recommendation.${rec.id}`,
      level: rec.severity === 'WARN' ? 'warning' as const : 'info' as const,
      message: rec.message
    })),
    nextActions: result.recommendations.map((rec: AnalyzeRecommendation) => rec.fix)
  });

  return result.ok ? ExitCode.Success : ExitCode.Failure;
};
