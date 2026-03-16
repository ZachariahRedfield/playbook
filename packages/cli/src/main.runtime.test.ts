import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';


const scriptPath = path.resolve(process.cwd(), '..', '..', 'scripts', 'run-playbook.mjs');
const tempRoots: string[] = [];

const createTempRoot = (prefix: string): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
};

describe('runtime observability artifacts', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('writes current, cycle, and history runtime artifacts for target repos', { timeout: 15000 }, () => {
    const tempRoot = createTempRoot('playbook-runtime-observability-');
    const targetRepo = path.join(tempRoot, 'consumer-repo');
    fs.mkdirSync(path.join(targetRepo, 'src', 'feature'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'package.json'), JSON.stringify({ name: 'consumer', version: '0.0.1' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'src', 'index.ts'), 'import { x } from "./feature/missing";\nexport const ok = true;\n', 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'README.md'), '# consumer\n', 'utf8');


    execFileSync('node', [scriptPath, '--repo', targetRepo, 'index', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const runtimeRoot = path.join(targetRepo, '.playbook', 'runtime');
    const coveragePath = path.join(runtimeRoot, 'current', 'coverage.json');
    const telemetryPath = path.join(runtimeRoot, 'current', 'telemetry.json');

    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8')) as {
      cycle_id: string;
      eligible_files: number;
      scanned_files: number;
      unresolved_imports: number;
      eligible_scan_coverage_score: number;
      repo_visibility_score: number;
      blind_spot_ratio: number;
      score_components: { numerator_scanned_files: number; denominator_eligible_files: number };
      observations: { file_inventory: { total_files_seen: number; sampled_file_hashes: Array<{ path: string; sha256: string }> } };
      interpretations: { framework_inference: string };
    };
    const telemetry = JSON.parse(fs.readFileSync(telemetryPath, 'utf8')) as {
      cycle_id: string;
      command_call_count: number;
      command_call_count_by_command: Record<string, number>;
    };

    expect(coverage.cycle_id).toBe(telemetry.cycle_id);
    expect(coverage.eligible_files).toBeGreaterThan(0);
    expect(coverage.scanned_files).toBeGreaterThan(0);
    expect(coverage.unresolved_imports).toBeGreaterThan(0);
    expect(coverage.eligible_scan_coverage_score).toBeGreaterThan(0);
    expect(coverage.repo_visibility_score).toBeGreaterThan(0);
    expect(coverage.blind_spot_ratio).toBeGreaterThanOrEqual(0);
    expect(coverage.score_components.numerator_scanned_files).toBe(coverage.scanned_files);
    expect(coverage.score_components.denominator_eligible_files).toBeGreaterThan(0);
    expect(coverage.observations.file_inventory.total_files_seen).toBeGreaterThan(0);
    expect(coverage.observations.file_inventory.sampled_file_hashes.length).toBeGreaterThan(0);
    expect(coverage.interpretations.framework_inference).toBe('node');

    expect(telemetry.command_call_count).toBe(1);
    expect(telemetry.command_call_count_by_command.index).toBe(1);

    const cycleManifestPath = path.join(runtimeRoot, 'cycles', coverage.cycle_id, 'manifest.json');
    const cycleManifest = JSON.parse(fs.readFileSync(cycleManifestPath, 'utf8')) as {
      trigger_command: string;
      status: string;
      artifact_paths_written: string[];
    };

    expect(cycleManifest.trigger_command).toBe('index');
    expect(cycleManifest.status).toBe('success');
    expect(cycleManifest.artifact_paths_written).toContain('.playbook/runtime/current/coverage.json');

    execFileSync('node', [scriptPath, '--repo', targetRepo, 'index', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const commandStatsPath = path.join(runtimeRoot, 'history', 'command-stats.json');
    const coverageTrendPath = path.join(runtimeRoot, 'history', 'coverage-trend.json');
    const analyzerHistoryPath = path.join(runtimeRoot, 'history', 'analyzer-version-history.json');

    const commandStats = JSON.parse(fs.readFileSync(commandStatsPath, 'utf8')) as {
      commands: { index: { runs: number } };
    };
    const coverageTrend = JSON.parse(fs.readFileSync(coverageTrendPath, 'utf8')) as {
      entries: Array<{ cycle_id: string; eligible_scan_coverage_score: number; repo_visibility_score: number; blind_spot_ratio: number }>;
    };
    const analyzerHistory = JSON.parse(fs.readFileSync(analyzerHistoryPath, 'utf8')) as Array<{ runs: number; analyzer_contract_version: string }>;

    expect(commandStats.commands.index.runs).toBeGreaterThanOrEqual(2);
    expect(coverageTrend.entries.length).toBeGreaterThanOrEqual(2);
    expect(analyzerHistory.find((entry) => entry.analyzer_contract_version === '1.0')?.runs).toBeGreaterThanOrEqual(2);
  });

  it('records pilot as one top-level cycle with child phases', () => {
    const tempRoot = createTempRoot('playbook-pilot-runtime-');
    const targetRepo = path.join(tempRoot, 'pilot-target');
    fs.mkdirSync(path.join(targetRepo, 'src', 'features'), { recursive: true });
    fs.writeFileSync(
      path.join(targetRepo, 'package.json'),
      JSON.stringify({ name: 'pilot-target', version: '0.0.1', scripts: { test: 'echo ok' } }, null, 2),
      'utf8'
    );
    fs.writeFileSync(path.join(targetRepo, 'src', 'features', 'index.ts'), 'export const ready = true;\n', 'utf8');
    fs.mkdirSync(path.join(targetRepo, '.next', 'cache', 'webpack'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, '.next', 'cache', 'webpack', 'state.pack'), 'cached-build-output\n', 'utf8');
    fs.mkdirSync(path.join(targetRepo, 'playwright-report'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'playwright-report', 'index.html'), '<html>report</html>\n', 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'tmp_file.txt'), 'temporary output\n', 'utf8');

    const pilotRaw = execFileSync('node', [scriptPath, 'pilot', '--repo', targetRepo, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    const pilotSummary = JSON.parse(pilotRaw.slice(pilotRaw.indexOf('{'))) as {
      command: string;
      artifactPathsWritten: string[];
    };

    expect(pilotSummary.command).toBe('pilot');
    expect(pilotSummary.artifactPathsWritten).toContain('.playbook/findings.json');
    expect(pilotSummary.artifactPathsWritten).toContain('.playbook/plan.json');

    const runtimeRoot = path.join(targetRepo, '.playbook', 'runtime');
    const coverage = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'current', 'coverage.json'), 'utf8')) as { cycle_id: string };
    const telemetry = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'current', 'telemetry.json'), 'utf8')) as {
      cycle_id: string;
      command_call_count: number;
      command_call_count_by_command: Record<string, number>;
    };
    const manifest = JSON.parse(
      fs.readFileSync(path.join(runtimeRoot, 'cycles', coverage.cycle_id, 'manifest.json'), 'utf8')
    ) as {
      trigger_command: string;
      child_commands: string[];
    };

    expect(telemetry.cycle_id).toBe(coverage.cycle_id);
    expect(manifest.trigger_command).toBe('pilot');
    expect(manifest.child_commands).toEqual(['context', 'index', 'query modules', 'verify', 'plan']);
    expect(telemetry.command_call_count).toBe(6);
    expect(telemetry.command_call_count_by_command.pilot).toBe(1);
    expect(telemetry.command_call_count_by_command.context).toBe(1);
    expect(telemetry.command_call_count_by_command.index).toBe(1);
    expect(telemetry.command_call_count_by_command['query modules']).toBe(1);
    expect(telemetry.command_call_count_by_command.verify).toBe(1);
    expect(telemetry.command_call_count_by_command.plan).toBe(1);

    const summaryFile = JSON.parse(
      fs.readFileSync(path.join(targetRepo, '.playbook', 'pilot-summary.json'), 'utf8')
    ) as {
      scanWasteCandidates?: string[];
      topExpensivePathClasses?: Array<{ path_class: string }>;
      lowValuePathHandling?: { ignored_files: number; pruned_directories: number };
    };
    expect(summaryFile.scanWasteCandidates).toEqual(expect.arrayContaining(['.next/cache/', 'playwright-report/']));
    expect(summaryFile.topExpensivePathClasses?.length ?? 0).toBeGreaterThan(0);
    expect(summaryFile.lowValuePathHandling?.ignored_files ?? 0).toBeGreaterThan(0);
  });

  it('classifies low-value paths and exposes ignore candidates in coverage artifacts', () => {
    const tempRoot = createTempRoot('playbook-runtime-boundary-');
    const targetRepo = path.join(tempRoot, 'consumer-repo');
    fs.mkdirSync(path.join(targetRepo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'package.json'), JSON.stringify({ name: 'consumer', version: '0.0.1' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');
    fs.mkdirSync(path.join(targetRepo, 'nested', '.git', 'objects', 'pack'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'nested', '.git', 'objects', 'pack', 'pack.dat'), 'pack', 'utf8');
    fs.mkdirSync(path.join(targetRepo, '.next', 'cache', 'webpack'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, '.next', 'cache', 'webpack', 'state.pack'), 'cache', 'utf8');
    fs.mkdirSync(path.join(targetRepo, 'playwright-report'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'playwright-report', 'index.html'), '<html/>', 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'tmp_file.txt'), 'tmp', 'utf8');

    execFileSync('node', [scriptPath, '--repo', targetRepo, 'index', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const coverage = JSON.parse(
      fs.readFileSync(path.join(targetRepo, '.playbook', 'runtime', 'current', 'coverage.json'), 'utf8')
    ) as {
      unknown_areas: string[];
      observations: {
        file_inventory: {
          pruned_directories: Array<{ path: string; path_class: string }>;
          ignore_candidate_paths: string[];
          path_class_counts: Record<string, number>;
        };
      };
    };

    expect(coverage.unknown_areas).toContain('classified-low-value-paths');
    expect(coverage.observations.file_inventory.pruned_directories.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(['.next/cache', 'nested/.git', 'playwright-report'])
    );
    expect(coverage.observations.file_inventory.pruned_directories.map((entry) => entry.path_class)).toEqual(
      expect.arrayContaining(['build-cache', 'vcs-internal', 'generated-report'])
    );
    expect(coverage.observations.file_inventory.ignore_candidate_paths).toEqual(
      expect.arrayContaining(['.git/', '.next/cache/', 'playwright-report/', 'tmp_file.txt'])
    );
    expect(coverage.observations.file_inventory.path_class_counts.unknown).toBeGreaterThan(0);
  });

  it('honors explicit .playbookignore entries when collecting runtime coverage', () => {
    const tempRoot = createTempRoot('playbook-runtime-ignore-');
    const targetRepo = path.join(tempRoot, 'consumer-repo');
    fs.mkdirSync(path.join(targetRepo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'package.json'), JSON.stringify({ name: 'consumer', version: '0.0.1' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');
    fs.mkdirSync(path.join(targetRepo, 'playwright-report'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'playwright-report', 'index.html'), '<html/>', 'utf8');
    fs.writeFileSync(path.join(targetRepo, '.playbookignore'), 'playwright-report/\n', 'utf8');

    execFileSync('node', [scriptPath, '--repo', targetRepo, 'index', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const coverage = JSON.parse(
      fs.readFileSync(path.join(targetRepo, '.playbook', 'runtime', 'current', 'coverage.json'), 'utf8')
    ) as {
      observations: {
        file_inventory: {
          pruned_directories: Array<{ path: string; reason: string }>;
          ignore_candidate_paths: string[];
        };
      };
    };

    expect(coverage.observations.file_inventory.pruned_directories).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'playwright-report', reason: 'playbookignore-rule' })])
    );
    expect(coverage.observations.file_inventory.ignore_candidate_paths).not.toContain('playwright-report/');
  });

  it('normalizes nested wrapper recommendation paths for runtime artifacts and pilot summary', () => {
    const tempRoot = createTempRoot('playbook-runtime-wrapper-');
    const targetRepo = path.join(tempRoot, 'nat1-games');
    const wrapperRoot = path.join(targetRepo, 'nat1-games');
    fs.mkdirSync(path.join(wrapperRoot, 'playwright-report'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'package.json'), JSON.stringify({ name: 'nat1-games', version: '0.0.1' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(wrapperRoot, 'package.json'), JSON.stringify({ name: 'nat1-games', version: '0.0.1' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(wrapperRoot, 'playwright-report', 'index.html'), '<html>report</html>\n', 'utf8');
    fs.writeFileSync(path.join(wrapperRoot, 'tmp_file.txt'), 'temporary output\n', 'utf8');
    fs.writeFileSync(path.join(wrapperRoot, 'tmp_patch.diff'), 'tmp patch diff\n', 'utf8');

    execFileSync('node', [scriptPath, 'pilot', '--repo', targetRepo, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const runtimeRoot = path.join(targetRepo, '.playbook', 'runtime');
    const coverage = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'current', 'coverage.json'), 'utf8')) as {
      observations: {
        file_inventory: {
          ignore_candidate_paths: string[];
        };
      };
    };
    const recommendations = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'current', 'ignore-recommendations.json'), 'utf8')) as {
      recommendations: Array<{ path: string }>;
    };
    const summaryFile = JSON.parse(fs.readFileSync(path.join(targetRepo, '.playbook', 'pilot-summary.json'), 'utf8')) as {
      scanWasteCandidates?: string[];
    };

    expect(coverage.observations.file_inventory.ignore_candidate_paths).toEqual(
      expect.arrayContaining(['playwright-report/', 'tmp_file.txt', 'tmp_patch.diff'])
    );
    expect(coverage.observations.file_inventory.ignore_candidate_paths).not.toEqual(
      expect.arrayContaining(['nat1-games/playwright-report/', 'nat1-games/tmp_file.txt', 'nat1-games/tmp_patch.diff'])
    );

    expect(recommendations.recommendations.map((entry) => entry.path)).toEqual(
      expect.not.arrayContaining(['nat1-games/playwright-report/', 'nat1-games/tmp_file.txt', 'nat1-games/tmp_patch.diff'])
    );
    expect(recommendations.recommendations.find((entry) => entry.path === 'playwright-report/')?.path).toBe('playwright-report/');

    expect(summaryFile.scanWasteCandidates).toEqual(expect.not.arrayContaining(['nat1-games/playwright-report/', 'nat1-games/tmp_file.txt', 'nat1-games/tmp_patch.diff']));
    expect(summaryFile.scanWasteCandidates).toEqual(expect.arrayContaining(['playwright-report/', 'tmp_file.txt']));
  });
});
