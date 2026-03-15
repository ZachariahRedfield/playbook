import type { ExecutionSurface } from './executionRouter.js';

export type TaskRoute = 'deterministic_local' | 'unsupported';

export type RouteTaskKind =
  | 'artifact_read'
  | 'graph_query_report'
  | 'remediation_proposal'
  | 'patch_execution'
  | 'docs_only'
  | 'contracts_schema'
  | 'cli_command'
  | 'engine_scoring'
  | 'pattern_learning'
  | 'ambiguous'
  | 'unknown';

export type RouteMutabilityLevel = 'read_only' | 'proposal_only' | 'approved_plan_patch' | 'direct_patch';

export type RouteSafetyConstraints = {
  allowRepositoryMutation: boolean;
  requiresApprovedPlan: boolean;
};

export type RouteTaskInput = {
  task: string;
  taskKind: RouteTaskKind;
  availableArtifacts: string[];
  confidence: number;
  requiredRepoContext: boolean;
  safetyConstraints: RouteSafetyConstraints;
  mutabilityLevel: RouteMutabilityLevel;
  hasApprovedPlan: boolean;
};

export type RouteDecision = {
  route: TaskRoute;
  why: string;
  requiredInputs: string[];
  missingPrerequisites: string[];
  repoMutationAllowed: boolean;
  taskFamily: 'docs_only' | 'contracts_schema' | 'cli_command' | 'engine_scoring' | 'pattern_learning' | 'unknown';
  affectedSurfaces: ExecutionSurface[];
  estimatedChangeSurface: 'small' | 'medium' | 'large';
  warnings: string[];
};
