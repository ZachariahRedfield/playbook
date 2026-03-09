import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runDocsAudit } from '../src/docs/audit.js';

const tmpRoots: string[] = [];

const write = (root: string, relativePath: string, content = ''): void => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const createRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-audit-'));
  tmpRoots.push(root);

  const minimalActiveDocs: Record<string, string> = {
    'README.md': '# README\nai-context ai-contract context verify plan apply',
    'AGENTS.md': '# AGENTS',
    'docs/index.md': '# Index\nai-context ai-contract context verify plan apply',
    'docs/ARCHITECTURE.md': '# Architecture',
    'docs/commands/README.md': '# Commands',
    'docs/commands/docs.md': '# docs audit',
    'docs/PLAYBOOK_PRODUCT_ROADMAP.md': '# Product roadmap',
    'docs/PLAYBOOK_BUSINESS_STRATEGY.md': '# Business strategy',
    'docs/CONSUMER_INTEGRATION_CONTRACT.md': '# Consumer contract',
    'docs/AI_AGENT_CONTEXT.md': '# AI context\nai-context ai-contract context verify plan apply',
    'docs/ONBOARDING_DEMO.md': '# Onboarding\nai-context ai-contract context verify plan apply',
    'docs/REFERENCE/cli.md': '# CLI reference',
    'docs/FAQ.md': '# FAQ\nai-context ai-contract context verify plan apply',
    'docs/GITHUB_SETUP.md': '# GitHub setup',
    'docs/roadmap/README.md': '# Roadmap readme',
    'docs/roadmap/ROADMAP.json': '{}',
    'docs/roadmap/IMPROVEMENTS_BACKLOG.md': '# Backlog',
    'docs/RELEASING.md': '# Releasing',
    'docs/archive/README.md': '# Archive',
    'packages/cli/README.md': '# CLI\nai-context ai-contract context verify plan apply',
    'docs/PLAYBOOK_IMPROVEMENTS.md': '# Compatibility stub\nSuperseded and archived. See docs/archive/PLAYBOOK_IMPROVEMENTS_2026.md and docs/roadmap/IMPROVEMENTS_BACKLOG.md.',
    'docs/REPORT_DOCS_MERGE.md': '# Compatibility redirect\nSuperseded and archived in docs/archive/REPORT_DOCS_MERGE_2026.md. Canonical docs are in docs/index.md.'
  };

  Object.entries(minimalActiveDocs).forEach(([relativePath, content]) => write(root, relativePath, content));
  return root;
};

afterEach(() => {
  while (tmpRoots.length > 0) {
    const root = tmpRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('docs audit', () => {
  it('accepts generalized archive naming and archive README', () => {
    const root = createRepo();
    write(root, 'docs/archive/PLAYBOOK_IMPROVEMENTS_2026.md', '# archived');
    write(root, 'docs/archive/OVERVIEW_2026.md', '# archived');

    const result = runDocsAudit(root);
    const archiveFindings = result.findings.filter((finding) => finding.ruleId === 'docs.backlog-hygiene.archive-name');
    expect(archiveFindings).toHaveLength(0);
  });

  it('does not flag intentional compatibility stubs as cleanup candidates', () => {
    const root = createRepo();

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.cleanup-dedupe.candidate' && finding.path === 'docs/REPORT_DOCS_MERGE.md')).toBeUndefined();
  });

  it('flags active docs using legacy package scope and unscoped npx', () => {
    const root = createRepo();
    write(root, 'docs/FAQ.md', '# FAQ\nnpx playbook verify\nnpx @zachariahredfield/playbook verify');

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.active-surface.unscoped-npx' && finding.path === 'docs/FAQ.md')).toBeDefined();
    expect(result.findings.find((finding) => finding.ruleId === 'docs.active-surface.package-scope' && finding.path === 'docs/FAQ.md')).toBeDefined();
  });

  it('flags active docs referencing superseded doc paths', () => {
    const root = createRepo();
    write(root, 'docs/index.md', '# Index\nSee docs/OVERVIEW.md\nai-context ai-contract context verify plan apply');

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.active-surface.legacy-link' && finding.path === 'docs/index.md')).toBeDefined();
  });

  it('flags front-door docs that are analyze-first without compatibility framing', () => {
    const root = createRepo();
    write(root, 'packages/cli/README.md', '# CLI\n## 30-second demo\nUse analyze first.');

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.front-door.ladder-drift' && finding.path === 'packages/cli/README.md')).toBeDefined();
  });
});
