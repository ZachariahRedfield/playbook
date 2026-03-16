import path from 'node:path';
import type { ImprovementCandidate, ImprovementCandidatesArtifact } from '../improvement/candidateEngine.js';
import { readJsonIfExists } from '../learning/io.js';
import { summarizeCycleRegressions, type CycleHistoryArtifact } from '../telemetry/cycleSummary.js';

export const POLICY_EVALUATION_SCHEMA_VERSION = '1.0' as const;
export const POLICY_EVALUATION_RELATIVE_PATH = '.playbook/policy-evaluation.json' as const;

type PolicyEvidenceStrength = 'high' | 'medium' | 'low';
type PolicyFrequency = 'repeated' | 'isolated';
type PolicyImpactScope = 'narrow' | 'broad';

export type PolicyEvaluateDecision = 'safe' | 'requires_review' | 'blocked';

export type PolicyEvaluationEntry = {
  proposal_id: string;
  decision: PolicyEvaluateDecision;
  reason: string;
  evidence: {
    frequency: number;
    confidence: number;
    signals: string[];
  };
};

export type PolicyEvaluationArtifact = {
  schemaVersion: typeof POLICY_EVALUATION_SCHEMA_VERSION;
  kind: 'policy-evaluation';
  generatedAt: string;
  proposalOnly: true;
  nonAutonomous: true;
  sourceArtifacts: {
    improvementCandidatesPath: string;
    cycleHistoryPath: string;
    improvementCandidatesAvailable: boolean;
    cycleHistoryAvailable: boolean;
  };
  summary: {
    safe: number;
    requires_review: number;
    blocked: number;
    total: number;
  };
  evaluations: PolicyEvaluationEntry[];
};

const isBroadImpactCategory = (category: ImprovementCandidate['category']): boolean =>
  category === 'orchestration' || category === 'worker_prompts' || category === 'validation_efficiency' || category === 'routing';

const classifyEvidenceStrength = (candidate: ImprovementCandidate): PolicyEvidenceStrength => {
  if (candidate.evidence_count >= 4 && candidate.supporting_runs >= 2 && candidate.confidence_score >= 0.75) {
    return 'high';
  }

  if (candidate.evidence_count >= 2 && candidate.supporting_runs >= 1 && candidate.confidence_score >= 0.55) {
    return 'medium';
  }

  return 'low';
};

const classifyFrequency = (candidate: ImprovementCandidate): PolicyFrequency =>
  candidate.recurrence_count >= 3 ? 'repeated' : 'isolated';

const classifyImpactScope = (candidate: ImprovementCandidate): PolicyImpactScope =>
  isBroadImpactCategory(candidate.category) ? 'broad' : 'narrow';

const toSignals = (input: {
  evidenceStrength: PolicyEvidenceStrength;
  frequencyClass: PolicyFrequency;
  impactScope: PolicyImpactScope;
  regressionDetected: boolean;
  regressionReasons: string[];
}): string[] => {
  const signals: string[] = [
    `evidence_strength:${input.evidenceStrength}`,
    `frequency_class:${input.frequencyClass}`,
    `impact_scope:${input.impactScope}`,
    `regression_detected:${input.regressionDetected ? 'yes' : 'no'}`
  ];

  if (input.regressionDetected) {
    for (const reason of input.regressionReasons) {
      signals.push(`regression_reason:${reason}`);
    }
  }

  return signals;
};

export const evaluateImprovementPolicy = (repoRoot: string): PolicyEvaluationArtifact => {
  const improvementCandidatesPath = path.join(repoRoot, '.playbook/improvement-candidates.json');
  const cycleHistoryPath = path.join(repoRoot, '.playbook/cycle-history.json');

  const improveArtifact = readJsonIfExists<ImprovementCandidatesArtifact>(improvementCandidatesPath);
  const cycleHistory = readJsonIfExists<CycleHistoryArtifact>(cycleHistoryPath);
  const regression = summarizeCycleRegressions({ cycleHistory });
  const regressionReasons = [...regression.regression_reasons].sort((left, right) => left.localeCompare(right));

  const candidates = [...(improveArtifact?.candidates ?? [])].sort((left, right) =>
    left.candidate_id.localeCompare(right.candidate_id)
  );

  const evaluations = candidates.map((candidate): PolicyEvaluationEntry => {
    const evidenceStrength = classifyEvidenceStrength(candidate);
    const frequencyClass = classifyFrequency(candidate);
    const impactScope = classifyImpactScope(candidate);

    const signals = toSignals({
      evidenceStrength,
      frequencyClass,
      impactScope,
      regressionDetected: regression.regression_detected,
      regressionReasons
    });

    if (evidenceStrength === 'low' || candidate.confidence_score < 0.5) {
      return {
        proposal_id: candidate.candidate_id,
        decision: 'blocked',
        reason: 'Blocked: evidence is weak or confidence is below deterministic policy threshold.',
        evidence: {
          frequency: candidate.recurrence_count,
          confidence: candidate.confidence_score,
          signals
        }
      };
    }

    if (frequencyClass === 'repeated' || impactScope === 'broad' || regression.regression_detected) {
      return {
        proposal_id: candidate.candidate_id,
        decision: 'requires_review',
        reason: 'Requires review: repeated issues, broad impact, or regression signals require governed human validation.',
        evidence: {
          frequency: candidate.recurrence_count,
          confidence: candidate.confidence_score,
          signals
        }
      };
    }

    if (evidenceStrength === 'high' && impactScope === 'narrow') {
      return {
        proposal_id: candidate.candidate_id,
        decision: 'safe',
        reason: 'Safe: strong governed evidence and narrow impact scope satisfy deterministic policy thresholds.',
        evidence: {
          frequency: candidate.recurrence_count,
          confidence: candidate.confidence_score,
          signals
        }
      };
    }

    return {
      proposal_id: candidate.candidate_id,
      decision: 'requires_review',
      reason: 'Requires review: evidence is medium and policy requires explicit reviewer confirmation before action.',
      evidence: {
        frequency: candidate.recurrence_count,
        confidence: candidate.confidence_score,
        signals
      }
    };
  });

  const summary = evaluations.reduce(
    (acc, evaluation) => {
      acc[evaluation.decision] += 1;
      acc.total += 1;
      return acc;
    },
    { safe: 0, requires_review: 0, blocked: 0, total: 0 }
  );

  return {
    schemaVersion: POLICY_EVALUATION_SCHEMA_VERSION,
    kind: 'policy-evaluation',
    generatedAt: new Date().toISOString(),
    proposalOnly: true,
    nonAutonomous: true,
    sourceArtifacts: {
      improvementCandidatesPath: '.playbook/improvement-candidates.json',
      cycleHistoryPath: '.playbook/cycle-history.json',
      improvementCandidatesAvailable: Boolean(improveArtifact),
      cycleHistoryAvailable: Boolean(cycleHistory)
    },
    summary,
    evaluations
  };
};
