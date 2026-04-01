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


const writePatternOutcomes = (repo: string): void => {
  const source = path.join(process.cwd(), '..', '..', 'tests', 'contracts', 'pattern-outcomes.fixture.json');
  const target = path.join(repo, '.playbook', 'pattern-outcomes.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};



const writeCrossRepoPatternsArtifact = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'cross-repo-patterns.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'cross-repo-patterns',
        generatedAt: '2026-01-01T00:00:00.000Z',
        repositories: [
          {
            id: 'repo-a',
            repoPath: '/tmp/repo-a',
            patternCount: 2,
            patterns: [
              { pattern_id: 'pattern.modularity', attractor: 0.9, fitness: 0.82, strength: 0.87, instance_count: 3, governance_stable: true },
              { pattern_id: 'pattern.recursion', attractor: 0.7, fitness: 0.62, strength: 0.67, instance_count: 1, governance_stable: false }
            ]
          },
          {
            id: 'repo-b',
            repoPath: '/tmp/repo-b',
            patternCount: 2,
            patterns: [
              { pattern_id: 'pattern.modularity', attractor: 0.88, fitness: 0.8, strength: 0.85, instance_count: 2, governance_stable: true },
              { pattern_id: 'pattern.recursion', attractor: 0.6, fitness: 0.58, strength: 0.59, instance_count: 1, governance_stable: false }
            ]
          }
        ],
        aggregates: [
          {
            pattern_id: 'pattern.modularity',
            repo_count: 2,
            instance_count: 5,
            mean_attractor: 0.89,
            mean_fitness: 0.81,
            portability_score: 0.9,
            outcome_consistency: 0.95,
            instance_diversity: 1,
            governance_stability: 1
          },
          {
            pattern_id: 'pattern.recursion',
            repo_count: 2,
            instance_count: 2,
            mean_attractor: 0.65,
            mean_fitness: 0.6,
            portability_score: 0.58,
            outcome_consistency: 0.84,
            instance_diversity: 0.5,
            governance_stability: 0
          }
        ]
      },
      null,
      2
    )
  );
};

const writeRepoPatternArtifacts = (repo: string): void => {
  writeContractPatternGraph(repo);
  writePatternOutcomes(repo);
};


const writePatternConvergenceArtifact = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'pattern-convergence.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'pattern-convergence',
        generatedAt: '2026-01-04T00:00:00.000Z',
        proposalOnly: true,
        sourceArtifacts: ['.playbook/pattern-candidates.json', '.playbook/patterns-promoted.json'],
        clusters: [
          {
            clusterId: 'cluster:deterministic-governance-mutation-boundary-review-gated-promotion',
            intent: 'deterministic-governance',
            constraint_class: 'mutation-boundary',
            resolution_strategy: 'review-gated-promotion',
            members: [
              {
                source: 'candidate',
                id: 'candidate.module.tests.required',
                title: 'Require deterministic module tests',
                intent: 'deterministic-governance',
                constraint_class: 'mutation-boundary',
                resolution_strategy: 'review-gated-promotion'
              }
            ],
            shared_abstraction: 'Promote only through explicit review to preserve deterministic governance boundaries.',
            convergence_confidence: 0.64,
            recommended_higher_order_pattern: 'Higher-order: enforce explicit review gates before promotion mutations.'
          },
          {
            clusterId: 'cluster:pattern-portability-cross-repo-consistency-normalize-and-cluster',
            intent: 'pattern-portability',
            constraint_class: 'cross-repo-consistency',
            resolution_strategy: 'normalize-and-cluster',
            members: [
              {
                source: 'candidate',
                id: 'candidate.portability.layering',
                title: 'Portable layering family',
                intent: 'pattern-portability',
                constraint_class: 'cross-repo-consistency',
                resolution_strategy: 'normalize-and-cluster'
              },
              {
                source: 'promoted',
                id: 'pattern.portability.layering',
                title: 'Portable layering',
                intent: 'pattern-portability',
                constraint_class: 'cross-repo-consistency',
                resolution_strategy: 'normalize-and-cluster'
              }
            ],
            shared_abstraction: 'Compress cross-repo evidence into reusable normalized pattern families.',
            convergence_confidence: 0.93,
            recommended_higher_order_pattern: 'Higher-order: map shared portability constraints into one reusable abstraction.'
          }
        ]
      },
      null,
      2
    )
  );
};


