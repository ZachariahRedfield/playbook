# Exit Codes

Current Playbook CLI exit behavior:

## `playbook analyze`

- Default mode: returns `0`.
- `--json`: returns `0`.
- `--ci`: returns `0` when `result.ok` is true, else `1`.

## `playbook verify`

- Returns `0` when report `ok` is true.
- Returns `1` when report `ok` is false.
- Same pass/fail code behavior in default, `--json`, and `--ci` modes.

## `playbook doctor`

- Returns `1` only when `git` is not installed.
- Returns `0` otherwise, including cases with warnings.

## `playbook diagram`

- Returns `0` after successful diagram generation and file write.
- Runtime errors (for example, uncaught filesystem exceptions) cause process failure via Node error exit behavior.
