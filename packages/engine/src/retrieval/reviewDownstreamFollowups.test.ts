import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReviewDownstreamFollowupsArtifact } from './reviewDownstreamFollowups.js';

const touchedDirs: string[] = [];

const createTempRepo = (): string => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-review-downstream-followups-'));
  touchedDirs.push(repoRoot);
  return repoRoot;
};

const writeJson = (repoRoot: string, relativePath: string, payload: unknown): void => {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

afterEach(() => {
  while (touchedDirs.length > 0) {
    const directory = touchedDirs.pop();
    if (directory && fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('buildReviewDownstreamFollowupsArtifact', () => {
  it('compiles explicit deterministic downstream follow-up suggestions by governed surface', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-handoff-routes.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-handoff-routes',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T02:00:00.000Z',
      routes: [
        {
          routeId: 'route-doc-1',
          handoffId: 'handoff-doc-1',
          targetKind: 'doc',
          path: 'docs/README.md',
          recommendedSurface: 'docs',
          recommendedArtifact: 'docs/README.md',
          reasonCode: 'docs-revision-follow-up',
          evidenceRefs: ['docs/README.md', 'docs/README.md'],
          nextActionText: 'Revise docs.'
        },
        {
          routeId: 'route-memory-1',
          handoffId: 'handoff-memory-1',
          targetKind: 'knowledge',
          targetId: 'k-100',
          recommendedSurface: 'memory',
          recommendedArtifact: '.playbook/memory/candidates.json',
          reasonCode: 'memory-revision-follow-up',
          evidenceRefs: ['event:e-100'],
          nextActionText: 'Capture memory follow-up.'
        },
        {
          routeId: 'route-story-1',
          handoffId: 'handoff-story-1',
          targetKind: 'doc',
          path: 'docs/ops.md',
          recommendedSurface: 'story',
          recommendedArtifact: '.playbook/stories.json',
          reasonCode: 'story-seed-operational-gap',
          evidenceRefs: ['backlog:ops-gap'],
          nextActionText: 'Seed story follow-up.'
        },
        {
          routeId: 'route-super-1',
          handoffId: 'handoff-super-1',
          targetKind: 'knowledge',
          targetId: 'k-old',
          recommendedSurface: 'promote',
          recommendedArtifact: '.playbook/memory/knowledge/superseded.json',
          reasonCode: 'supersession-follow-up',
          evidenceRefs: ['knowledge:k-new'],
          nextActionText: 'Record supersession.'
        }
      ]
    });

    const artifact = buildReviewDownstreamFollowupsArtifact(repoRoot, '2026-03-24T03:00:00.000Z');

    expect(artifact.followups).toHaveLength(4);
    expect(artifact.followups.map((entry) => entry.type)).toEqual(['docs-revision', 'promote-memory', 'story-seed', 'supersession']);
    expect(artifact.followups[0]).toMatchObject({
      routeId: 'route-doc-1',
      type: 'docs-revision',
      path: 'docs/README.md',
      evidenceRefs: ['docs/README.md']
    });
    expect(artifact.followups[1]).toMatchObject({
      routeId: 'route-memory-1',
      type: 'promote-memory',
      targetId: 'k-100'
    });
    expect(artifact.followups[2]).toMatchObject({
      routeId: 'route-story-1',
      type: 'story-seed'
    });
    expect(artifact.followups[3]).toMatchObject({
      routeId: 'route-super-1',
      type: 'supersession'
    });
  });

  it('is deterministic for same input and preserves proposal-only read-only authority', () => {
    const repoRoot = createTempRepo();
    writeJson(repoRoot, '.playbook/review-handoff-routes.json', {
      schemaVersion: '1.0',
      kind: 'playbook-review-handoff-routes',
      proposalOnly: true,
      authority: 'read-only',
      generatedAt: '2026-03-24T02:00:00.000Z',
      routes: [
        {
          routeId: 'route-memory-2',
          handoffId: 'handoff-memory-2',
          targetKind: 'knowledge',
          targetId: 'k-222',
          recommendedSurface: 'promote',
          recommendedArtifact: '.playbook/pattern-candidates.json',
          reasonCode: 'promote-revision-follow-up',
          evidenceRefs: ['candidate:c-222'],
          nextActionText: 'Prepare promote follow-up.'
        }
      ]
    });

    const left = buildReviewDownstreamFollowupsArtifact(repoRoot, '2026-03-24T03:00:00.000Z');
    const right = buildReviewDownstreamFollowupsArtifact(repoRoot, '2026-03-24T03:00:00.000Z');

    expect(left).toEqual(right);
    expect(left.proposalOnly).toBe(true);
    expect(left.authority).toBe('read-only');
  });
});
