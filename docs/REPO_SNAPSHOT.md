# Repository Snapshot

## Repo Tree (top-level)

```text
.
├── .github/
├── actions/
├── docs/
├── packages/
├── scripts/
├── templates/
├── test/
├── tests/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## README

Primary README is located at:

- `README.md`

It describes Playbook as a deterministic repo intelligence + governance + remediation runtime, including quick start, canonical workflow ladder, and command categories.

## Roadmap File

Primary product roadmap file:

- `docs/PLAYBOOK_PRODUCT_ROADMAP.md`

Additional roadmap materials:

- `docs/roadmap/README.md`
- `docs/roadmap/ROADMAP.json`
- `docs/roadmap/IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md`
- `docs/roadmap/IMPROVEMENTS_BACKLOG.md`
- `docs/roadmap/PLAYBOOK_EXECUTION_SYSTEM_V1.md`
- `docs/roadmap/WEEK0_WEEK1_EXECUTION_VALIDATOR.md`

## CLI Command List

From local CLI context output (`node packages/cli/dist/main.js context --json`):

- `demo`
- `init`
- `analyze`
- `analyze-pr`
- `verify`
- `plan`
- `apply`
- `fix`
- `doctor`
- `status`
- `upgrade`
- `diagram`
- `explain`
- `context`
- `ai-context`
- `ai-contract`
- `contracts`
- `docs`
- `audit`
- `schema`
- `rules`
- `index`
- `graph`
- `ask`
- `deps`
- `query`
- `session`

## Package Structure

Workspace definition (`pnpm-workspace.yaml`):

- `packages/*`

Current packages:

- `packages/cli` → `@fawxzzy/playbook`
- `packages/core` → `@zachariahredfield/playbook-core`
- `packages/engine` → `@zachariahredfield/playbook-engine`
- `packages/node` → `@zachariahredfield/playbook-node`
