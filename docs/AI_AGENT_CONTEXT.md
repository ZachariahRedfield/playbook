# AI Agent Context

## Use diagrams before structural changes

When changing package layout or cross-package dependencies:

1. Run `pnpm -r build && node packages/cli/dist/main.js diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md` for repo-internal execution.
2. Review `Structure` to understand folder/workspace containment.
3. Review `Dependencies` to avoid introducing unintended couplings.
4. Regenerate diagrams after architecture updates and commit the updated markdown.

This keeps architecture reasoning explicit and reproducible for agents working in this repository.

## Release & Distribution

### Why `playbook` (unscoped) is not the npx target

- WHAT: Treat unscoped `playbook` as unavailable for onboarding commands.
- WHY: The unscoped npm package name is already taken, so `npx <unscoped package name> ...` cannot be the reliable install-free path.

### Preferred install-free bootstrap

Use the scoped package entrypoint for the canonical serious-user ladder:

```bash
npx --yes @fawxzzy/playbook ai-context --json
npx --yes @fawxzzy/playbook ai-contract --json
npx --yes @fawxzzy/playbook context --json
npx --yes @fawxzzy/playbook index --json
npx --yes @fawxzzy/playbook query modules --json
npx --yes @fawxzzy/playbook explain architecture --json
```

`analyze` remains available for compatibility and lightweight stack inspection, but it is no longer the primary serious-user bootstrap path.

Optional compatibility invocation (same scoped package):

```bash
npx --yes -p @fawxzzy/playbook playbook ai-context --json
```

### Publishing notes

- WHAT: Publish scoped packages with explicit public access (`npm publish --access public`).
- WHY: Scoped npm packages default to private visibility and will not work for public `npx` onboarding unless published as public.

- WHAT: Do a manual first publish, then automate via a tag-triggered GitHub workflow.
- WHY: Validates package metadata and distribution behavior once before CI automation takes ownership.

## Product state anchoring

Rule: **Product State Must Be Anchored**.

Pattern: **AI Anchor Drift**.

Whenever command/workflow state changes, update:

- `README.md`
- command reference docs
- demo docs/contracts
- `docs/CHANGELOG.md`

Current product-facing command/artifact surface:

- `analyze`
- `verify`
- `rules`
- `doctor`
- `diagram`
- `plan`
- `apply`
- `playbook-demo` (via `playbook demo`)

If docs disagree with implementation, treat code as source of truth and realign docs.

## Internal CI command rule

- Rule: Repo-internal CI must execute the built CLI directly, not through `npx`.
- Pattern: Separate internal CLI execution (`node packages/cli/dist/main.js ...`) from consumer-install execution (`npx --yes @fawxzzy/playbook ...`).
- Failure Mode: `npx could not determine executable to run` indicates package/bin resolution failure, not necessarily a command implementation bug.

## Documentation governance validation

When documentation, governance, or command-surface files change in the Playbook repository, run:

```bash
pnpm -r build
node packages/cli/dist/main.js docs audit --json
```

Pattern: AI working inside the Playbook repo should run docs audit alongside other branch-accurate local CLI validations.
