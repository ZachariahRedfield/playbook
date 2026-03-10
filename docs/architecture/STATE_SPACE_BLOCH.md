# RunCycle State-Space (Bloch Projection)

This document defines Playbook's deterministic `bloch-v1` projection for RunCycle telemetry.

> **Disclaimer:** this is a projection/diagnostic coordinate system for repository process state. It is **not** quantum computation, does not simulate qubits, and does not imply quantum execution semantics.

## Why Bloch geometry

Playbook uses a bounded 3D state-space metaphor to make RunCycle trajectory and drift legible:

- **Bloch sphere** intuition: pure states lie on a unit sphere.
- **Bloch ball** intuition: mixed/uncertain states live inside the sphere.
- **Rotations** represent directional workflow movement.
- **Measurements** represent deterministic readouts at verify checkpoints.

In Playbook, these are visualization and diagnostics concepts only.

## `bloch-v1` projection contract

For normalized metrics in `[0,1]`:

- `reuseRate`
- `entropyBudget`
- `loopClosureRate`

Map metrics to axes:

- `x = 2*reuseRate - 1`
- `y = 1 - 2*entropyBudget`
- `z = 2*loopClosureRate - 1`

Then derive vector fields:

- `direction = normalize([x,y,z])`
- `purity = clamp(1 - entropyBudget, 0, 1)`
- `vector = direction * purity`
- `angularDistancePrev = arccos(dot(v_t,v_prev)/(||v_t||*||v_prev|| + 1e-9))`

`bloch-v1` snapshots are derived artifacts and must stay deterministic for identical inputs.

## Artifact placement

- Runtime emission target: `.playbook/state-space/<runCycleId>.json`
- Stable examples for documentation/tests: `.playbook/demo-artifacts/state-space.example.json`

Only stable snapshot examples should be committed.
