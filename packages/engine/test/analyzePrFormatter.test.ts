import { describe, expect, it } from 'vitest';
import { formatAnalyzePrGithubReview } from '../src/formatters/githubReviewFormatter.js';
import type { AnalyzePullRequestResult } from '../src/pr/analyzePr.js';

const baseAnalysis: AnalyzePullRequestResult = {
  schemaVersion: '1.0',
  command: 'analyze-pr',
  baseRef: 'main',
  changedFiles: ['src/workouts/index.ts'],
  summary: { changedFileCount: 1, affectedModuleCount: 1, riskLevel: 'medium' },
  affectedModules: ['workouts'],
  impact: [{ module: 'workouts', dependencies: [], directDependents: [], dependents: [] }],
  architecture: { boundariesTouched: ['source'] },
  risk: { level: 'medium', signals: ['x'], moduleRisk: [{ module: 'workouts', level: 'medium', score: 1, signals: ['x'] }] },
  docs: { changed: [], recommendedReview: [] },
  rules: { related: ['PB001'], owners: [] },
  moduleOwners: [],
  findings: [
    {
      ruleId: 'verify.rule.tests.required',
      severity: 'warning',
      message: 'Missing test coverage for rule',
      recommendation: 'Add contract tests',
      file: 'src/workouts/index.ts',
      line: 12
    },
    {
      ruleId: 'PB001',
      severity: 'info',
      message: 'No inline location'
    }
  ],
  reviewGuidance: [],
  context: { sources: [{ type: 'git-diff', baseRef: 'main' }] }
};

describe('formatAnalyzePrGithubReview', () => {
  it('emits only findings with file/line as review annotations', () => {
    const output = JSON.parse(formatAnalyzePrGithubReview(baseAnalysis));
    expect(output).toEqual([
      {
        path: 'src/workouts/index.ts',
        line: 12,
        body: 'Playbook Warning: verify.rule.tests.required Missing test coverage for rule\n\nRecommendation: Add contract tests'
      }
    ]);
  });
});
