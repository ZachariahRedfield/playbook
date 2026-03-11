import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ANALYZER_CONTRACT_VERSION = '1.0' as const;
const RUNTIME_ROOT_RELATIVE = '.playbook/runtime' as const;
const DEFAULT_MAX_SCAN_BYTES = 1_000_000;

type RuntimeCycleStatus = 'success' | 'failure';

type RuntimeCycleContext = {
  cycleId: string;
  startedAt: string;
  repoRoot: string;
  triggerCommand: string;
  childCommands: string[];
  playbookVersion: string;
};

type CoverageArtifact = {
  schemaVersion: '1.0';
  cycle_id: string;
  observed_at: string;
  eligible_files: number;
  scanned_files: number;
  skipped_files: number;
  ignored_files: number;
  unsupported_files: number;
  binary_files: number;
  parse_failures: number;
  unresolved_imports: number;
  detected_modules: number;
  unknown_areas: string[];
  coverage_score: number;
  coverage_formula: string;
  coverage_score_components: {
    numerator_scanned_files: number;
    denominator_eligible_files: number;
  };
  observations: {
    file_inventory: {
      total_files_seen: number;
      sampled_file_hashes: Array<{ path: string; sha256: string }>;
      max_scan_bytes: number;
      expensive_paths: Array<{ path: string; size_bytes: number }>;
    };
    dependency_scan: {
      unresolved_relative_imports: number;
    };
  };
  interpretations: {
    framework_inference: string;
    architecture_inference: string;
    coverage_confidence: 'high' | 'medium' | 'low';
  };
};

type TelemetryArtifact = {
  schemaVersion: '1.0';
  cycle_id: string;
  command_call_count: number;
  command_call_count_by_command: Record<string, number>;
  repeated_command_count: number;
  command_durations: Record<string, number>;
  artifact_cache_hits: number;
  artifact_cache_misses: number;
  fallback_usage_counts: Record<string, number>;
  parser_failure_counts: Record<string, number>;
  expensive_paths: Array<{ path: string; size_bytes: number }>;
  warnings_count: number;
  failures_count: number;
};

type HistoryCommandStats = {
  schemaVersion: '1.0';
  commands: Record<
    string,
    {
      runs: number;
      successes: number;
      failures: number;
      totalDurationMs: number;
      averageDurationMs: number;
      lastRunAt: string;
    }
  >;
};

const posixRelative = (root: string, absolutePath: string): string => path.relative(root, absolutePath).split(path.sep).join(path.posix.sep);

const ensureDir = (target: string): void => {
  fs.mkdirSync(target, { recursive: true });
};

