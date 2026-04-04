import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';
import { runQuery } from './query.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeRepoIndex = (repo: string): void => {
  const indexPath = path.join(repo, '.playbook', 'repo-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        framework: 'nextjs',
        language: 'typescript',
        architecture: 'modular-monolith',
        modules: [
          { name: 'auth', dependencies: [] },
          { name: 'workouts', dependencies: ['auth'] },
          { name: 'analytics', dependencies: ['workouts'] }
        ],
        dependencies: [{ from: 'workouts', to: 'auth', type: 'source-import' }],
        workspace: [{ name: 'engine', path: 'packages/engine', role: 'engine', dependsOn: [] }],
        tests: [{ module: 'auth', tests_present: true, coverage_estimate: 'unknown' }],
        configs: [{ name: 'tsconfig', path: 'tsconfig.json', present: true }],
        database: 'supabase',
        rules: ['requireNotesOnChanges'],
        architectureRoleInference: {
          classificationMode: 'observation-only',
          classifierVersion: 'role-heuristic-v1',
          policyEnforcement: 'none',
          dependencyMatrix: {
            interface: ['foundation', 'adapter'],
            orchestration: ['interface', 'foundation', 'adapter'],
            foundation: ['foundation'],
            adapter: ['interface', 'foundation']
          },
          nodes: [
            { workspace: '@playbook/cli', inferredRole: 'interface', evidence: ['workspace-role:cli'] },
            { workspace: '@playbook/engine', inferredRole: 'orchestration', evidence: ['workspace-role:engine'] }
          ],
          dependencyObservations: [
            {
              from: '@playbook/engine',
              to: '@playbook/cli',
              fromRole: 'orchestration',
              toRole: 'interface',
              status: 'allowed'
            }
          ]
        }
      },
      null,
      2
    )
  );
};


const writeDocsCoverageFixtures = (repo: string): void => {
  fs.mkdirSync(path.join(repo, 'docs', 'modules'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs', 'ARCHITECTURE.md'), '# Architecture\n\n## Auth\nAuth module details\n');
  fs.writeFileSync(path.join(repo, 'docs', 'modules', 'workouts.md'), '# Workouts\nDetails\n');
};


const writeModuleOwners = (repo: string): void => {
  const ownersPath = path.join(repo, '.playbook', 'module-owners.json');
  fs.mkdirSync(path.dirname(ownersPath), { recursive: true });
  fs.writeFileSync(
    ownersPath,
    JSON.stringify(
      {
        workouts: { owners: ['fitness'], area: 'product' },
        analytics: { owners: ['data'], area: 'platform' }
      },
      null,
      2
    )
  );
};


const writePatternsArtifact = (repo: string): void => {
  const patternsPath = path.join(repo, '.playbook', 'patterns.json');
  fs.mkdirSync(path.dirname(patternsPath), { recursive: true });
  fs.writeFileSync(
    patternsPath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        command: 'pattern-compaction',
        patterns: [{ id: 'MODULE_TEST_ABSENCE', bucket: 'testing', occurrences: 3, examples: ['module lacks tests'] }]
      },
      null,
      2
    )
  );
};


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
            convergencePrioritySuggestion: {
              proposalOnly: true,
              suggestedPriority: 'high',
              convergenceConfidence: 0.95,
              weightedScore: 0.854,
              weightingFactors: {
                basePromotionScore: 0.83,
                convergenceConfidence: 0.95,
                convergenceMemberCount: 2,
                clusterMatch: true
              },
              provenance: {
                convergenceArtifact: '.playbook/pattern-convergence.json',
                matchStrategy: 'member-id-first-then-metadata-token-overlap',
                consideredClusters: 1
              },
              rationale: 'Proposal-only weighting rationale',
              matchedClusterId: 'cluster:deterministic-governance-mutation-boundary-read-only-artifact-synthesis'
            },
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

