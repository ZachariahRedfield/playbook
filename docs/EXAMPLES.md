# Playbook CLI Examples

## Analyze a repository

```bash
pnpm playbook analyze
```

## Verify repository governance

```bash
pnpm playbook verify
```

## Initialize Playbook

```bash
pnpm playbook init
```

## Sample CLI output

```text
$ pnpm playbook analyze
Detected Stack

Framework: Next.js
Database: Supabase
Styling: Tailwind

$ pnpm playbook verify
PASS  requireNotesOnChanges
All governance checks passed.
```
