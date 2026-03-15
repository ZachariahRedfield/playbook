export interface LaneOutcomeScore {
  lane_id: string;
  execution_duration: number;
  retry_count: number;
  success_rate: number;
  score: number;
}
