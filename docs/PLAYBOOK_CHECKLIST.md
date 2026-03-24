# Playbook Checklist

- [ ] Updated architecture docs if behavior changed
- [ ] Added note entry with WHAT/WHY
- [ ] Verified `pnpm playbook verify` passes

## Design Integrity Checks

Advisory checks (no new hard gates):

- Does this feature reduce to explicit, enforceable rules?
- What are the invariants vs incidental detail?
- Are we storing minimal sufficient information?
- Are we deriving secondary views/state instead of persisting redundant expansions?
- Can this workflow be expressed as state -> transformation -> enforcement?
