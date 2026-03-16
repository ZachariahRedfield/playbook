import fs from 'node:fs';
import path from 'node:path';
import type { PatternPortabilityRun } from './patternPortability.js';
import {
  type PatternPortabilityScore,
  type TransferReadinessArtifact,
  type TransferReadinessEntry,
  normalizeTransferReadinessArtifact
} from '@zachariahredfield/playbook-core';
import { readJsonIfExists, writeDeterministicJsonAtomic } from './io.js';

export const TRANSFER_READINESS_SCHEMA_VERSION = '1.0' as const;
export const TRANSFER_READINESS_RELATIVE_PATH = '.playbook/transfer-readiness.json' as const;

const LEARNING_COMPACTION_RELATIVE_PATH = '.playbook/learning-compaction.json' as const;
const ROUTER_RECOMMENDATIONS_RELATIVE_PATH = '.playbook/router-recommendations.json' as const;

type LearningCompactionSummary = {
  summary?: {
    validation_patterns?: Array<{ validation_key: string }>;
    recurring_failures?: Array<{ signal_id: string; family: string; confidence: number }>;
    open_questions?: string[];
  };
};

type RouterRecommendationsArtifact = {
  recommendations?: Array<{ recommendation_id: string; task_family: string }>;
};

type AssessInput = {
  patternScore: PatternPortabilityScore;
  targetRepoRoot: string;
  targetRepoId: string;
};

const round4 = (value: number): number => Number(value.toFixed(4));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const uniqueSorted = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

const safeRead = <T>(filePath: string): T | undefined => readJsonIfExists<T>(filePath);

const deriveRequiredSubsystems = (patternId: string): string[] => {
  const lowered = patternId.toLowerCase();
  const detected = [
    'observation_engine',
    'knowledge_lifecycle',
    'governance_kernel'
  ].filter((subsystem) => lowered.includes(subsystem));
  return detected.length > 0 ? detected : ['knowledge_lifecycle'];
};

const deriveRequiredArtifacts = (requiredSubsystems: string[]): string[] => {
  const artifacts = ['.playbook/learning-compaction.json'];
  if (requiredSubsystems.includes('observation_engine')) {
    artifacts.push('.playbook/process-telemetry.json');
  }
  if (requiredSubsystems.includes('knowledge_lifecycle')) {
    artifacts.push('.playbook/router-recommendations.json');
  }
  if (requiredSubsystems.includes('governance_kernel')) {
    artifacts.push('playbook.config.json');
  }
  return uniqueSorted(artifacts);
};

const deriveRequiredGovernanceContracts = (requiredSubsystems: string[]): string[] => {
  const contracts = ['playbook.config.json'];
  if (requiredSubsystems.includes('governance_kernel')) {
    contracts.push('.playbook/ai-contract.json');
  }
  return uniqueSorted(contracts);
};

const deriveRequiredValidations = (patternId: string): string[] => {
  const lowered = patternId.toLowerCase();
  if (lowered.includes('governance') || lowered.includes('kernel')) {
    return ['pnpm -r build', 'pnpm test', 'pnpm playbook verify --ci --json'];
  }
  return ['pnpm -r build', 'pnpm test'];
};

const computeCoverage = (required: string[], present: string[]): number => {
  if (required.length === 0) return 1;
  const presentSet = new Set(present);
  const covered = required.filter((entry) => presentSet.has(entry)).length;
  return round4(clamp01(covered / required.length));
};

