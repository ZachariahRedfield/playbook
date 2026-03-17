import fs from 'node:fs';
import path from 'node:path';
import { readRepositoryGraph, summarizeGraphNeighborhood, type GraphNeighborhoodSummary } from '../graph/repoGraph.js';
import { explainArtifactFromArchitecture, explainCommandFromArchitecture, explainSubsystemFromArchitecture } from '../architecture/introspection.js';
import { queryRepositoryIndex } from '../query/repoQuery.js';
import type { RepositoryModule } from '../indexer/repoIndexer.js';
import { getRuleMetadata } from './ruleRegistry.js';
import { resolveRepositoryTarget, type ResolvedTarget } from '../intelligence/targetResolver.js';
import { readModuleContextDigest } from '../context/moduleContext.js';
import { readRuntimeMemoryEnvelope, type RuntimeMemoryEnvelope } from '../intelligence/runtimeMemory.js';
import {
  expandMemoryProvenance,
  lookupMemoryCandidateKnowledge,
  lookupPromotedMemoryKnowledge,
  type ExpandedMemoryProvenance
} from '../memory/inspection.js';
import type { MemoryKnowledgeEntry } from '../memory/knowledge.js';
import type { MemoryReplayCandidate } from '../schema/memoryReplay.js';

const toModuleNames = (modules: string[] | RepositoryModule[]): string[] => {
  if (modules.length === 0) {
    return [];
  }

  const first = modules[0];
  if (typeof first === 'string') {
    return modules as string[];
  }

  return (modules as RepositoryModule[]).map((moduleEntry) => moduleEntry.name);
};

type ExplainContext = {
  architecture: string;
  modules: string[];
  framework: string;
  rules: string[];
};

type ExplainMemoryFields = {
  memorySummary?: RuntimeMemoryEnvelope['memorySummary'];
  memorySources?: RuntimeMemoryEnvelope['memorySources'];
  knowledgeHits?: RuntimeMemoryEnvelope['knowledgeHits'];
  recentRelevantEvents?: RuntimeMemoryEnvelope['recentRelevantEvents'];
  memoryKnowledge?: {
    promoted: MemoryKnowledgeExplanation[];
    candidates: MemoryCandidateExplanation[];
  };
};

type MemoryKnowledgeExplanation = {
  knowledgeId: string;
  kind: MemoryKnowledgeEntry['kind'];
  title: string;
  summary: string;
  promotedAt: string;
  provenance: ExpandedMemoryProvenance[];
};

type MemoryCandidateExplanation = {
  candidateId: string;
  kind: MemoryReplayCandidate['kind'];
  title: string;
  summary: string;
  lastSeenAt?: string;
  provenance: ExpandedMemoryProvenance[];
};

