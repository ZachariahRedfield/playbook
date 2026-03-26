import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { captureMemoryEvent } from './index.js';
import { decideAdmission } from './admission.js';

const makeRepo = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-admission-'));

const writePressureBand = (repoRoot: string, band: 'normal' | 'warm' | 'pressure' | 'critical'): void => {
  const outPath = path.join(repoRoot, '.playbook/memory-pressure.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ band }, null, 2)}\n`, 'utf8');
};

const lowSignalInput = {
  kind: 'verify_run' as const,
  scope: { modules: [], ruleIds: [] },
  riskSummary: { level: 'low' as const, signals: [] },
  outcome: { status: 'success' as const, summary: 'ok' },
  salienceInputs: {},
  sources: []
};

describe('memory admission policy', () => {
  it('dedupes repeated low-signal memory in warm band', () => {
    const repoRoot = makeRepo();
    writePressureBand(repoRoot, 'warm');

    captureMemoryEvent(repoRoot, lowSignalInput);
    captureMemoryEvent(repoRoot, lowSignalInput);

    const index = JSON.parse(fs.readFileSync(path.join(repoRoot, '.playbook/memory/index.json'), 'utf8')) as { events: unknown[] };
    expect(index.events).toHaveLength(1);
  });

  it('rolls repeated low-signal memory into rollups in pressure band', () => {
    const repoRoot = makeRepo();
    writePressureBand(repoRoot, 'pressure');

    captureMemoryEvent(repoRoot, lowSignalInput);
    captureMemoryEvent(repoRoot, lowSignalInput);

    const rollupsDir = path.join(repoRoot, '.playbook/memory/events/rollups');
    expect(fs.existsSync(rollupsDir)).toBe(true);
    const rollups = fs.readdirSync(rollupsDir).filter((entry) => entry.endsWith('.json'));
    expect(rollups.length).toBeGreaterThan(0);
  });

  it('keeps high-signal events in critical and skips low-value writes', () => {
    const repoRoot = makeRepo();
    writePressureBand(repoRoot, 'critical');

    captureMemoryEvent(repoRoot, lowSignalInput);
    captureMemoryEvent(repoRoot, {
      ...lowSignalInput,
      kind: 'apply_run',
      riskSummary: { level: 'high', signals: ['failure'] },
      outcome: { status: 'failure', summary: 'failed' }
    });

    const index = JSON.parse(fs.readFileSync(path.join(repoRoot, '.playbook/memory/index.json'), 'utf8')) as { events: unknown[] };
    expect(index.events).toHaveLength(1);
  });

  it('preserves canonical/review-critical admission at critical pressure', () => {
    const decision = decideAdmission({
      band: 'critical',
      isCanonical: true,
      isReviewCritical: false,
      isHighSignal: false,
      isLowSignal: true,
      duplicateCount: 99,
      admissionKey: 'abc'
    });
    const reviewDecision = decideAdmission({
      band: 'critical',
      isCanonical: false,
      isReviewCritical: true,
      isHighSignal: false,
      isLowSignal: true,
      duplicateCount: 99,
      admissionKey: 'abc'
    });

    expect(decision.action).toBe('admit');
    expect(reviewDecision.action).toBe('admit');
  });
});
