# playbook.config.json

`playbook.config.json` defines the active governance behavior for a repository.

## Structure

- `version` — config schema version.
- `docs` — documentation paths used by Playbook.
- `analyze.detectors` — detector list used by `playbook analyze`.
- `verify.rules.requireNotesOnChanges` — rule configuration for enforcing notes updates.

## Default config example

```json
{
  "version": "1",
  "docs": {
    "notes": "docs/PLAYBOOK_NOTES.md",
    "architecture": "docs/ARCHITECTURE.md",
    "governance": "docs/PROJECT_GOVERNANCE.md"
  },
  "analyze": {
    "detectors": ["nextjs", "tailwind", "supabase"]
  },
  "verify": {
    "rules": {
      "requireNotesOnChanges": {
        "enabled": true,
        "codeGlobs": ["src/**", "app/**", "server/**", "supabase/**"],
        "notesPath": "docs/PLAYBOOK_NOTES.md"
      }
    }
  }
}
```