export type RuleExplanation = ExplainMemoryFields & {
  type: 'rule';
  resolvedTarget: ResolvedTarget;
  id: string;
  purpose: string;
  fix: string[];
  reason: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ModuleExplanation = ExplainMemoryFields & {
  type: 'module';
  resolvedTarget: ResolvedTarget;
  name: string;
  responsibilities: string[];
  dependencies: string[];
  architecture: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type ArchitectureExplanation = ExplainMemoryFields & {
  type: 'architecture';
  resolvedTarget: ResolvedTarget;
  architecture: string;
  structure: string;
  reasoning: string;
  graphNeighborhood?: GraphNeighborhoodSummary;
};

export type SubsystemExplanation = ExplainMemoryFields & {
  type: 'subsystem';
  resolvedTarget: ResolvedTarget;
  name: string;
  purpose: string;
  commands: string[];
  artifacts: string[];
  upstream?: string[];
  downstream?: string[];
};

export type CommandExplanation = ExplainMemoryFields & {
  type: 'command';
  resolvedTarget: ResolvedTarget;
  command: string;
  subsystemOwnership: string;
  artifactsRead: string[];
  artifactsWritten: string[];
  rationaleSummary: string;
  downstreamConsumers: string[];
  commonFailurePrerequisites: string[];
};

export type ArtifactExplanation = ExplainMemoryFields & {
  type: 'artifact';
  resolvedTarget: ResolvedTarget;
  artifact: string;
  ownerSubsystem: string;
  purpose: string;
  upstreamSubsystem: string | null;
  downstreamConsumers: string[];
  cycleState?: CycleStateArtifactExplanation;
  cycleHistory?: CycleHistoryArtifactExplanation;
  policyEvaluation?: PolicyEvaluationArtifactExplanation;
  policyApplyResult?: PolicyApplyResultArtifactExplanation;
  sessionEvidenceEnvelope?: SessionEvidenceEnvelopeExplanation;
};

type CycleStateStepExplanation = {
  name: string;
  status: 'success' | 'failure';
  duration_ms: number;
};

type CycleStateArtifactExplanation = {
  artifactType: 'cycle-state';
  cycle_version: number;
  repo: string;
  cycle_id: string;
  started_at: string;
  result: 'success' | 'failed';
  failed_step?: string;
  steps: CycleStateStepExplanation[];
  artifacts_written: string[];
};

type CycleHistoryEntryExplanation = {
  cycle_id: string;
  started_at: string;
  result: 'success' | 'failed';
  failed_step?: string;
  duration_ms: number;
};

type CycleHistoryArtifactExplanation = {
  artifactType: 'cycle-history';
  history_version: number;
  repo: string;
  cycles: CycleHistoryEntryExplanation[];
};

type PolicyEvaluationEntryExplanation = {
  proposal_id: string;
  decision: 'safe' | 'requires_review' | 'blocked';
  reason: string;
  evidence?: Record<string, unknown>;
};

type PolicyEvaluationArtifactExplanation = {
  artifactType: 'policy-evaluation';
  schemaVersion: string;
  kind: string;
  generatedAt?: string;
  summary: {
    safe: number;
    requires_review: number;
    blocked: number;
    total: number;
  };
  evaluations: PolicyEvaluationEntryExplanation[];
};


type PolicyApplyResultEntryExplanation = {
  proposal_id: string;
  decision: 'safe' | 'requires_review' | 'blocked';
  reason: string;
};

type PolicyApplyFailedEntryExplanation = PolicyApplyResultEntryExplanation & {
  error: string;
};


type SessionEvidenceArtifactReferenceExplanation = {
  path: string;
  kind: string;
  present: boolean;
};

type SessionEvidenceLineageReferenceExplanation = {
  order: number;
  stage: 'session' | 'proposal_generation' | 'policy_evaluation' | 'execution_result';
  artifact: string;
  present: boolean;
};

type SessionEvidenceEnvelopeExplanation = {
  version: number;
  session_id: string;
  selected_run_id: string | null;
  cycle_id: string | null;
  generated_from_last_updated_time: string;
  artifacts: SessionEvidenceArtifactReferenceExplanation[];
  proposal_ids: string[];
  policy_decisions: Array<{
    proposal_id: string;
    decision: 'safe' | 'requires_review' | 'blocked';
    reason: string;
    source: 'policy-evaluation' | 'policy-apply-result';
  }>;
  execution_result: {
    executed: string[];
    skipped_requires_review: string[];
    skipped_blocked: string[];
    failed_execution: string[];
  } | null;
  lineage: SessionEvidenceLineageReferenceExplanation[];
};

type PolicyApplyResultArtifactExplanation = {
  artifactType: 'policy-apply-result';
  schemaVersion: string;
  kind: string;
  summary: {
    executed: number;
    skipped_requires_review: number;
    skipped_blocked: number;
    failed_execution: number;
    total: number;
  };
  executed: PolicyApplyResultEntryExplanation[];
  skipped_requires_review: PolicyApplyResultEntryExplanation[];
  skipped_blocked: PolicyApplyResultEntryExplanation[];
  failed_execution: PolicyApplyFailedEntryExplanation[];
};

export type UnknownExplanation = ExplainMemoryFields & {
  type: 'unknown';
  resolvedTarget: ResolvedTarget;
  target: string;
  message: string;
};

export type ExplainTargetResult = RuleExplanation | ModuleExplanation | ArchitectureExplanation | SubsystemExplanation | CommandExplanation | ArtifactExplanation | UnknownExplanation;

const normalizeTarget = (target: string): string => target.trim().toLowerCase();

const gatherContext = (projectRoot: string): ExplainContext => {
  const architecture = queryRepositoryIndex(projectRoot, 'architecture').result as string;
  const modules = toModuleNames(queryRepositoryIndex(projectRoot, 'modules').result as string[] | RepositoryModule[]);
  const framework = queryRepositoryIndex(projectRoot, 'framework').result as string;
  const rules = queryRepositoryIndex(projectRoot, 'rules').result as string[];

  return {
    architecture,
    modules,
    framework,
    rules
  };
};

const inferModuleResponsibilities = (name: string): string[] => [
  `Owns ${name} feature behavior and boundaries.`,
  `Encapsulates ${name} domain logic and module-level policies.`
];

const architectureStructure = (architecture: string): string => {
  if (architecture === 'modular-monolith') {
    return 'Feature modules are isolated and commonly organized under src/features.';
  }

  return `Repository structure follows ${architecture} conventions derived from indexed signals.`;
};

const architectureReasoning = (architecture: string, framework: string, modules: string[]): string => {
  if (architecture === 'modular-monolith') {
    return `modular-monolith architecture organizes code into isolated feature modules under src/features. Indexed framework: ${framework}. Indexed modules: ${modules.join(', ') || 'none'}.`;
  }

  return `Architecture is inferred as ${architecture} from repository intelligence signals. Indexed framework: ${framework}. Indexed modules: ${modules.join(', ') || 'none'}.`;
};

const readGraphNeighborhood = (projectRoot: string, nodeId: string): GraphNeighborhoodSummary | undefined => {
  try {
    const graph = readRepositoryGraph(projectRoot);
    return summarizeGraphNeighborhood(graph, nodeId) ?? undefined;
  } catch {
    return undefined;
  }
};

const explainRule = (projectRoot: string, context: ExplainContext, resolvedTarget: ResolvedTarget): RuleExplanation | UnknownExplanation => {
  const metadata = getRuleMetadata(resolvedTarget.selector);

  if (!metadata) {
    return {
      type: 'unknown',
      resolvedTarget,
      target: resolvedTarget.input,
      message: `No rule metadata found for ${resolvedTarget.selector} in rule registry.`
    };
  }

  return {
    type: 'rule',
    resolvedTarget,
    id: metadata.id,
    purpose: metadata.purpose,
    fix: metadata.fix,
    reason: `Rule registry metadata for ${metadata.id}. Indexed rules: ${context.rules.join(', ') || 'none'}.`,
    graphNeighborhood: readGraphNeighborhood(projectRoot, `rule:${metadata.id}`)
  };
};

export type ExplainTargetOptions = {
  withMemory?: boolean;
};

const withMemory = <T extends Record<string, unknown>>(
  projectRoot: string,
  enabled: boolean | undefined,
  input: T,
  options?: { target?: string }
): T & ExplainMemoryFields => {
  if (!enabled) {
    return input;
  }

  const memory = readRuntimeMemoryEnvelope(projectRoot, { target: options?.target });

  const memoryKnowledge = resolveMemoryKnowledge(projectRoot, options?.target);
  return {
    ...input,
    memorySummary: memory.memorySummary,
    memorySources: memory.memorySources,
    knowledgeHits: memory.knowledgeHits,
    recentRelevantEvents: memory.recentRelevantEvents,
    memoryKnowledge
  };
};

const toComparableTimestamp = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeRelevanceTokens = (target: string | undefined): string[] =>
  (target ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

const scoreTokenRelevance = (tokens: string[], value: string): number => {
  if (tokens.length === 0) {
    return 0;
  }

  const normalized = value.toLowerCase();
  return tokens.reduce((score, token) => (normalized.includes(token) ? score + 1 : score), 0);
};

const rankPromotedKnowledge = (entries: MemoryKnowledgeEntry[], target: string | undefined): MemoryKnowledgeEntry[] => {
  const tokens = normalizeRelevanceTokens(target);
  return [...entries]
    .map((entry) => {
      const content = [entry.knowledgeId, entry.kind, entry.title, entry.summary, entry.module, entry.ruleId, entry.failureShape].join(' ');
      return {
        entry,
        relevance: scoreTokenRelevance(tokens, content)
      };
    })
    .filter((item) => tokens.length === 0 || item.relevance > 0)
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      const promotedDelta = toComparableTimestamp(right.entry.promotedAt) - toComparableTimestamp(left.entry.promotedAt);
      if (promotedDelta !== 0) {
        return promotedDelta;
      }
      return left.entry.knowledgeId.localeCompare(right.entry.knowledgeId);
    })
    .map((item) => item.entry);
};

const rankCandidateKnowledge = (entries: MemoryReplayCandidate[], target: string | undefined): MemoryReplayCandidate[] => {
  const tokens = normalizeRelevanceTokens(target);
  return [...entries]
    .map((entry) => {
      const content = [entry.candidateId, entry.kind, entry.title, entry.summary, entry.module, entry.ruleId, entry.failureShape].join(' ');
      return {
        entry,
        relevance: scoreTokenRelevance(tokens, content)
      };
    })
    .filter((item) => tokens.length === 0 || item.relevance > 0)
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      const seenDelta = toComparableTimestamp(right.entry.lastSeenAt) - toComparableTimestamp(left.entry.lastSeenAt);
      if (seenDelta !== 0) {
        return seenDelta;
      }
      return left.entry.candidateId.localeCompare(right.entry.candidateId);
    })
    .map((item) => item.entry);
};