const writeCrossRepoCandidatesArtifact = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'cross-repo-candidates.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'cross-repo-candidates',
        generatedAt: '2026-01-03T00:00:00.000Z',
        repositories: ['playbook', 'fawxzzy-fitness'],
        candidates: [
          {
            id: 'candidate.layering.001',
            title: 'Portable governed artifact pattern: layering',
            when: 'When playbook and fawxzzy-fitness emit evidence.',
            then: 'Then review layering as a portable cross-repo pattern candidate.',
            because: 'Cross-repo evidence shows layering across 2 repositories.',
            normalizationKey: 'artifact-pattern::layering',
            sourceRefs: [
              'fawxzzy-fitness::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-fitness',
              'playbook::pattern-candidates::.playbook/pattern-candidates.json::/candidates/0::digest-playbook'
            ],
            storySeed: {
              title: 'Review portable pattern: layering',
              rationale: 'Cross-repo evidence shows layering across 2 repositories.',
              acceptanceCriteria: ['Verify evidence', 'Keep references only']
            },
            fingerprint: 'finger-layering'
          },
          {
            id: 'candidate.query-before-mutation.001',
            title: 'Portable governed artifact pattern: query-before-mutation',
            when: 'When only playbook emits evidence.',
            then: 'Then review cautiously.',
            because: 'Only one repository contributes evidence.',
            normalizationKey: 'artifact-pattern::query-before-mutation',
            sourceRefs: ['playbook::pattern-candidates::.playbook/pattern-candidates.json::/candidates/1::digest-playbook'],
            storySeed: {
              title: 'Review portable pattern: query-before-mutation',
              rationale: 'Only one repository contributes evidence.',
              acceptanceCriteria: ['Verify evidence']
            },
            fingerprint: 'finger-query'
          }
        ]
      },
      null,
      2
    )
  );
};

const writeCompactionCandidateArtifacts = (repo: string): void => {
  const verifyPath = path.join(repo, '.playbook', 'verify.json');
  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });
  fs.writeFileSync(
    verifyPath,
    JSON.stringify(
      {
        failures: [
          {
            id: 'module.tests.required',
            message: 'Module lacks deterministic tests.',
            fix: 'Add deterministic test coverage.'
          }
        ]
      },
      null,
      2
    )
  );

  const planPath = path.join(repo, '.playbook', 'plan.json');
  fs.writeFileSync(
    planPath,
    JSON.stringify(
      {
        tasks: [
          {
            id: 'task-1',
            ruleId: 'module.tests.required',
            action: 'Add tests for module.',
            file: 'packages/cli/src/commands/patterns.ts',
            autoFix: false
          }
        ]
      },
      null,
      2
    )
  );
};

