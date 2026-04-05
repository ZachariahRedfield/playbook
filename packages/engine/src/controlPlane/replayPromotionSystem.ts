import fs from 'node:fs';
import path from 'node:path';

export const REPLAY_PROMOTION_SYSTEM_RELATIVE_PATH = '.playbook/replay-promotion-system.json' as const;

type SourceArtifactState = { path: string; present: boolean; valid: boolean };

type ReplayPromotionLifecycleState = 'candidate' | 'promoted' | 'stale' | 'superseded' | 'retired';

type ReplayPromotionProvenanceRef = {
  replayCandidateIds: string[];
  consolidationCandidateIds: string[];
  compactionReviewIds: string[];
  promotedKnowledgeIds: string[];
  lifecycleRecommendationIds: string[];
  eventRefs: string[];
};

export type ReplayPromotionSystemArtifact = {
  schemaVersion: '1.0';
  kind: 'playbook-replay-promotion-system';
  generatedAt: string;
  replay_candidate_inventory: {
    path: '.playbook/memory/replay-candidates.json';
    count: number;
    byKind: Record<string, number>;
    candidateIds: string[];
  };
  consolidation_candidate_inventory: {
    path: '.playbook/memory/consolidation-candidates.json';
    count: number;
    reviewRequired: number;
    alreadyPromotedMatch: number;
    candidateIds: string[];
  };
  compaction_review_buckets: {
    path: '.playbook/memory/compaction-review.json';
    total: number;
    buckets: {
      discard: number;
      attach: number;
      merge: number;
      new_candidate: number;
    };
    reviewIds: string[];
  };
  salience_review_required_status: {
    replaySalience: {
      max: number;
      min: number;
      average: number;
    };
    reviewRequired: {
      replay: number;
      consolidation: number;
      compaction: number;
    };
  };
  promotion_boundaries: {
    candidateOnly: {
      replay: number;
      consolidation: number;
      compaction: number;
    };
    promotionReady: {
      consolidationEligible: number;
      compactionNewCandidate: number;
    };
    explicitAuthority: {
      mutation: 'read-only';
      promotion: 'review-required';
      autoPromotion: false;
    };
  };
  lifecycle_state_summaries: {
    candidates: number;
    promoted: number;
    stale: number;
    superseded: number;
    retired: number;
    byState: Record<ReplayPromotionLifecycleState, number>;
  };
  provenance_refs_end_to_end: ReplayPromotionProvenanceRef;
  source_artifacts: SourceArtifactState[];
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const readJson = (repoRoot: string, relativePath: string): Record<string, unknown> | null => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const readArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)) : [];

const uniqueSorted = (values: Array<string | null | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const countBy = (values: string[]): Record<string, number> =>
  values.reduce<Record<string, number>>((acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }), {});

const toNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const promotedKnowledgePaths = [
  '.playbook/memory/knowledge/decisions.json',
  '.playbook/memory/knowledge/patterns.json',
  '.playbook/memory/knowledge/failure-modes.json',
  '.playbook/memory/knowledge/invariants.json'
] as const;

const lifecycleStateOf = (entry: Record<string, unknown>): ReplayPromotionLifecycleState => {
  const status = typeof entry.status === 'string' ? entry.status : '';
  if (status === 'superseded') return 'superseded';
  if (status === 'retired') return 'retired';
  if (status === 'stale') return 'stale';
  if (status === 'active' || status === 'promoted') return 'promoted';
  return 'candidate';
};

const buildSourceArtifacts = (repoRoot: string, paths: string[]): SourceArtifactState[] =>
  paths.map((artifactPath) => {
    const parsed = readJson(repoRoot, artifactPath);
    return { path: artifactPath, present: fs.existsSync(path.join(repoRoot, artifactPath)), valid: parsed !== null };
  });

