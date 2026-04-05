export type MultiRepoReadInterfaceSlice =
  | 'readiness-proof'
  | 'run-state-inspection'
  | 'longitudinal-state-summary'
  | 'cross-repo-pattern-comparison'
  | 'workspace-tenant-governance'
  | 'maintenance-plan-summary';

export type MultiRepoReadInterfaceRepoScope = {
  repo_id: string;
  repo_root: string;
  policy_boundary: 'per-repo';
  provenance_boundary: 'per-repo';
};

export type MultiRepoReadInterfaceEnvelope = {
  schemaVersion: '1.0';
  kind: 'playbook-multi-repo-control-plane-read-interface';
  request: {
    slice: MultiRepoReadInterfaceSlice;
    mode: 'read-only';
    target_repo_ids: string[];
  };
  response: {
    deterministic: true;
    generated_at: '1970-01-01T00:00:00.000Z';
    policy_boundary: {
      mutation_authority: 'none';
      hidden_cross_repo_orchestration: false;
    };
    repo_scope: MultiRepoReadInterfaceRepoScope[];
    provenance: string[];
    slice_payload: Record<string, unknown>;
  };
};

type BuildMultiRepoReadInterfaceEnvelopeInput = {
  slice: MultiRepoReadInterfaceSlice;
  repoScope: Array<{ repo_id: string; repo_root: string }>;
  provenance: string[];
  payload: Record<string, unknown>;
};

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.filter((entry) => entry.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );

export const buildMultiRepoReadInterfaceEnvelope = (
  input: BuildMultiRepoReadInterfaceEnvelopeInput,
): MultiRepoReadInterfaceEnvelope => ({
  schemaVersion: '1.0',
  kind: 'playbook-multi-repo-control-plane-read-interface',
  request: {
    slice: input.slice,
    mode: 'read-only',
    target_repo_ids: uniqueSorted(input.repoScope.map((entry) => entry.repo_id)),
  },
  response: {
    deterministic: true,
    generated_at: '1970-01-01T00:00:00.000Z',
    policy_boundary: {
      mutation_authority: 'none',
      hidden_cross_repo_orchestration: false,
    },
    repo_scope: [...input.repoScope]
      .map((entry) => ({
        ...entry,
        policy_boundary: 'per-repo' as const,
        provenance_boundary: 'per-repo' as const,
      }))
      .sort((left, right) => left.repo_id.localeCompare(right.repo_id)),
    provenance: uniqueSorted(input.provenance),
    slice_payload: input.payload,
  },
});
