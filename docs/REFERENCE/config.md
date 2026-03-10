# Configuration Reference

Playbook loads configuration from:

- `playbook.config.json` at the repository root.

## Missing config behavior

If `playbook.config.json` is missing, Playbook loads defaults and emits a warning:

- Loader warning: `playbook.config.json not found; using defaults.`
- `pnpm playbook doctor` surfaces this as a warning (but does not fail solely for warnings).

## Schema

```json
{
  "version": 1,
  "docs": {
    "notesPath": "string",
    "architecturePath": "string",
    "governancePath": "string",
    "checklistPath": "string"
  },
  "analyze": {
    "detectors": ["string"]
  },
  "plugins": ["string"],
  "verify": {
    "policy": {
      "rules": ["rule-id"]
    },
    "rules": {
      "requireNotesOnChanges": [
        {
          "whenChanged": ["glob"],
          "mustTouch": ["path-or-glob"]
        }
      ]
    }
  }
}
```

## Minimal example

```json
{
  "version": 1,
  "docs": {
    "notesPath": "docs/PLAYBOOK_NOTES.md",
    "architecturePath": "docs/ARCHITECTURE.md",
    "governancePath": "docs/PROJECT_GOVERNANCE.md",
    "checklistPath": "docs/PLAYBOOK_CHECKLIST.md"
  },
  "analyze": {
    "detectors": ["nextjs", "supabase", "tailwind"]
  },
  "plugins": [],
  "verify": {
    "policy": {
      "rules": ["requireNotesOnChanges"]
    },
    "rules": {
      "requireNotesOnChanges": [
        {
          "whenChanged": ["src/**", "app/**", "server/**", "supabase/**"],
          "mustTouch": ["docs/PLAYBOOK_NOTES.md"]
        }
      ]
    }
  }
}
```