const resolveMemoryKnowledge = (projectRoot: string, target: string | undefined): ExplainMemoryFields['memoryKnowledge'] => {
  const promoted = rankPromotedKnowledge(lookupPromotedMemoryKnowledge(projectRoot), target)
    .slice(0, 3)
    .map((entry) => ({
      knowledgeId: entry.knowledgeId,
      kind: entry.kind,
      title: entry.title,
      summary: entry.summary,
      promotedAt: entry.promotedAt,
      provenance: expandMemoryProvenance(projectRoot, entry.provenance)
    }));

  const candidates = rankCandidateKnowledge(lookupMemoryCandidateKnowledge(projectRoot), target)
    .slice(0, 3)
    .map((entry) => ({
      candidateId: entry.candidateId,
      kind: entry.kind,
      title: entry.title,
      summary: entry.summary,
      lastSeenAt: entry.lastSeenAt,
      provenance: expandMemoryProvenance(projectRoot, entry.provenance)
    }));

  return {
    promoted,
    candidates
  };
};

const explainSubsystem = (projectRoot: string, target: string): SubsystemExplanation => {
  const details = explainSubsystemFromArchitecture(projectRoot, target);
  return {
    type: 'subsystem',
    resolvedTarget: {
      input: `subsystem ${target}`,
      kind: 'unknown',
      selector: target,
      canonical: `subsystem:${target}`,
      matched: true
    },
    name: details.subsystem.name,
    purpose: details.subsystem.purpose,
    commands: details.subsystem.commands,
    artifacts: details.subsystem.artifacts,
    upstream: details.subsystem.upstream,
    downstream: details.subsystem.downstream
  };
};

