import { createHash } from 'node:crypto';
import type { PatternCard } from '../schema/patternCard.js';
import type { FunctorApplication, FunctorApplicationArtifact, FunctorTargetDomain, KnowledgeFunctor } from '../schema/functor.js';
import { FUNCTOR_REGISTRY, getFunctorById } from './registry.js';

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

const stableDigest = (input: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');

const deriveDependencies = (pattern: PatternCard): string[] =>
  uniqueSorted([
    ...pattern.linkedContractRefs,
    ...pattern.lineage.parentPatternIds,
    ...pattern.lineage.priorVersionIds
  ]);

const buildOutput = (targetDomain: FunctorTargetDomain, pattern: PatternCard, dependencies: string[]): Record<string, unknown> => {
  if (targetDomain === 'contract-proposal') {
    return {
      contractProposalTemplate: {
        ruleTarget: pattern.linkedContractRefs[0] ?? `rule:${pattern.patternId}`,
        title: pattern.title,
        summary: pattern.summary,
        mechanism: pattern.mechanism,
        invariant: pattern.invariant,
        dependencies
      }
    };
  }

  if (targetDomain === 'documentation-template') {
    return {
      documentationTemplate: {
        heading: `Pattern: ${pattern.title}`,
        sections: [
          { key: 'summary', value: pattern.summary },
          { key: 'mechanism', value: pattern.mechanism ?? '' },
          { key: 'invariant', value: pattern.invariant ?? '' },
          { key: 'dependencies', value: dependencies.join(', ') }
        ]
      }
    };
  }

  return {
    ciRuleTemplate: {
      ruleId: `ci.rule.${pattern.canonicalKey}`,
      assert: pattern.invariant ?? pattern.summary,
      rationale: pattern.mechanism ?? pattern.summary,
      dependencies
    }
  };
};

const buildFunctorApplication = (functor: KnowledgeFunctor, pattern: PatternCard, generatedAt: string): FunctorApplication => {
  const dependencies = deriveDependencies(pattern);
  const output = buildOutput(functor.targetDomain, pattern, dependencies);
  const structuralInvariantProjection = {
    mechanism: pattern.mechanism,
    invariant: pattern.invariant,
    dependencies
  };

  const deterministicDigest = stableDigest({
    functorId: functor.functorId,
    mappingId: functor.mapping.mappingId,
    patternId: pattern.patternId,
    canonicalKey: pattern.canonicalKey,
    structuralInvariantProjection,
    output
  });

  return {
    schemaVersion: '1.0',
    kind: 'playbook-functor-application',
    applicationId: `functor-application:${functor.functorId}:${pattern.patternId}:${deterministicDigest.slice(0, 12)}`,
    functorId: functor.functorId,
    mappingId: functor.mapping.mappingId,
    inputKind: 'playbook-pattern-card',
    outputKind: functor.mapping.targetKind,
    outputDomain: functor.targetDomain,
    structuralInvariantProjection,
    deterministicDigest,
    lineage: {
      sourcePatternId: pattern.patternId,
      sourceCanonicalKey: pattern.canonicalKey,
      sourceArtifactPath: pattern.lineage.sourceArtifactPaths[0],
      sourceEvidenceRefs: uniqueSorted(pattern.lineage.evidenceRefs),
      generatedAt
    },
    output
  };
};

export type ApplyFunctorInput = {
  pattern: PatternCard;
  functorId?: string;
  generatedAt?: string;
};

export const applyFunctor = ({ pattern, functorId, generatedAt }: ApplyFunctorInput): FunctorApplicationArtifact => {
  const createdAt = generatedAt ?? new Date().toISOString();
  const selectedFunctors = functorId ? [getFunctorById(functorId)].filter((entry): entry is KnowledgeFunctor => Boolean(entry)) : FUNCTOR_REGISTRY;

  if (selectedFunctors.length === 0) {
    throw new Error(`unknown functor: ${functorId ?? 'undefined'}`);
  }

  const applications = selectedFunctors
    .map((functor) => buildFunctorApplication(functor, pattern, createdAt))
    .sort((left, right) => left.functorId.localeCompare(right.functorId));

  const artifactSeed = {
    patternId: pattern.patternId,
    generatedAt: createdAt,
    applications: applications.map((application) => application.deterministicDigest)
  };

  return {
    schemaVersion: '1.0',
    kind: 'playbook-functor-output',
    artifactId: `functor-output:${pattern.patternId}:${stableDigest(artifactSeed).slice(0, 12)}`,
    generatedAt: createdAt,
    applications
  };
};
