# Knowledge Compaction Phase (Specification v0)

## Purpose

Define the first formal Playbook **Compaction Phase** as an internal, deterministic, review-oriented stage in the repository learning loop.

This document is a specification/contract surface, not a full runtime implementation.

Compaction is not broad note deduplication. It is deterministic semantic reduction: keep the smallest reusable pattern that still predicts useful repository behavior.

## Position in the knowledge loop

Compaction sits between extraction and human-reviewed promotion:

`observe -> extract candidate patterns -> canonicalize -> compare against stored patterns -> decide outcome -> emit compacted review drafts -> human review/promotion -> archive or supersede replaced patterns`

This phase must preserve the canonical runtime ladder and remediation loop:

- Ladder: `ai-context -> ai-contract -> context -> index -> query/explain/ask --repo-context -> verify -> plan -> apply -> verify`
- Remediation loop: `verify -> plan -> apply -> verify`

Compaction is an internal intelligence phase that augments artifacts and review drafts; it does not replace remediation execution contracts.

## Compression definition

Compaction must answer these questions for each candidate unit:

1. **Is this actually new?**
2. **Is this another example of an existing pattern?**
3. **Can this be merged into a smaller reusable abstraction?**
4. **Is this too specific to store as an abstraction?**
5. **Does this indicate an existing pattern should split into cleaner patterns?**

Rule: store the smallest reusable abstraction that still preserves explanatory power.

Failure Mode: compression without preserved semantics creates a pile of notes rather than reusable intelligence.

## Deterministic decision buckets

Each candidate must end in exactly one deterministic v0 bucket:

1. **discard**
   - Candidate is duplicate noise, too transient, or below minimum explanatory value.
2. **attach**
   - Candidate does not justify abstraction changes but is valid supporting evidence for an existing pattern card.
3. **merge**
   - Candidate and an existing pattern describe the same mechanism and should be folded into one tighter card.
4. **add**
   - Candidate is net-new reusable behavior not represented by current pattern cards.

Determinism requirement: decision rules should be explicit and reproducible for identical inputs.

## Canonicalization rules before comparison

All candidate units must be canonicalized before similarity/diff decisions:

- map concrete file paths to role labels when possible (for example, `packages/cli/src/...` -> `cli-command-surface` role)
- map concrete package/module names to component/tool roles when possible
- remove unstable identifiers (hashes, UUIDs, timestamps, local temp paths)
- normalize exact error strings into mechanism-level summaries
- keep concrete incidents as **evidence blocks**, not primary abstractions
- preserve provenance pointers so reviewers can trace abstraction back to source artifacts

Canonicalization output should remain deterministic and machine-readable.

## Pattern-card storage contract (compressed target shape)

Compaction outputs draft pattern cards with a stable contract surface:

```json
{
  "schemaVersion": "1.0",
  "kind": "playbook-pattern-card",
  "patternId": "pattern.cross_tool_alias_drift_ab12cd34",
  "title": "string",
  "status": "candidate|reviewed|promoted|archived",
  "createdFromBucket": "attach|merge|add",
  "trigger": "string",
  "context": "string",
  "mechanism": "string",
  "invariant": "string",
  "implication": "string",
  "response": "string",
  "examples": ["string"],
  "evidence": ["string"],
  "sourceKinds": ["string"],
  "sourceRefs": ["string"],
  "relatedModules": ["string"],
  "relatedRules": ["string"],
  "relatedDocs": ["string"],
  "relatedOwners": ["string"],
  "relatedTests": ["string"],
  "relatedRiskSignals": ["string"],
  "relatedGraphNodes": ["string"],
  "relatedPatterns": ["pattern-id"],
  "supersedes": ["pattern-id"],
  "supersededBy": ["pattern-id"],
  "reviewState": "pending-review|reviewed",
  "promotionState": "not-promoted|promoted",
  "confidence": null,
  "notes": "optional concise review note"
}
```

Abstraction boundary guidance:

- `mechanism` + `invariant` + `response` describe reusable behavior.
- Concrete stack traces, one-off incident details, and raw diff fragments belong in `evidence`.
- `examples` should be minimal representative instances, not full incident logs.

## Automation boundaries (v0)

Safe to automate now:

- exact dedupe detection
- canonicalization transforms
- evidence attachment to existing cards
- over-specific candidate rejection by deterministic thresholds
- simple same-mechanism merge suggestions

Human-reviewed in v0:

- aggressive generalization across domains
- conflict resolution between competing abstractions
- splitting an overly broad pattern into multiple cards
- superseding/retiring promoted patterns

## Inputs and artifact connections

Compaction should eventually consume existing deterministic artifacts/signals:

- `.playbook/repo-index.json`
- `.playbook/repo-graph.json`
- `.playbook/context/modules/*.json` module digests
- verify findings and rule metadata
- plan/apply histories and remediation outcomes
- docs/rules/ownership/risk signals

Output stance for v0:

- internal-first candidate artifacts
- review drafts for human promotion workflows
- explicit supersede/archive linkages for pattern lifecycle

Current implemented deterministic slices:

- canonicalization + deterministic bucketing (`discard | attach | merge | add`) are implemented for internal candidates
- deterministic review artifacts now sit on top of bucketing for inspection/testing
- generalization candidates are captured only as deferred metadata during bucketing (no generalize bucket implementation in this slice)
- first extraction adapters now derive normalized internal candidates from trusted deterministic evidence surfaces (`verify`, `plan`, `apply` when present, `analyze-pr`, `docs audit`)
- extraction canonicalization strips unstable noise and produces deterministic candidate fingerprints before future comparison/bucketing stages
- normalized internal candidate artifact output is written to `.playbook/compaction/candidates.json` as compaction input (not promoted knowledge)
- reason codes are canonical machine contracts; human-readable explanations are derived deterministically from reason codes
- graph-ready durable candidate pattern cards are now written under `.playbook/patterns/*.json` from `add` and `merge` bucket outcomes
- `attach` outcomes enrich existing cards/drafts with provenance while preserving abstraction identity
- deterministic review draft artifacts now write to `.playbook/compaction/review-drafts.json`
- `discard` outcomes remain review-only and never produce durable pattern cards
- promotion workflows and graph traversal/query remain future work

## Scope boundaries for this phase

In first formalization, Compaction Phase is:

- internal
- deterministic
- review-oriented
- artifact-backed

Non-goals in this pass:

- no broad new user-facing command family
- no autonomous learning loop that mutates enforcement policy
- no automatic rule promotion without review

Future option (explicitly secondary): a maintenance-oriented `pnpm playbook compact` command may be introduced later once contracts, review UX, and promotion governance are hardened.


## Toroidal Flow alignment (additive framing)

Compaction is the return-intelligence bridge in the Toroidal Flow architecture model (`observe -> verify -> plan -> apply -> extract -> canonicalize -> compact -> promote -> retire`).

Alignment constraints:

- `apply` is midpoint for full-cycle architecture framing, not terminal endpoint.
- Raw extracted findings are evidence inputs and must not directly mutate reusable context.
- `nextContextDelta` is derived only from approved/promoted knowledge outputs, never from unpromoted extraction artifacts.
- Promotion and retirement remain optional, governance-gated outcomes rather than mandatory outputs of every cycle.

Rule: Nothing may re-enter planning/context unless it has passed `extract -> canonicalize -> compact -> promote`.
Pattern: Every Playbook run is a deterministic closed-loop cycle, not a terminal command.
Failure Mode: Open-loop apply causes knowledge loss, drift, duplicate patterns, and memory-heap behavior.
Failure Mode: Forced promotion on every cycle produces noisy memory mutation instead of governed intelligence.
