import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runContracts } from './contracts.js';

describe('runContracts', () => {
  it('includes memory artifact and additive command output schema registrations', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runContracts(process.cwd(), { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const schemas = payload.schemas as Record<string, unknown>;
    expect(Array.isArray(schemas.memoryArtifacts)).toBe(true);
    expect(Array.isArray(schemas.commandOutputs)).toBe(true);
    expect((schemas.memoryArtifacts as Array<{ id: string }>).map((entry) => entry.id)).toContain('stories-backlog');
    expect((schemas.memoryArtifacts as Array<{ id: string }>).map((entry) => entry.id)).toContain('test-autofix-remediation-history');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('query.memoryKnowledge');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('knowledge');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('pattern-graph');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('cross-repo-candidates');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('task-execution-profile');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('execution-plan');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('workflow-promotion');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('promotion-receipt');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('outcome-telemetry');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('learning-state');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('improvement-candidates');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('lane-state');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('worker-assignments');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('worker-fragment');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('docs-consolidation-plan');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('repository-events');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('cycle-state');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('cycle-history');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('policy-apply-result');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('session-evidence-envelope');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('pr-review');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('story');
    expect((schemas.commandOutputs as Array<{ id: string }>).map((entry) => entry.id)).toContain('stories');
  });

  it('keeps schema registration identifiers and paths stable', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runContracts(process.cwd(), { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const schemas = payload.schemas as Record<string, unknown>;
    expect(schemas).toEqual({
      memoryArtifacts: [
        { id: 'repository-memory-event', version: '1.0', path: '.playbook/memory/events/*.json' },
        { id: 'repository-memory-index', version: '1.0', path: '.playbook/memory/index.json' },
        { id: 'memory-event', version: '1.0.0', path: '.playbook/memory/events/runtime/*.json' },
        { id: 'candidate-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/candidates/*.json' },
        { id: 'promoted-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/promoted/*.json' },
        { id: 'retired-knowledge-record', version: '1.0.0', path: '.playbook/memory/knowledge/promoted/*.json' },
        { id: 'memory-replay-result', version: '1.0', path: '.playbook/memory/replay/*.json' },
        { id: 'knowledge-candidate-output', version: '1.0', path: '.playbook/knowledge/candidates.json' },
        { id: 'stories-backlog', version: '1.0', path: '.playbook/stories.json' },
        { id: 'test-autofix-remediation-history', version: '1.0', path: '.playbook/test-autofix-history.json' }
      ],
      commandOutputs: [
        // Intentional public schema additions must be reflected here to preserve strict contracts-registry stability coverage.
        { id: 'query.memoryKnowledge', version: '1.0', path: 'schema://cli/query' },
        { id: 'knowledge', version: '1.0', path: 'packages/contracts/src/knowledge.schema.json' },
        { id: 'pattern-graph', version: '1.0', path: 'packages/contracts/src/pattern-graph.schema.json' },
        { id: 'cross-repo-candidates', version: '1.0', path: 'packages/contracts/src/cross-repo-candidates.schema.json' },
        { id: 'task-execution-profile', version: '1.0', path: 'packages/contracts/src/task-execution-profile.schema.json' },
        { id: 'execution-plan', version: '1.0', path: 'packages/contracts/src/execution-plan.schema.json' },
        { id: 'workflow-promotion', version: '1.0', path: 'packages/contracts/src/workflow-promotion.schema.json' },
        { id: 'promotion-receipt', version: '1.0', path: 'packages/contracts/src/promotion-receipt.schema.json' },
        { id: 'workset-plan', version: '1.0', path: 'packages/contracts/src/workset-plan.schema.json' },
        { id: 'outcome-telemetry', version: '1.0', path: 'packages/contracts/src/outcome-telemetry.schema.json' },
        { id: 'learning-state', version: '1.0', path: 'packages/contracts/src/learning-state.schema.json' },
        { id: 'improvement-candidates', version: '1.0', path: 'packages/contracts/src/improvement-candidates.schema.json' },
        { id: 'policy-evaluation', version: '1.0', path: 'packages/contracts/src/policy-evaluation.schema.json' },
        { id: 'policy-apply-result', version: '1.0', path: 'packages/contracts/src/policy-apply-result.schema.json' },
        { id: 'lane-state', version: '1.0', path: 'packages/contracts/src/lane-state.schema.json' },
        { id: 'worker-assignments', version: '1.0', path: 'packages/contracts/src/worker-assignments.schema.json' },
        { id: 'worker-fragment', version: '1.0', path: 'packages/contracts/src/worker-fragment.schema.json' },
        { id: 'docs-consolidation-plan', version: '1.0', path: 'packages/contracts/src/docs-consolidation-plan.schema.json' },
        { id: 'repository-events', version: '1.0', path: 'packages/contracts/src/repository-events.schema.json' },
        { id: 'cycle-state', version: '1.0', path: 'packages/contracts/src/cycle-state.schema.json' },
        { id: 'cycle-history', version: '1.0', path: 'packages/contracts/src/cycle-history.schema.json' },
        { id: 'session-evidence-envelope', version: '1.0', path: 'packages/contracts/src/session-evidence-envelope.schema.json' },
        { id: 'pr-review', version: '1.0', path: 'packages/contracts/src/pr-review.schema.json' },
        { id: 'story', version: '1.0', path: 'packages/contracts/src/story.schema.json' },
        { id: 'stories', version: '1.0', path: 'packages/contracts/src/stories.schema.json' },
        { id: 'explain.memoryKnowledge', version: '1.0', path: 'schema://cli/explain' },
        { id: 'plan.tasks[].advisory.outcomeLearning', version: '1.0', path: 'schema://cli/plan' },
        { id: 'analyze-pr.preventionGuidance', version: '1.0', path: 'schema://cli/analyze-pr' },
        { id: 'analyze-pr.context.sources[].promoted-knowledge', version: '1.0', path: 'schema://cli/analyze-pr' },
        { id: 'test-triage', version: '1.0', path: 'packages/contracts/src/test-triage.schema.json' },
        { id: 'test-fix-plan', version: '1.0', path: 'packages/contracts/src/test-fix-plan.schema.json' },
        { id: 'test-autofix', version: '1.0', path: 'packages/contracts/src/test-autofix.schema.json' },
        { id: 'test-autofix-remediation-history', version: '1.0', path: 'packages/contracts/src/test-autofix-remediation-history.schema.json' }
      ]
    });

    logSpy.mockRestore();
  });
});
