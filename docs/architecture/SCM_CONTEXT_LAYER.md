# SCM Context Layer (Normalization Plan)

Git/SCM context must be normalized across commands to avoid environment-specific behavior.

## Problem statement

Playbook command surfaces currently use consistent primitives in many places, but SCM resolution logic is still distributed across multiple flows (`verify`, `ask --diff-context`, `analyze-pr`, and Node integration helpers).

Without a shared normalization layer, edge-case handling can drift across commands:

- merge-base selection in PR vs push contexts
- detached `HEAD` behavior
- shallow clone limitations
- dirty working tree behavior
- file rename detection behavior

## Target architecture

Create a shared SCM context module:

- `packages/core/src/scm/context.ts`

Proposed responsibility:

- normalize repo capability checks (`isGitRepository`, shallow clone detection)
- resolve deterministic base/head references for push/PR/local modes
- expose normalized changed-file resolution options (including rename support policy)
- return explicit context diagnostics instead of command-local fallbacks

## Contract goals

The SCM context layer should provide:

- deterministic behavior across all command surfaces
- explicit error/warning taxonomy for SCM limitations
- consistent handling of shallow history and detached HEAD
- one canonical merge-base strategy configurable by invocation mode

## Migration sequence

1. Introduce `packages/core/src/scm/context.ts` with no behavioral change wrappers.
2. Migrate `packages/engine/src/git/base.ts` and `packages/engine/src/git/diff.ts` consumers to shared APIs.
3. Migrate `analyze-pr`, `ask --diff-context`, and `verify` diff-base callsites.
4. Add cross-command contract tests validating identical SCM behavior for key edge cases.

## Edge-case matrix (minimum)

- non-git directory
- detached HEAD
- shallow clone with missing base history
- merge-base equals HEAD (`main` push scenario)
- dirty working tree with unstaged changes
- rename-heavy diffs

