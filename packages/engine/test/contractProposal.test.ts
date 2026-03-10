import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyContractProposal, buildContractProposal, replayAcceptedContractProposals, writeContractVersion } from '../src/index.js';
import type { PatternCard } from '../src/schema/patternCard.js';
import type { VersionedContract } from '../src/contracts/versioning.js';

const pattern: PatternCard = {
  schemaVersion: '1.0',
  kind: 'playbook-pattern-card',
  patternId: 'pattern.det.verify',
  canonicalKey: 'deterministic-contract-mutation',
  title: 'Deterministic contract mutation proposals',
  summary: 'Promoted pattern cards produce reviewable mutation proposals.',
  linkedContractRefs: ['rule.contract.proposals'],
  state: 'promoted',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  currentVersion: 1,
  versionHistory: [],
  lineage: {
    originCycleIds: ['2026-01-01T00-00-00.000Z@abc1234'],
    sourceDraftIds: ['draft.1'],
    sourceGroupIds: ['group.1'],
    sourceZettelIds: ['zettel.1'],
    sourceArtifactPaths: ['.playbook/run-cycles/2026-01-01T00-00-00.000Z@abc1234.json'],
    evidenceRefs: ['evidence:1'],
    parentPatternIds: [],
    priorVersionIds: [],
    decisionIds: ['decision.1']
  },
  versionRef: { patternId: 'pattern.det.verify', version: 1, status: 'promoted' }
};

const contract: VersionedContract = {
  schemaVersion: '1.0',
  kind: 'playbook-contract',
  contractId: 'governance',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  rules: [{ ruleId: 'rule.contract.proposals', status: 'active', summary: 'old summary' }]
};

describe('contract mutation proposals', () => {
  it('builds proposals deterministically from promoted patterns', () => {
    const proposal = buildContractProposal({ pattern });
    expect(proposal.patternId).toBe(pattern.patternId);
    expect(proposal.mutationType).toBe('modify_rule');
    expect(proposal.sourceGroupIds).toEqual(['group.1']);
    expect(proposal.sourceZettelIds).toEqual(['zettel.1']);
    expect(proposal.evidenceRefs).toEqual(['evidence:1']);
  });

  it('rejects proposals when verify gate fails', () => {
    const proposal = buildContractProposal({ pattern });
    const result = applyContractProposal({
      proposal,
      currentContract: contract,
      verifyGate: () => ({ ok: false, errors: ['verify failed'] })
    });

    expect(result.accepted).toBe(false);
    expect(result.proposal.verificationStatus).toBe('failed');
    expect(result.nextContract).toBeUndefined();
  });

  it('creates immutable contract versions and replays decision history', () => {
    const proposal = buildContractProposal({ pattern });
    const applied = applyContractProposal({ proposal, currentContract: contract, verifyGate: () => ({ ok: true }) });
    expect(applied.accepted).toBe(true);
    expect(applied.nextContract?.version).toBe(2);

    const history = replayAcceptedContractProposals({ initialContract: contract, acceptedProposals: [proposal], verifyGate: () => ({ ok: true }) });
    expect(history).toHaveLength(2);
    expect(history[0].supersededBy).toBe('governance@v2');
    expect(history[1].supersedes).toBe('governance@v1');

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-contract-'));
    const written = writeContractVersion(tempRoot, history[1]);
    expect(written).toBe('.playbook/contracts/versions/governance/v2.json');
    expect(() => writeContractVersion(tempRoot, history[1])).toThrow('immutable');
  });
});
