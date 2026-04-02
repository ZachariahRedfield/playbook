import fs from 'node:fs';
import path from 'node:path';
import { readConsumedRuntimeManifestsArtifact, RUNTIME_MANIFESTS_RELATIVE_PATH } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { listRegisteredCommands } from './index.js';

type AiContextResult = {
  schemaVersion: '1.0';
  command: 'ai-context';
  repo: {
    summary: string;
    architecture: 'modular-monolith';
    localCliPreferred: boolean;
  };
  repositoryIntelligence: {
    artifact: '.playbook/repo-index.json';
    available: boolean;
    commands: string[];
  };
  controlPlaneArtifacts: {
    policyEvaluation: '.playbook/policy-evaluation.json';
    policyApplyResult: '.playbook/policy-apply-result.json';
    session: '.playbook/session.json';
    cycleState: '.playbook/cycle-state.json';
    cycleHistory: '.playbook/cycle-history.json';
    improvementCandidates: '.playbook/improvement-candidates.json';
    prReview: '.playbook/pr-review.json';
  };
  runtimeManifests: {
    artifact: typeof RUNTIME_MANIFESTS_RELATIVE_PATH;
    manifestsCount: number;
    manifests: unknown[];
  };
  operatingLadder: {
    preferredCommandOrder: [
      'ai-context',
      'ai-contract',
      'context',
      'index',
      'query',
      'explain',
      'ask --repo-context',
      'rules',
      'verify',
      'direct-file-inspection-if-needed'
    ];
    recommendedBootstrap: [
      'pnpm -r build',
      'node packages/cli/dist/main.js ai-context --json',
      'node packages/cli/dist/main.js context --json'
    ];
    remediationWorkflow: ['verify', 'explain', 'plan', 'apply', 'verify'];
  };
  productCommands: Array<{
    name: string;
    example: string;
  }>;
  guidance: {
    preferPlaybookCommands: true;
    authorityRule: string;
    localExecutionRule: string;
    failureMode: string;
    memoryCommandFamily: {
      available: boolean;
      preferredCommands: ['memory events --json', 'memory knowledge --json', 'memory candidates --json'];
    };
    promotedKnowledgeGuidance: string;
    candidateKnowledgeGuidance: string;
  };
};

const buildAiContextResult = (cwd: string): AiContextResult => {
  const indexFile = path.join(cwd, '.playbook', 'repo-index.json');
  const runtimeManifestArtifact = readConsumedRuntimeManifestsArtifact(cwd);

  return {
    schemaVersion: '1.0',
    command: 'ai-context',
    repo: {
      summary: 'Playbook is an AI-aware engineering governance CLI with deterministic command contracts.',
      architecture: 'modular-monolith',
      localCliPreferred: true
    },
    repositoryIntelligence: {
      artifact: '.playbook/repo-index.json',
      available: fs.existsSync(indexFile),
      commands: ['index', 'query', 'deps', 'ask', 'explain']
    },
    controlPlaneArtifacts: {
      policyEvaluation: '.playbook/policy-evaluation.json',
      policyApplyResult: '.playbook/policy-apply-result.json',
      session: '.playbook/session.json',
      cycleState: '.playbook/cycle-state.json',
      cycleHistory: '.playbook/cycle-history.json',
      improvementCandidates: '.playbook/improvement-candidates.json',
      prReview: '.playbook/pr-review.json'
    },
    runtimeManifests: {
      artifact: RUNTIME_MANIFESTS_RELATIVE_PATH,
      manifestsCount: runtimeManifestArtifact.manifests.length,
      manifests: runtimeManifestArtifact.manifests
    },
    operatingLadder: {
      preferredCommandOrder: [
        'ai-context',
        'ai-contract',
        'context',
        'index',
        'query',
        'explain',
        'ask --repo-context',
        'rules',
        'verify',
        'direct-file-inspection-if-needed'
      ],
      recommendedBootstrap: [
        'pnpm -r build',
        'node packages/cli/dist/main.js ai-context --json',
        'node packages/cli/dist/main.js context --json'
      ],
      remediationWorkflow: ['verify', 'explain', 'plan', 'apply', 'verify']
    },
    productCommands: listRegisteredCommands()
      .filter((entry) => ['ai-context', 'ai-contract', 'context', 'index', 'query', 'ask', 'explain', 'verify', 'plan', 'apply'].includes(entry.name))
      .map((entry) => {
        const example =
          entry.name === 'query'
            ? 'playbook query modules --json'
            : entry.name === 'ask'
              ? 'playbook ask \"where should a new feature live?\" --repo-context --json'
              : entry.name === 'explain'
                ? 'playbook explain architecture --json'
                : entry.name === 'apply'
                  ? 'playbook apply --from-plan .playbook/plan.json'
                  : `playbook ${entry.name}${entry.name === 'ai-context' || entry.name === 'context' || entry.name === 'index' || entry.name === 'verify' || entry.name === 'plan' ? ' --json' : ''}`;

        return { name: entry.name, example };
      }),
    guidance: {
      preferPlaybookCommands: true,
      authorityRule: 'Playbook command outputs are authoritative over ad-hoc repository inference when command coverage exists.',
      localExecutionRule: 'Inside the Playbook repository, use local built CLI entrypoints for branch-accurate validation.',
      failureMode: 'Agent drift occurs when AI tools bypass Playbook command outputs and reason directly from stale or incomplete file inspection.',
      memoryCommandFamily: {
        available: true,
        preferredCommands: ['memory events --json', 'memory knowledge --json', 'memory candidates --json']
      },
      promotedKnowledgeGuidance: 'Prefer promoted knowledge for retrieval and planning support because it is reviewed and stable doctrine.',
      candidateKnowledgeGuidance: 'Treat candidates as advisory-only signals until reviewed promotion; never treat candidate artifacts as authoritative doctrine.'
    }
  };
};

