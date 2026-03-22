import fs from 'node:fs';
import path from 'node:path';
import type { ReportFailure } from '../../report/types.js';
import type { DocsConsolidationPlanArtifact } from '../../docs/consolidationPlan.js';
import type { LaneStateArtifact, LaneStateEntry } from '../../orchestration/laneState.js';
import type { WorkerResultsArtifact } from '../../orchestration/workerResults.js';

type PolicyApplyEntry = {
  proposal_id?: string;
  reason?: string;
  error?: string;
};

type PolicyApplyResultArtifact = {
  skipped_blocked?: PolicyApplyEntry[];
  failed_execution?: PolicyApplyEntry[];
};

const PROTECTED_DOCS = new Set([
  'docs/CHANGELOG.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/commands/orchestrate.md',
  'docs/commands/workers.md'
]);

const readJsonIfPresent = <T>(repoRoot: string, relativePath: string): T | undefined => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return undefined;
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
};

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));

const summarize = (values: readonly string[]): string => values.length === 0 ? 'none' : values.join(', ');

const buildEvidence = (input: { decision: string; status: string; affectedSurfaces: string[]; blockers: string[]; nextAction: string }): string =>
  `decision=${input.decision}; status=${input.status}; affected_surfaces=${summarize(input.affectedSurfaces)}; blockers=${summarize(input.blockers)}; next_action=${input.nextAction}`;

const laneHasProtectedWork = (lane: LaneStateEntry): boolean => lane.protected_doc_consolidation?.has_protected_doc_work === true;

const protectedFragmentTargets = (workerResults: WorkerResultsArtifact | undefined): string[] =>
  uniqueSorted(
    (workerResults?.results ?? [])
      .flatMap((result) => result.fragment_refs ?? [])
      .map((ref) => ref.target_path)
      .filter((target): target is string => typeof target === 'string' && PROTECTED_DOCS.has(target))
  );

const matchesDocsDriftSignal = (entry: PolicyApplyEntry, reviewedTaskIds: Set<string>): boolean => {
  const proposalId = typeof entry.proposal_id === 'string' ? entry.proposal_id : '';
  const combined = `${entry.reason ?? ''} ${entry.error ?? ''}`.toLowerCase();
  return reviewedTaskIds.has(proposalId)
    || combined.includes('docs consolidation conflict')
    || combined.includes('target-drift-detected')
    || combined.includes('protected-doc')
    || combined.includes('singleton-doc');
};

