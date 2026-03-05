import { describe, expect, it } from 'vitest';
import { buildResult, ExitCode } from './cliContract.js';

describe('cliContract sorting', () => {
  it('sorts findings and next actions deterministically', () => {
    const result = buildResult({
      command: 'test',
      ok: false,
      exitCode: ExitCode.Failure,
      summary: 'summary',
      findings: [
        { id: 'z', level: 'info', message: 'later' },
        { id: 'a', level: 'error', message: 'first' },
        { id: 'b', level: 'warning', message: 'middle' }
      ],
      nextActions: ['z action', 'a action']
    });

    expect(result.findings.map((f) => f.id)).toEqual(['a', 'b', 'z']);
    expect(result.nextActions).toEqual(['a action', 'z action']);
  });
});
