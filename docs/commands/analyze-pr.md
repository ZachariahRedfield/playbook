# `pnpm playbook analyze-pr`

Structured pull-request intelligence from local git diff + indexed repository intelligence.

## Usage

- `pnpm playbook analyze-pr`
- `pnpm playbook analyze-pr --json`
- `pnpm playbook analyze-pr --base main --json`
- `pnpm playbook analyze-pr --format github-comment`
- `pnpm playbook analyze-pr --format github-review`

## Implemented behavior

`analyze-pr` composes:

- local git diff data
- `.playbook/repo-index.json`
- indexed impact/risk/docs/ownership intelligence

The output includes deterministic PR analysis (changed files, affected modules, downstream impact, boundary touches, docs guidance, and merge guidance).

### Options

- `--base <ref>`: explicit diff base
- `--json`: canonical machine-readable analysis output
- `--format <text|json|github-comment|github-review>`: deterministic formatter over the same analysis payload
- `--help`: command help

If `--format` receives an unsupported value, the command fails deterministically.

## CI contract notes

- Run `pnpm playbook index` before `analyze-pr`.
- In pull_request workflows, pass explicit base refs (for example `--base origin/${{ github.base_ref }}`) and use `fetch-depth: 0`.
- `--format github-comment` is intended for sticky summary comments.
- `--format github-review` is intended for inline review diagnostics.

## Failure behavior

Deterministic failures are returned for:

- missing `.playbook/repo-index.json`
- unresolved base ref when `--base` is provided
- unavailable git diff context
- no changed files in resolved diff/worktree
