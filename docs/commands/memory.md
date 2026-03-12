# `pnpm playbook memory replay`

Replay episodic repository memory from `.playbook/memory/index.json` and referenced event files into deterministic candidate knowledge artifacts.

## Guarantees

- Read-only replay over rules/docs/source files.
- Deterministic salience scoring from explicit event inputs only:
  - severity
  - recurrence count
  - cross-module breadth
  - risk score
  - persistence across runs
  - ownership/docs gaps
  - novel successful remediation shape
- Deterministic clustering by `fingerprint/module/rule/failure shape`.
- Candidate provenance links every emitted candidate back to source event ids and files.

## Output artifact

- Default artifact path: `.playbook/memory/candidates.json`
- Candidate kinds:
  - `decision`
  - `pattern`
  - `failure_mode`
  - `invariant`
  - `open_question`

## Example

```bash
pnpm playbook memory replay --json
```
