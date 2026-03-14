import type { RepositoryGraph } from '../../graph/repoGraph.js';
import type { ContractRegistryPayload } from '../../contracts/contractRegistry.js';
import type { DocsAuditResult } from '../../docs/audit.js';

export type ExtractionArtifacts = {
  graph: RepositoryGraph;
  contractsRegistry: ContractRegistryPayload;
  docsAudit: DocsAuditResult;
};

export type PatternEvidence = {
  artifact: string;
  pointer: string;
  summary: string;
};

export type PatternCandidate = {
  id: string;
  detector: string;
  title: string;
  summary: string;
  confidence: number;
  evidence: PatternEvidence[];
  related: string[];
};

export type Detector = {
  detector: string;
  detect: (artifacts: ExtractionArtifacts) => PatternCandidate[];
};
