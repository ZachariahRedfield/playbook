import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runPatterns } from './patterns.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writePatternReviewQueue = (repo: string): void => {
  const filePath = path.join(repo, '.playbook', 'pattern-review-queue.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        kind: 'playbook-pattern-review-queue',
        generatedAt: '2026-01-01T00:00:00.000Z',
        candidates: [
          {
            id: 'candidate-module_test_absence',
            sourcePatternId: 'MODULE_TEST_ABSENCE',
            canonicalPatternName: 'module test absence',
            whyItExists: 'why',
            examples: ['module lacks tests'],
            confidence: 0.9,
            reusableEngineeringMeaning: 'meaning',
            recurrenceCount: 3,
            repoSurfaceBreadth: 0.6,
            remediationUsefulness: 0.8,
            canonicalClarity: 0.9,
            falsePositiveRisk: 0.1,
            promotionScore: 0.83,
            stage: 'review'
          }
        ]
      },
      null,
      2
    )
  );
};

describe('runPatterns', () => {
  it('approves candidate promotion with deterministic JSON output', async () => {
    const repo = createRepo('playbook-cli-patterns-promote');
    writePatternReviewQueue(repo);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runPatterns(repo, ['promote', '--id', 'candidate-module_test_absence', '--decision', 'approve'], {
      format: 'json',
      quiet: false
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.action).toBe('promote');
    expect(payload.reviewRecord.decision.decision).toBe('approve');
    expect(fs.existsSync(path.join(repo, '.playbook', 'patterns-promoted.json'))).toBe(true);

    logSpy.mockRestore();
  });
});