export const verifyProtectedDocGovernance = (repoRoot: string): ReportFailure[] => {
  const laneState = readJsonIfPresent<LaneStateArtifact>(repoRoot, '.playbook/lane-state.json');
  const workerResults = readJsonIfPresent<WorkerResultsArtifact>(repoRoot, '.playbook/worker-results.json');
  const docsPlan = readJsonIfPresent<DocsConsolidationPlanArtifact>(repoRoot, '.playbook/docs-consolidation-plan.json');
  const policyApply = readJsonIfPresent<PolicyApplyResultArtifact>(repoRoot, '.playbook/policy-apply-result.json');

  const failures: ReportFailure[] = [];
  const protectedFragments = protectedFragmentTargets(workerResults);
  const protectedLanes = (laneState?.lanes ?? []).filter((lane) => laneHasProtectedWork(lane));
  const pendingLanes = uniqueSorted(protectedLanes.filter((lane) => ['pending', 'plan_ready'].includes(lane.protected_doc_consolidation.stage)).map((lane) => lane.lane_id));
  const blockedLanes = uniqueSorted(protectedLanes.filter((lane) => lane.protected_doc_consolidation.stage === 'blocked').map((lane) => lane.lane_id));
  const blockedTargets = uniqueSorted(
    protectedLanes
      .filter((lane) => lane.protected_doc_consolidation.stage === 'blocked')
      .flatMap((lane) => (lane.conflict_surface_paths ?? []).filter((surface) => PROTECTED_DOCS.has(surface)))
  );

  if (protectedFragments.length > 0 && !docsPlan) {
    failures.push({
      id: 'protected-doc.consolidation.plan.missing',
      message: 'Protected-doc fragments exist but no reviewed consolidation plan was found.',
      evidence: buildEvidence({
        decision: 'fail_closed',
        status: 'reviewed consolidation plan missing',
        affectedSurfaces: protectedFragments,
        blockers: ['.playbook/docs-consolidation-plan.json missing'],
        nextAction: 'Run `pnpm playbook docs consolidate-plan --json`.'
      }),
      fix: 'Run `pnpm playbook docs consolidate-plan --json`.'
    });
  }

  if (blockedLanes.length > 0) {
    failures.push({
      id: 'protected-doc.consolidation.blocked',
      message: 'Protected-doc consolidation is blocked by reviewed conflicts.',
      evidence: buildEvidence({
        decision: 'fail_closed',
        status: 'protected-doc consolidation blocked',
        affectedSurfaces: blockedTargets.length > 0 ? blockedTargets : protectedFragmentTargets(workerResults),
        blockers: blockedLanes.map((laneId) => `lane:${laneId}`),
        nextAction: 'Resolve consolidation conflicts, then rerun `pnpm playbook docs consolidate --json`.'
      }),
      fix: 'Resolve consolidation conflicts, then rerun `pnpm playbook docs consolidate --json`.'
    });
  }

  if (pendingLanes.length > 0) {
    const planTargets = uniqueSorted((docsPlan?.tasks ?? []).map((task) => task.file).filter((value): value is string => typeof value === 'string' && PROTECTED_DOCS.has(value)));
    failures.push({
      id: 'protected-doc.consolidation.pending',
      message: 'Protected-doc consolidation remains unresolved.',
      evidence: buildEvidence({
        decision: 'fail_closed',
        status: docsPlan ? 'protected-doc consolidation pending apply' : 'protected-doc consolidation pending review',
        affectedSurfaces: planTargets.length > 0 ? planTargets : protectedFragments,
        blockers: pendingLanes.map((laneId) => `lane:${laneId}`),
        nextAction: docsPlan
          ? 'Run `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json`.'
          : 'Run `pnpm playbook docs consolidate --json`, then `pnpm playbook docs consolidate-plan --json`.'
      }),
      fix: docsPlan
        ? 'Run `pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json`.'
        : 'Run `pnpm playbook docs consolidate --json`, then `pnpm playbook docs consolidate-plan --json`.'
    });
  }

  const reviewedTaskIds = new Set(uniqueSorted((docsPlan?.tasks ?? []).map((task) => task.id)));
  const driftEntries = uniqueSorted([
    ...((policyApply?.skipped_blocked ?? []).filter((entry) => matchesDocsDriftSignal(entry, reviewedTaskIds)).map((entry) => entry.proposal_id ?? 'unknown')),
    ...((policyApply?.failed_execution ?? []).filter((entry) => matchesDocsDriftSignal(entry, reviewedTaskIds)).map((entry) => entry.proposal_id ?? 'unknown'))
  ]);

  if (driftEntries.length > 0) {
    const planTargets = uniqueSorted((docsPlan?.tasks ?? []).map((task) => task.file).filter((value): value is string => typeof value === 'string' && PROTECTED_DOCS.has(value)));
    failures.push({
      id: 'protected-doc.apply.drift-conflict',
      message: 'Guarded apply detected drift on reviewed singleton-doc targets.',
      evidence: buildEvidence({
        decision: 'fail_closed',
        status: 'guarded apply drift conflict',
        affectedSurfaces: planTargets,
        blockers: driftEntries.map((proposalId) => `proposal:${proposalId}`),
        nextAction: 'Regenerate the reviewed docs-consolidation-plan artifact before applying again.'
      }),
      fix: 'Regenerate the reviewed docs-consolidation-plan artifact before applying again.'
    });
  }

  return failures.sort((left, right) => left.id.localeCompare(right.id));
};
