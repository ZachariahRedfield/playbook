import { ExitCode } from '../lib/cliContract.js';

type DemoContract = {
  schemaVersion: '1.0';
  command: 'demo';
  repository: {
    name: 'playbook-demo';
    url: 'https://github.com/ZachariahRedfield/playbook-demo';
  };
  workflow: string[];
  expectedInitialFindings: {
    firstVerifyPasses: boolean;
    planProducesReviewedTasks: boolean;
    applyExecutesBoundedTasks: boolean;
    finalVerifyPasses: boolean;
  };
  demonstrates: string[];
  summary: string;
};

const DEMO_REPOSITORY_URL = 'https://github.com/ZachariahRedfield/playbook-demo';

const DEMO_WORKFLOW: string[] = [
  `git clone ${DEMO_REPOSITORY_URL}`,
  'cd playbook-demo',
  'npm install',
  'npx playbook ai-context --json',
  'npx playbook ai-contract --json',
  'npx playbook context --json',
  'npx playbook index --json',
  'npx playbook query modules --json',
  'npx playbook explain architecture --json',
  'npx playbook verify',
  'npx playbook plan --json > .playbook/plan.json',
  'npx playbook apply --from-plan .playbook/plan.json',
  'npx playbook verify'
];

const DEMONSTRATES: string[] = [
  'repository understanding',
  'deterministic rule enforcement',
  'explainable findings',
  'safe remediation workflow'
];

const collectDemoContract = (): DemoContract => ({
  schemaVersion: '1.0',
  command: 'demo',
  repository: {
    name: 'playbook-demo',
    url: DEMO_REPOSITORY_URL
  },
  workflow: DEMO_WORKFLOW,
  expectedInitialFindings: {
    firstVerifyPasses: false,
    planProducesReviewedTasks: true,
    applyExecutesBoundedTasks: true,
    finalVerifyPasses: true
  },
  demonstrates: DEMONSTRATES,
  summary:
    'Official Playbook onboarding flow: clone the demo repository, establish trust/bootstrap context, generate deterministic repository intelligence, verify governance findings, execute reviewed plan/apply remediation, and confirm final verification passes.'
});

const printText = (result: DemoContract): void => {
  console.log('Playbook Demo');
  console.log('');
  console.log('Repository:');
  console.log(result.repository.url);
  console.log('');
  console.log('Quick start:');
  for (const step of result.workflow) {
    console.log(step);
  }

  console.log('');
  console.log('Expected initial state:');
  console.log('- first verify fails');
  console.log('- plan generates reviewed remediation tasks');
  console.log('- apply executes bounded plan tasks');
  console.log('- final verify passes');
  console.log('');
  console.log('What this demonstrates:');
  for (const point of result.demonstrates) {
    console.log(`- ${point}`);
  }
};

export const runDemo = async (_cwd: string, options: { format: 'text' | 'json'; quiet: boolean }): Promise<number> => {
  const result = collectDemoContract();

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printText(result);
  }

  return ExitCode.Success;
};
