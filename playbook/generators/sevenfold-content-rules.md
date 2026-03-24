# Sevenfold Plus Content Generation Rules

## Input Contract
Generators should consume `playbook/ontologies/sevenfold-plus.yaml`.

## Output Families
For each target number, emit:
- lore seed
- faction or boss seed
- biome/realm seed
- relic line seed
- questline seed
- UI/audio motif seed
- engine/system hook seed

## Core Rules
1. **Meta-state handling**
   - 0, 8, and 9 are orchestrators around 1–7, not peer realm bins.
2. **Minimum generation guarantee**
   - At least one realm/biome, boss/faction, relic line, questline, and engine hook per number.
3. **Shadow interpretation rule**
   - Pride = trying to become one's own source.
   - Greed = trying to possess enough to fill absence.
   - Wrath = trying to destroy separation.
   - Envy = trying to steal another's wholeness.
   - Sloth = refusing the burden of becoming.
   - Gluttony = trying to consume fullness.
   - Lust = trying to fuse instantly without transformation.
4. **8-specific rule**
   - Emit hybrid/reconciled outputs from at least two 1–7 archetypes.
   - Do not emit generic standalone "realm 8" duplicates.
5. **9-specific rule**
   - Emit persistence, consequence, lineage, stewardship, civic memory, or inherited systems.
   - Never treat 9 as a final-boss override.
6. **Layer isolation rule**
   - Canon outputs must exclude dev mnemonics.

## Generator Pseudocode
```text
for n in requested_numbers:
  entry = ontology[n]
  if n == 8:
    compose_from(min_two_archetypes)
  if n == 9:
    include_persistence_graph_and_legacy_payloads()
  emit_realm()
  emit_faction_or_boss()
  emit_relic_line()
  emit_questline()
  emit_system_hook()
  validate_layers(no_dev_mnemonics_in_canon)
```
