import { formatHuman, formatJson, verify } from '@zachariahredfield/playbook-core';
import { createNodeContext } from '@zachariahredfield/playbook-node';

export const runVerify = async (cwd: string, options: { json: boolean; ci: boolean }): Promise<number> => {
  const report = await verify(createNodeContext({ cwd }));

  if (options.ci || options.json) {
    console.log(formatJson(report));
    if (options.ci) {
      console.log(report.ok ? 'playbook verify: PASS' : 'playbook verify: FAIL');
    }
  } else {
    console.log(formatHuman(report));
  }

  return report.ok ? 0 : 1;
};
