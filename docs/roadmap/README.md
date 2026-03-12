# Roadmap Contracts

This directory contains machine-readable roadmap artifacts used by CI and AI automation.

## Source-of-truth hierarchy (canonical)

1. **Strategic roadmap**: `docs/PLAYBOOK_PRODUCT_ROADMAP.md` (single strategic sequencing + commitment posture).
2. **Machine-readable roadmap contract**: `docs/roadmap/ROADMAP.json` (CI-validated feature/dependency/status contract).
3. **Canonical architecture dependency map**: `docs/architecture/PLAYBOOK_FINAL_ARCHITECTURE_MAP_AND_CANONICAL_DEPENDENCY_INDEX.md` (dependency ordering and trust-chain map).
4. **Implementation sequencing view**: `docs/PLAYBOOK_PRODUCT_ROADMAP.md` implementation sequencing section (build-now vs later order).
5. **Active implementation plan window**: `docs/roadmap/IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md` and `docs/roadmap/WEEK0_WEEK1_EXECUTION_VALIDATOR.md`.
6. **Backlog**: `docs/roadmap/IMPROVEMENTS_BACKLOG.md` (emerging, unscheduled ideas only).

Rule: One Strategic Roadmap, One Machine-Readable Contract.
Rule: ROADMAP.json must stay synchronized with merged architecture and roadmap truth.
Rule: Architecture-defined does not equal implementation-committed.
Rule: Product overlays must not be sequenced as runtime prerequisites.

## Canonical files

- `ROADMAP.json`: deterministic roadmap contract entries.
- `../PLAYBOOK_PRODUCT_ROADMAP.md`: canonical product roadmap, including current runtime position, near-term execution boundaries, and longer-horizon platform direction.
- `../architecture/PLAYBOOK_FINAL_ARCHITECTURE_MAP_AND_CANONICAL_DEPENDENCY_INDEX.md`: canonical dependency-ordered architecture map and navigation index across architecture slices, trust boundaries, and roadmap layers.
- `IMPROVEMENTS_BACKLOG.md`: idea and enhancement staging backlog.
- `IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md`: implementation-grade 4-week operating plan aligned to accepted roadmap baseline.
- `WEEK0_WEEK1_EXECUTION_VALIDATOR.md`: execution validator and immediate Week 0/1 build queue derived from the accepted baseline.
- `../ARCHITECTURE.md`: canonical current-state architecture document; future-state platform evolution stays in the product roadmap.

## Navigation

- Read `../PLAYBOOK_PRODUCT_ROADMAP.md` for the strategic roadmap and the platform-evolution layer model.
- Read `../architecture/PLAYBOOK_FINAL_ARCHITECTURE_MAP_AND_CANONICAL_DEPENDENCY_INDEX.md` for the canonical dependency order and architecture-slice navigation index used by roadmap layers.
- Read `IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md` for the active execution window only.
- Read `IMPROVEMENTS_BACKLOG.md` for unscheduled ideas and staging candidates.
- Read `ROADMAP.json` for the machine-readable contract CI and automation validate.

Rule: Roadmap entries represent planned intent; live command availability is determined by implemented command contracts and CLI help.
Rule: The 4-week implementation plan must stay narrower than the long-term platform direction.

## Architecture-slice contract policy

ROADMAP contract policy in this repository:

- Implementation-facing architecture slices should have explicit `feature_id` entries when they define dependency-relevant build sequencing.
- Product/commercial architecture overlays may be represented as smaller umbrella feature families when they are not direct runtime prerequisites.
- Architecture research docs do **not** imply implemented capability status; statuses must reflect implementation truth (`implemented-hardening`, `in-progress`, `planned`, `planned-later`, `directional`).
- Dependency ordering in `ROADMAP.json` must follow the canonical architecture map.

Failure Mode: Architecture docs merged without roadmap-contract alignment.
Failure Mode: Machine-readable roadmap lagging behind strategic roadmap.
Failure Mode: Future platform direction mistaken for active implementation.

## Rule

Every delivery change should map to at least one `feature_id` from `ROADMAP.json`.

Each roadmap feature entry must include:

- `feature_id`
- `version`
- `title`
- `goal`
- `commands`
- `contracts`
- `tests`
- `docs`
- `dependencies`
- `package_ownership`
- `verification_commands`
- `status`


## CI modes

- `node scripts/validate-roadmap-contract.mjs --ci`: validates roadmap contract structure.
- `node scripts/validate-roadmap-contract.mjs --ci --enforce-pr-feature-id`: enforces roadmap `feature_id` linkage with precedence: PR title -> PR body -> `.playbook/pr-metadata.json` (`featureIds`).

The repository CI workflow enforces the second mode through the reusable `./.github/actions/playbook-ci` action so roadmap linkage is branch-validated, not documentation-only.

Rule: roadmap entries represent planned intent; command live availability is determined by implemented CLI help/contracts and command truth artifacts (`docs/contracts/command-truth.json`).

Planned CLI mirror command surface: `pnpm playbook roadmap verify` (backed by the same roadmap-contract validator).

## Knowledge lifecycle and platform direction (internal-first)

Roadmap sequencing for repository knowledge follows a deterministic internal-first lifecycle:

`observation/extraction -> canonicalization -> deterministic comparison -> bucketing/compaction -> promotion -> retirement`

- Observation artifacts are evidence, not reusable guidance.
- Compaction is the bridge between extraction and promotion.
- Promotion requires stronger trust thresholds than raw observation.
- Retirement/deprecation is required to prevent stale or duplicative knowledge drift.
- Public knowledge-management command expansion is intentionally deferred until lifecycle and trust contracts are stable.

Recommended later platform-layer sequence:

1. knowledge persistence
2. knowledge compaction / promotion
3. repo longitudinal state
4. trust / evidence model
5. control plane
6. execution orchestration hardening
7. multi-repo transfer
8. governed interface/API surfaces
9. workspace/tenant governance + optional hosted deployment model
10. packaging/SKU architecture (Open Core -> Team -> Enterprise)
11. interface surfaces
12. capability / model routing

This sequence is roadmap direction, not part of the current 4-week execution commitment.

Rule: Treat extracted knowledge as evidence first, reusable knowledge second.
Rule: Promotion must only happen after canonicalization, deterministic comparison, and compaction.
Failure Mode: Unbounded pattern accumulation degrades determinism, retrieval quality, and operator trust.



Rule: Keep the Final Architecture Map synchronized with merged architecture slices so roadmap-layer navigation remains canonical.
