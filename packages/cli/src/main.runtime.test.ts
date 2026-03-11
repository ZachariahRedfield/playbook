import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('runtime observability artifacts', () => {
  it('writes current, cycle, and history runtime artifacts for target repos', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-runtime-observability-'));
    const targetRepo = path.join(tempRoot, 'consumer-repo');
    fs.mkdirSync(path.join(targetRepo, 'src', 'feature'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'package.json'), JSON.stringify({ name: 'consumer', version: '0.0.1' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'src', 'index.ts'), 'import { x } from "./feature/missing";\nexport const ok = true;\n', 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'README.md'), '# consumer\n', 'utf8');

    const scriptPath = path.resolve(process.cwd(), '..', '..', 'scripts', 'run-playbook.mjs');

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


  it('writes runtime artifacts under pilot --repo target when repo is passed as command option', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pilot-runtime-'));
    const targetRepo = path.join(tempRoot, 'pilot-target');
    fs.mkdirSync(path.join(targetRepo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(targetRepo, 'package.json'), JSON.stringify({ name: 'pilot-target', version: '0.0.1' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(targetRepo, 'src', 'index.ts'), `export const ok = true;\n`, 'utf8');

    const scriptPath = path.resolve(process.cwd(), '..', '..', 'scripts', 'run-playbook.mjs');

    execFileSync('node', [scriptPath, 'pilot', '--repo', targetRepo, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const runtimeRoot = path.join(targetRepo, '.playbook', 'runtime');
    const telemetryPath = path.join(runtimeRoot, 'current', 'telemetry.json');
    const coveragePath = path.join(runtimeRoot, 'current', 'coverage.json');

    const telemetry = JSON.parse(fs.readFileSync(telemetryPath, 'utf8')) as {
      trigger_command: string;
      command_call_count_by_command: Record<string, number>;
    };

    expect(() => JSON.parse(fs.readFileSync(coveragePath, 'utf8'))).not.toThrow();
    expect(telemetry.trigger_command).toBe('pilot');
    expect(telemetry.command_call_count_by_command.pilot).toBe(1);
  });
});
