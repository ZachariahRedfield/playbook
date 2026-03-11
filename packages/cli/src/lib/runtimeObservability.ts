import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ANALYZER_CONTRACT_VERSION = '1.0' as const;
const RUNTIME_ROOT_RELATIVE = '.playbook/runtime' as const;
const DEFAULT_MAX_SCAN_BYTES = 1_000_000;

type RuntimeCycleStatus = 'success' | 'failure';
type ScanPathClass = 'vcs-internal' | 'build-cache' | 'generated-report' | 'temporary-file' | 'binary-asset' | 'unknown';
type ScanHandling = 'pruned' | 'ignored' | 'scanned' | 'skipped' | 'unsupported' | 'binary';

type RuntimeCycleContext = {
  cycleId: string;
  startedAt: string;
  repoRoot: string;
  triggerCommand: string;
  childCommands: string[];
  playbookVersion: string;
};

type PathCategory =
  | 'vcs-internal'
  | 'build-cache'
  | 'generated-report'
  | 'binary-asset'
  | 'oversized-source'
  | 'temporary-file'
  | 'user-source'
  | 'unknown';

type ReadStatus = 'found' | 'missing' | 'malformed';

type CoverageArtifact = {
  schemaVersion: '1.0';
  cycle_id: string;
  observed_at: string;
  total_files_seen: number;
  eligible_files: number;
  scanned_files: number;
  skipped_files: number;
  oversized_files: number;
  ignored_files: number;
  unsupported_files: number;
  binary_files: number;
  parse_failures: number;
  parse_failed_files: number;
  unresolved_imports: number;
  detected_modules: number;
  unknown_areas: string[];
  eligible_scan_coverage_score: number;
  repo_visibility_score: number;
  blind_spot_ratio: number;
  coverage_formulas: {
    eligible_scan_coverage_score: string;
    repo_visibility_score: string;
    blind_spot_ratio: string;
  };
  score_components: {
    numerator_scanned_files: number;
    denominator_eligible_files: number;
    numerator_visible_files: number;
    denominator_total_files_seen: number;
    numerator_blind_spot_files: number;
    denominator_total_files_seen_for_blind_spot: number;
  };
  observations: {
    file_inventory: {
      total_files_seen: number;
      sampled_file_hashes: Array<{ path: string; sha256: string }>;
      max_scan_bytes: number;
<<<<<<< HEAD
      expensive_paths: Array<{ path: string; size_bytes: number }>;
      path_class_counts: Record<ScanPathClass, number>;
      pruned_directories: Array<{ path: string; path_class: ScanPathClass; reason: string }>;
      low_value_path_samples: Array<{ path: string; path_class: ScanPathClass; handling: ScanHandling; reason: string }>;
      ignore_candidate_paths: string[];
      expensive_path_classes: Array<{ path_class: ScanPathClass; total_size_bytes: number; file_count: number }>;
=======
      expensive_paths: Array<{ path: string; size_bytes: number; category: PathCategory }>;
      expensive_path_category_counts: Record<PathCategory, number>;
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
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
  trigger_command: string;
  command_call_count: number;
  command_call_count_by_command: Record<string, number>;
  repeated_command_count: number;
  command_durations: Record<string, number>;
  artifact_cache_hits: number;
  artifact_cache_misses: number;
  internal_phase_counts: Record<string, number>;
  artifact_reads: { attempted: number; found: number; missing: number; malformed: number };
  artifact_writes: { total: number; by_artifact: Record<string, number> };
  graph_build_phase_count: number;
  module_extraction_phase_count: number;
  verify_rule_phase_count: number;
  fallback_usage_counts: Record<string, number>;
  ignore_classification_counts: Record<PathCategory, number>;
  expensive_path_category_counts: Record<PathCategory, number>;
  parser_failure_counts: Record<string, number>;
<<<<<<< HEAD
  expensive_paths: Array<{ path: string; size_bytes: number }>;
  expensive_path_classes: Array<{ path_class: ScanPathClass; total_size_bytes: number; file_count: number }>;
  low_value_path_count: number;
=======
  expensive_paths: Array<{ path: string; size_bytes: number; category: PathCategory }>;
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
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

<<<<<<< HEAD
const toPosix = (value: string): string => value.split(path.sep).join(path.posix.sep);

const getPathSegments = (relativePath: string): string[] => toPosix(relativePath).split('/').filter(Boolean);

const isTemporaryFileName = (value: string): boolean => /^tmp($|[_\-.])/i.test(value) || value.toLowerCase().endsWith('.tmp') || value.endsWith('~');

const classifyPath = (relativePath: string, input: { isDirectory: boolean; isBinary: boolean }): ScanPathClass => {
  if (input.isBinary) {
    return 'binary-asset';
  }

  const normalized = toPosix(relativePath).toLowerCase();
  const segments = getPathSegments(relativePath).map((segment) => segment.toLowerCase());
  const directoryName = input.isDirectory ? segments.at(-1) ?? '' : '';
  const fileName = !input.isDirectory ? path.posix.basename(normalized) : '';

  if (segments.includes('.git')) {
    return 'vcs-internal';
  }

  if (normalized.includes('/.next/cache/') || normalized === '.next/cache' || normalized.startsWith('.next/cache/')) {
    return 'build-cache';
  }

  if (segments.includes('playwright-report') || segments.includes('allure-report') || segments.includes('coverage') || segments.includes('reports')) {
    return 'generated-report';
  }

  if (segments.includes('node_modules') || segments.includes('.turbo') || segments.includes('.cache') || segments.includes('.parcel-cache') || segments.includes('.vite') || segments.includes('dist') || segments.includes('build') || segments.includes('out')) {
    return 'build-cache';
  }

  if (directoryName === 'tmp' || directoryName === 'temp' || directoryName === '.tmp' || isTemporaryFileName(fileName)) {
    return 'temporary-file';
  }

  return 'unknown';
};

const shouldPruneDirectory = (relativeDirPath: string, pathClass: ScanPathClass): { prune: boolean; reason: string } => {
  const normalized = toPosix(relativeDirPath).toLowerCase();
  if (normalized === '.playbook' || normalized.startsWith('.playbook/')) {
    return { prune: false, reason: '' };
  }

  if (pathClass === 'vcs-internal') {
    return { prune: true, reason: 'vcs-internal-directory' };
  }

  if (normalized === 'node_modules' || normalized.endsWith('/node_modules')) {
    return { prune: true, reason: 'dependency-cache-directory' };
  }

  if (normalized === '.next/cache' || normalized.startsWith('.next/cache/')) {
    return { prune: true, reason: 'next-build-cache-directory' };
  }

  if (pathClass === 'generated-report') {
    return { prune: true, reason: 'generated-report-directory' };
  }

  if (pathClass === 'temporary-file') {
    return { prune: true, reason: 'temporary-directory' };
  }

  return { prune: false, reason: '' };
=======
const classifyPath = (relativePath: string): PathCategory => {
  const normalized = relativePath.toLowerCase();
  if (normalized.startsWith('.git/')) return 'vcs-internal';
  if (normalized.startsWith('.next/cache/') || normalized.startsWith('node_modules/') || normalized.includes('/.cache/')) return 'build-cache';
  if (normalized.startsWith('playwright-report/') || normalized.startsWith('coverage/') || normalized.endsWith('.lcov')) return 'generated-report';
  if (normalized.includes('/tmp/') || normalized.includes('/temp/') || normalized.startsWith('tmp/') || normalized.startsWith('temp/') || normalized.endsWith('.tmp') || normalized.includes('tmp_file')) {
    return 'temporary-file';
  }
  return 'user-source';
};

const shouldIgnoreDirectory = (relativeDirPath: string): boolean => {
  const normalized = relativeDirPath.split(path.sep).join(path.posix.sep);
  return normalized === '.git' || normalized === 'node_modules';
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
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

type RepoFileEntry = {
  absolutePath: string;
  relativePath: string;
  pathClass: ScanPathClass;
};

type RepoInventory = {
  files: RepoFileEntry[];
  prunedDirectories: Array<{ path: string; path_class: ScanPathClass; reason: string }>;
};

const listRepoFiles = (repoRoot: string): RepoInventory => {
  const files: RepoFileEntry[] = [];
  const prunedDirectories: Array<{ path: string; path_class: ScanPathClass; reason: string }> = [];
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
        const pathClass = classifyPath(relative, { isDirectory: true, isBinary: false });
        const pruningDecision = shouldPruneDirectory(relative, pathClass);
        if (pruningDecision.prune) {
          prunedDirectories.push({ path: relative, path_class: pathClass, reason: pruningDecision.reason });
        } else {
          stack.push(child);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push({
          absolutePath: child,
          relativePath: relative,
          pathClass: classifyPath(relative, { isDirectory: false, isBinary: false })
        });
      }
    }
  }

  files.sort((a, b) => a.absolutePath.localeCompare(b.absolutePath));
  prunedDirectories.sort((a, b) => a.path.localeCompare(b.path));
  return { files, prunedDirectories };
};

const hashContent = (value: Buffer | string): string => crypto.createHash('sha256').update(value).digest('hex');

<<<<<<< HEAD
const emptyPathClassCounts = (): Record<ScanPathClass, number> => ({
  'vcs-internal': 0,
  'build-cache': 0,
  'generated-report': 0,
  'temporary-file': 0,
  'binary-asset': 0,
  unknown: 0
});

const pushLowValueSample = (
  store: Array<{ path: string; path_class: ScanPathClass; handling: ScanHandling; reason: string }>,
  sample: { path: string; path_class: ScanPathClass; handling: ScanHandling; reason: string }
): void => {
  if (store.length >= 25) {
    return;
  }
  store.push(sample);
};

const toIgnoreCandidate = (relativePath: string, pathClass: ScanPathClass, isDirectory: boolean): string | undefined => {
  const normalized = toPosix(relativePath);
  const lower = normalized.toLowerCase();
  const lowerSegments = lower.split('/').filter(Boolean);
  const originalSegments = normalized.split('/').filter(Boolean);

  const pathUntilSegment = (segment: string, includeNext = false): string | undefined => {
    const index = lowerSegments.indexOf(segment);
    if (index < 0) {
      return undefined;
    }
    const endIndex = includeNext ? index + 2 : index + 1;
    const parts = originalSegments.slice(0, Math.min(endIndex, originalSegments.length));
    return parts.length > 0 ? `${parts.join('/')}/` : undefined;
  };

  if (pathClass === 'vcs-internal') {
    return '.git/';
  }

  if (lower === '.next/cache' || lower.startsWith('.next/cache/')) {
    return '.next/cache/';
  }

  if (lower === 'playwright-report' || lower.startsWith('playwright-report/')) {
    return 'playwright-report/';
  }

  if (pathClass === 'generated-report') {
    return pathUntilSegment('playwright-report') ?? pathUntilSegment('allure-report') ?? pathUntilSegment('coverage') ?? pathUntilSegment('reports');
  }

  if (pathClass === 'build-cache') {
    return pathUntilSegment('node_modules') ??
      pathUntilSegment('.turbo') ??
      pathUntilSegment('.cache') ??
      pathUntilSegment('.parcel-cache') ??
      pathUntilSegment('.vite') ??
      pathUntilSegment('.next', true) ??
      pathUntilSegment('dist') ??
      pathUntilSegment('build') ??
      pathUntilSegment('out');
  }

  if (pathClass === 'temporary-file') {
    if (isDirectory) {
      return normalized.endsWith('/') ? normalized : `${normalized}/`;
    }
    return normalized;
  }

  return undefined;
=======
const createCategoryCounter = (): Record<PathCategory, number> => ({
  'vcs-internal': 0,
  'build-cache': 0,
  'generated-report': 0,
  'binary-asset': 0,
  'oversized-source': 0,
  'temporary-file': 0,
  'user-source': 0,
  unknown: 0
});

const trackRead = (target: string): ReadStatus => {
  if (!fs.existsSync(target)) {
    return 'missing';
  }
  try {
    JSON.parse(fs.readFileSync(target, 'utf8'));
    return 'found';
  } catch {
    return 'malformed';
  }
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
};

const collectCoverage = (repoRoot: string, cycleId: string): CoverageArtifact => {
  const observedAt = new Date().toISOString();
  const analyzableExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  const inventory = listRepoFiles(repoRoot);
  const files = inventory.files;

  let scannedFiles = 0;
  let eligibleFiles = 0;
  let oversizedFiles = 0;
  let unsupportedFiles = 0;
  let binaryFiles = 0;
  let parseFailures = 0;
  let unresolvedImports = 0;
  let ignoredFiles = 0;

<<<<<<< HEAD
  const expensivePaths: Array<{ path: string; size_bytes: number }> = [];
  const pathClassCounts = emptyPathClassCounts();
  const lowValuePathSamples: Array<{ path: string; path_class: ScanPathClass; handling: ScanHandling; reason: string }> = [];
  const ignoreCandidatePaths = new Set<string>();
  const expensiveClassStats = new Map<ScanPathClass, { total_size_bytes: number; file_count: number }>();

  for (const file of files) {
    const absolutePath = file.absolutePath;
    const relativePath = file.relativePath;
    const ext = path.extname(absolutePath).toLowerCase();
    const stat = fs.statSync(absolutePath);
    const pathClass = file.pathClass;
    pathClassCounts[pathClass] += 1;
    expensivePaths.push({ path: relativePath, size_bytes: stat.size });
    const currentClassStats = expensiveClassStats.get(pathClass) ?? { total_size_bytes: 0, file_count: 0 };
    currentClassStats.total_size_bytes += stat.size;
    currentClassStats.file_count += 1;
    expensiveClassStats.set(pathClass, currentClassStats);
=======
  const expensivePaths: Array<{ path: string; size_bytes: number; category: PathCategory }> = [];
  const expensivePathCategoryCounts = createCategoryCounter();

  for (const absolutePath of files) {
    const relativePath = posixRelative(repoRoot, absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const stat = fs.statSync(absolutePath);
    let category = classifyPath(relativePath);
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88

    if (absolutePath.includes(`${path.sep}.playbook${path.sep}runtime${path.sep}`)) {
      ignoredFiles += 1;
      pushLowValueSample(lowValuePathSamples, { path: relativePath, path_class: pathClass, handling: 'ignored', reason: 'playbook-runtime-artifact' });
      continue;
    }

    if (pathClass === 'vcs-internal' || pathClass === 'build-cache' || pathClass === 'generated-report' || pathClass === 'temporary-file') {
      ignoredFiles += 1;
      pushLowValueSample(lowValuePathSamples, { path: relativePath, path_class: pathClass, handling: 'ignored', reason: 'classified-low-value-path' });
      const ignoreCandidate = toIgnoreCandidate(relativePath, pathClass, false);
      if (ignoreCandidate) {
        ignoreCandidatePaths.add(ignoreCandidate);
      }
      continue;
    }

    if (isLikelyBinary(absolutePath)) {
      binaryFiles += 1;
<<<<<<< HEAD
      if (pathClass !== 'binary-asset') {
        pathClassCounts[pathClass] = Math.max(0, pathClassCounts[pathClass] - 1);
      }
      pathClassCounts['binary-asset'] += 1;
      pushLowValueSample(lowValuePathSamples, { path: relativePath, path_class: 'binary-asset', handling: 'binary', reason: 'contains-nul-byte' });
=======
      category = 'binary-asset';
      expensivePathCategoryCounts[category] += 1;
      expensivePaths.push({ path: relativePath, size_bytes: stat.size, category });
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
      continue;
    }

    if (!analyzableExtensions.has(ext)) {
      unsupportedFiles += 1;
<<<<<<< HEAD
      pushLowValueSample(lowValuePathSamples, { path: relativePath, path_class: pathClass, handling: 'unsupported', reason: 'unsupported-extension' });
=======
      expensivePathCategoryCounts[category] += 1;
      expensivePaths.push({ path: relativePath, size_bytes: stat.size, category });
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
      continue;
    }

    eligibleFiles += 1;

    if (stat.size > DEFAULT_MAX_SCAN_BYTES) {
<<<<<<< HEAD
      skippedFiles += 1;
      pushLowValueSample(lowValuePathSamples, { path: relativePath, path_class: pathClass, handling: 'skipped', reason: 'oversized-file' });
=======
      oversizedFiles += 1;
      category = 'oversized-source';
      expensivePathCategoryCounts[category] += 1;
      expensivePaths.push({ path: relativePath, size_bytes: stat.size, category });
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
      continue;
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf8');
      scannedFiles += 1;
<<<<<<< HEAD
      pushLowValueSample(lowValuePathSamples, { path: relativePath, path_class: pathClass, handling: 'scanned', reason: 'analyzable-source-file' });
=======
      expensivePathCategoryCounts[category] += 1;
      expensivePaths.push({ path: relativePath, size_bytes: stat.size, category });
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
      const importRe = /from\s+['\"]([^'\"]+)['\"]|import\(['\"]([^'\"]+)['\"]\)|import\s+['\"]([^'\"]+)['\"]/g;
      for (const match of content.matchAll(importRe)) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (specifier && specifier.startsWith('.') && !resolveRelativeImport(absolutePath, specifier)) {
          unresolvedImports += 1;
        }
      }
    } catch {
      parseFailures += 1;
      expensivePathCategoryCounts[category] += 1;
      expensivePaths.push({ path: relativePath, size_bytes: stat.size, category });
    }
  }

  const repoIndexPath = path.join(repoRoot, '.playbook', 'repo-index.json');
  const repoIndex = readJsonFile<{ framework?: string; architecture?: string; modules?: Array<{ name: string }> }>(repoIndexPath);
  const detectedModules = Array.isArray(repoIndex?.modules) ? repoIndex.modules.length : 0;

  const denominatorEligible = eligibleFiles === 0 ? 1 : eligibleFiles;
  const denominatorTotal = files.length === 0 ? 1 : files.length;
  const blindSpotFiles = unsupportedFiles + binaryFiles + oversizedFiles + parseFailures + ignoredFiles;

  const eligibleScanCoverageScore = Number((scannedFiles / denominatorEligible).toFixed(4));
  const repoVisibilityScore = Number(((files.length - blindSpotFiles) / denominatorTotal).toFixed(4));
  const blindSpotRatio = Number((blindSpotFiles / denominatorTotal).toFixed(4));

  const unknownAreas: string[] = [];
  if (unsupportedFiles > 0) unknownAreas.push('unsupported-file-types');
  if (oversizedFiles > 0) unknownAreas.push('oversized-files');
  if (unresolvedImports > 0) unknownAreas.push('unresolved-imports');
<<<<<<< HEAD
  if (parseFailures > 0) unknownAreas.push('parse-failures');
  if (ignoredFiles > 0 || inventory.prunedDirectories.length > 0) unknownAreas.push('classified-low-value-paths');
=======
  if (binaryFiles > 0) unknownAreas.push('binary-assets');
  if (parseFailures > 0) unknownAreas.push('parse-failed-files');
  if (expensivePathCategoryCounts['vcs-internal'] > 0) unknownAreas.push('vcs-internal-paths');
  if (expensivePathCategoryCounts['generated-report'] > 0) unknownAreas.push('generated-reports');
  if (expensivePathCategoryCounts['temporary-file'] > 0) unknownAreas.push('temporary-files');
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88

  const coverageConfidence: 'high' | 'medium' | 'low' = repoVisibilityScore >= 0.9 ? 'high' : repoVisibilityScore >= 0.6 ? 'medium' : 'low';
  const sampledFileHashes = files
    .filter((fileEntry) => !fileEntry.absolutePath.includes(`${path.sep}.playbook${path.sep}runtime${path.sep}`))
    .slice(0, 5)
    .map((fileEntry) => ({
      path: fileEntry.relativePath,
      sha256: hashContent(fs.readFileSync(fileEntry.absolutePath))
    }));
  for (const entry of inventory.prunedDirectories) {
    pushLowValueSample(lowValuePathSamples, { path: entry.path, path_class: entry.path_class, handling: 'pruned', reason: entry.reason });
    const ignoreCandidate = toIgnoreCandidate(entry.path, entry.path_class, true);
    if (ignoreCandidate) {
      ignoreCandidatePaths.add(ignoreCandidate);
    }
  }

  const expensivePathClasses = Array.from(expensiveClassStats.entries())
    .map(([pathClass, stats]) => ({
      path_class: pathClass,
      total_size_bytes: stats.total_size_bytes,
      file_count: stats.file_count
    }))
    .sort((left, right) => right.total_size_bytes - left.total_size_bytes)
    .slice(0, 5);

  return {
    schemaVersion: '1.0',
    cycle_id: cycleId,
    observed_at: observedAt,
    total_files_seen: files.length,
    eligible_files: eligibleFiles,
    scanned_files: scannedFiles,
    skipped_files: oversizedFiles,
    oversized_files: oversizedFiles,
    ignored_files: ignoredFiles,
    unsupported_files: unsupportedFiles,
    binary_files: binaryFiles,
    parse_failures: parseFailures,
    parse_failed_files: parseFailures,
    unresolved_imports: unresolvedImports,
    detected_modules: detectedModules,
    unknown_areas: unknownAreas,
    eligible_scan_coverage_score: eligibleScanCoverageScore,
    repo_visibility_score: repoVisibilityScore,
    blind_spot_ratio: blindSpotRatio,
    coverage_formulas: {
      eligible_scan_coverage_score: 'eligible_scan_coverage_score = scanned_files / eligible_files (eligible_files defaults to 1 when empty)',
      repo_visibility_score: 'repo_visibility_score = (total_files_seen - blind_spot_files) / total_files_seen (total_files_seen defaults to 1 when empty)',
      blind_spot_ratio: 'blind_spot_ratio = blind_spot_files / total_files_seen (total_files_seen defaults to 1 when empty)'
    },
    score_components: {
      numerator_scanned_files: scannedFiles,
      denominator_eligible_files: denominatorEligible,
      numerator_visible_files: files.length - blindSpotFiles,
      denominator_total_files_seen: denominatorTotal,
      numerator_blind_spot_files: blindSpotFiles,
      denominator_total_files_seen_for_blind_spot: denominatorTotal
    },
    observations: {
      file_inventory: {
        total_files_seen: files.length,
        sampled_file_hashes: sampledFileHashes,
        max_scan_bytes: DEFAULT_MAX_SCAN_BYTES,
        expensive_paths: expensivePaths.sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 5),
<<<<<<< HEAD
        path_class_counts: pathClassCounts,
        pruned_directories: inventory.prunedDirectories,
        low_value_path_samples: lowValuePathSamples,
        ignore_candidate_paths: Array.from(ignoreCandidatePaths).sort((a, b) => a.localeCompare(b)),
        expensive_path_classes: expensivePathClasses
=======
        expensive_path_category_counts: expensivePathCategoryCounts
>>>>>>> e7e6212fdfca535a8bea181c1e417bbc752efb88
      },
      dependency_scan: {
        unresolved_relative_imports: unresolvedImports
      }
    },
    interpretations: {
      framework_inference: repoIndex?.framework ?? 'unknown',
      architecture_inference: repoIndex?.architecture ?? 'unknown',
      coverage_confidence: coverageConfidence
    }
  };
};

const enrichPilotSummaryWithRuntimeSignals = (repoRoot: string, coverage: CoverageArtifact): void => {
  const pilotSummaryPath = path.join(repoRoot, '.playbook', 'pilot-summary.json');
  if (!fs.existsSync(pilotSummaryPath)) {
    return;
  }

  const parsed = readJsonFile<Record<string, unknown>>(pilotSummaryPath);
  if (!parsed || parsed.command !== 'pilot') {
    return;
  }

  const enrichedSummary = {
    ...parsed,
    scanWasteCandidates: coverage.observations.file_inventory.ignore_candidate_paths.slice(0, 10),
    topExpensivePathClasses: coverage.observations.file_inventory.expensive_path_classes,
    lowValuePathHandling: {
      ignored_files: coverage.ignored_files,
      pruned_directories: coverage.observations.file_inventory.pruned_directories.length
    }
  };

  writeJsonFile(pilotSummaryPath, enrichedSummary);
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
  const current = readJsonFile<{ schemaVersion: '1.0'; entries: Array<{ cycle_id: string; observed_at: string; eligible_scan_coverage_score: number; repo_visibility_score: number; blind_spot_ratio: number }> }>(historyPath) ?? {
    schemaVersion: '1.0',
    entries: []
  };

  const entries = [
    ...current.entries,
    {
      cycle_id: coverage.cycle_id,
      observed_at: coverage.observed_at,
      eligible_scan_coverage_score: coverage.eligible_scan_coverage_score,
      repo_visibility_score: coverage.repo_visibility_score,
      blind_spot_ratio: coverage.blind_spot_ratio
    }
  ]
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

  const readTargets = [path.join(context.repoRoot, '.playbook', 'repo-index.json'), path.join(runtimeRoot, 'history', 'command-stats.json'), path.join(runtimeRoot, 'history', 'coverage-trend.json')];
  const readStatuses = readTargets.map(trackRead);
  const artifactReads = {
    attempted: readTargets.length,
    found: readStatuses.filter((status) => status === 'found').length,
    missing: readStatuses.filter((status) => status === 'missing').length,
    malformed: readStatuses.filter((status) => status === 'malformed').length
  };

  const internalPhaseCounts = {
    coverage_collection: 1,
    dependency_scan: 1,
    history_update: 3,
    cycle_manifest_write: 1
  };

  const artifactWrites = {
    total: 6,
    by_artifact: {
      'runtime/current/coverage': 1,
      'runtime/current/telemetry': 1,
      'runtime/cycle/manifest': 1,
      'runtime/cycle/coverage': 1,
      'runtime/cycle/telemetry': 1,
      'runtime/history-rollups': 1
    }
  };

  const telemetry: TelemetryArtifact = {
    schemaVersion: '1.0',
    cycle_id: context.cycleId,
    trigger_command: context.triggerCommand,
    command_call_count: allCommands.length,
    command_call_count_by_command: Object.fromEntries(Object.entries(commandCalls).sort(([left], [right]) => left.localeCompare(right))),
    repeated_command_count: repeatedCommandCount,
    command_durations: { [context.triggerCommand]: Number(input.durationMs.toFixed(2)) },
    artifact_cache_hits: fs.existsSync(path.join(context.repoRoot, '.playbook', 'repo-index.json')) ? 1 : 0,
    artifact_cache_misses: fs.existsSync(path.join(context.repoRoot, '.playbook', 'repo-index.json')) ? 0 : 1,
    internal_phase_counts: internalPhaseCounts,
    artifact_reads: artifactReads,
    artifact_writes: artifactWrites,
    graph_build_phase_count: context.triggerCommand === 'index' ? 1 : 0,
    module_extraction_phase_count: context.triggerCommand === 'index' ? 1 : 0,
    verify_rule_phase_count: context.triggerCommand === 'verify' ? 1 : 0,
    fallback_usage_counts: {
      coverage_denominator_defaulted: coverage.eligible_files === 0 ? 1 : 0,
      total_files_denominator_defaulted: coverage.total_files_seen === 0 ? 1 : 0
    },
    ignore_classification_counts: coverage.observations.file_inventory.expensive_path_category_counts,
    expensive_path_category_counts: coverage.observations.file_inventory.expensive_path_category_counts,
    parser_failure_counts: {
      coverage_parse_failures: coverage.parse_failures
    },
    expensive_paths: coverage.observations.file_inventory.expensive_paths,
    expensive_path_classes: coverage.observations.file_inventory.expensive_path_classes,
    low_value_path_count: coverage.ignored_files + coverage.observations.file_inventory.pruned_directories.length,
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

  if (context.triggerCommand === 'pilot') {
    enrichPilotSummaryWithRuntimeSignals(context.repoRoot, coverage);
  }

  updateCommandHistory(runtimeRoot, context.triggerCommand, Number(input.durationMs.toFixed(2)), status, endedAt);
  updateCoverageHistory(runtimeRoot, coverage);
  updateAnalyzerHistory(runtimeRoot, endedAt);
};
