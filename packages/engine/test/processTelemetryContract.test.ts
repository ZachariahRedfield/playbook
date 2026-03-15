import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeProcessTelemetryArtifact } from '../src/telemetry/outcomeTelemetry.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

describe('process telemetry contract expansion', () => {
  it('keeps additive schema fields optional and available in schema', () => {
    const schema = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'packages/contracts/src/process-telemetry.schema.json'), 'utf8')
    ) as {
      $defs: { ProcessRecord: { required: string[]; properties: Record<string, unknown> } };
    };

    const requiredFields = schema.$defs.ProcessRecord.required;
    expect(requiredFields).not.toContain('task_profile_id');
    expect(requiredFields).not.toContain('route_id');
    expect(requiredFields).not.toContain('rule_packs_selected');
    expect(requiredFields).not.toContain('required_validations_selected');
    expect(requiredFields).not.toContain('optional_validations_selected');
    expect(requiredFields).not.toContain('validation_duration_ms');
    expect(requiredFields).not.toContain('planning_duration_ms');
    expect(requiredFields).not.toContain('apply_duration_ms');
    expect(requiredFields).not.toContain('human_intervention_required');
    expect(requiredFields).not.toContain('parallel_lane_count');
    expect(requiredFields).not.toContain('actual_merge_conflict');
    expect(requiredFields).not.toContain('over_validation_signal');
    expect(requiredFields).not.toContain('under_validation_signal');

    expect(schema.$defs.ProcessRecord.properties.task_profile_id).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.route_id).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.rule_packs_selected).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.required_validations_selected).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.optional_validations_selected).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.validation_duration_ms).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.planning_duration_ms).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.apply_duration_ms).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.human_intervention_required).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.parallel_lane_count).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.actual_merge_conflict).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.over_validation_signal).toBeDefined();
    expect(schema.$defs.ProcessRecord.properties.under_validation_signal).toBeDefined();
  });

  it('normalizes fixture deterministically with bounded summary and backward compatibility', () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tests/contracts/process-telemetry.fixture.json'), 'utf8')
    );

    const normalized = normalizeProcessTelemetryArtifact(fixture);
    expect(normalized.records[0].id).toBe('proc-docs-lean-1');
    expect(normalized.records.at(-1)?.id).toBe('proc-partial-safe-degrade-1');

    expect(normalized.summary.total_records).toBe(5);
    expect(normalized.summary.route_id_counts['route.docs.lean.v1']).toBe(1);
    expect(normalized.summary.rule_packs_selected_counts.governance).toBe(2);
    expect(normalized.summary.total_validation_duration_ms).toBe(2840);
    expect(normalized.summary.human_intervention_required_count).toBe(1);
    expect(normalized.summary.actual_merge_conflict_count).toBe(1);
    expect(normalized.summary.average_parallel_lane_count).toBe(1.6);
    expect(normalized.summary.over_validation_signal_count).toBe(1);

    const partial = normalized.records.find((record) => record.id === 'proc-partial-safe-degrade-1');
    expect(partial?.route_id).toBeUndefined();
    expect(partial?.validation_duration_ms).toBeUndefined();
    expect(partial?.parallel_lane_count).toBeUndefined();
    expect(normalized.summary.under_validation_signal_count).toBe(0);
  });
});
