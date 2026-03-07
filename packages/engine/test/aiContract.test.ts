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

  it('throws when schemaVersion is unsupported', () => {
    const invalid = {
      ...getDefaultAiContract(),
      schemaVersion: '2.0'
    };

    expect(() => validateAiContract(invalid)).toThrow('Unsupported AI contract schemaVersion');
  });
});
