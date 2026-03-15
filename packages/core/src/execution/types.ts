export type LaneRuntimeState =
  | 'blocked'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed';

export interface LaneRuntime {
  lane_id: string;
  state: LaneRuntimeState;
  worker?: string;
  started_at?: string;
  finished_at?: string;
}
