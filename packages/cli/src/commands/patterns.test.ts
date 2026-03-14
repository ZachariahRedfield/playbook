import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runPatterns } from './patterns.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writePatternReviewQueue = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'pattern-review-queue.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'playbook-pattern-review-queue',
        generatedAt: '2026-01-01T00:00:00.000Z',
        candidates: [
          {
            id: 'candidate-module_test_absence',
            sourcePatternId: 'MODULE_TEST_ABSENCE',
            canonicalPatternName: 'module test absence',
            whyItExists: 'why',
            examples: ['module lacks tests'],
            confidence: 0.9,
            reusableEngineeringMeaning: 'meaning',
            recurrenceCount: 3,
            repoSurfaceBreadth: 0.6,
            remediationUsefulness: 0.8,
            canonicalClarity: 0.9,
            falsePositiveRisk: 0.1,
            promotionScore: 0.83,
            attractorScoreBreakdown: {
              recurrence_score: 0.6,
              cross_domain_score: 1,
              evidence_score: 0.5,
              reuse_score: 0.7,
              governance_score: 0.9,
              attractor_score: 0.7,
              explanation: 'Attractor score ranks representational persistence and utility. It does not claim ontology or truth.'
            },
            stage: 'review'
          }
        ]
      },
      null,
      2
    )
  );
};


const writeContractPatternGraph = (repo: string): void => {
  const source = path.join(process.cwd(), '..', '..', 'tests', 'contracts', 'pattern-graph.fixture.json');
  const target = path.join(repo, '.playbook', 'pattern-graph.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

const writePatternKnowledge = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'memory', 'knowledge', 'patterns.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        artifact: 'memory-knowledge',
        kind: 'pattern',
        generatedAt: '2026-01-01T00:00:00.000Z',
        entries: [
          {
            knowledgeId: 'pattern-1',
            candidateId: 'cand-1',
            sourceCandidateIds: ['cand-1'],
            sourceEventFingerprints: ['fp-1'],
            kind: 'pattern',
            title: 'Pattern one',
            summary: 'Pattern one summary',
            fingerprint: 'fp-1',
            module: 'module-a',
            ruleId: 'rule-a',
            failureShape: 'shape-a',
            promotedAt: '2026-01-01T00:00:00.000Z',
            provenance: [],
            status: 'active',
            supersedes: [],
            supersededBy: []
          },
          {
            knowledgeId: 'pattern-2',
            candidateId: 'cand-2',
            sourceCandidateIds: ['cand-2'],
            sourceEventFingerprints: ['fp-2'],
            kind: 'pattern',
            title: 'Pattern two',
            summary: 'Pattern two summary',
            fingerprint: 'fp-2',
            module: 'module-a',
            ruleId: 'rule-b',
            failureShape: 'shape-a',
            promotedAt: '2026-01-02T00:00:00.000Z',
            provenance: [],
            status: 'active',
            supersedes: ['pattern-1'],
            supersededBy: []
          }
        ]
      },
      null,
      2
    )
  );
};

describe('runPatterns', () => {
  it('lists pattern knowledge graph nodes as JSON', async () => {
    const repo = createRepo('playbook-cli-patterns-list');
    writePatternKnowledge(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['list'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchInlineSnapshot(`
      {
        "action": "list",
        "command": "patterns",
        "patterns": [
          {
            "candidateId": "cand-1",
            "failureShape": "shape-a",
            "fingerprint": "fp-1",
            "kind": "pattern",
            "knowledgeId": "pattern-1",
            "module": "module-a",
            "promotedAt": "2026-01-01T00:00:00.000Z",
            "provenance": [],
            "ruleId": "rule-a",
            "sourceCandidateIds": [
              "cand-1",
            ],
            "sourceEventFingerprints": [
              "fp-1",
            ],
            "status": "active",
            "summary": "Pattern one summary",
            "supersededBy": [],
            "supersedes": [],
            "title": "Pattern one",
          },
          {
            "candidateId": "cand-2",
            "failureShape": "shape-a",
            "fingerprint": "fp-2",
            "kind": "pattern",
            "knowledgeId": "pattern-2",
            "module": "module-a",
            "promotedAt": "2026-01-02T00:00:00.000Z",
            "provenance": [],
            "ruleId": "rule-b",
            "sourceCandidateIds": [
              "cand-2",
            ],
            "sourceEventFingerprints": [
              "fp-2",
            ],
            "status": "active",
            "summary": "Pattern two summary",
            "supersededBy": [],
            "supersedes": [
              "pattern-1",
            ],
            "title": "Pattern two",
          },
        ],
        "schemaVersion": "1.0",
      }
    `);

    logSpy.mockRestore();
  });

  it('returns related nodes for a given pattern id', async () => {
    const repo = createRepo('playbook-cli-patterns-related');
    writePatternKnowledge(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['related', 'pattern-2'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.related).toHaveLength(3);

    logSpy.mockRestore();
  });

  it('approves candidate promotion with deterministic JSON output', async () => {
    const repo = createRepo('playbook-cli-patterns-promote');
    writePatternReviewQueue(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['promote', '--id', 'candidate-module_test_absence', '--decision', 'approve'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('promote');
    expect(payload.reviewRecord.decision.decision).toBe('approve');
    expect(fs.existsSync(path.join(repo, '.playbook', 'patterns-promoted.json'))).toBe(true);

    logSpy.mockRestore();
  });


  it('scores pattern graph with appended attractor entries', async () => {
    const repo = createRepo('playbook-cli-patterns-score');
    writeContractPatternGraph(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['score'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('score');
    const first = payload.graph.patterns[0];
    expect(first.scores.length).toBeGreaterThan(1);

    logSpy.mockRestore();
  });

  it('returns top ranked patterns by attractor score', async () => {
    const repo = createRepo('playbook-cli-patterns-top');
    writeContractPatternGraph(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['top', '--limit', '2'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('top');
    expect(payload.patterns).toHaveLength(2);

    logSpy.mockRestore();
  });
});
