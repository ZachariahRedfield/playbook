export type TaskRoute = 'deterministic_local' | 'model_reasoning' | 'hybrid' | 'unsupported';

export type RouteTaskKind =
  | 'artifact_read'
  | 'graph_query_report'
  | 'remediation_proposal'
  | 'patch_execution'
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
};
