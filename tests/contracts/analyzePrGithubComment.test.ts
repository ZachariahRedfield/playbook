import { describe, expect, it } from 'vitest';
import { formatAnalyzePrGithubComment } from '../../packages/engine/src/formatters/githubCommentFormatter.js';
import type { AnalyzePullRequestResult } from '../../packages/engine/src/pr/analyzePr.js';

const fixture: AnalyzePullRequestResult = {
  schemaVersion: '1.0',
  command: 'analyze-pr',
  baseRef: 'origin/main...HEAD',
  changedFiles: ['packages/cli/src/commands/analyzePr.ts', 'README.md'],
  summary: {
    changedFileCount: 2,
    affectedModuleCount: 1,
    riskLevel: 'medium'
  },
  affectedModules: ['@fawxzzy/playbook'],
  impact: [
    {
      module: '@fawxzzy/playbook',
      dependencies: ['@zachariahredfield/playbook-engine'],
      directDependents: [],
      dependents: []
    }
  ],
  architecture: {
    boundariesTouched: ['docs', 'packages']
  },
  risk: {
    level: 'medium',
    signals: ['cross-boundary-change'],
    moduleRisk: [
      {
        module: '@fawxzzy/playbook',
        level: 'medium',
        score: 0.6,
        signals: ['cross-boundary-change']
      }
    ]
  },
  docs: {
    changed: ['README.md'],
    recommendedReview: ['README.md', 'docs/commands/README.md']
  },
  rules: {
    related: ['PB001'],
    owners: [
      {
        ruleId: 'PB001',
        area: 'governance',
        owners: ['@playbook/core'],
        remediationType: 'manual'
      }
    ]
  },
  moduleOwners: [
    {
      module: '@fawxzzy/playbook',
      owners: ['@playbook/cli'],
      area: 'cli'
    }
  ],
  reviewGuidance: ['Run `playbook verify --json` before merge.'],
  context: {
    sources: [
      { type: 'git-diff', baseRef: 'origin/main...HEAD' },
      { type: 'repo-index', path: '.playbook/repo-index.json' },
      { type: 'module-impact', modules: ['@fawxzzy/playbook'] },
      { type: 'module-risk', modules: ['@fawxzzy/playbook'] },
      { type: 'docs-coverage', modules: ['@fawxzzy/playbook'] },
      { type: 'module-owners', path: '.playbook/module-owners.json' },
      { type: 'rule-owners', rules: ['PB001'] }
    ]
  }
};

describe('analyze-pr github-comment formatter', () => {
  it('formats deterministic GitHub comment markdown output', () => {
    expect(formatAnalyzePrGithubComment(fixture)).toMatchSnapshot();
  });
});
