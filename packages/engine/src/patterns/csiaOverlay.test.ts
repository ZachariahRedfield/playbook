import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadValidatedCsiaFramework } from './csiaOverlay.js';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('loadValidatedCsiaFramework', () => {
  it('loads canonical schema/examples deterministically for the same inputs', () => {
    const first = loadValidatedCsiaFramework(repoRoot);
    const second = loadValidatedCsiaFramework(repoRoot);

    expect(first.sourcePathForOutput).toBe(path.join('docs', 'examples', 'csia-framework.mappings.json'));
    expect(JSON.stringify(first.artifact)).toBe(JSON.stringify(second.artifact));
  });

  it('fails clearly when required mapping fields are missing', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'csia-missing-'));
    const localRepo = path.join(tempRoot, 'repo');
    fs.mkdirSync(path.join(localRepo, 'packages', 'contracts', 'src'), { recursive: true });
    fs.mkdirSync(path.join(localRepo, 'docs', 'examples'), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, 'packages', 'contracts', 'src', 'csia-framework.schema.json'), path.join(localRepo, 'packages', 'contracts', 'src', 'csia-framework.schema.json'));
    fs.writeFileSync(
      path.join(localRepo, 'docs', 'examples', 'invalid.json'),
      JSON.stringify({ schemaVersion: '1.0', kind: 'csia-framework', primitives: ['compute', 'simulate', 'interpret', 'adapt'], bridges: [], failureModes: [] }, null, 2)
    );

    expect(() => loadValidatedCsiaFramework(localRepo, path.join('docs', 'examples', 'invalid.json'))).toThrow(
      'missing required field "regimes"'
    );
  });

  it('keeps runtime artifact keys and values aligned to canonical schema/examples', () => {
    const result = loadValidatedCsiaFramework(repoRoot);

    expect(result.artifact.schemaVersion).toBe('1.0');
    expect(result.artifact.kind).toBe('csia-framework');
    expect(result.artifact.primitives).toEqual(['compute', 'simulate', 'interpret', 'adapt']);
    expect(result.artifact.regimes.every((regime) => regime.id.length > 0 && regime.secondaryPrimitives.length > 0)).toBe(true);
    expect(result.artifact.failureModes.every((failureMode) => failureMode.id.length > 0 && failureMode.linkedPrimitives.length > 0)).toBe(true);
  });
});
