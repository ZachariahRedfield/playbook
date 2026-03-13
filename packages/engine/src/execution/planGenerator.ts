import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryKnowledgeArtifact, MemoryKnowledgeEntry, MemoryKnowledgeKind } from '../memory/knowledge.js';
import type { PlanTask, RuleFailure } from './types.js';

export type Plan = {
  tasks: PlanTask[];
};

type RankedFinding = {
  finding: RuleFailure;
  score: number;
  rationale: PlanTask['advisory'];
};

const KNOWLEDGE_ARTIFACTS: Record<MemoryKnowledgeKind, string> = {
  decision: '.playbook/memory/knowledge/decisions.json',
  pattern: '.playbook/memory/knowledge/patterns.json',
  failure_mode: '.playbook/memory/knowledge/failure-modes.json',
  invariant: '.playbook/memory/knowledge/invariants.json'
};

const compareFindings = (left: RuleFailure, right: RuleFailure): number => {
  const idDiff = left.id.localeCompare(right.id);
  if (idDiff !== 0) {
    return idDiff;
  }

  const leftEvidence = left.evidence ?? '';
  const rightEvidence = right.evidence ?? '';
  const evidenceDiff = leftEvidence.localeCompare(rightEvidence);
  if (evidenceDiff !== 0) {
    return evidenceDiff;
  }

  return left.message.localeCompare(right.message);
};

const stableTaskSeed = (finding: RuleFailure): string =>
  `${finding.id}|${finding.evidence ?? ''}|${finding.fix ?? finding.message}|${Boolean(finding.fix)}`;

const stableTaskId = (seed: string, occurrence: number): string => {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 10);
  return `task-${digest}-${occurrence}`;
};

const toComparableTimestamp = (value: string): number => Date.parse(value) || 0;

const readKnowledgeEntries = (projectRoot: string): MemoryKnowledgeEntry[] => {
  const entries: MemoryKnowledgeEntry[] = [];

  for (const relativePath of Object.values(KNOWLEDGE_ARTIFACTS)) {
    const fullPath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Partial<MemoryKnowledgeArtifact>;
    if (!Array.isArray(parsed.entries)) {
      continue;
    }

    entries.push(
      ...parsed.entries
        .filter((entry): entry is MemoryKnowledgeEntry => Boolean(entry && typeof entry.knowledgeId === 'string'))
        .filter((entry) => entry.status === 'active')
    );
  }

  return entries.sort((left, right) => {
    const promotedDelta = toComparableTimestamp(right.promotedAt) - toComparableTimestamp(left.promotedAt);
    if (promotedDelta !== 0) {
      return promotedDelta;
    }
    return left.knowledgeId.localeCompare(right.knowledgeId);
  });
};

const deriveFindingModule = (finding: RuleFailure): string | null => {
  if (!finding.evidence) {
    return null;
  }
  const [module] = finding.evidence.split(/[\\/]/);
  return module ?? null;
};

const deriveFailureShapeCandidates = (finding: RuleFailure): string[] => {
  const mutability = finding.fix ? 'fixable' : 'manual';
  return [
    `${finding.id}:${mutability}`,
    `${finding.id}:${finding.evidence ?? 'none'}:${mutability}`,
    `${finding.id}|${finding.evidence ?? ''}|${finding.fix ?? finding.message}|${mutability}`
  ];
};

const toConfidence = (entry: MemoryKnowledgeEntry): number => {
  const support = entry.sourceEventFingerprints.length + entry.provenance.length + entry.sourceCandidateIds.length;
  return Math.min(1, Math.max(0.1, support / 10));
};

const rankFinding = (finding: RuleFailure, knowledgeEntries: MemoryKnowledgeEntry[]): RankedFinding => {
  const moduleName = deriveFindingModule(finding);
  const failureShapes = new Set(deriveFailureShapeCandidates(finding));

  const scored = knowledgeEntries
    .map((entry) => {
      const ruleIdMatched = entry.ruleId === finding.id;
      const moduleMatched = Boolean(moduleName && entry.module === moduleName);
      const failureShapeMatched = failureShapes.has(entry.failureShape);
      const score = (ruleIdMatched ? 3 : 0) + (moduleMatched ? 2 : 0) + (failureShapeMatched ? 2 : 0);
      return { entry, score, ruleIdMatched, moduleMatched, failureShapeMatched };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.entry.knowledgeId.localeCompare(right.entry.knowledgeId);
    });

  if (scored.length === 0) {
    return { finding, score: 0, rationale: undefined };
  }

  const top = scored[0];
  const influencedByKnowledgeIds = scored.slice(0, 3).map((candidate) => candidate.entry.knowledgeId);

  return {
    finding,
    score: top.score,
    rationale: {
      outcomeLearning: {
        influencedByKnowledgeIds,
        rationale: `Ranked using promoted outcome knowledge (${influencedByKnowledgeIds.join(', ')}).`,
        scope: {
          ruleIdMatched: top.ruleIdMatched,
          moduleMatched: top.moduleMatched,
          failureShapeMatched: top.failureShapeMatched
        },
        support: {
          sourceCandidateCount: top.entry.sourceCandidateIds.length,
          provenanceCount: top.entry.provenance.length,
          eventFingerprintCount: top.entry.sourceEventFingerprints.length
        },
        confidence: toConfidence(top.entry)
      }
    }
  };
};

export class PlanGenerator {
  constructor(private readonly options: { projectRoot?: string; enableOutcomeLearning?: boolean } = {}) {}

  generate(findings: RuleFailure[]): Plan {
    const baseline = [...findings].sort(compareFindings);
    const knowledgeEntries = this.options.enableOutcomeLearning !== false && this.options.projectRoot
      ? readKnowledgeEntries(this.options.projectRoot)
      : [];
    const ranked = baseline.map((finding) => rankFinding(finding, knowledgeEntries));
    const sortedFindings = ranked
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return compareFindings(left.finding, right.finding);
      });
    const seen = new Map<string, number>();

    return {
      tasks: sortedFindings.map(({ finding, rationale }) => {
        const action = finding.fix ?? finding.message;
        const autoFix = Boolean(finding.fix);
        const seed = stableTaskSeed(finding);
        const occurrence = (seen.get(seed) ?? 0) + 1;
        seen.set(seed, occurrence);

        return {
          id: stableTaskId(seed, occurrence),
          ruleId: finding.id,
          file: finding.evidence ?? null,
          action,
          autoFix,
          ...(rationale ? { advisory: rationale } : {})
        };
      })
    };
  }
}
