# Playbook Control Plane / Agent Runtime v1 (Canonical Future-State Spec)

- feature_id: PB-V09-CONTROL-PLANE-001
- status: canonical future-state specification

## Purpose

This document defines the canonical future-state architecture for Playbook Control Plane / Agent Runtime v1.

It establishes subsystem boundaries, minimum models, and runtime invariants for agentic operation without weakening deterministic governance.

## Scope and non-goals

### In scope

- Control-plane orchestration and policy decisions.
- Agent lifecycle, scheduling, retries, approvals, and telemetry.
- Minimal v1 task and agent contracts.
- Deterministic mutation boundary between runtime components and the Playbook engine.

### Out of scope

- Claiming all behaviors are already implemented.
- Replacing deterministic Playbook engine workflows.
- Granting direct repository mutation authority to autonomous agents.

## Subsystem boundaries

## 1) Playbook engine (deterministic mutation substrate)

The Playbook engine is the canonical deterministic substrate for all real repository mutation.

Responsibilities:
- Own deterministic command contracts and mutation invariants.
- Execute governed workflows (for example `verify -> plan -> apply -> verify`).
- Validate preconditions and reject out-of-contract mutation attempts.
- Produce mutation evidence artifacts and deterministic outputs.

Boundary:
- Mutation is valid only when performed through engine-governed interfaces.

## 2) Control plane (runtime governance and orchestration)

The control plane decides whether, when, and under which policy a task may execute.

Responsibilities:
- Task intake, admission control, deduplication, and dependency handling.
- Scheduling and dispatch policy (priority, fairness, anti-starvation).
- Retry classification and retry policy enforcement.
- Approval-gate evaluation and state transitions.
- Safety policy resolution and execution-time policy projection.
- Lifecycle persistence and lease management.

Boundary:
- The control plane orchestrates work but does not bypass engine mutation controls.

## 3) Agents (policy-constrained workers)

Agents claim leases and perform assigned work under control-plane policy.

Responsibilities:
- Advertise capabilities and runtime health.
- Claim, renew, and release leases.
- Execute assigned task steps via approved executors.
- Emit lifecycle and execution telemetry.

Boundary:
- Agents have no independent mutation authority beyond engine-mediated execution.

## 4) Observers (non-mutating evidence and telemetry)

Observers provide runtime visibility and audit lineage.

Responsibilities:
- Record lifecycle events, queue transitions, and policy decisions.
- Capture command lineage, evidence references, and outcome metadata.
- Emit immutable telemetry streams for diagnostics and governance audits.

Boundary:
- Observers are strictly non-mutating.

## 5) Executors (engine invocation adapters)

Executors are runtime adapters that invoke deterministic engine commands on behalf of leased agents.

Responsibilities:
- Translate approved task intent into engine command invocations.
- Enforce scope, approval, and policy constraints before execution.
- Fail closed when required policy artifacts are missing or invalid.

Boundary:
- Executors cannot perform direct side-channel mutation outside engine pathways.

## Responsibility domains

### Agent lifecycle

- Registration and capability declaration.
- Heartbeats and liveness tracking.
- Lease claim/renew/release with stale-lease recovery.
- State transitions across: `queued`, `leased`, `running`, `awaiting-approval`, `retry-scheduled`, `succeeded`, `failed`, `cancelled`.

### Task scheduling

- Deterministic enqueue/dequeue semantics.
- Priority-aware dispatch with dependency constraints.
- Fairness and anti-starvation policy.
- Route selection by capability, scope, and safety profile.

### Retry / priority

- Priority classes: `urgent`, `high`, `normal`, `low`.
- Bounded retry budgets by failure class.
- Backoff strategy (for example exponential with jitter) to avoid retry storms.
- Priority inversion mitigation when safety-sensitive work is blocked.

### Approval gates

- Compute required approvals from mutation scope + policy profile.
- Transition to `awaiting-approval` until valid approval evidence is attached.
- Bind approver identity, decision, and timestamp to execution evidence.

### Safety policy

- Operation allowlists/denylists by task type.
- Path/module/scope constraints.
- Side-effect boundaries and environment constraints.
- Fail-closed semantics for missing or ambiguous policy inputs.

### Runtime telemetry

- Queue depth, queue age, lease churn, retry counts, success/failure rates.
- Lifecycle event stream, policy decisions, and failure taxonomy.
- Immutable evidence bundles for audit, incident analysis, and rollback reasoning.

### Memory access

- Separation of repo-local runtime memory vs promoted/shared memory.
- Policy-scoped read/write permissions by actor and task class.
- Provenance and lineage requirements for writes that can influence future automation.

## Minimal task model (v1)

```json
{
  "taskId": "task_123",
  "type": "governance-remediation",
  "priority": "high",
  "requestedBy": "human|ci|api",
  "targetRepo": ".",
  "mutationScope": "L0|L1|L2|L3|L4",
  "requiredWorkflow": ["verify", "plan", "apply", "verify"],
  "dependencies": ["task_101"],
  "requiresApproval": true,
  "approvalPolicy": "owner-required",
  "retryPolicy": {
    "maxAttempts": 3,
    "backoff": "exponential-jitter"
  },
  "status": "queued",
  "createdAt": "ISO-8601",
  "evidenceRef": "session://..."
}
```

## Minimal agent model (v1)

```json
{
  "agentId": "agent_abc",
  "class": "deterministic-executor",
  "capabilities": ["verify", "plan", "apply", "explain"],
  "allowedScopes": ["L0", "L1", "L2"],
  "state": "idle|busy|degraded|offline",
  "lease": {
    "taskId": null,
    "expiresAt": null
  },
  "lastHeartbeatAt": "ISO-8601",
  "policyVersion": "v1",
  "telemetryChannel": "runtime://events"
}
```

## Canonical execution semantics

1. Task is submitted with requester identity, intent, scope, and policy context.
2. Control plane performs admission checks and computes required approvals.
3. Scheduler enqueues based on dependencies, priority, and fairness constraints.
4. Eligible agent claims lease and runs bounded preflight policy checks.
5. If approval is required, task remains in `awaiting-approval` until evidence is valid.
6. Executor invokes deterministic engine workflow for mutation-capable steps.
7. Observer records command lineage, policy decisions, artifacts, and outcomes.
8. Control plane commits terminal state and publishes completion evidence.

## Invariants

- Agents never bypass the engine's mutation controls.
- Real mutation occurs only through deterministic engine interfaces.
- Missing approvals or safety inputs block mutation (fail closed).
- Agent authority is a strict subset of task scope and policy allowance.
- Mutation-capable runs are evidence-linked and audit-visible.

## Control Plane vs Automation Synthesis

These are distinct layers with separate trust semantics:

- **Control Plane**: runtime governance, scheduling, lifecycle management, approvals, policy enforcement, and evidence handling.
- **Automation Synthesis**: generation of candidate actions/plans/strategies.

Automation Synthesis can propose; it cannot directly mutate. Proposals remain untrusted until accepted by control-plane policy and executed through deterministic engine pathways.

## Playbook Notes candidates

- Pattern: Agents Sit Above Deterministic Substrate
- Rule: Agents Never Bypass Engine Mutation Controls
- Rule: Approval Gates Guard Real Mutation
- Failure Mode: Control Plane Without Deterministic Substrate

Additional optional candidates:
- Pattern: Lease-Based Agent Lifecycle with Fail-Closed Policy Checks
- Pattern: Queue-Integrated Approval Hold Before Mutation
- Rule: Mutation-Capable Tasks Must Emit Immutable Evidence Lineage
- Failure Mode: Side-Channel Executor Path Bypasses Approval State
