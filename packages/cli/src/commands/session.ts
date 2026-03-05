import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupSessionSnapshots,
  formatMergeReportMarkdown,
  importChatTextSnapshot,
  mergeSessionSnapshots,
  validateSessionSnapshot
} from '@zachariahredfield/playbook-engine';

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

export const runSession = async (cwd: string, args: string[]): Promise<number> => {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand) {
    console.log('Usage: playbook session <import|merge|cleanup> [options]');
    return 1;
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
    console.log(`Wrote session snapshot: ${path.relative(cwd, outPath)}`);
    return 0;
  }

  if (subcommand === 'merge') {
    const inPaths = parseListOption(rest, '--in');
    if (inPaths.length < 2) {
      throw new Error('playbook session merge requires at least two --in <snapshot.json> values');
    }

    const outPath = resolvePath(cwd, requireOption(parseOption(rest, '--out'), '--out'));
    const reportPath = parseOption(rest, '--report');
    const reportJsonPath = parseOption(rest, '--json');

    const snapshots = inPaths.map((entry) => {
      const loaded = JSON.parse(fs.readFileSync(resolvePath(cwd, entry), 'utf8')) as unknown;
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

    console.log(`Wrote merged snapshot: ${path.relative(cwd, outPath)}`);
    return result.conflicts.length > 0 ? 2 : 0;
  }

  if (subcommand === 'cleanup') {
    const sessionsDir = resolvePath(cwd, parseOption(rest, '--sessions-dir') ?? '.playbook/sessions');
    const maxDaysRaw = parseOption(rest, '--max-days');
    const maxCountRaw = parseOption(rest, '--max-count');
    const dryRun = rest.includes('--dry-run');

    const result = cleanupSessionSnapshots({
      sessionsDir,
      maxDays: maxDaysRaw ? Number(maxDaysRaw) : undefined,
      maxCount: maxCountRaw ? Number(maxCountRaw) : undefined,
      dryRun
    });

    for (const filePath of result.deleted) {
      console.log(`${dryRun ? 'Would delete' : 'Deleted'}: ${path.relative(cwd, filePath)}`);
    }

    console.log(
      JSON.stringify(
        {
          sessionsDir: path.relative(cwd, sessionsDir) || '.',
          dryRun,
          deletedCount: result.deletedCount,
          keptCount: result.keptCount
        },
        null,
        2
      )
    );

    return 0;
  }

  console.log('Usage: playbook session <import|merge|cleanup> [options]');
  return 1;
};