const explainCommand = (projectRoot: string, target: string): CommandExplanation => {
  const details = explainCommandFromArchitecture(projectRoot, target);
  return {
    type: 'command',
    resolvedTarget: {
      input: `command ${target}`,
      kind: 'unknown',
      selector: target,
      canonical: `command:${target}`,
      matched: true
    },
    command: details.command,
    subsystemOwnership: details.inspection.subsystem,
    artifactsRead: details.inspection.artifactsRead,
    artifactsWritten: details.inspection.artifactsWritten,
    rationaleSummary: details.inspection.rationaleSummary,
    downstreamConsumers: details.inspection.downstreamConsumers,
    commonFailurePrerequisites: details.inspection.commonFailurePrerequisites
  };
};

const explainArtifact = (projectRoot: string, target: string): ArtifactExplanation => {
  const cycleState = explainCycleStateArtifact(projectRoot, target) ?? undefined;
  const cycleHistory = explainCycleHistoryArtifact(projectRoot, target) ?? undefined;
  const policyEvaluation = explainPolicyEvaluationArtifact(projectRoot, target) ?? undefined;
  const policyApplyResult = explainPolicyApplyResultArtifact(projectRoot, target) ?? undefined;
  const sessionEvidenceEnvelope = explainSessionEvidenceEnvelopeArtifact(projectRoot, target) ?? undefined;

  if (cycleState || cycleHistory || policyEvaluation || policyApplyResult || sessionEvidenceEnvelope) {
    const policyArtifactOnly = (Boolean(policyEvaluation) || Boolean(policyApplyResult)) && !cycleState && !cycleHistory && !sessionEvidenceEnvelope;
    return {
      type: 'artifact',
      resolvedTarget: {
        input: `artifact ${target}`,
        kind: 'unknown',
        selector: target,
        canonical: `artifact:${target}`,
        matched: true
      },
      artifact: target,
      ownerSubsystem: policyArtifactOnly ? 'improvement_engine' : 'execution_supervisor',
      purpose: policyArtifactOnly ? 'Governed policy evaluation for proposal-only execution safety checks' : 'Run workers and monitor execution',
      upstreamSubsystem: policyArtifactOnly ? 'telemetry_learning' : 'orchestration_planner',
      downstreamConsumers: policyArtifactOnly ? ['change_bridge'] : ['telemetry_learning', 'lane_lifecycle', 'worker_coordination'],
      ...(cycleState ? { cycleState } : {}),
      ...(cycleHistory ? { cycleHistory } : {}),
      ...(policyEvaluation ? { policyEvaluation } : {}),
      ...(policyApplyResult ? { policyApplyResult } : {}),
      ...(sessionEvidenceEnvelope ? { sessionEvidenceEnvelope } : {})
    };
  }

  const details = explainArtifactFromArchitecture(projectRoot, target);
  return {
    type: 'artifact',
    resolvedTarget: {
      input: `artifact ${target}`,
      kind: 'unknown',
      selector: target,
      canonical: `artifact:${target}`,
      matched: true
    },
    artifact: details.artifact,
    ownerSubsystem: details.lineage.ownerSubsystem,
    purpose: details.subsystem.purpose,
    upstreamSubsystem: details.lineage.upstreamSubsystem,
    downstreamConsumers: details.lineage.downstreamConsumers
  };
};