const writePromotedPatterns = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'patterns-promoted.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'playbook-promoted-patterns',
        promotedPatterns: [
          {
            id: 'MODULE_TEST_ABSENCE',
            sourceCandidateId: 'candidate-module_test_absence',
            canonicalPatternName: 'module test absence',
            whyItExists: 'why',
            examples: ['module lacks tests'],
            confidence: 0.9,
            reusableEngineeringMeaning: 'meaning',
            promotedAt: '2026-01-02T00:00:00.000Z',
            reviewRecord: {
              candidateId: 'candidate-module_test_absence',
              canonicalPatternName: 'module test absence',
              whyItExists: 'why',
              examples: ['module lacks tests'],
              confidence: 0.9,
              reusableEngineeringMeaning: 'meaning',
              decision: {
                candidateId: 'candidate-module_test_absence',
                decision: 'approve',
                decidedBy: 'human-reviewed-local',
                decidedAt: '2026-01-02T00:00:00.000Z',
                rationale: 'Approved through explicit deterministic local review boundary.'
              }
            }
          }
        ]
      },
      null,
      2
    )
  );
};

const writeVerifyReport = (repo: string): void => {
  const verifyPath = path.join(repo, '.playbook', 'verify-report.json');
  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });
  fs.writeFileSync(
    verifyPath,
    JSON.stringify({
      schemaVersion: '1.0',
      command: 'verify',
      failures: [{ id: 'verify.failure.auth.config', message: 'auth module has policy gaps' }]
    })
  );
};


const writeLongitudinalStateFixture = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'longitudinal-state.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        unresolved_risk_summary: { total_open: 3, high: 1, medium: 1, low: 1 },
        recurring_finding_clusters: [{ cluster_id: 'cluster-auth', occurrences: 4, unresolved: 2 }],
        verification_lineage: {
          latest_verification_ref: '.playbook/verify-report.json',
          latest_verified_at: '2026-01-01T00:01:00.000Z',
          latest_approval_refs: ['.playbook/improvement-approvals.json']
        },
        knowledge_lifecycle_summary: { candidate: 2, promoted: 5, superseded: 1 }
      },
      null,
      2
    )
  );
};

const writeExecutionRunsFixture = (repo: string): void => {
  const runsDir = path.join(repo, '.playbook', 'execution-runs');
  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(
    path.join(runsDir, 'pb-exec-0001.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'orchestration-execution-run-state',
        run_id: 'pb-exec-0001',
        source_launch_plan_fingerprint: 'abc123',
        eligible_lanes: ['lane-1'],
        status: 'completed',
        lanes: {
          'lane-1': {
            lane_id: 'lane-1',
            status: 'completed',
            blocker_refs: [],
            receipt_refs: ['execution-state:pb-exec-0001:lane:lane-1:worker:worker-lane-1'],
            worker_id: 'worker-lane-1',
            started_at: '2026-01-01T00:00:00.000Z',
            completed_at: '2026-01-01T00:01:00.000Z',
            updated_at: '2026-01-01T00:01:00.000Z'
          }
        },
        metadata: { runtime: 'execution-supervisor', resumed_from_interrupted_run: false, reconcile_revision: 1 },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:01:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z'
      },
      null,
      2
    )
  );
};

const writeSessionFixture = (repo: string): void => {
  const sessionPath = path.join(repo, '.playbook', 'session.json');
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    JSON.stringify(
      {
        version: 1,
        sessionId: 'session-test',
        repoRoot: repo,
        activeGoal: 'inspect continuity',
        selectedRunId: 'pb-exec-0001',
        pinnedArtifacts: [{ artifact: '.playbook/policy-apply-result.json', kind: 'artifact', pinnedAt: '2026-01-01T00:00:00.000Z' }],
        currentStep: 'resume',
        unresolvedQuestions: [],
        constraints: [],
        evidenceEnvelope: {
          version: 1,
          session_id: 'session-test',
          selected_run_id: 'pb-exec-0001',
          cycle_id: null,
          generated_from_last_updated_time: '2026-01-01T00:02:00.000Z',
          artifacts: [{ path: '.playbook/session.json', kind: 'session', present: true }],
          proposal_ids: [],
          policy_decisions: [],
          execution_result: null,
          lineage: []
        },
        lastUpdatedTime: '2026-01-01T00:02:00.000Z'
      },
      null,
      2
    )
  );
};

