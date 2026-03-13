import { describe, expect, it } from 'vitest';
import {
  MEMORY_CONTRACT_SCHEMA_VERSION,
  assertMemoryLifecycleTransition,
  createCandidateKnowledgeRecord,
  createEventFingerprint,
  createEventInstanceId,
  createMemoryEvent,
  createMemorySchemaMetadata,
  isSupportedMemorySchemaVersion,
  memoryArtifactPaths,
  promoteCandidateKnowledgeRecord,
  retirePromotedKnowledgeRecord
} from '../src/contracts/memory.js';

describe('memory contracts', () => {
  it('creates deterministic event fingerprints for semantically equivalent dimensions', () => {
    const a = createEventFingerprint({
      eventType: 'rule-finding',
      canonicalKey: 'PB-V08-MEMORY-SYSTEM-001',
      dimensions: ['repo:playbook', 'rule:pb-v08', 'scope:memory']
    });
    const b = createEventFingerprint({
      eventType: 'rule-finding',
      canonicalKey: 'PB-V08-MEMORY-SYSTEM-001',
      dimensions: ['scope:memory', 'rule:pb-v08', 'repo:playbook', 'repo:playbook']
    });

    expect(a).toEqual(b);
  });

  it('creates deterministic event instance ids for one concrete capture instance', () => {
    const fingerprint = createEventFingerprint({
      eventType: 'rule-finding',
      canonicalKey: 'retrieval-provenance'
    });

    const idA = createEventInstanceId({
      repoId: 'ZachariahRedfield/playbook',
      eventType: 'rule-finding',
      occurredAt: 1710000000000,
      eventFingerprint: fingerprint
    });
    const idB = createEventInstanceId({
      repoId: 'ZachariahRedfield/playbook',
      eventType: 'rule-finding',
      occurredAt: 1710000000000,
      eventFingerprint: fingerprint
    });

    expect(idA).toBe(idB);
  });

  it('enforces candidate -> promoted -> retired lifecycle transitions', () => {
    const candidate = createCandidateKnowledgeRecord({
      canonicalKey: 'pattern:fast-episodic-store-slow-doctrine-store',
      createdAt: 1710000000100,
      sourceEventInstanceIds: ['evt_0001'],
      sourceEventFingerprints: ['evtfp_0001'],
      salience: {
        scoreVersion: '1',
        score: 0.92,
        reasonCodes: ['pattern-frequency', 'rule-alignment'],
        scoredAt: 1710000000200
      }
    });

    expect(() => assertMemoryLifecycleTransition('candidate', 'promoted')).not.toThrow();
    expect(() => assertMemoryLifecycleTransition('candidate', 'retired')).toThrow(
      'Invalid memory lifecycle transition: candidate -> retired'
    );

    const promoted = promoteCandidateKnowledgeRecord(candidate, { promotedAt: 1710000000300 });
    const retired = retirePromotedKnowledgeRecord(promoted, {
      retiredAt: 1710000000400,
      retirementReason: 'superseded',
      supersededByKnowledgeId: 'mem_newer'
    });

    expect(promoted.lifecycleState).toBe('promoted');
    expect(retired.lifecycleState).toBe('retired');
    expect(retired.supersession.retirementReason).toBe('superseded');
  });

  it('includes schema metadata on memory artifacts and helpers', () => {
    const metadata = createMemorySchemaMetadata('memory-event');
    expect(metadata.schemaVersion).toBe(MEMORY_CONTRACT_SCHEMA_VERSION);
    expect(isSupportedMemorySchemaVersion(MEMORY_CONTRACT_SCHEMA_VERSION)).toBe(true);
    expect(isSupportedMemorySchemaVersion('0.9.0')).toBe(false);

    const event = createMemoryEvent({
      repoId: 'ZachariahRedfield/playbook',
      eventType: 'promotion-review',
      occurredAt: 1710001000000,
      summary: 'Rule: Retrieval Must Return Provenance',
      canonicalKey: 'PB-V08-REPLAY-PROMOTION-001',
      fingerprintDimensions: ['rule:retrieval-provenance', 'rule:retrieval-provenance'],
      evidence: [
        {
          ...createMemorySchemaMetadata('session-evidence-reference'),
          sessionId: 'session-001',
          stepId: 'step-002',
          artifactPath: '.playbook/memory/events/runtime/event-001.json',
          capturedAt: 1710001000001
        }
      ],
      salience: {
        scoreVersion: '1',
        score: 0.88,
        reasonCodes: ['provenance-required', 'promotion-signal'],
        scoredAt: 1710001000002
      }
    });

    expect(event.schemaVersion).toBe(MEMORY_CONTRACT_SCHEMA_VERSION);
    expect(memoryArtifactPaths.runtimeEvents).toBe('.playbook/memory/events/runtime');
  });
});
