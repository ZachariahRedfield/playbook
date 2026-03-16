const clampScore = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(4))));

export type TransferReadinessPresence = {
  required: string[];
  present: string[];
  missing: string[];
};

export type TransferReadinessValidationCoverage = {
  required_validations: string[];
  present_validations: string[];
  coverage_score: number;
};

export type TransferReadinessGovernanceAlignment = {
  required_contracts: string[];
  present_contracts: string[];
  missing_contracts: string[];
  alignment_score: number;
};

export type TransferReadinessRecommendation = 'ready' | 'partial' | 'blocked';

export type TransferReadinessEntry = {
  target_repo: string;
  pattern_id: string;
  readiness_score: number;
  subsystem_presence: TransferReadinessPresence;
  artifact_availability: TransferReadinessPresence;
  validation_coverage: TransferReadinessValidationCoverage;
  governance_alignment: TransferReadinessGovernanceAlignment;
  blockers: string[];
  missing_prerequisites: string[];
  open_questions: string[];
  recommendation: TransferReadinessRecommendation;
};

export type TransferReadinessArtifact = {
  schemaVersion: '1.0';
  kind: 'transfer-readiness';
  generatedAt: string;
  target_repo: string;
  assessments: TransferReadinessEntry[];
};

const normalizeStringList = (values: string[] | undefined): string[] =>
  [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));

const normalizePresence = (value: TransferReadinessPresence): TransferReadinessPresence => {
  const required = normalizeStringList(value.required);
  const present = normalizeStringList(value.present).filter((entry) => required.includes(entry));
  const missing = normalizeStringList(value.missing.length > 0 ? value.missing : required.filter((entry) => !present.includes(entry)));
  return {
    required,
    present,
    missing
  };
};

export const normalizeTransferReadinessArtifact = (artifact: TransferReadinessArtifact): TransferReadinessArtifact => ({
  ...artifact,
  assessments: [...artifact.assessments]
    .map((entry) => {
      const subsystemPresence = normalizePresence(entry.subsystem_presence);
      const artifactAvailability = normalizePresence(entry.artifact_availability);
      const requiredValidations = normalizeStringList(entry.validation_coverage.required_validations);
      const presentValidations = normalizeStringList(entry.validation_coverage.present_validations).filter((validation) => requiredValidations.includes(validation));
      const requiredContracts = normalizeStringList(entry.governance_alignment.required_contracts);
      const presentContracts = normalizeStringList(entry.governance_alignment.present_contracts).filter((contractPath) => requiredContracts.includes(contractPath));
      const missingContracts = normalizeStringList(
        entry.governance_alignment.missing_contracts.length > 0
          ? entry.governance_alignment.missing_contracts
          : requiredContracts.filter((contractPath) => !presentContracts.includes(contractPath))
      );

      return {
        ...entry,
        readiness_score: clampScore(entry.readiness_score),
        subsystem_presence: subsystemPresence,
        artifact_availability: artifactAvailability,
        validation_coverage: {
          required_validations: requiredValidations,
          present_validations: presentValidations,
          coverage_score: clampScore(entry.validation_coverage.coverage_score)
        },
        governance_alignment: {
          required_contracts: requiredContracts,
          present_contracts: presentContracts,
          missing_contracts: missingContracts,
          alignment_score: clampScore(entry.governance_alignment.alignment_score)
        },
        blockers: normalizeStringList(entry.blockers),
        missing_prerequisites: normalizeStringList(entry.missing_prerequisites),
        open_questions: normalizeStringList(entry.open_questions)
      };
    })
    .sort((left, right) => left.pattern_id.localeCompare(right.pattern_id))
});

