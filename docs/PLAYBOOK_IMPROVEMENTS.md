# Playbook Improvement Backlog

Purpose
-------
This document captures feature ideas, architectural opportunities, and workflow improvements discovered during Playbook development.

Items here are **not yet committed roadmap work**.

They are promoted to the roadmap once they become prioritized product capabilities.

Lifecycle
---------
Idea → Improvement Backlog → Roadmap → Implemented → Archive

This prevents roadmap bloat while preserving product intelligence discovered during development.

---

## Query System Expansion

- [ ] Dependency graph query  
  Command: `playbook query dependencies`  
  Purpose: visualize module relationships and dependency structure.

- [ ] Impact analysis query  
  Command: `playbook query impact <module>`  
  Purpose: determine the blast radius of changes to a module.

Example:

```bash
playbook query impact auth
```

Output should include:
- dependent modules
- affected architecture boundaries
- impacted rules

---

## Risk Intelligence

- [ ] Hotspot ranking  
  Command: `playbook query risk --top`  
  Purpose: rank the highest-risk modules based on fan-in, impact, and verification failures.

---

## Developer Workflow Intelligence

- [ ] Pull request analysis  
  Command: `playbook analyze-pr`

Purpose:
Provide structured architecture intelligence about a pull request.

Example output:
- modules touched
- risk level
- architecture boundary violations
- missing tests
- missing documentation
