import type { RunCycleArtifactRef as ArtifactRef } from './runCycle';

export type BlochAxesV1 = {
  reuseRateX: number;
  entropyBudgetY: number;
  loopClosureRateZ: number;
};

export type BlochVector = {
  direction: [number, number, number];
  coherence: number;
  vector: [number, number, number];
  magnitude: number;
  purity: number;
  angularDistancePrev?: number;
};

export type GateEvent = {
  type: 'rotation' | 'measurement' | 'projection';
  at: string;
  label: string;
  details?: Record<string, unknown>;
};

export type StateSpaceSnapshot = {
  schemaVersion: '1.0';
  kind: 'playbook-state-space-snapshot';
  runCycleId: string;
  projection: 'bloch-v1';
  sourceRunCycle: ArtifactRef;
  axes: BlochAxesV1;
  bloch: BlochVector;
  gateEvents?: GateEvent[];
};
