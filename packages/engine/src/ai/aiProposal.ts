import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getDefaultAiContract, loadAiContract } from './aiContract.js';

export const AI_PROPOSAL_SCHEMA_VERSION = '1.0' as const;
export const AI_PROPOSAL_DEFAULT_FILE = '.playbook/ai-proposal.json' as const;
const AI_CONTEXT_FILE = '.playbook/ai-context.json' as const;

type OptionalProposalSurface = 'plan' | 'review' | 'rendezvous' | 'interop';

type ProposalProvenanceEntry = {
  artifactPath: string;
  source: 'file' | 'generated';
  required: boolean;
  available: boolean;
  used: boolean;
};

export type AiProposal = {
  schemaVersion: typeof AI_PROPOSAL_SCHEMA_VERSION;
  command: 'ai-propose';
  proposalId: string;
  scope: {
    mode: 'proposal-only';
    boundaries: [
      'no-direct-apply',
      'no-memory-promotion',
      'no-pattern-promotion',
      'no-external-interop-emit',
      'artifact-only-output'
    ];
    allowedInputs: string[];
    optionalInputs: string[];
  };
  reasoningSummary: string[];
  recommendedNextGovernedSurface: 'route' | 'plan' | 'review-pr' | 'verify';
  suggestedArtifactPath: string;
  blockers: string[];
  assumptions: string[];
  confidence: number;
  provenance: ProposalProvenanceEntry[];
};

export type GenerateAiProposalOptions = {
  include?: OptionalProposalSurface[];
};

const OPTIONAL_SURFACE_PATHS: Record<OptionalProposalSurface, string> = {
  plan: '.playbook/plan.json',
  review: '.playbook/pr-review.json',
  rendezvous: '.playbook/rendezvous-manifest.json',
  interop: '.playbook/lifeline-interop-runtime.json'
};

const maybeReadJson = (cwd: string, relativePath: string): { found: boolean; parsed: unknown } => {
  const absolutePath = path.join(cwd, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { found: false, parsed: null };
  }

  try {
    return { found: true, parsed: JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown };
  } catch {
    return { found: true, parsed: null };
  }
};

const normalizeInclude = (include: OptionalProposalSurface[] | undefined): OptionalProposalSurface[] => {
  if (!include || include.length === 0) {
    return [];
  }

  return Array.from(new Set(include)).sort((left, right) => left.localeCompare(right));
};

export const generateAiProposal = (
  cwd: string,
  options: GenerateAiProposalOptions = {}
): AiProposal => {
  const include = normalizeInclude(options.include);

  const contextPayload = maybeReadJson(cwd, AI_CONTEXT_FILE);
  const loadedContract = loadAiContract(cwd);
  const contract = loadedContract.contract;
  const defaultContract = getDefaultAiContract();

  const repoIndexPath = contract.intelligence_sources.repoIndex || defaultContract.intelligence_sources.repoIndex;
  const repoIndexPayload = maybeReadJson(cwd, repoIndexPath);

  const requestedOptionalSurfaces = include.map((surface) => ({
    surface,
    path: OPTIONAL_SURFACE_PATHS[surface],
    ...maybeReadJson(cwd, OPTIONAL_SURFACE_PATHS[surface])
  }));

  const provenance: ProposalProvenanceEntry[] = [
    {
      artifactPath: AI_CONTEXT_FILE,
      source: contextPayload.found ? 'file' : 'generated',
      required: true,
      available: contextPayload.found,
      used: true
    },
    {
      artifactPath: '.playbook/ai-contract.json',
      source: loadedContract.source,
      required: true,
      available: true,
      used: true
    },
    {
      artifactPath: repoIndexPath,
      source: 'file',
      required: true,
      available: repoIndexPayload.found,
      used: true
    },
    ...requestedOptionalSurfaces.map((entry) => ({
      artifactPath: entry.path,
      source: 'file' as const,
      required: false,
      available: entry.found,
      used: true
    }))
  ];

  const blockers: string[] = [];
  if (!repoIndexPayload.found) {
    blockers.push('Missing .playbook/repo-index.json; run `pnpm playbook index --json` before routing proposal work.');
  }

  for (const entry of requestedOptionalSurfaces) {
    if (!entry.found) {
      blockers.push(`Requested optional artifact is missing: ${entry.path}.`);
    }
  }

  const assumptions = [
    'AI proposals are advisory-only and must flow through route/plan/review/apply boundaries.',
    'No state mutation is authorized beyond explicit proposal artifact writes.',
    'Any execution or interop emits require explicit downstream governed commands.'
  ];

  const contextSource = contextPayload.found ? 'file-backed ai-context' : 'generated ai-context fallback';
  const contractSource = loadedContract.source === 'file' ? 'file-backed ai-contract' : 'generated ai-contract fallback';

  const reasoningSummary = [
    `Constructed proposal from ${contextSource}, ${contractSource}, and ${repoIndexPath}.`,
    `Canonical remediation sequence remains ${contract.remediation.canonicalFlow.join(' -> ')}.`,
    include.length > 0
      ? `Optional artifact summaries requested: ${include.join(', ')}.`
      : 'No optional plan/review/rendezvous/interop summaries were requested.',
    blockers.length > 0
      ? 'Proposal is blocked on missing required/optional artifacts; route first to collect governed evidence.'
      : 'Proposal has enough governed evidence to route into plan/review surfaces.'
  ];

  const availableCount = provenance.filter((entry) => entry.available).length;
  const confidenceRaw = availableCount / Math.max(provenance.length, 1) - blockers.length * 0.1;
  const confidence = Math.max(0.1, Math.min(0.99, Number(confidenceRaw.toFixed(2))));

  const recommendedNextGovernedSurface: AiProposal['recommendedNextGovernedSurface'] = blockers.length > 0
    ? 'route'
    : include.includes('review')
      ? 'review-pr'
      : 'plan';

  const fingerprintSeed = JSON.stringify({
    contextSource,
    contractSource,
    repoIndexAvailable: repoIndexPayload.found,
    include,
    blockers,
    recommendedNextGovernedSurface
  });

  const proposalId = `ai-proposal-${createHash('sha256').update(fingerprintSeed).digest('hex').slice(0, 12)}`;

  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    command: 'ai-propose',
    proposalId,
    scope: {
      mode: 'proposal-only',
      boundaries: [
        'no-direct-apply',
        'no-memory-promotion',
        'no-pattern-promotion',
        'no-external-interop-emit',
        'artifact-only-output'
      ],
      allowedInputs: [AI_CONTEXT_FILE, '.playbook/ai-contract.json', repoIndexPath],
      optionalInputs: requestedOptionalSurfaces.map((entry) => entry.path)
    },
    reasoningSummary,
    recommendedNextGovernedSurface,
    suggestedArtifactPath: AI_PROPOSAL_DEFAULT_FILE,
    blockers,
    assumptions,
    confidence,
    provenance
  };
};