const explainCycleStateArtifact = (projectRoot: string, target: string): CycleStateArtifactExplanation | null => {
  if (target !== '.playbook/cycle-state.json') {
    return null;
  }

  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`playbook explain artifact: missing artifact "${target}".`);
  }

  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as Record<string, unknown>;
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.map((step) => {
        const candidate = step as Record<string, unknown>;
        return {
          name: String(candidate.name),
          status: candidate.status === 'failure' ? 'failure' : 'success',
          duration_ms: Number(candidate.duration_ms)
        } as CycleStateStepExplanation;
      })
    : [];

  return {
    artifactType: 'cycle-state',
    cycle_version: Number(parsed.cycle_version),
    repo: String(parsed.repo),
    cycle_id: String(parsed.cycle_id),
    started_at: String(parsed.started_at),
    result: parsed.result === 'failed' ? 'failed' : 'success',
    ...(typeof parsed.failed_step === 'string' ? { failed_step: parsed.failed_step } : {}),
    steps,
    artifacts_written: Array.isArray(parsed.artifacts_written) ? parsed.artifacts_written.map((entry) => String(entry)) : []
  };
};


const explainCycleHistoryArtifact = (projectRoot: string, target: string): CycleHistoryArtifactExplanation | null => {
  if (target !== '.playbook/cycle-history.json') {
    return null;
  }

  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`playbook explain artifact: missing artifact "${target}".`);
  }

  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as Record<string, unknown>;
  const cycles = Array.isArray(parsed.cycles)
    ? parsed.cycles.map((cycle) => {
        const candidate = cycle as Record<string, unknown>;
        return {
          cycle_id: String(candidate.cycle_id),
          started_at: String(candidate.started_at),
          result: candidate.result === 'failed' ? 'failed' : 'success',
          ...(typeof candidate.failed_step === 'string' ? { failed_step: candidate.failed_step } : {}),
          duration_ms: Number(candidate.duration_ms)
        } as CycleHistoryEntryExplanation;
      })
    : [];

  return {
    artifactType: 'cycle-history',
    history_version: Number(parsed.history_version),
    repo: String(parsed.repo),
    cycles
  };
};

