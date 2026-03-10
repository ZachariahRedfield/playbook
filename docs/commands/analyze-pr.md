# `pnpm playbook analyze-pr`

Structured pull request intelligence using local diff + indexed repository intelligence.

## Usage

- `pnpm playbook analyze-pr`
- `pnpm playbook analyze-pr --format text`
- `pnpm playbook analyze-pr --json`
- `pnpm playbook analyze-pr --base main --json`
- `pnpm playbook analyze-pr --format github-comment`
- `pnpm playbook analyze-pr --format github-review`

## Behavior

`analyze-pr` composes trusted local sources:

- local git diff from a deterministic base
- `.playbook/repo-index.json`
- indexed module impact/risk intelligence
- module and rule ownership surfaces
- docs coverage + changed docs context

It returns deterministic review/report data for automation, including changed files, affected modules, downstream impact, architecture boundaries touched, risk summary, docs review recommendations, rule/module ownership, and pre-merge guidance.

Rule relevance is scoped to the current change set: docs-only diffs emit documentation-relevant governance rules, while source/module and multi-boundary changes emit only governance rules justified by changed files, affected modules, touched boundaries, and explicit rule ownership metadata.

`--format <text|json|github-comment|github-review>` is a presentation/export selector over the same deterministic analysis contract. `--json` remains canonical analysis data; `github-comment` is deterministic markdown rendering for CI workflows; `github-review` is deterministic inline review annotation JSON for GitHub pull request files/lines.

GitHub Actions PR transport treats `analyze-pr --format github-comment` as the sticky summary markdown producer and `analyze-pr --format github-review` as the inline diagnostics producer. Summary comment transport updates one sticky comment marker (`<!-- playbook:analyze-pr-comment -->`) while inline diagnostics are synchronized on reruns (`<!-- playbook:analyze-pr-inline -->`) so stale diagnostics are removed and current diagnostics are posted without duplicate comment spam.

Producer/consumer contract note: `pnpm playbook analyze-pr` requires `.playbook/repo-index.json` and must be preceded by `pnpm playbook index`; creating `.playbook/` alone does not satisfy the artifact prerequisite. CI should run artifact producers before consumers (index first, then analyze-pr/query/impact).

CI diff-base contract note: in pull_request automation, pass an explicit base ref (for example `--base origin/${{ github.base_ref }}`) and ensure checkout uses full history (`fetch-depth: 0`) so diff-based analysis can resolve base/head deterministically.

Shell integration notes for GitHub Actions transport:

- Shell commands copied into GitHub Actions `run:` blocks must be rechecked for escaping; log-safe or JSON-escaped commands may fail in bash.
- Prefer multiline `run: |` blocks for commands with nested quoting.
- Prefer `node -e "console.log(...)"` over deeply nested `node -p` expressions when populating GitHub Actions env vars.
- When reading `packageManager` from `package.json`, split version with `${PM#pnpm@}` before passing to `pnpm/action-setup`.

## Scope contract

Pattern: `pnpm playbook analyze-pr` composes local diff context with indexed repository intelligence to produce deterministic pull request analysis.

Rule: Pull request intelligence must rely on trusted local git + Playbook-managed artifacts, not cloud-only or fuzzy repository inference.

Pattern: `ask --diff-context` is conversational change reasoning; `analyze-pr` is the structured review/report surface.

## Failure behavior

Deterministic failures are returned for:

- missing `.playbook/repo-index.json`
- no changed files in the resolved diff/worktree
- git diff unavailable (non-git repo)
- unresolved base ref when `--base <ref>` is provided


## Inline diagnostics contract

`analyze-pr --json` now includes deterministic `findings` entries with optional `file`/`line` coordinates and governance metadata (`ruleId`, `severity`, `message`, `recommendation`).

`analyze-pr --format github-review` maps those findings directly into GitHub review annotations:

- `path` ← `finding.file`
- `line` ← `finding.line`
- `body` ← deterministic formatter rendering (`ruleId` + message + optional recommendation)

Rule: inline PR diagnostics must come from canonical analyze-pr contracts through formatter output, never from ad-hoc workflow inference.
