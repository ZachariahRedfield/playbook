# `playbook analyze-pr`

Structured pull request intelligence using local diff + indexed repository intelligence.

## Usage

- `playbook analyze-pr`
- `playbook analyze-pr --json`
- `playbook analyze-pr --base main --json`

## Behavior

`analyze-pr` composes trusted local sources:

- local git diff from a deterministic base
- `.playbook/repo-index.json`
- indexed module impact/risk intelligence
- module and rule ownership surfaces
- docs coverage + changed docs context

It returns deterministic review/report data for automation, including changed files, affected modules, downstream impact, architecture boundaries touched, risk summary, docs review recommendations, rule/module ownership, and pre-merge guidance.

## Scope contract

Pattern: `playbook analyze-pr` composes local diff context with indexed repository intelligence to produce deterministic pull request analysis.

Rule: Pull request intelligence must rely on trusted local git + Playbook-managed artifacts, not cloud-only or fuzzy repository inference.

Pattern: `ask --diff-context` is conversational change reasoning; `analyze-pr` is the structured review/report surface.

## Failure behavior

Deterministic failures are returned for:

- missing `.playbook/repo-index.json`
- no changed files in the resolved diff/worktree
- git diff unavailable (non-git repo)
- unresolved base ref when `--base <ref>` is provided
