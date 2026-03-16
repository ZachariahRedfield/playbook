export const PLAYBOOK_SCHEMA_PATHS = {
  executionPlan: 'packages/contracts/src/execution-plan.schema.json',
  worksetPlan: 'packages/contracts/src/workset-plan.schema.json',
  laneState: 'packages/contracts/src/lane-state.schema.json',
  workerAssignments: 'packages/contracts/src/worker-assignments.schema.json',
  taskExecutionProfile: 'packages/contracts/src/task-execution-profile.schema.json',
  learningState: 'packages/contracts/src/learning-state.schema.json',
  repositoryEvents: 'packages/contracts/src/repository-events.schema.json',
  improvementCandidates: 'packages/contracts/src/improvement-candidates.schema.json',
  patternPortability: 'packages/contracts/src/pattern-portability.schema.json',
  transferPlans: 'packages/contracts/src/transfer-plans.schema.json',
  transferReadiness: 'packages/contracts/src/transfer-readiness.schema.json',
  cycleState: 'packages/contracts/src/cycle-state.schema.json'
} as const;
