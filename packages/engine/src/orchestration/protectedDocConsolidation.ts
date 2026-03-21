import fs from 'node:fs';
import path from 'node:path';
import type { DocsConsolidationArtifact } from '../docs/consolidate.js';
import type { DocsConsolidationPlanArtifact } from '../docs/consolidationPlan.js';

export type ProtectedDocConsolidationStage = 'not_applicable' | 'pending' | 'blocked' | 'plan_ready' | 'applied';

export type ProtectedDocConsolidationStatus = {
  has_protected_doc_work: boolean;
  stage: ProtectedDocConsolidationStage;
  summary: string;
  next_command: string | null;
};

type DocsPlanTask = DocsConsolidationPlanArtifact['tasks'][number];
type DocsPlanExclusion = DocsConsolidationPlanArtifact['excluded'][number];

const PROTECTED_SINGLETON_DOCS = new Set([
  'docs/CHANGELOG.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/commands/orchestrate.md',
  'docs/commands/workers.md'
]);

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const readJsonIfPresent = <T>(cwd: string, relativePath: string): T | undefined => {
  const absolutePath = path.join(cwd, relativePath);
  if (!fs.existsSync(absolutePath)) return undefined;
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
};

const taskIsApplied = (cwd: string, task: DocsPlanTask): boolean => {
  if (!task.file || !task.write) return false;
  const absolutePath = path.join(cwd, task.file);
  if (!fs.existsSync(absolutePath)) return false;
  const current = fs.readFileSync(absolutePath, 'utf8');
  const { operation, content, startMarker, endMarker, anchor } = task.write;

  if (operation === 'replace-managed-block' || operation === 'append-managed-block') {
    return current.includes(content) && current.includes(startMarker) && current.includes(endMarker);
  }

  if (!anchor) return false;
  const anchorIndex = current.indexOf(anchor);
  const contentIndex = current.indexOf(content);
  return anchorIndex >= 0 && contentIndex > anchorIndex && current.includes(startMarker) && current.includes(endMarker);
};

const laneHasProtectedDocWork = (surfaces: readonly string[]): boolean => surfaces.some((surface) => PROTECTED_SINGLETON_DOCS.has(surface));

const summarizeTargets = (targets: readonly string[]): string => {
  if (targets.length === 0) return 'protected-doc consolidation';
  if (targets.length === 1) return targets[0]!;
  return `${targets.length} protected docs`;
};

export const computeProtectedDocConsolidationStatus = (
  cwd: string,
  laneId: string,
  surfaces: readonly string[]
): ProtectedDocConsolidationStatus => {
  const protectedTargets = uniqueSorted(surfaces.filter((surface) => PROTECTED_SINGLETON_DOCS.has(surface)));
  if (!laneHasProtectedDocWork(protectedTargets)) {
    return {
      has_protected_doc_work: false,
      stage: 'not_applicable',
      summary: 'no protected-doc work',
      next_command: null
    };
  }

  const consolidation = readJsonIfPresent<DocsConsolidationArtifact>(cwd, '.playbook/docs-consolidation.json');
  const plan = readJsonIfPresent<DocsConsolidationPlanArtifact>(cwd, '.playbook/docs-consolidation-plan.json');

  const issueMatches = (consolidation?.issues ?? []).filter((issue) =>
    issue.laneIds.includes(laneId) || protectedTargets.includes(issue.targetDoc)
  );
  const exclusionMatches = (plan?.excluded ?? []).filter((entry: DocsPlanExclusion) =>
    entry.lane_ids.includes(laneId) || protectedTargets.includes(entry.target_doc)
  );
  if (issueMatches.length > 0 || exclusionMatches.length > 0) {
    return {
      has_protected_doc_work: true,
      stage: 'blocked',
      summary: 'blocked by conflicts',
      next_command: 'pnpm playbook docs consolidate --json'
    };
  }

  const taskMatches = (plan?.tasks ?? []).filter((task: DocsPlanTask) =>
    ((task.provenance?.lane_ids ?? []) as string[]).includes(laneId) || (task.file ? protectedTargets.includes(task.file) : false)
  );
  if (taskMatches.length > 0) {
    const allApplied = taskMatches.every((task) => taskIsApplied(cwd, task));
    if (allApplied) {
      return {
        has_protected_doc_work: true,
        stage: 'applied',
        summary: 'protected-doc consolidation applied',
        next_command: null
      };
    }

    return {
      has_protected_doc_work: true,
      stage: 'plan_ready',
      summary: 'pending protected-doc consolidation',
      next_command: 'pnpm playbook apply --from-plan .playbook/docs-consolidation-plan.json'
    };
  }

  const consolidatedTargets = (consolidation?.consolidatedTargets ?? []).filter((target) =>
    target.laneIds.includes(laneId) || protectedTargets.includes(target.targetDoc)
  );
  if (consolidatedTargets.length > 0 || protectedTargets.length > 0) {
    return {
      has_protected_doc_work: true,
      stage: 'pending',
      summary: 'pending protected-doc consolidation',
      next_command: consolidation ? 'pnpm playbook docs consolidate-plan --json' : 'pnpm playbook docs consolidate --json'
    };
  }

  return {
    has_protected_doc_work: true,
    stage: 'pending',
    summary: `pending protected-doc consolidation for ${summarizeTargets(protectedTargets)}`,
    next_command: 'pnpm playbook docs consolidate --json'
  };
};
