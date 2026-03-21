import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

describe('lane state artifact contract', () => {
  it('defines required additive fields and lane entry contract', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/contracts/src/lane-state.schema.json'), 'utf8')) as {
      required: string[];
      properties: Record<string, unknown>;
      $defs: { laneStateEntry: { required: string[]; properties: Record<string, unknown> } };
    };

    expect(schema.required).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'kind',
        'generatedAt',
        'proposalOnly',
        'workset_plan_path',
        'lanes',
        'blocked_lanes',
        'ready_lanes',
        'running_lanes',
        'completed_lanes',
        'merge_ready_lanes',
        'dependency_status',
        'merge_readiness',
        'verification_status',
        'warnings'
      ])
    );

    expect(schema.$defs.laneStateEntry.required).toEqual(
      expect.arrayContaining([
        'lane_id',
        'task_ids',
        'status',
        'readiness_status',
        'dependency_level',
        'dependencies_satisfied',
        'blocked_reasons',
        'blocking_reasons',
        'conflict_surface_paths',
        'shared_artifact_risk',
        'assignment_confidence',
        'verification_summary',
        'merge_ready',
        'worker_ready',
        'protected_doc_consolidation'
      ])
    );

    expect(schema.properties.workset_plan_path).toBeDefined();
    expect(schema.properties.merge_readiness).toBeDefined();
    expect(schema.properties.verification_status).toBeDefined();
  });

  it('keeps fixture shape compatible with schema envelope', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests/contracts/lane-state.fixture.json'), 'utf8')) as {
      kind: string;
      schemaVersion: string;
      lanes: Array<{ lane_id: string; status: string }>;
      ready_lanes: string[];
    };

    expect(fixture.kind).toBe('lane-state');
    expect(fixture.schemaVersion).toBe('1.0');
    expect(fixture.lanes[0]?.lane_id).toBe('lane-1');
    expect(fixture.ready_lanes).toContain('lane-1');
  });
});