export const readReplayPromotionSystem = (repoRoot: string): ReplayPromotionSystemArtifact => {
  const replayPath = '.playbook/memory/replay-candidates.json' as const;
  const consolidationPath = '.playbook/memory/consolidation-candidates.json' as const;
  const compactionPath = '.playbook/memory/compaction-review.json' as const;
  const lifecyclePath = '.playbook/memory/lifecycle-candidates.json' as const;

  const replay = readJson(repoRoot, replayPath);
  const replayCandidates = readArray(replay?.candidates);

  const consolidation = readJson(repoRoot, consolidationPath);
  const consolidationCandidates = readArray(consolidation?.candidates);

  const compaction = readJson(repoRoot, compactionPath);
  const compactionEntries = readArray(compaction?.entries);

  const lifecycle = readJson(repoRoot, lifecyclePath);
  const lifecycleCandidates = readArray(lifecycle?.candidates);

  const promotedKnowledge = promotedKnowledgePaths.flatMap((artifactPath) => readArray(readJson(repoRoot, artifactPath)?.entries));

  const replaySalience = replayCandidates.map((entry) => toNumber(entry.salienceScore)).filter((value) => value > 0);
  const replayReviewRequired = replayCandidates.filter((entry) => entry.candidateOnly === true || typeof entry.candidateId === 'string').length;
  const consolidationReviewRequired = consolidationCandidates.filter((entry) => entry.promotion && typeof entry.promotion === 'object' && (entry.promotion as Record<string, unknown>).reviewRequired === true).length;
  const compactionReviewRequired = compactionEntries.filter((entry) => entry.promotion && typeof entry.promotion === 'object' && (entry.promotion as Record<string, unknown>).reviewRequired === true).length;

  const lifecycleStates = [
    ...lifecycleCandidates.map((entry) => lifecycleStateOf(entry)),
    ...promotedKnowledge.map((entry) => lifecycleStateOf(entry))
  ];
  const byState = countBy(lifecycleStates) as Record<ReplayPromotionLifecycleState, number>;

  const sourceArtifacts = uniqueSorted([
    replayPath,
    consolidationPath,
    compactionPath,
    lifecyclePath,
    '.playbook/memory-system.json',
    ...promotedKnowledgePaths
  ]);

  return {
    schemaVersion: '1.0',
    kind: 'playbook-replay-promotion-system',
    generatedAt: new Date(0).toISOString(),
    replay_candidate_inventory: {
      path: replayPath,
      count: replayCandidates.length,
      byKind: countBy(replayCandidates.map((entry) => (typeof entry.kind === 'string' ? entry.kind : 'unknown'))),
      candidateIds: uniqueSorted(replayCandidates.map((entry) => (typeof entry.candidateId === 'string' ? entry.candidateId : null)))
    },
    consolidation_candidate_inventory: {
      path: consolidationPath,
      count: consolidationCandidates.length,
      reviewRequired: consolidationCandidates.filter((entry) => (entry.reviewStatus ?? null) === 'review_required').length,
      alreadyPromotedMatch: consolidationCandidates.filter((entry) => (entry.reviewStatus ?? null) === 'already_promoted_match').length,
      candidateIds: uniqueSorted(consolidationCandidates.map((entry) => (typeof entry.consolidationCandidateId === 'string' ? entry.consolidationCandidateId : null)))
    },
    compaction_review_buckets: {
      path: compactionPath,
      total: compactionEntries.length,
      buckets: {
        discard: compactionEntries.filter((entry) => entry.decision && typeof entry.decision === 'object' && (entry.decision as Record<string, unknown>).decision === 'discard').length,
        attach: compactionEntries.filter((entry) => entry.decision && typeof entry.decision === 'object' && (entry.decision as Record<string, unknown>).decision === 'attach').length,
        merge: compactionEntries.filter((entry) => entry.decision && typeof entry.decision === 'object' && (entry.decision as Record<string, unknown>).decision === 'merge').length,
        new_candidate: compactionEntries.filter((entry) => entry.decision && typeof entry.decision === 'object' && (entry.decision as Record<string, unknown>).decision === 'new_candidate').length
      },
      reviewIds: uniqueSorted(compactionEntries.map((entry) => (typeof entry.reviewId === 'string' ? entry.reviewId : null)))
    },
    salience_review_required_status: {
      replaySalience: {
        max: replaySalience.length > 0 ? Math.max(...replaySalience) : 0,
        min: replaySalience.length > 0 ? Math.min(...replaySalience) : 0,
        average: replaySalience.length > 0 ? Number((replaySalience.reduce((sum, value) => sum + value, 0) / replaySalience.length).toFixed(3)) : 0
      },
      reviewRequired: {
        replay: replayReviewRequired,
        consolidation: consolidationReviewRequired,
        compaction: compactionReviewRequired
      }
    },
    promotion_boundaries: {
      candidateOnly: {
        replay: replayCandidates.length,
        consolidation: consolidationCandidates.length,
        compaction: compactionEntries.length
      },
      promotionReady: {
        consolidationEligible: consolidationCandidates.filter((entry) => entry.promotion && typeof entry.promotion === 'object' && (entry.promotion as Record<string, unknown>).eligible === true).length,
        compactionNewCandidate: compactionEntries.filter((entry) => entry.decision && typeof entry.decision === 'object' && (entry.decision as Record<string, unknown>).decision === 'new_candidate').length
      },
      explicitAuthority: {
        mutation: 'read-only',
        promotion: 'review-required',
        autoPromotion: false
      }
    },
    lifecycle_state_summaries: {
      candidates: byState.candidate ?? 0,
      promoted: byState.promoted ?? 0,
      stale: byState.stale ?? 0,
      superseded: byState.superseded ?? 0,
      retired: byState.retired ?? 0,
      byState: {
        candidate: byState.candidate ?? 0,
        promoted: byState.promoted ?? 0,
        stale: byState.stale ?? 0,
        superseded: byState.superseded ?? 0,
        retired: byState.retired ?? 0
      }
    },
    provenance_refs_end_to_end: {
      replayCandidateIds: uniqueSorted(replayCandidates.map((entry) => (typeof entry.candidateId === 'string' ? entry.candidateId : null))),
      consolidationCandidateIds: uniqueSorted(consolidationCandidates.map((entry) => (typeof entry.consolidationCandidateId === 'string' ? entry.consolidationCandidateId : null))),
      compactionReviewIds: uniqueSorted(compactionEntries.map((entry) => (typeof entry.reviewId === 'string' ? entry.reviewId : null))),
      promotedKnowledgeIds: uniqueSorted(promotedKnowledge.map((entry) => (typeof entry.knowledgeId === 'string' ? entry.knowledgeId : null))),
      lifecycleRecommendationIds: uniqueSorted(lifecycleCandidates.map((entry) => (typeof entry.recommendation_id === 'string' ? entry.recommendation_id : null))),
      eventRefs: uniqueSorted([
        ...replayCandidates.flatMap((entry) => readArray(entry.provenance).map((provenance) => `${String(provenance.eventId ?? '')}:${String(provenance.sourcePath ?? '')}`)),
        ...consolidationCandidates.flatMap((entry) => {
          const provenance = entry.provenance && typeof entry.provenance === 'object' ? (entry.provenance as Record<string, unknown>) : null;
          return provenance ? readArray(provenance.events).map((eventRef) => `${String(eventRef.eventId ?? '')}:${String(eventRef.sourcePath ?? '')}`) : [];
        }),
        ...compactionEntries.flatMap((entry) => {
          const provenance = entry.provenance && typeof entry.provenance === 'object' ? (entry.provenance as Record<string, unknown>) : null;
          return provenance ? readArray(provenance.events).map((eventRef) => `${String(eventRef.eventId ?? '')}:${String(eventRef.sourcePath ?? '')}`) : [];
        })
      ])
    },
    source_artifacts: buildSourceArtifacts(repoRoot, sourceArtifacts)
  };
};

export const writeReplayPromotionSystem = (repoRoot: string): ReplayPromotionSystemArtifact => {
  const artifact = readReplayPromotionSystem(repoRoot);
  const absolutePath = path.join(repoRoot, REPLAY_PROMOTION_SYSTEM_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, deterministicStringify(artifact), 'utf8');
  return artifact;
};
