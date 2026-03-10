import type { KnowledgeFunctor } from '../schema/functor.js';

export const FUNCTOR_REGISTRY: KnowledgeFunctor[] = [
  {
    schemaVersion: '1.0',
    kind: 'playbook-knowledge-functor',
    functorId: 'functor.pattern.to.contract-proposal',
    sourceKind: 'playbook-pattern-card',
    targetDomain: 'contract-proposal',
    description: 'Maps pattern cards into deterministic contract proposal payloads.',
    mapping: {
      mappingId: 'mapping.pattern.contract-proposal.v1',
      sourceKind: 'playbook-pattern-card',
      targetKind: 'playbook-contract-proposal-template',
      targetDomain: 'contract-proposal',
      transformVersion: '1.0.0',
      description: 'Preserves mechanism/invariant/dependencies while generating contract proposal scaffolds.',
      preserveFields: ['mechanism', 'invariant', 'dependencies']
    }
  },
  {
    schemaVersion: '1.0',
    kind: 'playbook-knowledge-functor',
    functorId: 'functor.pattern.to.documentation-template',
    sourceKind: 'playbook-pattern-card',
    targetDomain: 'documentation-template',
    description: 'Maps pattern cards into deterministic documentation templates.',
    mapping: {
      mappingId: 'mapping.pattern.documentation-template.v1',
      sourceKind: 'playbook-pattern-card',
      targetKind: 'playbook-doc-template',
      targetDomain: 'documentation-template',
      transformVersion: '1.0.0',
      description: 'Preserves structural invariants to build doctrine-ready docs templates.',
      preserveFields: ['mechanism', 'invariant', 'dependencies']
    }
  },
  {
    schemaVersion: '1.0',
    kind: 'playbook-knowledge-functor',
    functorId: 'functor.pattern.to.ci-rule',
    sourceKind: 'playbook-pattern-card',
    targetDomain: 'ci-rule',
    description: 'Maps pattern cards into deterministic CI rule stubs.',
    mapping: {
      mappingId: 'mapping.pattern.ci-rule.v1',
      sourceKind: 'playbook-pattern-card',
      targetKind: 'playbook-ci-rule-template',
      targetDomain: 'ci-rule',
      transformVersion: '1.0.0',
      description: 'Preserves mechanism/invariant/dependencies as CI assertions.',
      preserveFields: ['mechanism', 'invariant', 'dependencies']
    }
  }
];

export const getFunctorById = (functorId: string): KnowledgeFunctor | undefined =>
  FUNCTOR_REGISTRY.find((functor) => functor.functorId === functorId);
