import { knowledgeSupersession } from '@zachariahredfield/playbook-engine';
import { parseIntegerOption, readOptionValue, resolveSubcommandArgument } from './shared.js';

export const runKnowledgeSupersession = (cwd: string, args: string[]) => {
  const id = resolveSubcommandArgument(args);
  if (!id) {
    throw new Error('playbook knowledge supersession: missing required <id> argument');
  }

  return knowledgeSupersession(cwd, id, {
    staleDays: parseIntegerOption(readOptionValue(args, '--days'), '--days')
  });
};