const printText = (result: AiContextResult): void => {
  console.log('Playbook AI Context');
  console.log('');
  console.log('Repository');
  console.log(result.repo.summary);
  console.log(`Architecture: ${result.repo.architecture}`);
  console.log(`Local CLI preferred: ${result.repo.localCliPreferred ? 'yes' : 'no'}`);
  console.log('');
  console.log('Repository Intelligence');
  console.log(`Artifact: ${result.repositoryIntelligence.artifact}`);
  console.log(`Available: ${result.repositoryIntelligence.available ? 'yes' : 'no'}`);
  console.log(`Commands: ${result.repositoryIntelligence.commands.join(', ')}`);
  console.log('');
  console.log('Control Plane Artifacts');
  console.log(`Policy evaluation: ${result.controlPlaneArtifacts.policyEvaluation}`);
  console.log(`Policy apply result: ${result.controlPlaneArtifacts.policyApplyResult}`);
  console.log(`Session: ${result.controlPlaneArtifacts.session}`);
  console.log(`Cycle state: ${result.controlPlaneArtifacts.cycleState}`);
  console.log(`Cycle history: ${result.controlPlaneArtifacts.cycleHistory}`);
  console.log(`Improvement candidates: ${result.controlPlaneArtifacts.improvementCandidates}`);
  console.log(`PR review: ${result.controlPlaneArtifacts.prReview}`);
  console.log('');
  console.log('Runtime Manifests');
  console.log(`Artifact: ${result.runtimeManifests.artifact}`);
  console.log(`Manifests: ${result.runtimeManifests.manifestsCount}`);
  console.log('');
  console.log('AI Operating Ladder');
  console.log(result.operatingLadder.preferredCommandOrder.join(' -> '));
  console.log('');
  console.log('Recommended Bootstrap');
  for (const command of result.operatingLadder.recommendedBootstrap) {
    console.log(command);
  }
  console.log('');
  console.log('Canonical Remediation Workflow');
  console.log(result.operatingLadder.remediationWorkflow.join(' -> '));
  console.log('');
  console.log('Memory Guidance');
  console.log(`Memory command family available: ${result.guidance.memoryCommandFamily.available ? 'yes' : 'no'}`);
  console.log(`Preferred commands: ${result.guidance.memoryCommandFamily.preferredCommands.join(', ')}`);
  console.log(`Promoted knowledge: ${result.guidance.promotedKnowledgeGuidance}`);
  console.log(`Candidate knowledge: ${result.guidance.candidateKnowledgeGuidance}`);
};

export const runAiContext = async (cwd: string, options: { format: 'text' | 'json'; quiet: boolean }): Promise<number> => {
  const result = buildAiContextResult(cwd);

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    printText(result);
  }

  return ExitCode.Success;
};
