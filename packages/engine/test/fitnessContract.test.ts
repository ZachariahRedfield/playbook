import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  fitnessIntegrationContract,
  getFitnessActionContract,
  getFitnessReceiptTypeForAction,
  isFitnessActionName
} from '../src/integrations/fitnessContract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('fitness integration contract mirror', () => {
  it('preserves bounded action names and receipt mappings exactly', () => {
    const actions = fitnessIntegrationContract.actions.map((entry) => entry.name);
    expect(actions).toEqual([
      'adjust_upcoming_workout_load',
      'schedule_recovery_block',
      'revise_weekly_goal_plan'
    ]);

    expect(getFitnessReceiptTypeForAction('adjust_upcoming_workout_load')).toBe('schedule_adjustment_applied');
    expect(getFitnessReceiptTypeForAction('schedule_recovery_block')).toBe('recovery_guardrail_applied');
    expect(getFitnessReceiptTypeForAction('revise_weekly_goal_plan')).toBe('goal_plan_amended');
  });

  it('preserves governance seam semantics exactly', () => {
    expect(fitnessIntegrationContract.governance).toEqual({
      loop: 'signal->plan->action->receipt',
      seam: 'playbook-lifeline',
      bypassAllowed: false
    });
  });

  it('preserves signal and snapshot channels exactly', () => {
    expect(fitnessIntegrationContract.signalTypes).toEqual([
      'fitness.session.events',
      'fitness.recovery.events',
      'fitness.goal.events'
    ]);
    expect(fitnessIntegrationContract.stateSnapshotTypes).toEqual([
      'fitness.session.snapshot',
      'fitness.recovery.snapshot',
      'fitness.goal.snapshot'
    ]);
  });

  it('preserves routing metadata and constraints exactly', () => {
    expect(getFitnessActionContract('adjust_upcoming_workout_load').routing).toEqual({
      topic: 'fitness.actions.training-load',
      must_route_through_playbook_plan: true,
      no_direct_lifeline_bypass: true
    });
    expect(getFitnessActionContract('schedule_recovery_block').routing).toEqual({
      topic: 'fitness.actions.recovery',
      must_route_through_playbook_plan: true,
      no_direct_lifeline_bypass: true
    });
    expect(getFitnessActionContract('revise_weekly_goal_plan').routing).toEqual({
      topic: 'fitness.actions.weekly-plan',
      must_route_through_playbook_plan: true,
      no_direct_lifeline_bypass: true
    });

    for (const action of fitnessIntegrationContract.actions) {
      expect(action.constraints).toEqual(['same_week_only', 'max_duration_days_14']);
    }
  });

  it('preserves bounded input schemas including required flags, min/max, and allowedValues', () => {
    const loadAction = getFitnessActionContract('adjust_upcoming_workout_load');
    expect(loadAction.input.fields).toContainEqual({ name: 'duration_days', type: 'number', required: true, min: 1, max: 14 });
    expect(loadAction.input.fields).toContainEqual({
      name: 'reason_code',
      type: 'string',
      required: true,
      allowedValues: ['fatigue_spike', 'session_missed', 'readiness_drop']
    });

    const recoveryAction = getFitnessActionContract('schedule_recovery_block');
    expect(recoveryAction.input.fields).toContainEqual({ name: 'duration_days', type: 'number', required: true, min: 1, max: 14 });
    expect(recoveryAction.input.fields).toContainEqual({
      name: 'recovery_mode',
      type: 'string',
      required: true,
      allowedValues: ['rest', 'deload', 'active_recovery']
    });

    const goalAction = getFitnessActionContract('revise_weekly_goal_plan');
    expect(goalAction.input.fields).toContainEqual({ name: 'duration_days', type: 'number', required: true, min: 1, max: 14 });
    expect(goalAction.input.fields).toContainEqual({
      name: 'goal_domain',
      type: 'string',
      required: true,
      allowedValues: ['volume', 'intensity', 'consistency']
    });
  });

  it('supports exact action-name guarding for downstream routing', () => {
    expect(isFitnessActionName('schedule_recovery_block')).toBe(true);
    expect(isFitnessActionName('test-autofix')).toBe(false);
  });

  it('matches the drift-check truth pack for action/receipt/routing constraints', () => {
    const truthPackPath = path.join(__dirname, '__fixtures__', 'fitness', 'actions-and-receipts.json');
    const truthPack = JSON.parse(fs.readFileSync(truthPackPath, 'utf8')) as {
      governance: { loop: string; seam: string; bypassAllowed: boolean };
      actions: Array<{
        action: string;
        receipt: string;
        routing: {
          topic: string;
          must_route_through_playbook_plan: boolean;
          no_direct_lifeline_bypass: boolean;
        };
        constraints: string[];
      }>;
    };

    expect(truthPack.governance).toEqual(fitnessIntegrationContract.governance);
    expect(
      truthPack.actions.map((entry) => ({
        action: entry.action,
        receipt: entry.receipt,
        routing: entry.routing,
        constraints: entry.constraints
      }))
    ).toEqual(
      fitnessIntegrationContract.actions.map((entry) => ({
        action: entry.name,
        receipt: entry.receiptType,
        routing: entry.routing,
        constraints: entry.constraints
      }))
    );
  });
});
