import fs from 'node:fs';
import path from 'node:path';
import {
  clearSession,
  cleanupSessionSnapshots,
  formatMergeReportMarkdown,
  importChatTextSnapshot,
  pinSessionArtifact,
  readSession,
  resumeSession,
  mergeSessionSnapshots,
  validateSessionSnapshot
} from '@zachariahredfield/playbook-engine';
import { resolveSessionMergeInputs } from './sessionMergeInputs.js';
import { emitResult, ExitCode } from '../lib/cliContract.js';

type SessionConflict = ReturnType<typeof mergeSessionSnapshots>['conflicts'][number];

const requireOption = (value: string | undefined, flag: string): string => {
  if (!value) {
    throw new Error(`Missing required option: ${flag}`);
  }
  return value;
};

const resolvePath = (cwd: string, maybePath: string): string => path.resolve(cwd, maybePath);

const parseOption = (args: string[], name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
};

const parseListOption = (args: string[], name: string): string[] => {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
};

type SessionOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

export const runSession = async (cwd: string, args: string[], options: SessionOptions): Promise<number> => {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand) {
    emitResult({
      format: options.format,
      quiet: false,
      command: 'session',
      ok: false,
      exitCode: ExitCode.Failure,
      summary: 'Usage: playbook session <import|merge|cleanup|show|pin|resume|clear> [options]',
      findings: [{ id: 'session.subcommand.missing', level: 'error', message: 'Missing session subcommand.' }],
      nextActions: ['Provide one of: import, merge, cleanup, show, pin, resume, clear.']
    });
    return ExitCode.Failure;
  }

  if (subcommand === 'show') {
    const session = readSession(cwd);

    if (!session) {
      emitResult({
        format: options.format,
        quiet: options.quiet,
        command: 'session.show',
        ok: true,
        exitCode: ExitCode.Success,
        summary: 'No active repo-scoped session found.',
        findings: [{ id: 'session.show.empty', level: 'info', message: 'Session artifact does not exist yet.' }],
        nextActions: ['Use `playbook session pin <artifact>` to create and populate session state.']
      });
      return ExitCode.Success;
    }

    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'session.show',
      ok: true,
      exitCode: ExitCode.Success,
      summary: `Session ${session.sessionId} at step ${session.currentStep}`,
      findings: [
        { id: 'session.show.goal', level: 'info', message: `goal=${session.activeGoal}` },
        { id: 'session.show.run', level: 'info', message: `selectedRunId=${session.selectedRunId ?? 'none'}` },
        { id: 'session.show.artifacts', level: 'info', message: `pinnedArtifacts=${session.pinnedArtifacts.length}` }
      ],
      nextActions: []
    });
    return ExitCode.Success;
  }

  if (subcommand === 'pin') {
    const artifact = rest[0] && !rest[0]?.startsWith('--') ? rest[0] : parseOption(rest, '--artifact');
    const kind = parseOption(rest, '--kind') as 'finding' | 'plan' | 'run' | 'pattern' | 'artifact' | undefined;
    if (!artifact) {
      throw new Error('playbook session pin requires <artifact> or --artifact <path>.');
    }
    const session = pinSessionArtifact(cwd, artifact, kind);
    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'session.pin',
      ok: true,
      exitCode: ExitCode.Success,
      summary: `Pinned artifact: ${artifact}`,
      findings: [
        { id: 'session.pin.count', level: 'info', message: `pinnedArtifacts=${session.pinnedArtifacts.length}` }
      ],
      nextActions: []
    });
    return ExitCode.Success;
  }

  if (subcommand === 'resume') {
    const resumed = resumeSession(cwd);
    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'session.resume',
      ok: resumed.warnings.length === 0,
      exitCode: resumed.warnings.length === 0 ? ExitCode.Success : ExitCode.PolicyFailure,
      summary: resumed.warnings.length === 0 ? 'Session resumed.' : 'Session resumed with warnings.',
      findings: [
        { id: 'session.resume.goal', level: 'info', message: `goal=${resumed.session.activeGoal}` },
        { id: 'session.resume.run', level: 'info', message: `activeRunFound=${resumed.activeRunFound}` },
        ...resumed.warnings.map((warning: string, index: number) => ({
          id: `session.resume.warning.${index + 1}`,
          level: 'warning' as const,
          message: warning
        }))
      ],
      nextActions: resumed.warnings.length > 0 ? ['Refresh or repin missing artifacts before continuing.'] : []
    });
    return resumed.warnings.length === 0 ? ExitCode.Success : ExitCode.PolicyFailure;
  }

  if (subcommand === 'clear') {
    const cleared = clearSession(cwd);
    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'session.clear',
      ok: true,
      exitCode: ExitCode.Success,
      summary: cleared ? 'Cleared repo-scoped session state.' : 'No repo-scoped session state to clear.',
      findings: [
        { id: 'session.clear.result', level: 'info', message: `cleared=${cleared}` }
      ],
      nextActions: []
    });
    return ExitCode.Success;
  }

  if (subcommand === 'import') {
    const inPath = requireOption(parseOption(rest, '--in'), '--in');
    const sourcePath = resolvePath(cwd, inPath);
    const sourceText = fs.readFileSync(sourcePath, 'utf8');
    const stat = fs.statSync(sourcePath);
    const name = parseOption(rest, '--name');
    const outOption = parseOption(rest, '--out');
    const store = rest.includes('--store');

    const snapshot = importChatTextSnapshot({
      text: sourceText,
      sourcePath,
      sourceName: name,
      createdAt: stat.mtime.toISOString(),
      repoHint: path.basename(cwd)
    });

    const defaultFileName = `${(name ?? path.basename(sourcePath, path.extname(sourcePath))).replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase()}-${snapshot.source.hash}.json`;
    const outPath = outOption
      ? resolvePath(cwd, outOption)
      : store
        ? path.join(cwd, '.playbook/sessions', defaultFileName)
        : path.join(path.dirname(sourcePath), `${path.basename(sourcePath, path.extname(sourcePath))}.snapshot.json`);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'session.import',
      ok: true,
      exitCode: ExitCode.Success,
      summary: `Wrote session snapshot: ${path.relative(cwd, outPath)}`,
      findings: [{ id: 'session.import.output.written', level: 'info', message: path.relative(cwd, outPath) }],
      nextActions: []
    });
    return ExitCode.Success;
  }

  if (subcommand === 'merge') {
    const inPaths = resolveSessionMergeInputs(cwd, parseListOption(rest, '--in'));
    if (inPaths.length < 2) {
      throw new Error('playbook session merge requires at least two --in <snapshot.json> values');
    }

    const outPath = resolvePath(cwd, requireOption(parseOption(rest, '--out'), '--out'));
    const reportPath = parseOption(rest, '--report');
    const reportJsonPath = parseOption(rest, '--json-report');

    const snapshots = inPaths.map((entry) => {
      const loaded = JSON.parse(fs.readFileSync(entry, 'utf8')) as unknown;
      return validateSessionSnapshot(loaded);
    });

    const result = mergeSessionSnapshots(snapshots);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(result.mergedSnapshot, null, 2)}\n`, 'utf8');

    if (reportPath) {
      const resolved = resolvePath(cwd, reportPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, formatMergeReportMarkdown(result), 'utf8');
    }

    if (reportJsonPath) {
      const resolved = resolvePath(cwd, reportJsonPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    }

    const conflictExitCode = result.conflicts.length > 0 ? ExitCode.PolicyFailure : ExitCode.Success;

    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'session.merge',
      ok: result.conflicts.length === 0,
      exitCode: conflictExitCode,
      summary: `Wrote merged snapshot: ${path.relative(cwd, outPath)}`,
      findings: [
        { id: 'session.merge.inputs.count', level: 'info', message: `Merged ${inPaths.length} snapshots.` },
        ...result.conflicts.map((conflict: SessionConflict, index: number) => ({
          id: `session.merge.conflict.${index + 1}`,
          level: 'warning' as const,
          message: `${conflict.type} conflict on ${conflict.key}`
        }))
      ],
      nextActions: result.conflicts.length > 0 ? ['Review merge conflicts and rerun merge.'] : []
    });

    return conflictExitCode;
  }

  if (subcommand === 'cleanup') {
    const sessionsDir = resolvePath(cwd, parseOption(rest, '--sessions-dir') ?? '.playbook/sessions');
    const maxDaysRaw = parseOption(rest, '--max-days');
    const maxCountRaw = parseOption(rest, '--max-count');
    const maxEntryLengthRaw = parseOption(rest, '--max-entry-length');
    const dryRun = rest.includes('--dry-run');
    const hygiene = rest.includes('--hygiene');
    const reportJsonPath = parseOption(rest, '--json-report');

    const result = cleanupSessionSnapshots({
      sessionsDir,
      maxDays: maxDaysRaw ? Number(maxDaysRaw) : undefined,
      maxCount: maxCountRaw ? Number(maxCountRaw) : undefined,
      maxEntryLength: maxEntryLengthRaw ? Number(maxEntryLengthRaw) : undefined,
      hygiene,
      dryRun
    });

    if (reportJsonPath) {
      const resolved = resolvePath(cwd, reportJsonPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    }

    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'session.cleanup',
      ok: true,
      exitCode: ExitCode.Success,
      summary: `${dryRun ? 'Dry run complete' : 'Cleanup complete'} for ${path.relative(cwd, sessionsDir) || '.'}`,
      findings: [
        ...result.deleted.map((filePath: string) => ({
          id: `session.cleanup.deleted.${path.basename(filePath).replace(/[^a-zA-Z0-9]+/g, '-')}`,
          level: 'info' as const,
          message: `${dryRun ? 'Would delete' : 'Deleted'}: ${path.relative(cwd, filePath)}`
        })),
        { id: 'session.cleanup.count.deleted', level: 'info', message: `deletedCount=${result.deletedCount}` },
        { id: 'session.cleanup.count.kept', level: 'info', message: `keptCount=${result.keptCount}` },
        {
          id: 'session.cleanup.hygiene.enabled',
          level: 'info' as const,
          message: `hygieneEnabled=${result.hygieneReport.enabled}`
        },
        {
          id: 'session.cleanup.hygiene.removed',
          level: 'info' as const,
          message: `deduplicated=${result.hygieneReport.itemsRemoved.deduplicated} junk=${result.hygieneReport.itemsRemoved.junk}`
        },
        {
          id: 'session.cleanup.hygiene.compacted',
          level: 'info' as const,
          message: `truncated=${result.hygieneReport.itemsCompacted.truncated} normalized=${result.hygieneReport.itemsCompacted.normalized}`
        },
        {
          id: 'session.cleanup.hygiene.reduction',
          level: 'info' as const,
          message: `bytesReduced=${result.hygieneReport.bytesReduced} linesReduced=${result.hygieneReport.linesReduced}`
        },
        ...result.hygieneReport.warnings.map((warning: string, index: number) => ({
          id: `session.cleanup.hygiene.warning.${index + 1}`,
          level: 'warning' as const,
          message: warning
        }))
      ],
      nextActions: []
    });

    return ExitCode.Success;
  }

  emitResult({
    format: options.format,
    quiet: false,
    command: 'session',
    ok: false,
    exitCode: ExitCode.Failure,
    summary: 'Usage: playbook session <import|merge|cleanup|show|pin|resume|clear> [options]',
    findings: [{ id: 'session.subcommand.invalid', level: 'error', message: `Unknown subcommand: ${subcommand}` }],
    nextActions: ['Provide one of: import, merge, cleanup, show, pin, resume, clear.']
  });
  return ExitCode.Failure;
};
