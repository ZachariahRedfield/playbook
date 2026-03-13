# Architecture Diagrams

## Structure
```mermaid
flowchart TB
  n_fawxzzy_playbook["@fawxzzy/playbook"]
  n_zachariahredfield_playbook_core["@zachariahredfield/playbook-core"]
  n_zachariahredfield_playbook_engine["@zachariahredfield/playbook-engine"]
  n_zachariahredfield_playbook_node["@zachariahredfield/playbook-node"]
  packages["packages"]
  packages --> n_fawxzzy_playbook
  packages --> n_zachariahredfield_playbook_core
  packages --> n_zachariahredfield_playbook_engine
  packages --> n_zachariahredfield_playbook_node
```

## Dependencies
```mermaid
flowchart TB
  n_fawxzzy_playbook["@fawxzzy/playbook"]
  n_zachariahredfield_playbook_core["@zachariahredfield/playbook-core"]
  n_zachariahredfield_playbook_engine["@zachariahredfield/playbook-engine"]
  n_zachariahredfield_playbook_node["@zachariahredfield/playbook-node"]
  n_fawxzzy_playbook --> n_zachariahredfield_playbook_core
  n_fawxzzy_playbook --> n_zachariahredfield_playbook_engine
  n_fawxzzy_playbook --> n_zachariahredfield_playbook_node
  n_zachariahredfield_playbook_engine --> n_zachariahredfield_playbook_core
```

## Legend
- Structure edges (`A --> B`) represent containment from top-level directory to package/workspace.
- Dependency edges (`A --> B`) represent internal package dependency direction (A depends on B).

## Generation
- Command: `playbook diagram --repo . --out docs/ARCHITECTURE_DIAGRAMS.md`
- Limits: maxNodes=60, maxEdges=120
- Exclusions: **/node_modules/**, **/dist/**, **/build/**, **/.next/**, **/.git/**
- Dependency source: workspace-manifests
