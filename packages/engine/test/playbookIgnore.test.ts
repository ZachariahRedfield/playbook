import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applySafePlaybookIgnoreRecommendations,
  suggestPlaybookIgnore
} from '../src/index.js';

const createRepo = (): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-ignore-'));
  fs.mkdirSync(path.join(repo, '.playbook', 'runtime', 'current'), { recursive: true });
  return repo;
};

type RecommendationFixture = {
  path: string;
  class: string;
  safety_level: 'safe-default' | 'likely-safe' | 'review-first';
  confidence: number;
  estimated_files_reduced: number;
  estimated_bytes_reduced: number;
  impact_level: 'low' | 'medium' | 'high';
};

const writeRecommendations = (repo: string, recommendations: RecommendationFixture[] = []): void => {
  const rankedRecommendations =
    recommendations.length > 0
      ? recommendations
      : [
          {
            path: '.git/',
            class: 'vcs-internal',
            safety_level: 'safe-default',
            confidence: 0.99,
            estimated_files_reduced: 1,
            estimated_bytes_reduced: 1,
            impact_level: 'low'
          },
          {
            path: 'node_modules/',
            class: 'build-cache',
            safety_level: 'safe-default',
            confidence: 0.99,
            estimated_files_reduced: 10,
            estimated_bytes_reduced: 10,
            impact_level: 'medium'
          },
          {
            path: 'tmp_file.txt',
            class: 'temporary-file',
            safety_level: 'review-first',
            confidence: 0.61,
            estimated_files_reduced: 1,
            estimated_bytes_reduced: 1,
            impact_level: 'low'
          }
        ];

  fs.writeFileSync(
    path.join(repo, '.playbook', 'runtime', 'current', 'ignore-recommendations.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        cycle_id: 'cycle-1',
        generated_at: '2026-03-11T00:00:00.000Z',
        recommendation_model: 'deterministic-v1',
        ranking_factors: ['rank'],
        recommendations: rankedRecommendations.map((entry, index) => ({
          path: entry.path,
          rank: index + 1,
          class: entry.class,
          rationale: 'test',
          confidence: entry.confidence,
          expected_scan_impact: {
            estimated_files_reduced: entry.estimated_files_reduced,
            estimated_bytes_reduced: entry.estimated_bytes_reduced,
            impact_level: entry.impact_level
          },
          safety_level: entry.safety_level
        })),
        summary: {
          total_recommendations: rankedRecommendations.length,
          safety_level_counts: {
            'safe-default': rankedRecommendations.filter((entry) => entry.safety_level === 'safe-default').length,
            'likely-safe': rankedRecommendations.filter((entry) => entry.safety_level === 'likely-safe').length,
            'review-first': rankedRecommendations.filter((entry) => entry.safety_level === 'review-first').length
          },
          class_counts: {
            'vcs-internal': 1,
            'build-cache': 1,
            'generated-report': 0,
            'temporary-file': 1,
            'binary-asset': 0,
            unknown: 0
          }
        }
      },
      null,
      2
    ),
    'utf8'
    );
};

