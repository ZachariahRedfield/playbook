import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../../lib/cliContract.js';
import { runPatterns } from '../patterns.js';

const repoRoot = path.resolve(__dirname, '../../../../..');

describe('patterns csia', () => {
  it('loads default CSIA mapping and returns deterministic overlay projection', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const firstExitCode = await runPatterns(repoRoot, ['csia'], { format: 'json', quiet: false });
    const secondExitCode = await runPatterns(repoRoot, ['csia'], { format: 'json', quiet: false });

    expect(firstExitCode).toBe(ExitCode.Success);
    expect(secondExitCode).toBe(ExitCode.Success);

    const firstPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const secondPayload = JSON.parse(String(logSpy.mock.calls[1]?.[0]));

    expect(firstPayload).toEqual(secondPayload);
    expect(firstPayload.action).toBe('csia');
    expect(firstPayload.mode).toBe('read-only');
    expect(firstPayload.proposal_only).toBe(true);
    expect(firstPayload.source_path).toBe(path.join('docs', 'examples', 'csia-framework.mappings.json'));
    expect(firstPayload.sources.schema).toBe(path.join('packages', 'contracts', 'src', 'csia-framework.schema.json'));
    expect(firstPayload.provenance).toEqual([
      { type: 'schema', path: path.join('packages', 'contracts', 'src', 'csia-framework.schema.json') },
      { type: 'mappings', path: path.join('docs', 'examples', 'csia-framework.mappings.json') }
    ]);
    expect(firstPayload.mappings[0]).toHaveProperty('mapping_id');
    expect(firstPayload.mappings[0]).toHaveProperty('dimensions');
    expect(firstPayload.mappings[0].dimensions).toHaveProperty('compute');
    expect(firstPayload.mappings[0].dimensions).toHaveProperty('simulate');
    expect(firstPayload.mappings[0].dimensions).toHaveProperty('interpret');
    expect(firstPayload.mappings[0].dimensions).toHaveProperty('adapt');
    expect(firstPayload.dominant_primitive_summary).toEqual({ compute: 0, simulate: 1, interpret: 1, adapt: 1 });

    logSpy.mockRestore();
  });

  it('filters regimes by --regime', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repoRoot, ['csia', '--regime', 'feature-release-gating'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.regimes).toHaveLength(1);
    expect(payload.regimes[0].id).toBe('feature-release-gating');
    expect(payload.mappings).toHaveLength(1);
    expect(payload.mappings[0].mapping_id).toBe('feature-release-gating');

    logSpy.mockRestore();
  });

  it('filters regimes by --primitive', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repoRoot, ['csia', '--primitive', 'interpret'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.regimes.length).toBeGreaterThan(0);
    expect(
      payload.regimes.every((regime: { dominantPrimitive: string; secondaryPrimitives: string[] }) =>
        regime.dominantPrimitive === 'interpret' || regime.secondaryPrimitives.includes('interpret')
      )
    ).toBe(true);

    logSpy.mockRestore();
  });

  it('handles missing and invalid --from path deterministically', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const invalidRelativePath = path.join('.playbook', 'tmp', 'invalid-csia.json');
    const invalidAbsolutePath = path.join(repoRoot, invalidRelativePath);
    fs.mkdirSync(path.dirname(invalidAbsolutePath), { recursive: true });
    fs.writeFileSync(invalidAbsolutePath, '{not valid json');

    const missingExitCode = await runPatterns(repoRoot, ['csia', '--from', '.playbook/tmp/missing-csia.json'], { format: 'json', quiet: false });
    expect(missingExitCode).toBe(ExitCode.Failure);
    const missingPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(missingPayload.error).toContain('mapping file not found');

    const invalidExitCode = await runPatterns(repoRoot, ['csia', '--from', invalidRelativePath], { format: 'json', quiet: false });
    expect(invalidExitCode).toBe(ExitCode.Failure);
    const invalidPayload = JSON.parse(String(logSpy.mock.calls[1]?.[0]));
    expect(invalidPayload.error).toContain('invalid JSON');

    logSpy.mockRestore();
  });

  it('fails clearly when mapping fields violate CSIA schema alignment', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const invalidPath = path.join('.playbook', 'tmp', 'invalid-csia-missing-regime-fields.json');
    const invalidAbsolutePath = path.join(repoRoot, invalidPath);
    fs.mkdirSync(path.dirname(invalidAbsolutePath), { recursive: true });
    fs.writeFileSync(
      invalidAbsolutePath,
      JSON.stringify(
        {
          schemaVersion: '1.0',
          kind: 'csia-framework',
          primitives: ['compute', 'simulate', 'interpret', 'adapt'],
          bridges: [],
          regimes: [{ id: 'compute-only', dominantPrimitive: 'compute' }],
          failureModes: [{ id: 'compute-risk', risk: 'risk', linkedPrimitives: ['compute'] }]
        },
        null,
        2
      )
    );

    const exitCode = await runPatterns(repoRoot, ['csia', '--from', invalidPath], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.error).toContain('regimes[0].secondaryPrimitives');

    logSpy.mockRestore();
  });

  it('links failure modes relevant to filtered regimes with schema-aligned mappings', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const customPath = path.join('.playbook', 'tmp', 'custom-csia.json');
    const customAbsolutePath = path.join(repoRoot, customPath);
    fs.mkdirSync(path.dirname(customAbsolutePath), { recursive: true });
    fs.writeFileSync(
      customAbsolutePath,
      JSON.stringify(
        {
          schemaVersion: '1.0',
          kind: 'csia-framework',
          primitives: ['compute', 'simulate', 'interpret', 'adapt'],
          bridges: [],
          regimes: [
            { id: 'compute-only', dominantPrimitive: 'compute', secondaryPrimitives: ['adapt'] },
            { id: 'interpret-only', dominantPrimitive: 'interpret', secondaryPrimitives: ['simulate'] }
          ],
          failureModes: [
            { id: 'compute-risk', risk: 'risk', linkedPrimitives: ['compute'], mitigation: 'mitigate' },
            { id: 'interpret-risk', risk: 'risk', linkedPrimitives: ['interpret'], mitigation: 'mitigate' }
          ]
        },
        null,
        2
      )
    );

    const exitCode = await runPatterns(repoRoot, ['csia', '--from', customPath, '--regime', 'compute-only'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.failureModes).toHaveLength(1);
    expect(payload.failureModes[0].id).toBe('compute-risk');
    expect(payload.mappings[0].mapping_id).toBe('compute-only');
    expect(payload.mappings[0].dimensions.compute.role).toBe('dominant');
    expect(payload.mappings[0].associated_examples).toEqual([]);

    logSpy.mockRestore();
  });
});
