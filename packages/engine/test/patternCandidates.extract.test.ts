import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPatternCandidateArtifact,
  extractPatternCandidates,
  generatePatternCandidateArtifact,
  PATTERN_CANDIDATES_RELATIVE_PATH
} from '../src/extract/patternCandidates.js';
import type { RepositoryGraph } from '../src/graph/repoGraph.js';

const fixtureGraph: RepositoryGraph = {
  schemaVersion: '1.1',
  kind: 'playbook-repo-graph',
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    { id: 'repository:root', kind: 'repository', name: 'root' },
    { id: 'module:@zachariahredfield/playbook-cli', kind: 'module', name: '@zachariahredfield/playbook-cli' },
    { id: 'module:@zachariahredfield/playbook-engine', kind: 'module', name: '@zachariahredfield/playbook-engine' },
    { id: 'rule:docs.command.truth', kind: 'rule', name: 'docs.command.truth' }
  ],
  edges: [
    { kind: 'contains', from: 'repository:root', to: 'module:@zachariahredfield/playbook-cli' },
    { kind: 'contains', from: 'repository:root', to: 'module:@zachariahredfield/playbook-engine' },
    { kind: 'depends_on', from: 'module:@zachariahredfield/playbook-cli', to: 'module:@zachariahredfield/playbook-engine' },
    { kind: 'governed_by', from: 'module:@zachariahredfield/playbook-cli', to: 'rule:docs.command.truth' },
    { kind: 'governed_by', from: 'module:@zachariahredfield/playbook-engine', to: 'rule:docs.command.truth' }
  ],
  stats: {
    nodeCount: 4,
    edgeCount: 5,
    nodeKinds: { repository: 1, module: 2, rule: 1 },
    edgeKinds: { contains: 2, depends_on: 1, governed_by: 2 }
  }
};

const fixtureContracts = {
  schemaVersion: '1.0',
  command: 'contracts',
  cliSchemas: {
    draft: '2020-12',
    schemaCommand: 'playbook schema --json',
    commands: ['query', 'plan', 'apply', 'verify', 'docs']
  },
  artifacts: {
    runtimeDefaults: [
      { path: '.playbook/repo-graph.json', producer: 'index' },
      { path: '.playbook/repo-index.json', producer: 'index' },
      { path: '.playbook/contracts-registry.json', producer: 'contracts' }
    ],
    contracts: []
  },
  roadmap: {
    path: 'docs/roadmap/ROADMAP.json',
    availability: { available: true },
    schemaVersion: '1.0',
    trackedFeatures: []
  }
} as const;

const fixtureDocsAudit = {
  ok: true,
  status: 'pass',
  summary: { errors: 0, warnings: 0, checksRun: 12 },
  findings: []
} as const;

describe('pattern candidate extraction', () => {
  it('extracts deterministic candidates from narrow detectors', () => {
    const candidates = extractPatternCandidates({
      repoRoot: process.cwd(),
      artifacts: {
        graph: fixtureGraph,
        contractsRegistry: fixtureContracts,
        docsAudit: fixtureDocsAudit
      }
    });

    expect(candidates.map((candidate) => candidate.detector)).toEqual([
      'contract-symmetry',
      'layering',
      'modularity',
      'query-before-mutation',
      'workflow-recursion'
    ]);
    expect(candidates.every((candidate) => candidate.evidence.length > 0)).toBe(true);
    expect(candidates.every((candidate) => candidate.confidence >= 0 && candidate.confidence <= 1)).toBe(true);
  });

  it('produces stable artifact output across runs', () => {
    const once = buildPatternCandidateArtifact(
      extractPatternCandidates({ repoRoot: process.cwd(), artifacts: { graph: fixtureGraph, contractsRegistry: fixtureContracts, docsAudit: fixtureDocsAudit } })
    );
    const twice = buildPatternCandidateArtifact(
      extractPatternCandidates({ repoRoot: process.cwd(), artifacts: { graph: fixtureGraph, contractsRegistry: fixtureContracts, docsAudit: fixtureDocsAudit } })
    );

    expect(once).toEqual(twice);
  });

  it('writes .playbook/pattern-candidates.json with deterministic marker', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pattern-candidates-'));
    const result = generatePatternCandidateArtifact({
      repoRoot: tempRoot,
      artifacts: {
        graph: fixtureGraph,
        contractsRegistry: fixtureContracts,
        docsAudit: fixtureDocsAudit
      }
    });

    expect(result.artifact.generatedAt).toBe('deterministic');
    const artifactPath = path.join(tempRoot, PATTERN_CANDIDATES_RELATIVE_PATH);
    expect(result.artifactPath).toBe(artifactPath);
    expect(fs.existsSync(artifactPath)).toBe(true);
  });

  it('fails deterministically when required artifacts are missing', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-pattern-candidates-missing-'));

    expect(() => extractPatternCandidates({ repoRoot: tempRoot })).toThrowError(
      'playbook extract patterns: missing required artifacts: .playbook/contracts-registry.json, .playbook/docs-audit.json, .playbook/repo-graph.json'
    );
  });
});