const explainPolicyEvaluationArtifact = (projectRoot: string, target: string): PolicyEvaluationArtifactExplanation | null => {
  if (target !== '.playbook/policy-evaluation.json') {
    return null;
  }

  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`playbook explain artifact: missing artifact "${target}".`);
  }

  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as Record<string, unknown>;
  const summaryCandidate = (parsed.summary ?? {}) as Record<string, unknown>;
  const evaluations = Array.isArray(parsed.evaluations)
    ? parsed.evaluations
        .map((evaluation) => {
          const candidate = evaluation as Record<string, unknown>;
          return {
            proposal_id: String(candidate.proposal_id),
            decision: candidate.decision === 'safe' || candidate.decision === 'blocked' ? candidate.decision : 'requires_review',
            reason: String(candidate.reason),
            ...(candidate.evidence && typeof candidate.evidence === 'object' && !Array.isArray(candidate.evidence)
              ? { evidence: candidate.evidence as Record<string, unknown> }
              : {})
          } as PolicyEvaluationEntryExplanation;
        })
        .sort((left, right) => left.proposal_id.localeCompare(right.proposal_id))
    : [];

  return {
    artifactType: 'policy-evaluation',
    schemaVersion: String(parsed.schemaVersion),
    kind: String(parsed.kind),
    ...(typeof parsed.generatedAt === 'string' ? { generatedAt: parsed.generatedAt } : {}),
    summary: {
      safe: Number(summaryCandidate.safe ?? 0),
      requires_review: Number(summaryCandidate.requires_review ?? 0),
      blocked: Number(summaryCandidate.blocked ?? 0),
      total: Number(summaryCandidate.total ?? evaluations.length)
    },
    evaluations
  };
};


const explainPolicyApplyResultArtifact = (projectRoot: string, target: string): PolicyApplyResultArtifactExplanation | null => {
  if (target !== '.playbook/policy-apply-result.json') {
    return null;
  }

  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`playbook explain artifact: missing artifact "${target}".`);
  }

  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as Record<string, unknown>;
  const summaryCandidate = (parsed.summary ?? {}) as Record<string, unknown>;

  const toEntry = (value: unknown): PolicyApplyResultEntryExplanation => {
    const candidate = value as Record<string, unknown>;
    return {
      proposal_id: String(candidate.proposal_id),
      decision: candidate.decision === 'safe' || candidate.decision === 'blocked' ? candidate.decision : 'requires_review',
      reason: String(candidate.reason)
    };
  };

  const toFailedEntry = (value: unknown): PolicyApplyFailedEntryExplanation => {
    const entry = toEntry(value);
    const candidate = value as Record<string, unknown>;
    return { ...entry, error: String(candidate.error) };
  };

  const executed = Array.isArray(parsed.executed) ? parsed.executed.map((entry) => toEntry(entry)).sort((l, r) => l.proposal_id.localeCompare(r.proposal_id)) : [];
  const skippedRequiresReview = Array.isArray(parsed.skipped_requires_review)
    ? parsed.skipped_requires_review.map((entry) => toEntry(entry)).sort((l, r) => l.proposal_id.localeCompare(r.proposal_id))
    : [];
  const skippedBlocked = Array.isArray(parsed.skipped_blocked)
    ? parsed.skipped_blocked.map((entry) => toEntry(entry)).sort((l, r) => l.proposal_id.localeCompare(r.proposal_id))
    : [];
  const failedExecution = Array.isArray(parsed.failed_execution)
    ? parsed.failed_execution.map((entry) => toFailedEntry(entry)).sort((l, r) => l.proposal_id.localeCompare(r.proposal_id))
    : [];

  return {
    artifactType: 'policy-apply-result',
    schemaVersion: String(parsed.schemaVersion),
    kind: String(parsed.kind),
    summary: {
      executed: Number(summaryCandidate.executed ?? executed.length),
      skipped_requires_review: Number(summaryCandidate.skipped_requires_review ?? skippedRequiresReview.length),
      skipped_blocked: Number(summaryCandidate.skipped_blocked ?? skippedBlocked.length),
      failed_execution: Number(summaryCandidate.failed_execution ?? failedExecution.length),
      total: Number(summaryCandidate.total ?? executed.length + skippedRequiresReview.length + skippedBlocked.length + failedExecution.length)
    },
    executed,
    skipped_requires_review: skippedRequiresReview,
    skipped_blocked: skippedBlocked,
    failed_execution: failedExecution
  };
};