const assessTargetReadiness = ({ patternScore, targetRepoRoot, targetRepoId }: AssessInput): TransferReadinessEntry => {
  const requiredSubsystems = deriveRequiredSubsystems(patternScore.pattern_id);
  const requiredArtifacts = deriveRequiredArtifacts(requiredSubsystems);
  const requiredValidations = deriveRequiredValidations(patternScore.pattern_id);
  const requiredContracts = deriveRequiredGovernanceContracts(requiredSubsystems);

  const learningCompaction = safeRead<LearningCompactionSummary>(path.join(targetRepoRoot, LEARNING_COMPACTION_RELATIVE_PATH));
  const routerRecommendations = safeRead<RouterRecommendationsArtifact>(path.join(targetRepoRoot, ROUTER_RECOMMENDATIONS_RELATIVE_PATH));

  const presentSubsystems = uniqueSorted(
    requiredSubsystems.filter((subsystem) => {
      if (subsystem === 'observation_engine') {
        return fs.existsSync(path.join(targetRepoRoot, '.playbook/process-telemetry.json'));
      }
      if (subsystem === 'knowledge_lifecycle') {
        return !!learningCompaction?.summary;
      }
      if (subsystem === 'governance_kernel') {
        return fs.existsSync(path.join(targetRepoRoot, 'playbook.config.json')) || fs.existsSync(path.join(targetRepoRoot, '.playbook/ai-contract.json'));
      }
      return false;
    })
  );

  const presentArtifacts = uniqueSorted(requiredArtifacts.filter((artifactPath) => fs.existsSync(path.join(targetRepoRoot, artifactPath))));
  const availableValidations = uniqueSorted((learningCompaction?.summary?.validation_patterns ?? []).map((entry) => entry.validation_key));
  const presentValidations = uniqueSorted(requiredValidations.filter((validation) => availableValidations.includes(validation)));
  const presentContracts = uniqueSorted(requiredContracts.filter((contractPath) => fs.existsSync(path.join(targetRepoRoot, contractPath))));

  const missingSubsystems = requiredSubsystems.filter((entry) => !presentSubsystems.includes(entry));
  const missingArtifacts = requiredArtifacts.filter((entry) => !presentArtifacts.includes(entry));
  const missingValidations = requiredValidations.filter((entry) => !presentValidations.includes(entry));
  const missingContracts = requiredContracts.filter((entry) => !presentContracts.includes(entry));

  const blockers = uniqueSorted([
    ...missingContracts.map((contractPath) => `missing governance contract: ${contractPath}`),
    ...((learningCompaction?.summary?.recurring_failures ?? [])
      .filter((failure) => failure.family.includes('validation') || failure.signal_id.includes('policy'))
      .map((failure) => `target policy blocker: ${failure.signal_id}`))
  ]);

  const openQuestions = uniqueSorted([
    ...(learningCompaction?.summary?.open_questions ?? []),
    ...(routerRecommendations?.recommendations && routerRecommendations.recommendations.length === 0
      ? ['No router recommendations found for this target; confirm adoption lane fit before transfer.']
      : []),
    ...(patternScore.evidence_runs < 3
      ? ['Sparse transfer evidence for this pattern/target pair; gather additional outcomes before acceptance.']
      : [])
  ]);

  const subsystemCoverage = computeCoverage(requiredSubsystems, presentSubsystems);
  const artifactCoverage = computeCoverage(requiredArtifacts, presentArtifacts);
  const validationCoverage = computeCoverage(requiredValidations, presentValidations);
  const governanceAlignment = computeCoverage(requiredContracts, presentContracts);

  const readinessScore = round4(
    clamp01(
      patternScore.confidence_score * 0.3 + subsystemCoverage * 0.2 + artifactCoverage * 0.15 + validationCoverage * 0.2 + governanceAlignment * 0.15
    )
  );

  const recommendation: TransferReadinessEntry['recommendation'] = blockers.length > 0 ? 'blocked' : readinessScore >= 0.75 ? 'ready' : 'partial';

  return {
    target_repo: targetRepoId,
    pattern_id: patternScore.pattern_id,
    readiness_score: readinessScore,
    subsystem_presence: {
      required: requiredSubsystems,
      present: presentSubsystems,
      missing: missingSubsystems
    },
    artifact_availability: {
      required: requiredArtifacts,
      present: presentArtifacts,
      missing: missingArtifacts
    },
    validation_coverage: {
      required_validations: requiredValidations,
      present_validations: presentValidations,
      coverage_score: validationCoverage
    },
    governance_alignment: {
      required_contracts: requiredContracts,
      present_contracts: presentContracts,
      missing_contracts: missingContracts,
      alignment_score: governanceAlignment
    },
    blockers,
    missing_prerequisites: uniqueSorted([...missingSubsystems, ...missingArtifacts, ...missingValidations, ...missingContracts]),
    open_questions: openQuestions,
    recommendation
  };
};

export const generateTransferReadinessArtifact = (input: {
  targetRepoRoot: string;
  targetRepoId: string;
  portabilityRun: PatternPortabilityRun;
}): TransferReadinessArtifact => {
  const assessments = input.portabilityRun.scores
    .map((patternScore) => assessTargetReadiness({ patternScore, targetRepoRoot: input.targetRepoRoot, targetRepoId: input.targetRepoId }))
    .sort((left, right) => right.readiness_score - left.readiness_score || left.pattern_id.localeCompare(right.pattern_id));

  return normalizeTransferReadinessArtifact({
    schemaVersion: TRANSFER_READINESS_SCHEMA_VERSION,
    kind: 'transfer-readiness',
    generatedAt: input.portabilityRun.generatedAt,
    target_repo: input.targetRepoId,
    assessments
  });
};

export const writeTransferReadinessArtifact = (repoRoot: string, artifact: TransferReadinessArtifact): string => {
  const targetPath = path.join(repoRoot, TRANSFER_READINESS_RELATIVE_PATH);
  writeDeterministicJsonAtomic(targetPath, normalizeTransferReadinessArtifact(artifact));
  return targetPath;
};
