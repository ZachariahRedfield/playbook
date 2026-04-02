import { describe, expect, it } from 'vitest';
import { classifyProofFailureDomains, classifySignalFailureDomains } from './failureDomains.js';
import type { BootstrapProofResult } from './bootstrapProof.js';

const makeProof = (overrides?: Partial<BootstrapProofResult>): BootstrapProofResult => ({
  schemaVersion: '1.0',
  kind: 'playbook-bootstrap-proof',
  repo_root: '/tmp/repo',
  command: 'status',
  mode: 'proof',
  ok: false,
  current_state: 'governance_blocked',
  highest_priority_next_action: 'Run verify.',
  summary: {
    current_state: 'blocked',
    why: 'blocked',
    what_next: 'Run verify.'
  },
  diagnostics: {
    failing_stage: 'governance',
    failing_category: 'governance_contract_failed',
    checks: []
  },
  ...overrides
});

describe('failure domain classification', () => {
  it('maps contract mismatch signals to contract_validation', () => {
    const summary = classifySignalFailureDomains([
      {
        signal: 'doctor.testing.verify.failure.PB999',
        summary: 'Contract drift detected: request/receipt schema mismatch.',
        nextAction: 'Refresh schema artifacts.'
      }
    ]);

    expect(summary.primaryFailureDomain).toBe('contract_validation');
    expect(summary.failureDomains).toContain('contract_validation');
  });

  it('maps proof execution-state failures to runtime_execution', () => {
    const summary = classifyProofFailureDomains(makeProof({
      diagnostics: {
        failing_stage: 'execution-state',
        failing_category: 'execution_state_missing',
        checks: [{
          id: 'execution-state.required',
          stage: 'execution-state',
          status: 'fail',
          category: 'execution_state_missing',
          summary: 'Execution/runtime state prerequisites are missing or invalid.',
          diagnostics: ['missing execution-state artifact: .playbook/last-run.json'],
          next_action: 'Run `pnpm playbook apply --json`.',
          command: null
        }]
      }
    }));

    expect(summary.primaryFailureDomain).toBe('runtime_execution');
    expect(summary.failureDomains).toContain('runtime_execution');
  });
});
