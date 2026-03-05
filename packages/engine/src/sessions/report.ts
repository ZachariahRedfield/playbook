import { MergeResult } from './schema.js';

export const formatMergeReportMarkdown = (result: MergeResult): string => {
  const lines: string[] = [
    '# Session Merge Report',
    '',
    '## Summary',
    `- Input snapshots: ${result.stats.inputSnapshots}`,
    `- Decisions: ${result.stats.decisionCount}`,
    `- Constraints: ${result.stats.constraintCount}`,
    `- Artifacts: ${result.stats.artifactCount}`,
    `- Tags: ${result.stats.tagCount}`,
    `- Conflicts: ${result.stats.conflictCount}`,
    '',
    '## Conflicts'
  ];

  if (result.conflicts.length === 0) {
    lines.push('- None');
  } else {
    for (const conflict of result.conflicts) {
      lines.push(`- **${conflict.type}** \`${conflict.key}\``);
      lines.push(`  - ours: \`${JSON.stringify(conflict.ours)}\``);
      lines.push(`  - theirs: \`${JSON.stringify(conflict.theirs)}\``);
      if (conflict.note) {
        lines.push(`  - note: ${conflict.note}`);
      }
      lines.push('');
    }
  }

  lines.push('## Manual resolution checklist');
  lines.push('- [ ] Review each listed conflict and pick canonical wording.');
  lines.push('- [ ] Update promoted docs (PLAYBOOK_NOTES, ARCHITECTURE, CHANGELOG) where needed.');
  lines.push('- [ ] Re-run `playbook session merge` and ensure conflicts are resolved.');

  return lines.join('\n').trimEnd() + '\n';
};
