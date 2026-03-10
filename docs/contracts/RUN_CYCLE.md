# RunCycle Artifact Contract

The RunCycle artifact captures one repository learning loop in a deterministic, machine-readable envelope.

It is intended to anchor:

- forward discovery (`ai-context`/`ai-contract`/`index`/`graph`)
- return remediation (`verify`/`plan`/`apply`/post-`verify`)
- Zettelkasten traces (`zettels.jsonl` and `links.jsonl`)

## Artifact path

Runtime output path:

- `.playbook/run-cycles/<timestamp>@<shortsha>.json`

Example:

- `.playbook/run-cycles/2025-01-01T00-00-00.000Z@abc1234.json`

## Contract shape

```json
{
  "schemaVersion": "1.0",
  "kind": "playbook-run-cycle",
  "runCycleId": "2025-01-01T00-00-00.000Z@abc1234",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "repository": {
    "root": ".",
    "git": {
      "commit": "abc1234def5678",
      "shortSha": "abc1234"
    }
  },
  "forwardArc": {
    "aiContext": { "path": ".playbook/ai-context.json", "digest": "sha256:..." },
    "aiContract": { "path": ".playbook/ai-contract.json", "digest": "sha256:..." },
    "repoIndex": { "path": ".playbook/repo-index.json", "digest": "sha256:..." },
    "repoGraph": { "path": ".playbook/repo-graph.json", "digest": "sha256:..." }
  },
  "returnArc": {
    "verify": { "path": ".playbook/verify.json", "digest": "sha256:..." },
    "plan": { "path": ".playbook/plan.json", "digest": "sha256:..." },
    "apply": { "path": ".playbook/apply.json", "digest": "sha256:..." },
    "postVerify": { "path": ".playbook/post-verify.json", "digest": "sha256:..." }
  },
  "zettelkasten": {
    "zettels": { "path": ".playbook/zettelkasten/zettels.jsonl", "digest": "sha256:..." },
    "links": { "path": ".playbook/zettelkasten/links.jsonl", "digest": "sha256:..." }
  },
  "metrics": {
    "loopClosureRate": 0.75,
    "promotionYield": 0.2,
    "compactionGain": 0.15,
    "reuseRate": 0.3,
    "driftScore": 0.1,
    "entropyBudget": 0.4
  }
}
```

## Required sections

- `forwardArc`: refs to forward intelligence artifacts (`ai-context`, `ai-contract`, `index`, `graph`).
- `returnArc`: refs to return/remediation artifacts (`verify`, `plan`, `apply`, post-`verify`).
- `zettelkasten`: refs to `.playbook/zettelkasten/zettels.jsonl` and `.playbook/zettelkasten/links.jsonl`.
- `metrics`: must include `loopClosureRate`, `promotionYield`, `compactionGain`, `reuseRate`, `driftScore`, and `entropyBudget`.

Each ref is nullable. Producers should populate refs only when source artifacts exist.

## Runtime artifact policy

RunCycle and Zettelkasten outputs are runtime artifacts and must remain under `.playbook/`.

For repository history, commit only curated/static examples (for example under `.playbook/demo-artifacts/`) and avoid committing volatile run-by-run snapshots.
