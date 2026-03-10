import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PatternCard } from '../schema/patternCard.js';
import type { PatternEquivalenceArtifact, PatternEquivalenceClass, PatternTopologySignature, PatternVariant } from '../schema/patternTopology.js';

const toMap = (patterns: readonly PatternCard[]): Map<string, PatternCard> => new Map(patterns.map((pattern) => [pattern.patternId, pattern]));

const evidenceCount = (pattern: PatternCard): number => pattern.lineage.evidenceRefs.length;

const reuseRate = (pattern: PatternCard): number =>
  pattern.lineage.parentPatternIds.length + pattern.lineage.priorVersionIds.length + pattern.lineage.sourceGroupIds.length;

const chooseCanonicalPattern = (members: readonly PatternCard[]): PatternCard => {
  const sorted = [...members].sort((left, right) => {
    const evidenceDelta = evidenceCount(right) - evidenceCount(left);
    if (evidenceDelta !== 0) {
      return evidenceDelta;
    }

    const reuseDelta = reuseRate(right) - reuseRate(left);
    if (reuseDelta !== 0) {
      return reuseDelta;
    }

    return left.patternId.localeCompare(right.patternId);
  });

  return sorted[0] as PatternCard;
};

const buildVariant = (member: PatternCard, canonicalPatternId: string): PatternVariant => ({
  patternId: member.patternId,
  canonicalPatternId,
  lineagePreserved: true,
  transformationNotes: [
    `Marked as topology variant of ${canonicalPatternId}.`,
    'Variant kept as-is to preserve lineage and historical promotion semantics.'
  ]
});

export const detectPatternEquivalenceClasses = (
  patterns: readonly PatternCard[],
  signatures: readonly PatternTopologySignature[]
): PatternEquivalenceClass[] => {
  const patternById = toMap(patterns);
  const signatureGroups = new Map<string, PatternTopologySignature[]>();

  for (const signature of signatures) {
    const existing = signatureGroups.get(signature.deterministicInvariantKey) ?? [];
    existing.push(signature);
    signatureGroups.set(signature.deterministicInvariantKey, existing);
  }

  const classes: PatternEquivalenceClass[] = [];

  for (const [invariantKey, groupedSignatures] of [...signatureGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const memberPatterns = groupedSignatures
      .map((signature) => patternById.get(signature.patternId))
      .filter((pattern): pattern is PatternCard => Boolean(pattern))
      .sort((left, right) => left.patternId.localeCompare(right.patternId));

    if (memberPatterns.length === 0) {
      continue;
    }

    const canonicalPattern = chooseCanonicalPattern(memberPatterns);
    const variants = memberPatterns
      .filter((member) => member.patternId !== canonicalPattern.patternId)
      .map((member) => buildVariant(member, canonicalPattern.patternId));

    classes.push({
      classId: `equivalence:${createHash('sha256').update(invariantKey).digest('hex').slice(0, 12)}`,
      signature: groupedSignatures[0] as PatternTopologySignature,
      canonicalPattern,
      memberPatterns,
      variants,
      transformationNotes: [
        'Equivalence detected from deterministic invariants only (stage count, dependencies, contracts, invariant type, mechanism type).',
        'Canonical pattern selected by evidence count, then reuse rate, then pattern id lexical order.'
      ]
    });
  }

  return classes;
};

export const buildPatternEquivalenceArtifact = (
  patterns: readonly PatternCard[],
  signatures: readonly PatternTopologySignature[],
  createdAt = new Date().toISOString()
): PatternEquivalenceArtifact => {
  const equivalenceClasses = detectPatternEquivalenceClasses(patterns, signatures);
  const memberCount = equivalenceClasses.reduce((count, entry) => count + entry.memberPatterns.length, 0);
  const canonicalCount = equivalenceClasses.length;
  const variantCount = equivalenceClasses.reduce((count, entry) => count + entry.variants.length, 0);

  return {
    schemaVersion: '1.0',
    kind: 'playbook-pattern-equivalence',
    artifactId: `pattern-equivalence:${createHash('sha256').update(createdAt).digest('hex').slice(0, 12)}`,
    createdAt,
    equivalenceClasses,
    signatures: [...signatures].sort((left, right) => left.patternId.localeCompare(right.patternId)),
    telemetry: {
      patternEquivalenceCount: equivalenceClasses.filter((entry) => entry.memberPatterns.length > 1).length,
      canonicalizationRate: memberCount === 0 ? 0 : Number((canonicalCount / memberCount).toFixed(4)),
      variantCollapseRate: memberCount === 0 ? 0 : Number((variantCount / memberCount).toFixed(4))
    }
  };
};

export const writePatternEquivalenceArtifact = (
  artifact: PatternEquivalenceArtifact,
  options: { projectRoot: string; timestamp: string; shortSha: string }
): string => {
  const fileName = `${options.timestamp}@${options.shortSha}.json`;
  const relativePath = path.posix.join('.playbook/topology/equivalence', fileName);
  const absolutePath = path.join(options.projectRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  return relativePath;
};
