import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_CONTRACT_FILE, getDefaultAiContract, loadAiContract, validateAiContract } from '../src/ai/aiContract.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe('aiContract', () => {
  it('returns a deterministic generated contract when .playbook/ai-contract.json is absent', () => {
    const repo = createRepo('playbook-ai-contract-default');

    const result = loadAiContract(repo);

    expect(result.source).toBe('generated');
    expect(result.contractFile).toBe(AI_CONTRACT_FILE);
    expect(result.contract).toEqual(getDefaultAiContract());
  });

  it('loads a file-backed contract when .playbook/ai-contract.json exists', () => {
    const repo = createRepo('playbook-ai-contract-file');
    const filePath = path.join(repo, '.playbook', 'ai-contract.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const contract = getDefaultAiContract();
    fs.writeFileSync(filePath, JSON.stringify(contract, null, 2));

    const result = loadAiContract(repo);

    expect(result.source).toBe('file');
    expect(result.contract).toEqual(contract);
  });


  it('includes memory-aware operating rules in generated default contract', () => {
    const contract = getDefaultAiContract();

    expect(contract.memory.artifactLocations.events).toBe('.playbook/memory/events');
    expect(contract.memory.artifactLocations.candidates).toBe('.playbook/memory/candidates.json');
    expect(contract.memory.artifactLocations.promotedKnowledge).toEqual([
      '.playbook/memory/knowledge/decisions.json',
      '.playbook/memory/knowledge/patterns.json',
      '.playbook/memory/knowledge/failure-modes.json',
      '.playbook/memory/knowledge/invariants.json'
    ]);
    expect(contract.memory.promotedKnowledgePolicy.reviewedPromotionRequired).toBe(true);
    expect(contract.memory.promotedKnowledgePolicy.noHiddenMutation).toBe(true);
    expect(contract.memory.retrieval.requireProvenance).toBe(true);
    expect(contract.memory.retrieval.provenanceFields).toEqual(['knowledgeId', 'eventId', 'sourcePath', 'fingerprint']);
  });

  it('remains backward-compatible for file-backed contracts without memory section', () => {
    const contract = validateAiContract({
      schemaVersion: '1.0',
      kind: 'playbook-ai-contract',
      ai_runtime: 'playbook-agent',
      workflow: ['index', 'query', 'plan', 'apply', 'verify'],
      intelligence_sources: {
        repoIndex: '.playbook/repo-index.json',
        moduleOwners: '.playbook/module-owners.json'
      },
      queries: ['architecture', 'dependencies', 'impact', 'risk', 'docs-coverage', 'rule-owners', 'module-owners'],
      remediation: {
        canonicalFlow: ['verify', 'plan', 'apply', 'verify'],
        diagnosticAugmentation: ['explain']
      },
      rules: {
        requireIndexBeforeQuery: true,
        preferPlaybookCommandsOverAdHocInspection: true,
        allowDirectEditsWithoutPlan: false
      }
    });

    expect(contract.memory.promotedKnowledgePolicy.candidatesAreAdvisoryOnlyUntilReviewedPromotion).toBe(true);
  });
  it('throws when schemaVersion is unsupported', () => {
    const invalid = {
      ...getDefaultAiContract(),
      schemaVersion: '2.0'
    };

    expect(() => validateAiContract(invalid)).toThrow('Unsupported AI contract schemaVersion');
  });
});