const explainSessionEvidenceEnvelopeArtifact = (projectRoot: string, target: string): SessionEvidenceEnvelopeExplanation | null => {
  if (target !== '.playbook/session.json') {
    return null;
  }

  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`playbook explain artifact: missing artifact "${target}".`);
  }

  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as Record<string, unknown>;
  const envelopeCandidate = parsed.evidenceEnvelope;
  if (!envelopeCandidate || typeof envelopeCandidate !== 'object' || Array.isArray(envelopeCandidate)) {
    throw new Error('playbook explain artifact: session artifact is missing evidenceEnvelope. Re-run a session command to refresh.');
  }

  const envelope = envelopeCandidate as Record<string, unknown>;
  const toArtifact = (value: unknown): SessionEvidenceArtifactReferenceExplanation | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    if (typeof candidate.path !== 'string' || typeof candidate.kind !== 'string' || typeof candidate.present !== 'boolean') {
      return null;
    }

    return {
      path: candidate.path,
      kind: candidate.kind,
      present: candidate.present
    };
  };

  const toDecision = (value: unknown): SessionEvidenceEnvelopeExplanation['policy_decisions'][number] | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    if (typeof candidate.proposal_id !== 'string' || typeof candidate.reason !== 'string') {
      return null;
    }

    const source = candidate.source === 'policy-apply-result' ? 'policy-apply-result' : 'policy-evaluation';
    const decision = candidate.decision === 'safe' || candidate.decision === 'blocked' ? candidate.decision : 'requires_review';

    return {
      proposal_id: candidate.proposal_id,
      decision,
      reason: candidate.reason,
      source
    };
  };

  const toLineage = (value: unknown): SessionEvidenceLineageReferenceExplanation | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    if (typeof candidate.order !== 'number' || typeof candidate.artifact !== 'string' || typeof candidate.present !== 'boolean') {
      return null;
    }

    const stage =
      candidate.stage === 'proposal_generation' || candidate.stage === 'policy_evaluation' || candidate.stage === 'execution_result'
        ? candidate.stage
        : 'session';

    return {
      order: candidate.order,
      stage,
      artifact: candidate.artifact,
      present: candidate.present
    };
  };

  const executionCandidate = envelope.execution_result;
  const executionResult =
    executionCandidate && typeof executionCandidate === 'object' && !Array.isArray(executionCandidate)
      ? {
          executed: Array.isArray((executionCandidate as Record<string, unknown>).executed)
            ? ((executionCandidate as Record<string, unknown>).executed as unknown[]).map((entry) => String(entry)).sort((l, r) => l.localeCompare(r))
            : [],
          skipped_requires_review: Array.isArray((executionCandidate as Record<string, unknown>).skipped_requires_review)
            ? ((executionCandidate as Record<string, unknown>).skipped_requires_review as unknown[]).map((entry) => String(entry)).sort((l, r) => l.localeCompare(r))
            : [],
          skipped_blocked: Array.isArray((executionCandidate as Record<string, unknown>).skipped_blocked)
            ? ((executionCandidate as Record<string, unknown>).skipped_blocked as unknown[]).map((entry) => String(entry)).sort((l, r) => l.localeCompare(r))
            : [],
          failed_execution: Array.isArray((executionCandidate as Record<string, unknown>).failed_execution)
            ? ((executionCandidate as Record<string, unknown>).failed_execution as unknown[]).map((entry) => String(entry)).sort((l, r) => l.localeCompare(r))
            : []
        }
      : null;

  return {
    version: Number(envelope.version ?? 1),
    session_id: String(envelope.session_id ?? parsed.sessionId ?? ''),
    selected_run_id: typeof envelope.selected_run_id === 'string' ? envelope.selected_run_id : null,
    cycle_id: typeof envelope.cycle_id === 'string' ? envelope.cycle_id : null,
    generated_from_last_updated_time: String(envelope.generated_from_last_updated_time ?? parsed.lastUpdatedTime ?? ''),
    artifacts: (Array.isArray(envelope.artifacts) ? envelope.artifacts : [])
      .map((entry) => toArtifact(entry))
      .filter((entry): entry is SessionEvidenceArtifactReferenceExplanation => entry !== null)
      .sort((left, right) => left.path.localeCompare(right.path)),
    proposal_ids: (Array.isArray(envelope.proposal_ids) ? envelope.proposal_ids : [])
      .map((entry) => String(entry))
      .sort((left, right) => left.localeCompare(right)),
    policy_decisions: (Array.isArray(envelope.policy_decisions) ? envelope.policy_decisions : [])
      .map((entry) => toDecision(entry))
      .filter((entry): entry is SessionEvidenceEnvelopeExplanation['policy_decisions'][number] => entry !== null)
      .sort((left, right) => {
        const proposalDelta = left.proposal_id.localeCompare(right.proposal_id);
        if (proposalDelta !== 0) {
          return proposalDelta;
        }
        return left.source.localeCompare(right.source);
      }),
    execution_result: executionResult,
    lineage: (Array.isArray(envelope.lineage) ? envelope.lineage : [])
      .map((entry) => toLineage(entry))
      .filter((entry): entry is SessionEvidenceLineageReferenceExplanation => entry !== null)
      .sort((left, right) => left.order - right.order)
  };
};

