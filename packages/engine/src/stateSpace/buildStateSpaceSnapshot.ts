import type { RunCycle, RunCycleArtifactRef, RunCycleMetrics } from '../schema/runCycle.js';
import type { GateEvent, StateSpaceSnapshot } from '../schema/stateSpace.js';

type BuildStateSpaceSnapshotInput = {
  runCycle: RunCycle;
  sourceRunCycle: RunCycleArtifactRef;
  metrics?: RunCycleMetrics;
  createdAt?: string;
  prevSnapshot?: Pick<StateSpaceSnapshot, 'runCycleId' | 'bloch'>;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round6 = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const normalize3 = (x: number, y: number, z: number): [number, number, number] => {
  const norm = Math.sqrt(x * x + y * y + z * z);
  if (norm <= Number.EPSILON) {
    return [0, 0, 0];
  }
  return [round6(x / norm), round6(y / norm), round6(z / norm)];
};

const buildGateEvents = (input: BuildStateSpaceSnapshotInput, angularDistancePrev?: number): GateEvent[] => {
  const { runCycle, createdAt } = input;
  const at = createdAt ?? runCycle.createdAt;
  const events: GateEvent[] = [
    {
      type: 'projection',
      at,
      label: 'bloch-v1-metrics-projection',
      details: {
        formula: {
          x: '2*reuseRate-1',
          y: '1-2*entropyBudget',
          z: '2*loopClosureRate-1'
        }
      }
    }
  ];

  if (runCycle.returnArc.verify || runCycle.returnArc.postVerify) {
    events.push({
      type: 'measurement',
      at,
      label: 'verify-measurement',
      details: {
        verify: runCycle.returnArc.verify,
        postVerify: runCycle.returnArc.postVerify
      }
    });
  }

  if (runCycle.returnArc.plan || runCycle.returnArc.apply) {
    events.push({
      type: 'rotation',
      at,
      label: 'plan-apply-rotation',
      details: {
        plan: runCycle.returnArc.plan,
        apply: runCycle.returnArc.apply,
        ...(angularDistancePrev !== undefined ? { angularDistancePrev } : {})
      }
    });
  }

  return events;
};

const toAngularDistance = (
  current: [number, number, number],
  previous: [number, number, number]
): number | undefined => {
  const currentMag = Math.sqrt(current[0] ** 2 + current[1] ** 2 + current[2] ** 2);
  const previousMag = Math.sqrt(previous[0] ** 2 + previous[1] ** 2 + previous[2] ** 2);
  const denom = currentMag * previousMag;
  if (denom <= Number.EPSILON) {
    return undefined;
  }

  const dot = current[0] * previous[0] + current[1] * previous[1] + current[2] * previous[2];
  const cosine = Math.max(-1, Math.min(1, dot / denom));
  return round6(Math.acos(cosine));
};

export const buildStateSpaceSnapshot = (input: BuildStateSpaceSnapshotInput): StateSpaceSnapshot => {
  const metrics = input.metrics ?? input.runCycle.metrics;
  const x = round6(2 * metrics.reuseRate - 1);
  const y = round6(1 - 2 * metrics.entropyBudget);
  const z = round6(2 * metrics.loopClosureRate - 1);

  const direction = normalize3(x, y, z);
  const purity = round6(clamp01(1 - metrics.entropyBudget));
  const magnitude = purity;
  const vector: [number, number, number] = [
    round6(direction[0] * magnitude),
    round6(direction[1] * magnitude),
    round6(direction[2] * magnitude)
  ];

  const angularDistancePrev = input.prevSnapshot
    ? toAngularDistance(vector, input.prevSnapshot.bloch.vector)
    : undefined;

  return {
    schemaVersion: '1.0',
    kind: 'playbook-state-space-snapshot',
    runCycleId: input.runCycle.runCycleId,
    projection: 'bloch-v1',
    createdAt: input.createdAt ?? input.runCycle.createdAt,
    sourceRunCycle: input.sourceRunCycle,
    axes: {
      reuseRateX: x,
      entropyBudgetY: y,
      loopClosureRateZ: z
    },
    bloch: {
      direction,
      coherence: purity,
      vector,
      magnitude,
      purity,
      ...(angularDistancePrev !== undefined ? { angularDistancePrev } : {})
    },
    gateEvents: buildGateEvents(input, angularDistancePrev)
  };
};

export type { BuildStateSpaceSnapshotInput };