const writeJsonFile = (target: string, payload: unknown): void => {
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const readJsonFile = <T>(target: string): T | undefined => {
  if (!fs.existsSync(target)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(target, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

const shouldIgnoreDirectory = (relativeDirPath: string): boolean => {
  const normalized = relativeDirPath.split(path.sep).join(path.posix.sep);
  return normalized === '.git' || normalized === 'node_modules' || normalized.startsWith('.playbook/runtime');
};

const isLikelyBinary = (absolutePath: string): boolean => {
  const fd = fs.openSync(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    for (let i = 0; i < bytesRead; i += 1) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  } finally {
    fs.closeSync(fd);
  }
};

const resolveRelativeImport = (absolutePath: string, specifier: string): boolean => {
  const base = path.resolve(path.dirname(absolutePath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`, path.join(base, 'index.ts'), path.join(base, 'index.tsx'), path.join(base, 'index.js')];
  return candidates.some((candidate) => fs.existsSync(candidate));
};

const listRepoFiles = (repoRoot: string): string[] => {
  const files: string[] = [];
  const stack = [repoRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const relative = posixRelative(repoRoot, child);
      if (entry.isDirectory()) {
        if (!shouldIgnoreDirectory(relative)) {
          stack.push(child);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(child);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
};

const hashContent = (value: Buffer | string): string => crypto.createHash('sha256').update(value).digest('hex');

const collectCoverage = (repoRoot: string, cycleId: string): CoverageArtifact => {
  const observedAt = new Date().toISOString();
  const analyzableExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  const files = listRepoFiles(repoRoot);

  let scannedFiles = 0;
  let eligibleFiles = 0;
  let skippedFiles = 0;
  let unsupportedFiles = 0;
  let binaryFiles = 0;
  let parseFailures = 0;
  let unresolvedImports = 0;
  let ignoredFiles = 0;

  const expensivePaths: Array<{ path: string; size_bytes: number }> = [];

  for (const absolutePath of files) {
    const ext = path.extname(absolutePath).toLowerCase();
    const stat = fs.statSync(absolutePath);
    expensivePaths.push({ path: posixRelative(repoRoot, absolutePath), size_bytes: stat.size });

    if (absolutePath.includes(`${path.sep}.playbook${path.sep}runtime${path.sep}`)) {
      ignoredFiles += 1;
      continue;
    }

    if (isLikelyBinary(absolutePath)) {
      binaryFiles += 1;
      continue;
    }

    if (!analyzableExtensions.has(ext)) {
      unsupportedFiles += 1;
      continue;
    }

    eligibleFiles += 1;
    if (stat.size > DEFAULT_MAX_SCAN_BYTES) {
      skippedFiles += 1;
      continue;
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf8');
      scannedFiles += 1;
      const importRe = /from\s+['\"]([^'\"]+)['\"]|import\(['\"]([^'\"]+)['\"]\)|import\s+['\"]([^'\"]+)['\"]/g;
      for (const match of content.matchAll(importRe)) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (specifier && specifier.startsWith('.') && !resolveRelativeImport(absolutePath, specifier)) {
          unresolvedImports += 1;
        }
      }
    } catch {
      parseFailures += 1;
    }
  }

  const repoIndexPath = path.join(repoRoot, '.playbook', 'repo-index.json');
  const repoIndex = readJsonFile<{ framework?: string; architecture?: string; modules?: Array<{ name: string }> }>(repoIndexPath);
  const detectedModules = Array.isArray(repoIndex?.modules) ? repoIndex.modules.length : 0;

  const coverageScore = eligibleFiles === 0 ? 1 : Number((scannedFiles / eligibleFiles).toFixed(4));
  const unknownAreas: string[] = [];
  if (unsupportedFiles > 0) unknownAreas.push('unsupported-file-types');
  if (skippedFiles > 0) unknownAreas.push('oversized-files');
  if (unresolvedImports > 0) unknownAreas.push('unresolved-imports');
  if (parseFailures > 0) unknownAreas.push('parse-failures');

  const coverageConfidence: 'high' | 'medium' | 'low' = coverageScore >= 0.9 ? 'high' : coverageScore >= 0.6 ? 'medium' : 'low';
  const sampledFileHashes = files
    .filter((filePath) => !filePath.includes(`${path.sep}.playbook${path.sep}runtime${path.sep}`))
    .slice(0, 5)
    .map((filePath) => ({
      path: posixRelative(repoRoot, filePath),
      sha256: hashContent(fs.readFileSync(filePath))
    }));

  return {
    schemaVersion: '1.0',
    cycle_id: cycleId,
    observed_at: observedAt,
    eligible_files: eligibleFiles,
    scanned_files: scannedFiles,
    skipped_files: skippedFiles,
    ignored_files: ignoredFiles,
    unsupported_files: unsupportedFiles,
    binary_files: binaryFiles,
    parse_failures: parseFailures,
    unresolved_imports: unresolvedImports,
    detected_modules: detectedModules,
    unknown_areas: unknownAreas,
    coverage_score: coverageScore,
    coverage_formula: 'coverage_score = scanned_files / eligible_files (eligible_files defaults to 1 when empty)',
    coverage_score_components: {
      numerator_scanned_files: scannedFiles,
      denominator_eligible_files: eligibleFiles === 0 ? 1 : eligibleFiles
    },
    // Observation data records directly measured repository facts.
    observations: {
      file_inventory: {
        total_files_seen: files.length,
        sampled_file_hashes: sampledFileHashes,
        max_scan_bytes: DEFAULT_MAX_SCAN_BYTES,
        expensive_paths: expensivePaths.sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 5)
      },
      dependency_scan: {
        unresolved_relative_imports: unresolvedImports
      }
    },
    // Interpretation data records inferred meaning derived from observations.
    interpretations: {
      framework_inference: repoIndex?.framework ?? 'unknown',
      architecture_inference: repoIndex?.architecture ?? 'unknown',
      coverage_confidence: coverageConfidence
    }
  };
};

const updateCommandHistory = (runtimeRoot: string, command: string, durationMs: number, status: RuntimeCycleStatus, endedAt: string): void => {
  const historyPath = path.join(runtimeRoot, 'history', 'command-stats.json');
  const current = readJsonFile<HistoryCommandStats>(historyPath) ?? { schemaVersion: '1.0', commands: {} };

  const existing = current.commands[command] ?? {
    runs: 0,
    successes: 0,
    failures: 0,
    totalDurationMs: 0,
    averageDurationMs: 0,
    lastRunAt: endedAt
  };

  const nextRuns = existing.runs + 1;
  const totalDurationMs = existing.totalDurationMs + durationMs;

  current.commands[command] = {
    runs: nextRuns,
    successes: existing.successes + (status === 'success' ? 1 : 0),
    failures: existing.failures + (status === 'failure' ? 1 : 0),
    totalDurationMs,
    averageDurationMs: Number((totalDurationMs / nextRuns).toFixed(2)),
    lastRunAt: endedAt
  };

  const sortedCommands = Object.fromEntries(Object.entries(current.commands).sort(([left], [right]) => left.localeCompare(right)));
  writeJsonFile(historyPath, { schemaVersion: '1.0', commands: sortedCommands });
};

const updateCoverageHistory = (runtimeRoot: string, coverage: CoverageArtifact): void => {
  const historyPath = path.join(runtimeRoot, 'history', 'coverage-trend.json');
  const current = readJsonFile<{ schemaVersion: '1.0'; entries: Array<{ cycle_id: string; observed_at: string; coverage_score: number }> }>(historyPath) ?? {
    schemaVersion: '1.0',
    entries: []
  };

  const entries = [...current.entries, { cycle_id: coverage.cycle_id, observed_at: coverage.observed_at, coverage_score: coverage.coverage_score }]
    .slice(-200)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));

  writeJsonFile(historyPath, { schemaVersion: '1.0', entries });
};

const updateAnalyzerHistory = (runtimeRoot: string, endedAt: string): void => {
  const historyPath = path.join(runtimeRoot, 'history', 'analyzer-version-history.json');
  const current = readJsonFile<{
    schemaVersion: '1.0';
    analyzer_contract_version: string;
    runs: number;
    last_seen_at: string;
  }[]>(historyPath) ?? [];

  const existingIndex = current.findIndex((entry) => entry.analyzer_contract_version === ANALYZER_CONTRACT_VERSION);
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    current[existingIndex] = {
      ...existing,
      runs: existing.runs + 1,
      last_seen_at: endedAt
    };
  } else {
    current.push({
      schemaVersion: '1.0',
      analyzer_contract_version: ANALYZER_CONTRACT_VERSION,
      runs: 1,
      last_seen_at: endedAt
    });
  }

  current.sort((a, b) => a.analyzer_contract_version.localeCompare(b.analyzer_contract_version));
  writeJsonFile(historyPath, current);
};

export const beginRuntimeCycle = (input: {
  repoRoot: string;
  triggerCommand: string;
  childCommands: string[];
  playbookVersion: string;
}): RuntimeCycleContext => {
  const cycleId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
  const startedAt = new Date().toISOString();

  return {
    cycleId,
    startedAt,
    repoRoot: input.repoRoot,
    triggerCommand: input.triggerCommand,
    childCommands: input.childCommands,
    playbookVersion: input.playbookVersion
  };
};

export const endRuntimeCycle = (context: RuntimeCycleContext, input: { exitCode: number; durationMs: number; error?: string }): void => {
  const endedAt = new Date().toISOString();
  const status: RuntimeCycleStatus = input.exitCode === 0 ? 'success' : 'failure';
  const runtimeRoot = path.join(context.repoRoot, RUNTIME_ROOT_RELATIVE);

  const coverage = collectCoverage(context.repoRoot, context.cycleId);

  const allCommands = [context.triggerCommand, ...context.childCommands];
  const commandCalls = allCommands.reduce<Record<string, number>>((acc, command) => {
    acc[command] = (acc[command] ?? 0) + 1;
    return acc;
  }, {});
  const repeatedCommandCount = Object.values(commandCalls).reduce((sum, count) => sum + Math.max(0, count - 1), 0);

  const telemetry: TelemetryArtifact = {
    schemaVersion: '1.0',
    cycle_id: context.cycleId,
    command_call_count: allCommands.length,
    command_call_count_by_command: Object.fromEntries(Object.entries(commandCalls).sort(([left], [right]) => left.localeCompare(right))),
    repeated_command_count: repeatedCommandCount,
    command_durations: { [context.triggerCommand]: Number(input.durationMs.toFixed(2)) },
    artifact_cache_hits: fs.existsSync(path.join(context.repoRoot, '.playbook', 'repo-index.json')) ? 1 : 0,
    artifact_cache_misses: fs.existsSync(path.join(context.repoRoot, '.playbook', 'repo-index.json')) ? 0 : 1,
    fallback_usage_counts: {},
    parser_failure_counts: {
      coverage_parse_failures: coverage.parse_failures
    },
    expensive_paths: coverage.observations.file_inventory.expensive_paths,
    warnings_count: coverage.unknown_areas.length,
    failures_count: status === 'failure' ? 1 : 0
  };

  const cycleManifest = {
    schemaVersion: '1.0',
    cycle_id: context.cycleId,
    started_at: context.startedAt,
    ended_at: endedAt,
    repo_root: context.repoRoot,
    trigger_command: context.triggerCommand,
    child_commands: context.childCommands,
    playbook_version: context.playbookVersion,
    analyzer_contract_version: ANALYZER_CONTRACT_VERSION,
    status,
    success: status === 'success',
    failure_reason: input.error,
    artifact_paths_written: [
      '.playbook/runtime/current/coverage.json',
      '.playbook/runtime/current/telemetry.json',
      `.playbook/runtime/cycles/${context.cycleId}/manifest.json`
    ]
  };

  writeJsonFile(path.join(runtimeRoot, 'current', 'coverage.json'), coverage);
  writeJsonFile(path.join(runtimeRoot, 'current', 'telemetry.json'), telemetry);

  const cycleDir = path.join(runtimeRoot, 'cycles', context.cycleId);
  writeJsonFile(path.join(cycleDir, 'manifest.json'), cycleManifest);
  writeJsonFile(path.join(cycleDir, 'coverage.json'), coverage);
  writeJsonFile(path.join(cycleDir, 'telemetry.json'), telemetry);

  updateCommandHistory(runtimeRoot, context.triggerCommand, Number(input.durationMs.toFixed(2)), status, endedAt);
  updateCoverageHistory(runtimeRoot, coverage);
  updateAnalyzerHistory(runtimeRoot, endedAt);
};
