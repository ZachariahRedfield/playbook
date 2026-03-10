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

export type BlochProjectionMetadata = {
  version: 'bloch-v1';
  disclaimer: 'diagnostic-projection-not-quantum-computation';
  axisMapping: {
    x: '2*reuseRate-1';
    y: '1-2*entropyBudget';
    z: '2*loopClosureRate-1';
  };
  vectorMapping: {
    direction: 'normalize([x,y,z])';
    purity: 'clamp(1-entropyBudget,0,1)';
    vector: 'direction*purity';
    angularDistancePrev: 'acos(dot(v_t,v_prev)/(||v_t||*||v_prev||+1e-9))';
  };
};

export type BlochTelemetry = {
  inputMetrics: {
    reuseRate: number;
    entropyBudget: number;
    loopClosureRate: number;
  };
  epsilon: 1e-9;
};

export type StateSpaceSnapshot = {
  schemaVersion: '1.0';
  kind: 'playbook-state-space-snapshot';
  runCycleId: string;
  projection: 'bloch-v1';
  projectionMeta: BlochProjectionMetadata;
  telemetry: BlochTelemetry;
  createdAt?: string;
  sourceRunCycle: ArtifactRef;
  axes: BlochAxesV1;
  bloch: BlochVector;
  gateEvents?: GateEvent[];
};