describe('runQuery', () => {
  it('prints text output for list fields', async () => {
    const repo = createRepo('playbook-cli-query-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual(['Modules', '───────', 'auth: none', 'workouts: auth', 'analytics: workouts']);

    logSpy.mockRestore();
  });


  it('supports deps and tests repository query fields', async () => {
    const repo = createRepo('playbook-cli-query-new-fields');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const depsExit = await runQuery(repo, ['deps'], { format: 'json', quiet: false });
    expect(depsExit).toBe(ExitCode.Success);
    const depsPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(depsPayload.field).toBe('dependencies');

    logSpy.mockClear();
    const testsExit = await runQuery(repo, ['tests'], { format: 'json', quiet: false });
    expect(testsExit).toBe(ExitCode.Success);
    const testsPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(testsPayload.field).toBe('tests');

    logSpy.mockRestore();
  });

  it('prints JSON output contract', async () => {
    const repo = createRepo('playbook-cli-query-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      command: 'query',
      field: 'modules',
      result: [
        { name: 'auth', dependencies: [] },
        { name: 'workouts', dependencies: ['auth'] },
        { name: 'analytics', dependencies: ['workouts'] }
      ]
    });

    logSpy.mockRestore();
  });

  it('adds continuity summary to query runs output', async () => {
    const repo = createRepo('playbook-cli-query-runs');
    writeExecutionRunsFixture(repo);
    writeSessionFixture(repo);
    writeLongitudinalStateFixture(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['runs'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.type).toBe('runs');
    expect(payload.continuity).toEqual({
      session: {
        active: true,
        sessionId: 'session-test',
        selectedRunId: 'pb-exec-0001',
        activeSessionRefs: ['.playbook/session.json'],
        pinnedEvidenceRefs: ['.playbook/policy-apply-result.json'],
        missingSessionRefs: []
      },
      lineage: {
        latestRunId: 'pb-exec-0001',
        latestRunUpdatedAt: '2026-01-01T00:01:00.000Z',
        latestReceiptRefs: ['execution-state:pb-exec-0001:lane:lane-1:worker:worker-lane-1']
      },
      staleSignals: []
    });

    expect(payload.longitudinal_state).toMatchObject({
      unresolved_risk_summary: { total_open: 3, high: 1, medium: 1, low: 1 },
      recurring_finding_clusters: [{ cluster_id: 'cluster-auth', occurrences: 4, unresolved: 2 }],
      verification_lineage: {
        latest_verification_ref: '.playbook/verify-report.json',
        latest_approval_refs: ['.playbook/improvement-approvals.json']
      },
      knowledge_lifecycle_summary: { candidate: 2, promoted: 5, superseded: 1 }
    });

    expect(payload.control_plane.kind).toBe('playbook-control-plane-state');
    expect(payload.control_plane.receipt_lineage_refs).toContain('execution-state:pb-exec-0001:lane:lane-1:worker:worker-lane-1');

    logSpy.mockRestore();
  });

  it('adds architecture role inference to architecture query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-architecture-json');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['architecture'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.field).toBe('architecture');
    expect(payload.result).toBe('modular-monolith');
    expect(payload.architectureRoleInference).toEqual({
      classificationMode: 'observation-only',
      classifierVersion: 'role-heuristic-v1',
      policyEnforcement: 'none',
      dependencyMatrix: {
        interface: ['foundation', 'adapter'],
        orchestration: ['interface', 'foundation', 'adapter'],
        foundation: ['foundation'],
        adapter: ['interface', 'foundation']
      },
      nodes: [
        { workspace: '@playbook/cli', inferredRole: 'interface', evidence: ['workspace-role:cli'] },
        { workspace: '@playbook/engine', inferredRole: 'orchestration', evidence: ['workspace-role:engine'] }
      ],
      dependencyObservations: [
        {
          from: '@playbook/engine',
          to: '@playbook/cli',
          fromRole: 'orchestration',
          toRole: 'interface',
          status: 'allowed'
        }
      ]
    });

    logSpy.mockRestore();
  });

  it('prints compact inferred roles in architecture query text output', async () => {
    const repo = createRepo('playbook-cli-query-architecture-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['architecture'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Architecture',
      '───────',
      'modular-monolith',
      'Inferred roles: @playbook/cli=interface, @playbook/engine=orchestration'
    ]);

    logSpy.mockRestore();
  });




  it('includes memory-aware fields only when --with-memory is provided', async () => {
    const repo = createRepo('playbook-cli-query-memory-json');
    writeRepoIndex(repo);
    writePromotedPatterns(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const withMemoryExit = await runQuery(repo, ['modules', '--with-memory'], { format: 'json', quiet: false });
    expect(withMemoryExit).toBe(ExitCode.Success);
    const withMemoryPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(typeof withMemoryPayload.memorySummary).toBe('string');
    expect(Array.isArray(withMemoryPayload.memorySources)).toBe(true);
    expect(Array.isArray(withMemoryPayload.knowledgeHits)).toBe(true);
    expect(Array.isArray(withMemoryPayload.recentRelevantEvents)).toBe(true);
    expect(Array.isArray(withMemoryPayload.memoryKnowledge)).toBe(true);

    logSpy.mockClear();
    const legacyExit = await runQuery(repo, ['modules'], { format: 'json', quiet: false });
    expect(legacyExit).toBe(ExitCode.Success);
    const legacyPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(legacyPayload.memorySummary).toBeUndefined();
    expect(legacyPayload.memorySources).toBeUndefined();
    expect(legacyPayload.memoryKnowledge).toBeUndefined();

    logSpy.mockRestore();
  });

  it('writes deterministic query JSON output with --out', async () => {
    const repo = createRepo('playbook-cli-query-out');
    writeRepoIndex(repo);
    const outPath = path.join(repo, '.playbook', 'query-modules.json');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['modules'], { format: 'json', quiet: false, outFile: outPath });

    expect(exitCode).toBe(ExitCode.Success);
    const stdoutPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const artifactPayload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(artifactPayload.data).toEqual(stdoutPayload);
    expect(artifactPayload.artifact).toBe('playbook.artifact');
    expect(artifactPayload.version).toBe(1);
    expect(typeof artifactPayload.generated_at).toBe('string');
    expect(typeof artifactPayload.checksum).toBe('string');

    logSpy.mockRestore();
  });

  it('degrades risk query with deterministic corruption guidance when findings.json is invalid', async () => {
    const repo = createRepo('playbook-cli-query-risk-corrupt-artifact');
    writeRepoIndex(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'findings.json'), 'wrapper contamination\n{\n  "command": "verify"\n}', 'utf8');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.type).toBe('risk');
    expect(payload.signals.verifyFailures).toBe(0);
    expect(payload.warnings[0]).toContain('optional artifact');
    expect(payload.warnings[0]).toContain('Regenerate artifacts with CLI-owned output flags');

    logSpy.mockRestore();
  });

  it('degrades risk query when plan.json contains UTF-16/BOM-like malformed content', async () => {
    const repo = createRepo('playbook-cli-query-risk-corrupt-utf16');
    writeRepoIndex(repo);
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'plan.json'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"command":"plan"}', 'utf16le')]));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.warnings[0]).toContain('.playbook/plan.json');
    expect(payload.warnings[0]).toContain('optional artifact');

    logSpy.mockRestore();
  });


  it('prints dependency query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-dependencies');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['dependencies', 'workouts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'dependencies',
      module: 'workouts',
      resolvedTarget: { input: 'workouts', kind: 'module', selector: 'workouts', canonical: 'module:workouts', matched: true },
      dependencies: ['auth']
    });

    logSpy.mockRestore();
  });


  it('prints impact query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-impact');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.query).toBe('impact');
    expect(payload.target).toBe('auth');
    expect(payload.module).toEqual({ name: 'auth', path: 'src/auth', type: 'module' });
    expect(payload.impact.dependencies).toEqual([]);
    expect(payload.impact.directDependents).toEqual(['workouts']);
    expect(payload.impact.dependents).toEqual(['analytics', 'workouts']);

    logSpy.mockRestore();
  });

  it('prints impact query text output', async () => {
    const repo = createRepo('playbook-cli-query-impact-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'auth'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Impact Analysis',
      '───────────────',
      '',
      'Target module: auth',
      'Module path: src/auth',
      '',
      'Dependencies: none',
      'Direct dependents: workouts',
      'Transitive dependents: analytics, workouts',
      'Risk: medium (0.53)'
    ]);

    logSpy.mockRestore();
  });

  it('fails impact query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-impact-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query impact: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails impact query when module argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-impact-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['impact'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query impact: missing required <module> argument');

    errorSpy.mockRestore();
  });




  it('prints rule-owners query JSON output for all rules', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-all');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'rule-owners',
      rules: [
        {
          ruleId: 'notes.empty',
          area: 'governance',
          owners: ['governance'],
          remediationType: 'notes-maintenance'
        },
        {
          ruleId: 'notes.missing',
          area: 'governance',
          owners: ['governance'],
          remediationType: 'notes-maintenance'
        },
        {
          ruleId: 'PB001',
          area: 'documentation',
          owners: ['docs'],
          remediationType: 'docs-sync'
        },
        {
          ruleId: 'requireNotesOnChanges',
          area: 'governance',
          owners: ['governance'],
          remediationType: 'notes-maintenance'
        },
        {
          ruleId: 'verify.rule.tests.required',
          area: 'quality',
          owners: ['cli', 'testing'],
          remediationType: 'test-coverage'
        }
      ]
    });

    logSpy.mockRestore();
  });

  it('prints rule-owners query JSON output for a single rule', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-single');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners', 'PB001'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'rule-owners',
      rule: {
        ruleId: 'PB001',
        area: 'documentation',
        owners: ['docs'],
        remediationType: 'docs-sync'
      }
    });

    logSpy.mockRestore();
  });

  it('prints rule-owners query text output for a single rule', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-text');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners', 'PB001'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Rule Ownership',
      '──────────────',
      '',
      'Rule: PB001',
      'Area: documentation',
      'Owners: docs',
      'Remediation type: docs-sync'
    ]);

    logSpy.mockRestore();
  });

  it('fails rule-owners query for unknown rules', async () => {
    const repo = createRepo('playbook-cli-query-rule-owners-unknown');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['rule-owners', 'PB404'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query rule-owners: unknown rule "PB404".');

    errorSpy.mockRestore();
  });


  it('prints module-owners query JSON output for all modules', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-all');
    writeRepoIndex(repo);
    writeModuleOwners(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: { minimumFields: ['owners', 'area', 'sourceLocation'], metadataPath: '.playbook/module-owners.json' },
      diagnostics: [
        'Some indexed modules are missing ownership mappings and are marked unresolved-mapping.',
        'Ownership metadata is configured without sourceLocation for one or more modules.'
      ],
      modules: [
        { name: 'analytics', owners: ['data'], area: 'platform', ownership: { status: 'configured', source: '.playbook/module-owners.json' } },
        { name: 'auth', owners: [], area: 'unassigned', ownership: { status: 'unresolved-mapping', source: '.playbook/module-owners.json' } },
        { name: 'workouts', owners: ['fitness'], area: 'product', ownership: { status: 'configured', source: '.playbook/module-owners.json' } }
      ]
    });

    logSpy.mockRestore();
  });

  it('prints module-owners query JSON output for a single module', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-single');
    writeRepoIndex(repo);
    writeModuleOwners(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'workouts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: { minimumFields: ['owners', 'area', 'sourceLocation'], metadataPath: '.playbook/module-owners.json' },
      diagnostics: [
        'Some indexed modules are missing ownership mappings and are marked unresolved-mapping.',
        'Ownership metadata is configured without sourceLocation for one or more modules.'
      ],
      module: {
        name: 'workouts',
        owners: ['fitness'],
        area: 'product',
        ownership: { status: 'configured', source: '.playbook/module-owners.json' }
      }
    });

    logSpy.mockRestore();
  });

  it('prints module-owners query text output for a single module', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-text');
    writeRepoIndex(repo);
    writeModuleOwners(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'workouts'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Module Ownership',
      '────────────────',
      '',
      'Module: workouts',
      'Owners: fitness',
      'Area: product',
      'Ownership status: configured',
      'Ownership source: .playbook/module-owners.json'
    ]);

    logSpy.mockRestore();
  });

  it('falls back deterministically when ownership mapping is missing', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-fallback');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'module-owners',
      contract: { minimumFields: ['owners', 'area', 'sourceLocation'], metadataPath: '.playbook/module-owners.json' },
      diagnostics: ['No ownership metadata configured at .playbook/module-owners.json.'],
      module: {
        name: 'auth',
        owners: [],
        area: 'unassigned',
        ownership: { status: 'no-metadata-configured', source: 'generated-default' }
      }
    });

    logSpy.mockRestore();
  });

  it('fails module-owners query for unknown modules', async () => {
    const repo = createRepo('playbook-cli-query-module-owners-unknown');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['module-owners', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query module-owners: unknown module "missing".');

    errorSpy.mockRestore();
  });




  it('prints patterns query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-patterns-json');
    writePatternsArtifact(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['patterns'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'pattern-compaction',
      patterns: [{ id: 'MODULE_TEST_ABSENCE', bucket: 'testing', occurrences: 3, examples: ['module lacks tests'] }]
    });

    logSpy.mockRestore();
  });

  it('prints test-hotspots query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-test-hotspots-json');
    writeRepoIndex(repo);
    const hotspotFixturePath = path.join(repo, 'packages', 'cli', 'src', 'commands', 'query.hotspot.test.ts');
    fs.mkdirSync(path.dirname(hotspotFixturePath), { recursive: true });
    fs.writeFileSync(
      hotspotFixturePath,
      [
        "import { queryDependencies } from '@zachariahredfield/playbook-engine';",
        '',
        "it('uses broad retrieval', () => {",
        '  const dependencies = queryDependencies(repo);',
        "  const workouts = dependencies.dependencies.find((entry) => entry.name === 'workouts');",
        '  expect(workouts).toBeDefined();',
        '});'
      ].join('\n')
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['test-hotspots'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'test-hotspots',
      hotspots: [
        {
          type: 'broad-retrieval',
          file: 'packages/cli/src/commands/query.hotspot.test.ts',
          line: 4,
          confidence: 'high',
          currentPattern:
            'const dependencies = queryDependencies(repo); followed by dependencies.dependencies.find/filter(...)',
          suggestedReplacementHelper: 'queryDependencies(<repo>, <module>)',
          automationSafety: 'safe-mechanical-refactor'
        }
      ],
      summary: {
        totalHotspots: 1,
        byType: [{ type: 'broad-retrieval', count: 1 }]
      }
    });

    logSpy.mockRestore();
  });

  it('prints test-hotspots query text output', async () => {
    const repo = createRepo('playbook-cli-query-test-hotspots-text');
    writeRepoIndex(repo);
    const hotspotFixturePath = path.join(repo, 'packages', 'cli', 'src', 'commands', 'query.hotspot.test.ts');
    fs.mkdirSync(path.dirname(hotspotFixturePath), { recursive: true });
    fs.writeFileSync(
      hotspotFixturePath,
      [
        "import { queryDependencies } from '@zachariahredfield/playbook-engine';",
        '',
        "it('uses broad retrieval', () => {",
        '  const dependencies = queryDependencies(repo);',
        "  const workouts = dependencies.dependencies.find((entry) => entry.name === 'workouts');",
        '  expect(workouts).toBeDefined();',
        '});'
      ].join('\n')
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['test-hotspots'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Test Hotspots',
      '─────────────',
      '',
      'packages/cli/src/commands/query.hotspot.test.ts:4',
      '  Type: broad-retrieval',
      '  Confidence: high',
      '  Current pattern: const dependencies = queryDependencies(repo); followed by dependencies.dependencies.find/filter(...)',
      '  Suggested helper: queryDependencies(<repo>, <module>)',
      '  Automation safety: safe-mechanical-refactor',
      '',
      'Summary',
      '  Total hotspots: 1',
      '  broad-retrieval: 1'
    ]);

    logSpy.mockRestore();
  });
  it('prints risk query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-risk');
    writeRepoIndex(repo);
    writeVerifyReport(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      schemaVersion: '1.0',
      command: 'query',
      type: 'risk',
      module: 'auth',
      riskLevel: 'medium',
      signals: {
        directDependencies: 0,
        dependents: 1,
        transitiveImpact: 2,
        verifyFailures: 1,
        isArchitecturalHub: false
      }
    });

    logSpy.mockRestore();
  });

  it('prints risk query text output', async () => {
    const repo = createRepo('playbook-cli-query-risk-text');
    writeRepoIndex(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'auth'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toContain('Risk Analysis');
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toContain('Module: auth');

    logSpy.mockRestore();
  });

  it('fails risk query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-risk-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query risk: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('prints docs-coverage query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-docs-coverage-json');
    writeRepoIndex(repo);
    writeDocsCoverageFixtures(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs-coverage'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      schemaVersion: '1.0',
      command: 'query',
      type: 'docs-coverage',
      modules: [
        { module: 'analytics', documented: false, sources: [] },
        { module: 'auth', documented: true, sources: ['docs/ARCHITECTURE.md'] },
        { module: 'workouts', documented: true, sources: ['docs/modules/workouts.md'] }
      ],
      summary: {
        totalModules: 3,
        documentedModules: 2,
        undocumentedModules: 1
      }
    });

    logSpy.mockRestore();
  });

  it('prints docs-coverage query text output', async () => {
    const repo = createRepo('playbook-cli-query-docs-coverage-text');
    writeRepoIndex(repo);
    writeDocsCoverageFixtures(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs-coverage'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      'Documentation Coverage',
      '──────────────────────',
      '',
      'Documented modules',
      '  auth',
      '  workouts',
      '',
      'Undocumented modules',
      '  analytics',
      '',
      'Summary',
      '  2 / 3 modules documented'
    ]);

    logSpy.mockRestore();
  });

  it('fails docs-coverage query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-docs-coverage-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs-coverage', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query docs-coverage: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails risk query when module argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-risk-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['risk'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query risk: missing required <module> argument');

    errorSpy.mockRestore();
  });

  it('fails dependency query for unknown module', async () => {
    const repo = createRepo('playbook-cli-query-dependencies-missing');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['dependencies', 'missing'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query dependencies: unknown module "missing".');

    errorSpy.mockRestore();
  });

  it('fails with clear error for unsupported fields', async () => {
    const repo = createRepo('playbook-cli-query-unsupported');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['docs'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith(
      'playbook query: unsupported field "docs". Supported fields: architecture, framework, language, modules, dependencies, workspace, tests, configs, database, rules.'
    );

    errorSpy.mockRestore();
  });

  it('fails when required field argument is missing', async () => {
    const repo = createRepo('playbook-cli-query-args');
    writeRepoIndex(repo);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, [], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook query: missing required <field> argument');

    errorSpy.mockRestore();
  });
});

