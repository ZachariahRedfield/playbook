import { MergeResult, SessionConflict, SessionDecision, SessionSnapshot, normalizeText, stableDecisionId, stableHash } from './schema.js';

const stableSort = (values: string[]): string[] =>
  [...values].sort((a, b) => normalizeText(a).localeCompare(normalizeText(b)) || a.localeCompare(b));

const mergeStringArrays = (snapshots: SessionSnapshot[], key: 'constraints' | 'artifacts' | 'tags'): { values: string[]; conflicts: SessionConflict[] } => {
  const canonical = new Map<string, string>();
  const conflicts: SessionConflict[] = [];

  for (const snapshot of snapshots) {
    for (const value of snapshot[key]) {
      const normalized = normalizeText(value);
      const existing = canonical.get(normalized);
      if (!existing) {
        canonical.set(normalized, value.trim());
        continue;
      }
      if (existing !== value.trim()) {
        conflicts.push({
          type: key === 'constraints' ? 'constraint' : key === 'artifacts' ? 'artifact' : 'tag',
          key: normalized,
          ours: existing,
          theirs: value.trim(),
          resolution: 'manual',
          note: 'Equivalent normalized values used different canonical forms.'
        });
      }
    }
  }

  return { values: stableSort(Array.from(canonical.values())), conflicts };
};

const materiallyDifferent = (ours: SessionDecision, theirs: SessionDecision): boolean => {
  const normalizeArray = (items?: string[]): string[] => stableSort((items ?? []).map((item) => item.trim()));
  return (
    normalizeText(ours.decision) === normalizeText(theirs.decision) &&
    (normalizeText(ours.rationale ?? '') !== normalizeText(theirs.rationale ?? '') ||
      JSON.stringify(normalizeArray(ours.alternatives)) !== JSON.stringify(normalizeArray(theirs.alternatives)) ||
      JSON.stringify(normalizeArray(ours.evidence)) !== JSON.stringify(normalizeArray(theirs.evidence)))
  );
};

const sortSnapshots = (snapshots: SessionSnapshot[]): SessionSnapshot[] =>
  [...snapshots].sort(
    (a, b) =>
      normalizeText(a.sessionId).localeCompare(normalizeText(b.sessionId)) ||
      a.createdAt.localeCompare(b.createdAt) ||
      (a.source.hash ?? '').localeCompare(b.source.hash ?? '')
  );

export const mergeSessionSnapshots = (inputs: SessionSnapshot[]): MergeResult => {
  const snapshots = sortSnapshots(inputs);
  const decisionMap = new Map<string, SessionDecision>();
  const conflicts: SessionConflict[] = [];

  for (const snapshot of snapshots) {
    for (const decision of snapshot.decisions) {
      const key = normalizeText(decision.decision);
      const normalized: SessionDecision = {
        ...decision,
        id: stableDecisionId(decision.decision),
        alternatives: decision.alternatives ? stableSort(decision.alternatives) : undefined,
        evidence: decision.evidence ? stableSort(decision.evidence) : undefined
      };
      const existing = decisionMap.get(key);
      if (!existing) {
        decisionMap.set(key, normalized);
        continue;
      }

      if (materiallyDifferent(existing, normalized)) {
        conflicts.push({
          type: 'decision',
          key,
          ours: existing,
          theirs: normalized,
          resolution: 'manual',
          note: 'Decision text matches after normalization but details differ.'
        });
      }
    }
  }

  const mergedDecisions = Array.from(decisionMap.values()).sort(
    (a, b) => normalizeText(a.decision).localeCompare(normalizeText(b.decision)) || a.decision.localeCompare(b.decision)
  );

  const mergedConstraints = mergeStringArrays(snapshots, 'constraints');
  const mergedArtifacts = mergeStringArrays(snapshots, 'artifacts');
  const mergedTags = mergeStringArrays(snapshots, 'tags');

  const mergedSnapshot: SessionSnapshot = {
    sessionId: `merge-${stableHash(snapshots.map((snapshot) => snapshot.sessionId).join('|'), 16)}`,
    source: {
      kind: 'merge',
      name: 'merged-session-snapshot',
      hash: stableHash(JSON.stringify(snapshots.map((snapshot) => snapshot.source.hash ?? snapshot.sessionId)), 16)
    },
    createdAt: snapshots.map((snapshot) => snapshot.createdAt).sort().at(-1) ?? new Date(0).toISOString(),
    repoHint: snapshots.map((snapshot) => snapshot.repoHint).find((value): value is string => Boolean(value)),
    decisions: mergedDecisions,
    constraints: mergedConstraints.values,
    openQuestions: stableSort(
      Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.openQuestions.map((entry) => entry.trim()).filter(Boolean))))
    ),
    artifacts: mergedArtifacts.values,
    nextSteps: stableSort(Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.nextSteps.map((entry) => entry.trim()).filter(Boolean))))),
    tags: mergedTags.values
  };

  const allConflicts = [...conflicts, ...mergedConstraints.conflicts, ...mergedArtifacts.conflicts, ...mergedTags.conflicts].sort(
    (a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key)
  );

  return {
    mergedSnapshot,
    conflicts: allConflicts,
    stats: {
      inputSnapshots: snapshots.length,
      decisionCount: mergedSnapshot.decisions.length,
      constraintCount: mergedSnapshot.constraints.length,
      artifactCount: mergedSnapshot.artifacts.length,
      tagCount: mergedSnapshot.tags.length,
      conflictCount: allConflicts.length
    }
  };
};
