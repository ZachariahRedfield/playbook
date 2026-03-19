import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportPatternTransferPackage, importPatternTransferPackage } from '../src/patternTransfer.js';

const tempDirs: string[] = [];
const mkd = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
const writeJson = (root: string, relativePath: string, value: unknown): void => {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};
afterEach(() => {
  while (tempDirs.length > 0) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('pattern transfer packages', () => {
  it('exports active patterns and imports them as candidate-only input', () => {
    const home = mkd('playbook-home-');
    const repo = mkd('playbook-repo-');
    writeJson(home, 'patterns.json', {
      schemaVersion: '1.0',
      kind: 'promoted-patterns',
      patterns: [{
        id: 'pattern.layering',
        pattern_family: 'layering',
        title: 'Layering',
        description: 'desc',
        storySeed: { title: 'Layering story', summary: 'sum', acceptance: ['a'] },
        source_artifact: '.playbook/pattern-candidates.json',
        signals: ['signal'],
        confidence: 0.9,
        evidence_refs: ['ref'],
        status: 'active',
        provenance: { source_ref: 'global/pattern-candidates/pattern-candidate-1', candidate_id: 'pattern-candidate-1', candidate_fingerprint: 'fp-1', promoted_at: '2026-03-19T00:00:00.000Z' },
        compatibility: { required_tags: ['node'] },
        risk_class: 'medium',
        known_failure_modes: ['drift'],
        lifecycle_events: []
      }]
    });
    const exported = exportPatternTransferPackage({ playbookHome: home, patternId: 'pattern.layering', targetRepoId: 'repo-a', targetTags: ['node'], sanitizationStatus: 'sanitized', riskClass: 'medium' });
    const imported = importPatternTransferPackage(repo, exported.packagePath, 'repo-a', ['node']);
    expect(imported.candidate_only).toBe(true);
    const candidates = JSON.parse(fs.readFileSync(path.join(repo, '.playbook/pattern-candidates.json'), 'utf8'));
    expect(candidates.candidates[0].imported_from.candidate_only).toBe(true);
    expect(candidates.candidates[0].status).toBe('observed');
  });

  it('fails closed on compatibility mismatch', () => {
    const home = mkd('playbook-home-');
    const repo = mkd('playbook-repo-');
    writeJson(home, 'patterns.json', {
      schemaVersion: '1.0', kind: 'promoted-patterns', patterns: [{
        id: 'pattern.layering', pattern_family: 'layering', title: 'Layering', description: 'desc', storySeed: { title: 'Layering story', summary: 'sum', acceptance: ['a'] }, source_artifact: '.playbook/pattern-candidates.json', signals: [], confidence: 0.9, evidence_refs: [], status: 'active', provenance: { source_ref: 'global/pattern-candidates/pattern-candidate-1', candidate_id: 'pattern-candidate-1', candidate_fingerprint: 'fp-1', promoted_at: '2026-03-19T00:00:00.000Z' }, compatibility: { required_tags: ['node'] }, risk_class: 'medium', known_failure_modes: [], lifecycle_events: []
      }]
    });
    const exported = exportPatternTransferPackage({ playbookHome: home, patternId: 'pattern.layering', targetRepoId: 'repo-a', compatibilityStatus: 'incompatible', sanitizationStatus: 'needs-review', riskClass: 'medium' });
    expect(() => importPatternTransferPackage(repo, exported.packagePath, 'repo-a', ['node'])).toThrow('compatibility mismatch fails closed');
  });
});
