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
    'docs/commands/README.md': '# Commands\nLifecycle Role Discoverability',
    'docs/commands/docs.md': '# docs audit',
    'docs/PLAYBOOK_PRODUCT_ROADMAP.md':
      '# Product roadmap\n## Fact\nObserved roadmap evidence.\n## Interpretation\nCurrent roadmap implications.\n## Narrative\nRoadmap entries describe implementation intent and may include planned command families that are not yet discoverable in current CLI help. Treat `playbook --help` and implemented command contracts as the source of truth for live command availability.',
    'docs/PLAYBOOK_DEV_WORKFLOW.md': '# Development workflow\n## Fact\nValidated checks.\n## Interpretation\nWhy checks matter.\n## Narrative\nHow to communicate updates.',
    'docs/PLAYBOOK_BUSINESS_STRATEGY.md': '# Business strategy',
    'docs/CONSUMER_INTEGRATION_CONTRACT.md': '# Consumer contract',
    'docs/AI_AGENT_CONTEXT.md': '# AI context\nai-context ai-contract context verify plan apply',
    'docs/ONBOARDING_DEMO.md':
      '# Onboarding\nai-context ai-contract context verify plan apply\nSupported question classes\nUnsupported question classes\nDeterministic fallback',
    'docs/REFERENCE/cli.md': '# CLI reference',
    'docs/FAQ.md': '# FAQ\nai-context ai-contract context verify plan apply',
    'docs/GITHUB_SETUP.md': '# GitHub setup',
    'docs/roadmap/README.md': '# Roadmap readme',
    'docs/roadmap/ROADMAP.json': '{}',
    'docs/contracts/command-truth.json': JSON.stringify(
      {
        bootstrapLadder: ['ai-context', 'ai-contract', 'context'],
        remediationLoop: ['verify', 'plan', 'apply', 'verify'],
        canonicalCommands: ['ai-context'],
        compatibilityCommands: ['analyze'],
        utilityCommands: ['demo']
      },
      null,
      2
    ),
    'docs/roadmap/IMPROVEMENTS_BACKLOG.md': '# Backlog',
    'docs/RELEASING.md': '# Releasing',
    'docs/archive/README.md': '# Archive',
    'packages/cli/README.md': '# CLI\nai-context ai-contract context verify plan apply',
    'docs/PLAYBOOK_IMPROVEMENTS.md':
      '# Compatibility stub\nSuperseded and archived. See docs/archive/PLAYBOOK_IMPROVEMENTS_2026.md and docs/roadmap/IMPROVEMENTS_BACKLOG.md.',
    'docs/REPORT_DOCS_MERGE.md':
      '# Compatibility redirect\nSuperseded and archived in docs/archive/REPORT_DOCS_MERGE_2026.md. Canonical docs are in docs/index.md.'
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

  it('fails when command truth contract is missing', () => {
    const root = createRepo();
    fs.rmSync(path.join(root, 'docs/contracts/command-truth.json'));

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.command-truth.missing')).toBeDefined();
  });

  it('fails when command truth metadata contains duplicate command entries', () => {
    const root = createRepo();
    write(
      root,
      'docs/contracts/command-truth.json',
      JSON.stringify(
        {
          bootstrapLadder: ['ai-context', 'ai-contract', 'context'],
          remediationLoop: ['verify', 'plan', 'apply', 'verify'],
          canonicalCommands: ['ai-context'],
          compatibilityCommands: ['analyze'],
          utilityCommands: ['demo'],
          commandTruth: [
            { name: 'verify', productFacing: true },
            { name: 'verify', productFacing: true }
          ]
        },
        null,
        2
      )
    );

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.command-truth.duplicate-command')).toBeDefined();
  });

  it('fails when docs command status managed table drifts from command truth', () => {
    const root = createRepo();
    write(
      root,
      'docs/contracts/command-truth.json',
      JSON.stringify(
        {
          bootstrapLadder: ['ai-context', 'ai-contract', 'context'],
          remediationLoop: ['verify', 'plan', 'apply', 'verify'],
          canonicalCommands: ['verify'],
          compatibilityCommands: [],
          utilityCommands: [],
          commandTruth: [{ name: 'verify', productFacing: true }]
        },
        null,
        2
      )
    );
    write(
      root,
      'docs/commands/README.md',
      '# Commands\n<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->\n| Command / Artifact | Purpose |\n| --- | --- |\n| `plan` | Generate |\n<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->'
    );

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.command-truth.status-table-drift')).toBeDefined();
  });


  it('passes postmortems with all required reconsolidation sections', () => {
    const root = createRepo();
    write(
      root,
      'docs/postmortems/incident-001.md',
      [
        '# Incident 001',
        '',
        '## Facts',
        'Observed evidence.',
        '',
        '## Interpretation',
        'What the facts suggest.',
        '',
        '## Fact',
        'Fact layer marker.',
        '',
        '## Narrative',
        'Narrative layer marker.',
        '',
        '## Model Changes',
        'Updated understanding.',
        '',
        '## Promotion Candidates',
        'Candidate follow-up.',
        '',
        '## Non-Promotion Notes',
        'Context that should stay local.',
        ''
      ].join('\n')
    );

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.postmortem.required-sections')).toBeUndefined();
  });

  it('fails postmortems missing required reconsolidation sections with a stable rule id', () => {
    const root = createRepo();
    write(
      root,
      'docs/postmortems/incident-002.md',
      [
        '# Incident 002',
        '',
        '## Facts',
        'Observed evidence.',
        '',
        '## Interpretation',
        'What the facts suggest.',
        '',
        '## Fact',
        'Fact layer marker.',
        '',
        '## Promotion Candidates',
        'Candidate follow-up.',
        '',
        '## Non-Promotion Notes',
        'Context that should stay local.',
        ''
      ].join('\n')
    );

    const result = runDocsAudit(root);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'docs.postmortem.required-sections',
          path: 'docs/postmortems/incident-002.md',
          level: 'error'
        })
      ])
    );
  });

  it('does not apply postmortem heading validation to non-postmortem docs', () => {
    const root = createRepo();
    write(root, 'docs/notes.md', '# Notes\n\n## Facts\nLoose note only.');

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.path === 'docs/notes.md' && finding.ruleId === 'docs.postmortem.required-sections')).toBeUndefined();
  });

  it('passes architecture decision docs with required rubric sections', () => {
    const root = createRepo();
    write(
      root,
      'docs/architecture/decisions/adr-001.md',
      [
        '# ADR-001',
        '',
        '## Constraints',
        'Constraint details.',
        '',
        '## Cost Surfaces',
        'Cost details.',
        '',
        '## Chosen Shape',
        'Chosen approach.',
        '',
        '## Why This Fits',
        'Fit details.',
        '',
        '## Tradeoffs / Failure Modes',
        'Tradeoffs.',
        '',
        '## Review Triggers',
        'Trigger details.',
        ''
      ].join('\n')
    );

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.architecture-rubric.required-sections')).toBeUndefined();
  });

  it('fails architecture decision docs missing required rubric sections with a stable rule id', () => {
    const root = createRepo();
    write(
      root,
      'docs/architecture/decisions/adr-002.md',
      ['# ADR-002', '', '## Constraints', 'Constraint details.', '', '## Cost Surfaces', 'Cost details.', ''].join('\n')
    );

    const result = runDocsAudit(root);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'docs.architecture-rubric.required-sections',
          path: 'docs/architecture/decisions/adr-002.md',
          level: 'error'
        })
      ])
    );
  });

  it('does not apply architecture rubric heading validation to non-architecture docs', () => {
    const root = createRepo();
    write(root, 'docs/notes.md', '# Notes\n\n## Constraints\nOptional note.');

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.path === 'docs/notes.md' && finding.ruleId === 'docs.architecture-rubric.required-sections')).toBeUndefined();
  });

  it('fails governed docs missing revision-layer sections with a stable rule id', () => {
    const root = createRepo();
    write(root, 'docs/PLAYBOOK_DEV_WORKFLOW.md', '# Development workflow\n## Fact\nEvidence only.\n## Interpretation\nMeaning only.\n');

    const result = runDocsAudit(root);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'docs.revision-layer.required-sections',
          path: 'docs/PLAYBOOK_DEV_WORKFLOW.md',
          level: 'error'
        })
      ])
    );
  });

  it('does not apply governed revision-layer checks to unrelated docs', () => {
    const root = createRepo();
    write(root, 'docs/notes.md', '# Notes\n## Fact\nOptional note.\n');

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.path === 'docs/notes.md' && finding.ruleId === 'docs.revision-layer.required-sections')).toBeUndefined();
  });

  it('fails when global reusable pattern memory points at repo-local storage', () => {
    const root = createRepo();
    write(
      root,
      'docs/commands/patterns.md',
      '# patterns\nGlobal reusable pattern memory lives in `.playbook/memory/knowledge/patterns.json`.\n'
    );

    const result = runDocsAudit(root);
    expect(result.findings.find((finding) => finding.ruleId === 'docs.pattern-storage.scope-path-drift' && finding.path === 'docs/commands/patterns.md')).toBeDefined();
  });

});
