# Bloch Sphere / State-Space Modeling for Playbook

This document defines the deterministic Bloch-style state-space projection used by Playbook telemetry.

> Bloch mapping is a deterministic projection for monitoring and drift metrics, not quantum behavior.

## Bloch sphere / Bloch ball basics (modeling aid)

- **Bloch sphere**: geometric model for idealized pure states as points on the unit sphere.
- **Bloch ball**: extension where mixed states occupy interior points with reduced magnitude.
- **Pure vs mixed**:
  - pure state → magnitude near `1`
  - mixed/noisy state → magnitude `< 1`
- **Rotations**: transformations move state direction in 3D space.
- **Measurement**: readout step that converts state into observable values for decisions.

In Playbook, this is only a bounded geometry for deterministic observability.

## Playbook mapping

- **RunCycle metrics** define the projected state vector.
- **Commands** (especially `plan`/`apply`) are modeled as deterministic rotations.
- **Verify + promotion checkpoints** are modeled as measurements.
- **Entropy/noise effects** are modeled as reduced vector magnitude (inside the Bloch ball).

## `bloch-v1` axis definitions

Given normalized metrics in `[0,1]`:

- `reuseRate`
- `entropyBudget`
- `loopClosureRate`

Axis projection for `bloch-v1`:

- `x = 2*reuseRate - 1`
- `y = 1 - 2*entropyBudget`
- `z = 2*loopClosureRate - 1`

Normalization:

- `direction = [x,y,z] / ||[x,y,z]||`
- If `||[x,y,z]|| = 0`, use `[0,0,0]`.

Purity and emitted vector:

- `purity = clamp(1 - entropyBudget, 0, 1)`
- `magnitude = purity`
- `vector = direction * magnitude`

Optional previous-cycle drift angle:

- `angularDistancePrev = acos(clamp(dot(v_t, v_t-1) / (||v_t||*||v_t-1||), -1, 1))`

## Determinism rule

State-space snapshots are derived artifacts.

- Inputs are RunCycle + deterministic artifact references.
- No random inputs or non-deterministic transforms are allowed.
- Re-running emission for identical inputs must produce identical snapshot semantics.
- Runtime artifacts must remain under `.playbook/state-space/`.

## Gate event conventions

`gateEvents` encode deterministic lifecycle intent:

- `projection`: metric-to-axis projection record.
- `measurement`: verify/promotion readouts.
- `rotation`: plan/apply transition steps.

These events are telemetry annotations, not physical quantum operations.