const writePatternCard = (repo: string): void => {
  const cardPath = path.join(repo, '.playbook', 'patterns', 'pattern-tests.json');
  fs.mkdirSync(path.dirname(cardPath), { recursive: true });
  fs.writeFileSync(
    cardPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'playbook-pattern-card',
        patternId: 'pattern-tests',
        title: 'Pattern tests',
        trigger: 'module.tests.required',
        context: 'packages/cli/src/commands/patterns.ts',
        mechanism: 'module lacks deterministic tests',
        invariant: '',
        implication: '',
        response: 'add deterministic tests',
        examples: ['module lacks deterministic tests'],
        evidence: ['verify finding: module lacks deterministic tests'],
        sourceKinds: ['verify'],
        sourceRefs: ['.playbook/verify.json'],
        relatedModules: [],
        relatedRules: ['module.tests.required'],
        relatedDocs: [],
        relatedOwners: [],
        relatedTests: [],
        relatedRiskSignals: [],
        relatedGraphNodes: [],
        relatedPatterns: [],
        supersedes: [],
        supersededBy: [],
        confidence: null,
        status: 'candidate',
        createdFromBucket: 'add',
        reviewState: 'pending-review',
        promotionState: 'not-promoted'
      },
      null,
      2
    )
  );
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

  it('returns outcome and fitness signals for a pattern', async () => {
    const repo = createRepo('playbook-cli-patterns-outcomes');
    writeContractPatternGraph(repo);
    writePatternOutcomes(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['outcomes', 'pattern.modularity'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('outcomes');
    expect(payload.patternId).toBe('pattern.modularity');
    expect(payload.signals).toMatchObject({ attractor: 0.91, fitness: 0.65, strength: 0.81 });
    expect(payload.outcomes).toEqual(['low blast radius', 'deterministic artifacts']);

    logSpy.mockRestore();
  });

  it('lists doctrine candidates ranked by strength', async () => {
    const repo = createRepo('playbook-cli-patterns-doctrine-candidates');
    writeContractPatternGraph(repo);
    writePatternOutcomes(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['doctrine-candidates'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('doctrine-candidates');
    expect(payload.candidates.length).toBeGreaterThan(0);
    expect(payload.candidates[0].strength).toBeGreaterThanOrEqual(payload.candidates.at(-1).strength);

    logSpy.mockRestore();
  });

  it('lists anti-pattern risk signals', async () => {
    const repo = createRepo('playbook-cli-patterns-anti-patterns');
    writeContractPatternGraph(repo);
    writePatternOutcomes(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['anti-patterns'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('anti-patterns');
    expect(payload.antiPatterns.length).toBeGreaterThan(0);
    expect(payload.antiPatterns[0].antiPatterns.length).toBe(3);

    logSpy.mockRestore();
  });

  it('computes cross-repo aggregates and writes artifact', async () => {
    const workspace = createRepo('playbook-cli-patterns-cross-repo');
    const repoA = path.join(workspace, 'repo-a');
    const repoB = path.join(workspace, 'repo-b');
    fs.mkdirSync(repoA, { recursive: true });
    fs.mkdirSync(repoB, { recursive: true });
    writeRepoPatternArtifacts(repoA);
    writeRepoPatternArtifacts(repoB);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runPatterns(workspace, ['cross-repo', '--repo', './repo-a', '--repo', './repo-b'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('cross-repo');
    expect(payload.aggregates.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(workspace, '.playbook', 'cross-repo-patterns.json'))).toBe(true);

    logSpy.mockRestore();
  });

  it('lists portability rows from cross-repo artifact', async () => {
    const repo = createRepo('playbook-cli-patterns-portability');
    writeCrossRepoPatternsArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['portability'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('portability');
    expect(payload.portability[0]).toEqual({ pattern_id: 'pattern.modularity', portability_score: 0.9 });

    logSpy.mockRestore();
  });

  it('filters generalized patterns above portability threshold', async () => {
    const repo = createRepo('playbook-cli-patterns-generalized');
    writeCrossRepoPatternsArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['generalized'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('generalized');
    expect(payload.generalized).toHaveLength(1);
    expect(payload.generalized[0].pattern_id).toBe('pattern.modularity');

    logSpy.mockRestore();
  });

  it('lists cross-repo candidate families through candidates inspection', async () => {
    const repo = createRepo('playbook-cli-patterns-candidates-cross-repo');
    writeCrossRepoPatternsArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['candidates', 'cross-repo'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('candidates-cross-repo');
    expect(payload.families[0].pattern_id).toBe('pattern.modularity');
    expect(payload.families[0].repo_count).toBe(2);

    logSpy.mockRestore();
  });

  it('lists generalized candidate families appearing in multiple repositories', async () => {
    const repo = createRepo('playbook-cli-patterns-candidates-generalized');
    writeCrossRepoPatternsArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['candidates', 'generalized'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('candidates-generalized');
    expect(payload.generalized).toHaveLength(2);
    expect(payload.generalized[0].repo_count).toBeGreaterThan(1);

    logSpy.mockRestore();
  });

  it('computes candidate portability score with stable weighted formula', async () => {
    const repo = createRepo('playbook-cli-patterns-candidates-portability');
    writeCrossRepoPatternsArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['candidates', 'portability'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('candidates-portability');
    expect(payload.formula.portability).toContain('0.35 * repo_count_signal');
    expect(payload.portability[0]).toMatchObject({
      pattern_id: 'pattern.modularity',
      repo_count_signal: 1,
      outcome_consistency_signal: 0.95,
      instance_diversity_signal: 1,
      governance_stability_signal: 1,
      portability_score: 0.9875
    });

    logSpy.mockRestore();
  });


  it('builds governance-safe enrichment proposals from cross-repo candidates', async () => {
    const repo = createRepo('playbook-cli-patterns-proposals');
    writeCrossRepoCandidatesArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['proposals'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('proposals');
    expect(payload.proposals).toHaveLength(1);
    expect(payload.proposals[0]).toMatchObject({
      proposal_id: 'proposal.artifact-pattern-layering.generalization',
      pattern_family: 'artifact-pattern::layering',
      proposed_action: 'append_instance',
      target_pattern: 'pattern.artifact-pattern-layering'
    });
    expect(payload.proposals[0].evidence).toHaveLength(2);
    expect(payload.proposals[0].promotion_targets.map((entry: { kind: string }) => entry.kind)).toEqual(['memory', 'story']);

    const artifactPath = path.join(repo, '.playbook', 'pattern-proposals.json');
    expect(fs.existsSync(artifactPath)).toBe(true);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    expect(artifact.kind).toBe('pattern-proposals');
    expect(artifact.proposals).toHaveLength(1);

    logSpy.mockRestore();
  });

  it('reports repo delta for shared patterns', async () => {
    const repo = createRepo('playbook-cli-patterns-repo-delta');
    writeCrossRepoPatternsArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['repo-delta', 'repo-a', 'repo-b'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('repo-delta');
    expect(payload.deltas[0]).toHaveProperty('strength_delta');

    logSpy.mockRestore();
  });


  it('reads convergence artifact with deterministic JSON output', async () => {
    const repo = createRepo('playbook-cli-patterns-convergence-json');
    writePatternConvergenceArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['convergence'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('convergence');
    expect(payload.cluster_count).toBe(2);
    expect(payload.clusters[0]).toMatchObject({
      intent: expect.any(String),
      constraint_class: expect.any(String),
      resolution_strategy: expect.any(String),
      members: expect.any(Array),
      convergence_confidence: expect.any(Number),
      recommended_higher_order_pattern: expect.any(String)
    });

    logSpy.mockRestore();
  });

  it('filters convergence clusters predictably', async () => {
    const repo = createRepo('playbook-cli-patterns-convergence-filters');
    writePatternConvergenceArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['convergence', '--intent', 'pattern-portability', '--constraint', 'cross-repo-consistency', '--resolution', 'normalize-and-cluster', '--min-confidence', '0.9'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.cluster_count).toBe(1);
    expect(payload.clusters[0]?.clusterId).toBe('cluster:pattern-portability-cross-repo-consistency-normalize-and-cluster');

    logSpy.mockRestore();
  });

  it('keeps convergence text output compact', async () => {
    const repo = createRepo('playbook-cli-patterns-convergence-text');
    writePatternConvergenceArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['convergence'], {
      format: 'text',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines[0]).toContain('Status:');
    expect(lines[1]).toContain('Cluster count:');
    expect(lines).toContainEqual(expect.stringContaining('Top convergent abstractions:'));
    expect(lines.at(-1)).toContain('Next action:');

    logSpy.mockRestore();
  });

  it('lists extracted candidates with deterministic ordering', async () => {
    const repo = createRepo('playbook-cli-patterns-candidates-list');
    writeCompactionCandidateArtifacts(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['candidates'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('candidates');
    expect(payload.candidates.length).toBe(2);
    const ids = payload.candidates.map((entry: { candidateId: string }) => entry.candidateId);
    expect(ids).toEqual([...ids].sort((left, right) => left.localeCompare(right)));

    logSpy.mockRestore();
  });

  it('shows one extracted candidate by id', async () => {
    const repo = createRepo('playbook-cli-patterns-candidates-show');
    writeCompactionCandidateArtifacts(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runPatterns(repo, ['candidates'], {
      format: 'json',
      quiet: false
    });
    const listPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const candidateId = listPayload.candidates[0].candidateId as string;

    logSpy.mockClear();
    const exitCode = await runPatterns(repo, ['candidates', 'show', candidateId], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('candidates-show');
    expect(payload.candidate.candidateId).toBe(candidateId);

    logSpy.mockRestore();
  });

  it('lists unmatched extracted candidates', async () => {
    const repo = createRepo('playbook-cli-patterns-candidates-unmatched');
    writeCompactionCandidateArtifacts(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['candidates', 'unmatched'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('candidates-unmatched');
    expect(payload.candidates.length).toBeGreaterThan(0);

    logSpy.mockRestore();
  });

  it('lists linked extracted candidates', async () => {
    const repo = createRepo('playbook-cli-patterns-candidates-link');
    writeCompactionCandidateArtifacts(repo);
    writePatternCard(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['candidates', 'link'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('candidates-link');
    expect(payload.links.length).toBeGreaterThan(0);

    logSpy.mockRestore();
  });

  it('promotes a cross-repo proposal explicitly into memory knowledge and story backlog surfaces', async () => {
    const repo = createRepo('playbook-cli-patterns-proposals-promote');
    writeCrossRepoCandidatesArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    let exitCode = await runPatterns(repo, ['proposals'], { format: 'json', quiet: false });
    expect(exitCode).toBe(ExitCode.Success);
    logSpy.mockClear();

    exitCode = await runPatterns(repo, ['proposals', 'promote', '--proposal', 'proposal.artifact-pattern-layering.generalization', '--target', 'memory'], {
      format: 'json',
      quiet: false
    });
    expect(exitCode).toBe(ExitCode.Success);
    let payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('proposals-promote');
    expect(payload.promotion.target).toBe('memory');
    expect(payload.promotion.candidate_only).toBe(true);

    logSpy.mockClear();
    exitCode = await runPatterns(repo, ['proposals', 'promote', '--proposal', 'proposal.artifact-pattern-layering.generalization', '--target', 'story', '--repo', 'playbook'], {
      format: 'json',
      quiet: false
    });
    expect(exitCode).toBe(ExitCode.Success);
    payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.promotion.target).toBe('story');
    expect(payload.promotion.story.id).toBe('cross-repo-artifact-pattern-layering-playbook');

    logSpy.mockRestore();
  });


});


describe('pattern transfer flows', () => {
  it('exports transfer packages and imports them as candidate-only input', async () => {
    const repo = createRepo('playbook-cli-pattern-transfer');
    const pkgPath = path.join(repo, 'patterns.json');
    fs.writeFileSync(pkgPath, JSON.stringify({ schemaVersion: '1.0', kind: 'promoted-patterns', patterns: [{ id: 'pattern.layering', pattern_family: 'layering', title: 'Layering', description: 'desc', storySeed: { title: 'Seed', summary: 'Sum', acceptance: ['a'] }, source_artifact: '.playbook/pattern-candidates.json', signals: ['signal'], confidence: 0.8, evidence_refs: ['ref'], status: 'active', provenance: { source_ref: 'global/pattern-candidates/pattern-candidate-1', candidate_id: 'pattern-candidate-1', candidate_fingerprint: 'fp-1', promoted_at: '2026-03-19T00:00:00.000Z' }, compatibility: { required_tags: ['node'] }, risk_class: 'medium', known_failure_modes: ['drift'], lifecycle_events: [] }] }, null, 2));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await runPatterns(repo, ['transfer', 'export', '--pattern', 'pattern.layering', '--target-repo', 'repo-a', '--target-tag', 'node'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const exported = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(exported.package.kind).toBe('pattern-transfer-package');
    logSpy.mockClear();
    expect(await runPatterns(repo, ['transfer', 'import', '--file', exported.package_path, '--repo', 'repo-a', '--repo-tag', 'node'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const imported = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
    expect(imported.import.candidate_only).toBe(true);
  });
});
