# Releasing Playbook CLI

## 1) Build and test from the monorepo root

```bash
pnpm install
pnpm -r build
pnpm test
```

## 2) Publish from CI on a version tag

Tag pushes (`v*`) trigger `.github/workflows/publish-npm.yml`, which publishes the public Playbook package (`@fawxzzy/playbook`) and the internal runtime distribution set used by the CLI wrapper/fallback path.

## 3) Deterministic fallback artifact on each release

The publish workflow now packs `packages/cli-wrapper` and uploads a deterministic release asset for CI fallback consumers:

- Asset filename: `playbook-cli-<version>.tgz`
- Example for first fixed release `v0.1.7`: `playbook-cli-0.1.7.tgz`
- Release URL shape: `https://github.com/ZachariahRedfield/playbook/releases/download/v<version>/playbook-cli-<version>.tgz`

The workflow enforces `tag version == packages/cli-wrapper package.json version` before uploading the tarball so pinned fallback URLs remain immutable and real.

Before upload, the release job now runs `node scripts/pack-release-fallback-asset.mjs`, which packs from `packages/cli-wrapper`, preserves the exact generated tarball as `dist/release/playbook-cli-<version>.tgz`, and asserts the tarball contains `package/bin/playbook.js`, `package/runtime/main.js`, and vendored `package/runtime/node_modules/**`.

## 4) Consumer pinning contract (Fawxzzy Fitness)

Consumer repositories must pin `PLAYBOOK_OFFICIAL_FALLBACK_SPEC` to the exact deterministic URL:

```bash
PLAYBOOK_OFFICIAL_FALLBACK_SPEC=@https://github.com/ZachariahRedfield/playbook/releases/download/v0.1.7/playbook-cli-0.1.7.tgz
```

This keeps producer (release asset) and consumer (fallback URL) ownership boundaries explicit and prevents URL/version/filename drift.

## 5) End-to-end fallback proof command

From this repository, run:

```bash
pnpm release:fallback:proof --version 0.1.7 --json
```

Optional consumer smoke validation (for real downstream proof):

```bash
pnpm release:fallback:proof --version 0.1.7 --consumer-repo /path/to/FawxzzyFitness --json
```

Use `--asset-path dist/release/playbook-cli-<version>.tgz` to prove a locally packed release artifact before upload, and add `--consumer-repo <path>` for a clean external consumer proof.

When `--consumer-repo` is provided, the command performs the clean-environment sequence:

1. `npm install`
2. package acquisition attempt (intentional miss)
3. fallback acquisition from the published tarball URL
4. prerequisite generation (`npx @fawxzzy/playbook index --json`)
5. canonical ladder (`verify -> plan -> apply`)
6. required artifact assertions (`.playbook/repo-graph.json`, `.playbook/plan.json`)

Fallback proof now reports artifact failures with deterministic categories:

- `missing_prerequisite_artifact`: prerequisite lifecycle step was not completed
- `stale_artifact`: artifact exists but predates the producer command run in this proof
- `invalid_artifact`: artifact exists but JSON/schema validation failed

Each artifact failure includes `artifactPath`, `reason`, `expectedProducerCommand`, `remediation`, and `severity` (`setup_precondition_fail` or `hard_fail`) in JSON output so consumer remediation is explicit.

## 5.1) Operational proof status tracking (required)

Record each real-network proof outcome in release notes/changelog with:

- producer proof result (`release asset fetch`, `tar integrity`, `canonical filename`)
- consumer proof result against Fawxzzy Fitness (`npm install`, intentional package miss, fallback acquisition, canonical ladder, artifact assertions)
- explicit drift callout when either side fails (producer or consumer)

Fallback is only considered operationally proven when both producer and consumer checks succeed in a network-capable environment.

Example remediation for a consumer repo:

```bash
cd /path/to/FawxzzyFitness
npm install
npx @fawxzzy/playbook index --json
npx @fawxzzy/playbook verify --json
npx @fawxzzy/playbook plan --json
npx @fawxzzy/playbook apply --json
```

## 6) Push the release tag

Create and push a git tag that matches the released version:

```bash
git tag v0.1.7
git push origin v0.1.7
```

## 5.2) Proof invariants

- Pattern: machine-readable packaging/release validation should prove external installability, not just internal monorepo correctness.
- Failure Mode: fallback artifacts that depend on unpublished workspace packages pass local assumptions but fail real external installation.
- Rule: release validation must include a clean external consumer proof before considering fallback packaging complete.
