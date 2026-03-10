# State-Space Snapshot Contract

State-space snapshots provide an internal, bounded projection of RunCycle telemetry into a stable 3-axis coordinate system.

This artifact is intended for trend analysis, loop diagnostics, and deterministic comparisons between adjacent cycles.

## Important framing

This model is **metaphorical**. It is a bounded state-space projection inspired by Bloch-sphere geometry for interpretability.

It is **not** a claim about quantum computing, quantum state simulation, or physical quantum behavior.

## Artifact purpose

- Attach a deterministic state-space view to RunCycle-level metrics.
- Preserve projection metadata so future mappings can coexist safely.
- Track directional drift and angular movement across consecutive cycles.

## Projection versioning

- `projection = "bloch-v1"` is the initial mapping.
- Future versions must use new projection IDs (for example `bloch-v2`) rather than changing `bloch-v1` semantics.
- Consumers must branch behavior by projection ID.

## Axes semantics (`bloch-v1`)

Input metrics are expected in `[0,1]`:

- `reuseRate` → x-axis (knowledge reuse pressure)
- `entropyBudget` → y-axis (remaining exploration budget)
- `loopClosureRate` → z-axis (completion and closure)

Axis transforms:

- `x = 2*reuseRate - 1`
- `y = 2*entropyBudget - 1`
- `z = 2*loopClosureRate - 1`

Direction and coherence:

- `u = normalize([x,y,z])`
- `c = clamp01(0.5*(1-driftScore) + 0.3*compactionGain + 0.2*loopClosureRate)`
- `r = c*u`

Derived values:

- `purity = (1 + |r|^2)/2`
- `angularDistancePrev = arccos( dot(r_t, r_{t-1}) / (|r_t||r_{t-1}| + 1e-9) )`

Notes:

- `clamp01(v) = min(1, max(0, v))`
- If the direction vector input norm is 0, use `u = [0,0,0]`.
- `angularDistancePrev` is in radians.

## Event logging model

Snapshots can record gate-like events to make transitions explicit:

- `rotation`: deterministic directional change from one state vector to another.
- `measurement`: scalar extraction from state (for example `purity`, `coherence`, or axis value).
- `projection`: explicit map from RunCycle metrics into a projection version (`bloch-v1`).

Recommended event envelope:

```json
{
  "type": "rotation",
  "at": "2025-01-01T00:00:00.000Z",
  "label": "cycle-transition",
  "details": {
    "angularDistance": 0.42,
    "fromRunCycleId": "...",
    "toRunCycleId": "..."
  }
}
```

Event guidance:

- Keep events append-only within a snapshot write.
- Include timestamps (`at`) and concise labels.
- Use `details` for projection-specific payloads while preserving stable top-level keys.

## Runtime location

Runtime snapshots should be written to:

- `.playbook/state-space/<runCycleId>.json`

Curated examples can be committed under:

- `.playbook/demo-artifacts/`