export const explainTarget = (projectRoot: string, target: string, options?: ExplainTargetOptions): ExplainTargetResult => {
  const trimmed = target.trim();
  const subsystemMatch = trimmed.match(/^subsystem\s+(.+)$/i);
  if (subsystemMatch) {
    const subsystemName = subsystemMatch[1].trim();
    if (!subsystemName) {
      throw new Error('playbook explain subsystem: missing required <name> argument');
    }
    return withMemory(projectRoot, options?.withMemory, explainSubsystem(projectRoot, subsystemName), { target: subsystemName });
  }

  const artifactMatch = trimmed.match(/^artifact\s+(.+)$/i);
  if (artifactMatch) {
    const artifactPath = artifactMatch[1].trim();
    if (!artifactPath) {
      throw new Error('playbook explain artifact: missing required <path> argument');
    }
    return withMemory(projectRoot, options?.withMemory, explainArtifact(projectRoot, artifactPath), { target: artifactPath });
  }
  const commandMatch = trimmed.match(/^command\s+(.+)$/i);
  if (commandMatch) {
    const commandName = commandMatch[1].trim();
    if (!commandName) {
      throw new Error('playbook explain command: missing required <name> argument');
    }
    return withMemory(projectRoot, options?.withMemory, explainCommand(projectRoot, commandName), { target: commandName });
  }

  const context = gatherContext(projectRoot);
  const resolvedTarget = resolveRepositoryTarget(projectRoot, normalizeTarget(target));

  if (resolvedTarget.kind === 'rule') {
    return withMemory(projectRoot, options?.withMemory, explainRule(projectRoot, context, resolvedTarget), { target: resolvedTarget.selector });
  }

  if (resolvedTarget.kind === 'module') {
    const moduleName = resolvedTarget.selector;
    const digest = readModuleContextDigest(projectRoot, moduleName);
    return withMemory(projectRoot, options?.withMemory, {
      type: 'module',
      resolvedTarget,
      name: moduleName,
      responsibilities: inferModuleResponsibilities(moduleName),
      dependencies: digest?.dependencies ?? [],
      architecture: context.architecture,
      graphNeighborhood: readGraphNeighborhood(projectRoot, `module:${moduleName}`)
    }, { target: moduleName });
  }

  if (resolvedTarget.kind === 'architecture') {
    return withMemory(projectRoot, options?.withMemory, {
      type: 'architecture',
      resolvedTarget,
      architecture: context.architecture,
      structure: architectureStructure(context.architecture),
      reasoning: architectureReasoning(context.architecture, context.framework, context.modules),
      graphNeighborhood: readGraphNeighborhood(projectRoot, 'repository:root')
    }, { target: 'architecture' });
  }

  return withMemory(projectRoot, options?.withMemory, {
    type: 'unknown',
    resolvedTarget,
    target,
    message: `Unable to explain "${target}" from repository intelligence. Try: playbook query modules | playbook rules.`
  }, { target });
};
