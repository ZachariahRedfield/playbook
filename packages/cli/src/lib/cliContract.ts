export enum ExitCode {
  Success = 0,
  Failure = 1,
  EnvironmentPrereq = 2,
  PolicyFailure = 3,
  WarningsOnly = 4
}

export type CliOutputFormat = 'text' | 'json';

export type CliFinding = {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  explanation?: string;
  remediation?: string[];
};

export type CliResult = {
  schemaVersion: '1.0';
  command: string;
  ok: boolean;
  exitCode: ExitCode;
  summary: string;
  findings: CliFinding[];
  nextActions: string[];
};

type EmitResultOptions = Omit<CliResult, 'schemaVersion' | 'findings' | 'nextActions'> & {
  format: CliOutputFormat;
  quiet?: boolean;
  explain?: boolean;
  findings?: CliFinding[];
  nextActions?: string[];
};

const compareFindings = (left: CliFinding, right: CliFinding): number => {
  const levelOrder = ['error', 'warning', 'info'];
  const levelDiff = levelOrder.indexOf(left.level) - levelOrder.indexOf(right.level);
  if (levelDiff !== 0) {
    return levelDiff;
  }
  const idDiff = left.id.localeCompare(right.id);
  if (idDiff !== 0) {
    return idDiff;
  }
  return left.message.localeCompare(right.message);
};

export const sortFindings = (findings: CliFinding[]): CliFinding[] => [...findings].sort(compareFindings);

export const sortNextActions = (nextActions: string[]): string[] => [...nextActions].sort((a, b) => a.localeCompare(b));

export const buildResult = ({ findings = [], nextActions = [], ...rest }: Omit<EmitResultOptions, 'format' | 'quiet'>): CliResult => ({
  schemaVersion: '1.0',
  ...rest,
  findings: sortFindings(findings),
  nextActions: sortNextActions(nextActions)
});

export const emitResult = ({ format, quiet = false, explain = false, ...rest }: EmitResultOptions): void => {
  const result = buildResult(rest);

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (quiet && result.ok) {
    return;
  }

  console.log(result.summary);

  if (result.findings.length > 0) {
    for (const finding of result.findings) {
      const prefix = finding.level === 'error' ? '✖' : finding.level === 'warning' ? '⚠' : '•';
      console.log(`${prefix} [${finding.id}] ${finding.message}`);
      if (explain) {
        if (finding.explanation) {
          console.log('  Why this matters:');
          console.log(`  ${finding.explanation}`);
        }
        if (finding.remediation && finding.remediation.length > 0) {
          console.log('  How to fix:');
          for (const step of finding.remediation) {
            console.log(`  - ${step}`);
          }
        }
      }
    }
  }

  if (result.nextActions.length > 0) {
    console.log('Next actions:');
    for (const action of result.nextActions) {
      console.log(`- ${action}`);
    }
  }
};
