# Playbook Improvement Backlog

Purpose
-------
This document captures potential Playbook capabilities and architectural improvements discovered during development or analysis.

Items here are not yet committed roadmap work. They are promoted to the roadmap once they become prioritized product capabilities.

Lifecycle
---------
Idea → Improvement Backlog → Roadmap

## Query System

- [ ] Dependency graph query
  Command: `playbook query dependencies`
  Purpose: show module relationships and dependency structure.

- [ ] Impact analysis query
  Command: `playbook query impact <module>`
  Purpose: determine the blast radius of code changes.

## Risk Intelligence

- [ ] Hotspot ranking
  Command: `playbook query risk --top`
  Purpose: rank highest-risk modules by fan-in and impact.

## Developer Workflow

- [ ] PR analysis command
  Command: `playbook analyze-pr`
  Purpose: produce structured intelligence about a pull request.

  Example output:
  - modules touched
  - architecture boundary violations
  - missing tests
  - missing docs
  - risk level
