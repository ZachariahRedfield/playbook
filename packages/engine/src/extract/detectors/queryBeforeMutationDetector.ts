import { createHash } from 'node:crypto';
import type { Detector, PatternCandidate } from './types.js';

const clamp = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(2))));
const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

export const queryBeforeMutationDetector: Detector = {
  detector: 'query-before-mutation',
  detect: ({ contractsRegistry, docsAudit }) => {
    const commands = [...contractsRegistry.cliSchemas.commands].sort((a, b) => a.localeCompare(b));
    const hasQuery = commands.includes('query');
    const hasPlan = commands.includes('plan');
    const hasApply = commands.includes('apply');

    if (!hasQuery || (!hasPlan && !hasApply)) {
      return [];
    }

    const commandTruthFindings = docsAudit.findings.filter((finding) => finding.ruleId.startsWith('docs.command'));
    const confidence = clamp(0.6 + (commandTruthFindings.length === 0 ? 0.25 : -0.1) + (hasPlan && hasApply ? 0.1 : 0));

    const idSeed = JSON.stringify({ detector: 'query-before-mutation', hasQuery, hasPlan, hasApply, commandTruthFindings: commandTruthFindings.length });

    const candidate: PatternCandidate = {
      id: `pattern.query-before-mutation.${shortHash(idSeed)}`,
      detector: 'query-before-mutation',
      title: 'Query-before-mutation command discipline',
      summary:
        commandTruthFindings.length === 0
          ? 'Command registry exposes query/read commands alongside plan/apply mutation commands without docs command-truth drift findings.'
          : `Command registry exposes query and mutation commands, but docs audit reported ${commandTruthFindings.length} command-truth finding(s).`,
      confidence,
      evidence: [
        {
          artifact: '.playbook/contracts-registry.json',
          pointer: 'cliSchemas.commands',
          summary: `query=${hasQuery}; plan=${hasPlan}; apply=${hasApply}`
        },
        {
          artifact: '.playbook/docs-audit.json',
          pointer: 'findings[ruleId^=docs.command]',
          summary: `command_truth_findings=${commandTruthFindings.length}`
        }
      ],
      related: ['query', ...(hasPlan ? ['plan'] : []), ...(hasApply ? ['apply'] : [])]
    };

    return [candidate];
  }
};
