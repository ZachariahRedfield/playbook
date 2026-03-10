import { describe, expect, it } from 'vitest';
import { buildPatternTopologySignatures } from '../src/topology/buildPatternTopology.js';
import { buildPatternEquivalenceArtifact, detectPatternEquivalenceClasses } from '../src/topology/detectEquivalence.js';
import type { PatternCard } from '../src/schema/patternCard.js';

const basePattern = (patternId: string, overrides: Partial<PatternCard> = {}): PatternCard => ({
  schemaVersion: '1.0',
  kind: 'playbook-pattern-card',
  patternId,
  canonicalKey: `${patternId}:canonical`,
  title: patternId,
  summary: 'Topology test pattern',
  mechanism: 'Decision Morphism',
  invariant: 'Append-only Journal',
  linkedContractRefs: ['contract.journal'],
  state: 'promoted',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  currentVersion: 1,
  versionHistory: [],
  lineage: {
    originCycleIds: ['cycle.1'],
    sourceDraftIds: ['draft.1'],
    sourceGroupIds: ['group.1'],
    sourceZettelIds: ['zettel.1'],
    sourceArtifactPaths: ['.playbook/run-cycles/1.json'],
    evidenceRefs: ['evidence.1'],
    parentPatternIds: [],
    priorVersionIds: [],
    decisionIds: ['decision.1']
  },
  versionRef: {
    versionId: `${patternId}:v1`,
    patternId,
    version: 1,
    artifactPath: `.playbook/pattern-cards/versions/${patternId}.json`,
    decisionId: 'decision.1'
  },
  topology: {
    stageCount: 3,
    dependencyStructure: ['collect->normalize', 'normalize->verify', 'verify->promote']
  },
  ...overrides
});

describe('pattern topology equivalence', () => {
  it('builds deterministic signatures from invariant topology fields', () => {
    const pattern = basePattern('pattern.a', {
      linkedContractRefs: ['contract.journal', 'contract.journal'],
      topology: { stageCount: 3, dependencyStructure: ['normalize->verify', 'collect->normalize', 'verify->promote'] }
    });

    const first = buildPatternTopologySignatures([pattern])[0];
    const second = buildPatternTopologySignatures([pattern])[0];

    expect(first).toEqual(second);
    expect(first.contractReferences).toEqual(['contract.journal']);
    expect(first.dependencyStructure).toEqual(['collect->normalize', 'normalize->verify', 'verify->promote']);
  });

  it('groups equivalent patterns and deterministically picks a canonical pattern', () => {
    const canonical = basePattern('pattern.canonical', {
      lineage: {
        ...basePattern('pattern.temp').lineage,
        evidenceRefs: ['e1', 'e2', 'e3'],
        sourceGroupIds: ['g1', 'g2']
      }
    });

    const variant = basePattern('pattern.variant', {
      lineage: {
        ...basePattern('pattern.temp2').lineage,
        evidenceRefs: ['e1'],
        sourceGroupIds: ['g1']
      }
    });

    const distinct = basePattern('pattern.distinct', {
      topology: { stageCount: 1, dependencyStructure: ['collect->promote'] },
      mechanism: 'Threshold Gate'
    });

    const patterns = [variant, distinct, canonical];
    const signatures = buildPatternTopologySignatures(patterns);
    const classes = detectPatternEquivalenceClasses(patterns, signatures);

    const equivalent = classes.find((entry) => entry.memberPatterns.length === 2);
    expect(equivalent?.canonicalPattern.patternId).toBe('pattern.canonical');
    expect(equivalent?.variants[0]?.patternId).toBe('pattern.variant');
    expect(equivalent?.variants[0]?.lineagePreserved).toBe(true);

    const artifact = buildPatternEquivalenceArtifact(patterns, signatures, '2026-02-01T00:00:00.000Z');
    expect(artifact.telemetry.patternEquivalenceCount).toBe(1);
    expect(artifact.telemetry.canonicalizationRate).toBeCloseTo(0.6667, 4);
    expect(artifact.telemetry.variantCollapseRate).toBeCloseTo(0.3333, 4);
  });
});