describe('playbook ignore workflow', () => {
  it('reports recommendation coverage from .playbookignore', () => {
    const repo = createRepo();
    writeRecommendations(repo);
    fs.writeFileSync(path.join(repo, '.playbookignore'), 'node_modules/\n', 'utf8');

    const result = suggestPlaybookIgnore(repo);

    expect(result.recommendations.find((entry) => entry.path === 'node_modules/')?.already_covered).toBe(true);
    expect(result.recommendations.find((entry) => entry.path === '.git/')?.already_covered).toBe(false);
    expect(result.review_required.map((entry) => entry.path)).toContain('tmp_file.txt');
  });

  it('creates a managed block with only missing safe-default entries and remains idempotent', () => {
    const repo = createRepo();
    writeRecommendations(repo);
    fs.writeFileSync(path.join(repo, '.playbookignore'), 'coverage/\nnode_modules/\n', 'utf8');

    const first = applySafePlaybookIgnoreRecommendations(repo);
    const firstContent = fs.readFileSync(path.join(repo, '.playbookignore'), 'utf8');
    const second = applySafePlaybookIgnoreRecommendations(repo);
    const secondContent = fs.readFileSync(path.join(repo, '.playbookignore'), 'utf8');

    expect(first.changed).toBe(true);
    expect(first.applied_entries).toEqual(['.git/']);
    expect(first.already_covered_entries).toEqual(['node_modules/']);
    expect(first.deferred_entries).toEqual(['tmp_file.txt']);
    expect(firstContent).toContain('# PLAYBOOK:IGNORE_START');
    expect(firstContent).toContain('.git/');
    expect(firstContent).not.toContain('tmp_file.txt');
    expect(second.changed).toBe(false);
    expect(secondContent).toBe(firstContent);
  });

  it('normalizes legacy nested-repo recommendation paths during suggest', () => {
    const repo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-ignore-nested-')), 'nat1-games');
    fs.mkdirSync(path.join(repo, '.playbook', 'runtime', 'current'), { recursive: true });
    writeRecommendations(repo, [
      { path: 'nat1-games/.git/', class: 'vcs-internal', safety_level: 'safe-default', confidence: 0.99, estimated_files_reduced: 1, estimated_bytes_reduced: 1, impact_level: 'low' },
      { path: 'nat1-games/playwright-report/', class: 'generated-report', safety_level: 'safe-default', confidence: 0.98, estimated_files_reduced: 2, estimated_bytes_reduced: 2, impact_level: 'low' },
      { path: 'nat1-games/tmp_file.txt', class: 'temporary-file', safety_level: 'review-first', confidence: 0.61, estimated_files_reduced: 1, estimated_bytes_reduced: 1, impact_level: 'low' }
    ]);

    fs.writeFileSync(path.join(repo, '.playbookignore'), 'playwright-report/\n', 'utf8');

    const result = suggestPlaybookIgnore(repo);

    expect(result.recommendations.map((entry) => entry.path)).toEqual(['.git/', 'playwright-report/', 'tmp_file.txt']);
    expect(result.recommendations.find((entry) => entry.path === 'playwright-report/')?.already_covered).toBe(true);
    expect(result.recommendations.find((entry) => entry.path === '.git/')?.already_covered).toBe(false);
  });

  it('deduplicates legacy-prefixed and normalized managed entries', () => {
    const repo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-ignore-legacy-manifest-')), 'nat1-games');
    fs.mkdirSync(path.join(repo, '.playbook', 'runtime', 'current'), { recursive: true });
    writeRecommendations(repo, [{ path: 'nat1-games/.git/', class: 'vcs-internal', safety_level: 'safe-default', confidence: 0.99, estimated_files_reduced: 1, estimated_bytes_reduced: 1, impact_level: 'low' }]);
    fs.writeFileSync(
      path.join(repo, '.playbookignore'),
      [
        '# custom entry',
        'coverage/',
        '# PLAYBOOK:IGNORE_START',
        '# Managed by Playbook from ranked ignore recommendations.',
        '# Only safe-default recommendations are auto-applied. Review-first and lower-confidence entries stay suggestion-only.',
        'nat1-games/.git/',
        '.git/',
        '# PLAYBOOK:IGNORE_END'
      ].join('\n'),
      'utf8'
    );

    const result = applySafePlaybookIgnoreRecommendations(repo);

    const content = fs.readFileSync(path.join(repo, '.playbookignore'), 'utf8');
    const managedBlock = content
      .split('\n')
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .filter((line) => !line.startsWith('coverage/'));
    const managedEntryLines = managedBlock.filter((line) => !line.startsWith('coverage/'));
    const gitEntries = managedEntryLines.filter((line) => line.includes('.git/'));

    expect(result.changed).toBe(true);
    expect(gitEntries).toEqual(['.git/']);
    expect(result.applied_entries).toEqual([]);
    expect(result.retained_entries).toEqual(['.git/']);

    const rerun = applySafePlaybookIgnoreRecommendations(repo);
    expect(rerun.changed).toBe(false);
    const rerunContent = fs.readFileSync(path.join(repo, '.playbookignore'), 'utf8');
    expect(rerunContent).toBe(content);
  });

  it('retains previously managed safe-default entries when later suggestions disappear', () => {
    const repo = createRepo();
    writeRecommendations(repo);

    const first = applySafePlaybookIgnoreRecommendations(repo);
    expect(first.changed).toBe(true);

    fs.writeFileSync(
      path.join(repo, '.playbook', 'runtime', 'current', 'ignore-recommendations.json'),
      JSON.stringify(
        {
          schemaVersion: '1.0',
          cycle_id: 'cycle-2',
          generated_at: '2026-03-11T00:00:01.000Z',
          recommendation_model: 'deterministic-v1',
          ranking_factors: ['rank'],
          recommendations: [],
          summary: {
            total_recommendations: 0,
            safety_level_counts: { 'safe-default': 0, 'likely-safe': 0, 'review-first': 0 },
            class_counts: {
              'vcs-internal': 0,
              'build-cache': 0,
              'generated-report': 0,
              'temporary-file': 0,
              'binary-asset': 0,
              unknown: 0
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const second = applySafePlaybookIgnoreRecommendations(repo);
    const content = fs.readFileSync(path.join(repo, '.playbookignore'), 'utf8');

    expect(second.changed).toBe(false);
    expect(content).toContain('# PLAYBOOK:IGNORE_START');
    expect(content).toContain('.git/');
    expect(content).toContain('node_modules/');
  });
});
