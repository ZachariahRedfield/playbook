import { createHash } from 'node:crypto';
import type { PatternCard } from '../schema/patternCard.js';
import type { PatternTopologySignature } from '../schema/patternTopology.js';

const normalize = (value: string | undefined): string => (value ?? 'unspecified').trim().toLowerCase().replace(/\s+/g, '-');

const uniqueSorted = (items: readonly string[] | undefined): string[] =>
  [...new Set((items ?? []).map((item) => item.trim()).filter((item) => item.length > 0))].sort((a, b) => a.localeCompare(b));

export const buildPatternTopologySignature = (pattern: PatternCard): PatternTopologySignature => {
  const stageCount = Math.max(1, pattern.topology?.stageCount ?? 1);
  const dependencyStructure = uniqueSorted(pattern.topology?.dependencyStructure);
  const contractReferences = uniqueSorted(pattern.linkedContractRefs);
  const invariantType = normalize(pattern.invariant);
  const mechanismType = normalize(pattern.mechanism);

  const deterministicInvariantKey = createHash('sha256')
    .update(JSON.stringify({ stageCount, dependencyStructure, contractReferences, invariantType, mechanismType }))
    .digest('hex')
    .slice(0, 20);

  return {
    schemaVersion: '1.0',
    kind: 'playbook-pattern-topology-signature',
    patternId: pattern.patternId,
    stageCount,
    dependencyStructure,
    contractReferences,
    invariantType,
    mechanismType,
    deterministicInvariantKey
  };
};

export const buildPatternTopologySignatures = (patterns: readonly PatternCard[]): PatternTopologySignature[] =>
  patterns.map((pattern) => buildPatternTopologySignature(pattern));
