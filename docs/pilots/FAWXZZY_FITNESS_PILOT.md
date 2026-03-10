# Fawxzzy Fitness External Pilot (Bounded Advisory)

## Objective

Run the first Fawxzzy Fitness Playbook pilot using the **current Playbook repository as the runtime** against an **external Fawxzzy Fitness repository path**, without relying on any embedded or stale Playbook copy in the fitness repository.

## Runtime model

- **Embedded Playbook copy**: historical snapshot committed inside the fitness repository; not authoritative for pilot execution.
- **External Playbook runtime**: current branch of this Playbook repository executing scripts/commands against `--target-repo <fitness-path>`.

Rule:
Initial external pilots must use the current Playbook runtime, not stale embedded copies.

Pattern:
A bounded external pilot validates the reasoning engine without forcing repo-level Playbook synchronization first.

Failure Mode:
Running a pilot on an outdated embedded Playbook copy produces false negatives and invalid architecture conclusions.

## Bounded pilot scope

Allowed stages only:

1. evidence intake
2. zettels
3. graph/grouping
4. candidate patterns
5. draft pattern cards
6. promotion review queue
7. meta findings

Disabled capabilities:

- automatic contract mutation
- automatic code edits
- cross-repo propagation
- broad functor transforms

## Command

From the Playbook repository root:

```bash
node scripts/dev/run-playbook-cycle.mjs --target-repo /absolute/path/to/fawxzzy-fitness
```

Optional flags:

```bash
node scripts/dev/run-playbook-cycle.mjs   --target-repo /absolute/path/to/fawxzzy-fitness   --config /absolute/path/to/fawxzzy-fitness/playbook.fitness.config.json   --run-id fitness-pilot-cycle-0001   --created-at 2026-01-01T00:00:00.000Z
```

## Artifact location contract

The pilot writes advisory artifacts to the target repository only:

- `.playbook/run-cycles`
- `.playbook/zettels`
- `.playbook/graph`
- `.playbook/groups`
- `.playbook/pattern-cards/drafts`
- `.playbook/promotion`
- `.playbook/meta`

No artifacts are written into the Playbook runtime repository when using `--target-repo`.

## Verification checklist

1. Pilot runs from Playbook repo root with `--target-repo <fitness-path>`.
2. Artifacts are present under `<fitness-path>/.playbook/`.
3. Runtime log shows Playbook runtime path and external target path.
4. Safeguards remain advisory-only in run-cycle output.