describe('command registry', () => {
  it('registers the query command', () => {
    const command = listRegisteredCommands().find((entry) => entry.name === 'query');

    expect(command).toBeDefined();
    expect(command?.description).toBe('Query machine-readable repository intelligence from .playbook/repo-index.json');
  });

  it('prints pattern-review query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-pattern-review');
    writePatternReviewQueue(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['pattern-review'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.kind).toBe('playbook-pattern-review-queue');
    expect(payload.candidates).toHaveLength(1);

    logSpy.mockRestore();
  });

  it('prints compact convergence advisory fields in pattern-review text output', async () => {
    const repo = createRepo('playbook-cli-query-pattern-review-text');
    writePatternReviewQueue(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['pattern-review'], { format: 'text', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const flattened = logSpy.mock.calls.map((call) => String(call[0]));
    expect(flattened.some((line) => line.includes('weighted=0.854'))).toBe(true);
    expect(flattened.some((line) => line.includes('priority=high'))).toBe(true);
    expect(flattened.some((line) => line.includes('cluster=cluster:deterministic-governance-mutation-boundary-read-only-artifact-synthesis'))).toBe(true);

    logSpy.mockRestore();
  });

  it('prints promoted-patterns query JSON output', async () => {
    const repo = createRepo('playbook-cli-query-promoted-patterns');
    writePromotedPatterns(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runQuery(repo, ['promoted-patterns'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.kind).toBe('playbook-promoted-patterns');
    expect(payload.promotedPatterns[0].id).toBe('MODULE_TEST_ABSENCE');

    logSpy.mockRestore();
  });
});
