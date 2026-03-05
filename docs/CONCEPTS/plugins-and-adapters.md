# Plugins and Adapters

This page separates what exists now from planned extension points.

## Exists now

### Analyze detectors

`analyze` uses detector IDs from `config.analyze.detectors`.

Default detector set:

- `nextjs`
- `supabase`
- `tailwind`

### Verify rule system

`verify` supports config-driven rules, including:

- `verify.rules.requireNotesOnChanges`

This rule defines `whenChanged[]` globs and required `mustTouch[]` paths.

## Planned distinction

Over time, Playbook will separate extension types more clearly:

- **Analyzers / detectors**: infer repository signals and stack context.
- **Adapters**: connect policy enforcement into delivery surfaces (for example CI/VCS integrations and agent prompt packs).

The analyzer/rule capabilities above are available now; richer adapter surfaces are roadmap work.
