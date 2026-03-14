import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ContractRegistryPayload } from '../contracts/contractRegistry.js';
import type { DocsAuditResult } from '../docs/audit.js';
import { readRepositoryGraph, type RepositoryGraph } from '../graph/repoGraph.js';
import { DEFAULT_PATTERN_CANDIDATE_DETECTORS, type Detector, type PatternCandidate } from './detectors/index.js';

export const PATTERN_CANDIDATES_RELATIVE_PATH = '.playbook/pattern-candidates.json' as const;

type PatternCandidateArtifact = {
  schemaVersion: '1.0';
  kind: 'pattern-candidates';
  generatedAt: string;
  candidates: PatternCandidateRecord[];
};

type PatternCandidateRecord = {
  id: string;
  pattern_family: string;
  title: string;
  description: string;
  source_artifact: string;
  signals: string[];
  confidence: number;
  evidence_refs: string[];
  status: 'observed';
};

type ExtractPatternCandidatesInput = {
  repoRoot: string;
  detectors?: readonly Detector[];
  artifacts?: Partial<{
    graph: RepositoryGraph;
    contractsRegistry: ContractRegistryPayload;
    docsAudit: DocsAuditResult;
  }>;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

const stableId = (prefix: string, value: unknown): string => `${prefix}.${createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 12)}`;

const asRecord = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

const readJson = <T>(repoRoot: string, relativePath: string, requiredKind?: string): T => {
  const absolutePath = path.join(repoRoot, relativePath);
  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;

  if (requiredKind) {
    const kind = asRecord(parsed as unknown)?.kind;
    if (kind !== requiredKind) {
      throw new Error(`playbook extract patterns: invalid artifact kind for ${relativePath}. Expected "${requiredKind}".`);
    }
  }

  return parsed;
};

const readArtifacts = (input: ExtractPatternCandidatesInput): { graph: RepositoryGraph; contractsRegistry: ContractRegistryPayload; docsAudit: DocsAuditResult } => {
  const graph = input.artifacts?.graph ?? readRepositoryGraph(input.repoRoot);
  const contractsRegistry = input.artifacts?.contractsRegistry ?? readJson<ContractRegistryPayload>(input.repoRoot, '.playbook/contracts-registry.json', 'contracts');
  const docsAudit = input.artifacts?.docsAudit ?? readJson<DocsAuditResult>(input.repoRoot, '.playbook/docs-audit.json');

  return { graph, contractsRegistry, docsAudit };
};

const ensureRequiredArtifacts = (input: ExtractPatternCandidatesInput): void => {
  const requiredPaths: Array<{ key: keyof NonNullable<ExtractPatternCandidatesInput['artifacts']>; path: string }> = [
    { key: 'graph', path: '.playbook/repo-graph.json' },
    { key: 'contractsRegistry', path: '.playbook/contracts-registry.json' },
    { key: 'docsAudit', path: '.playbook/docs-audit.json' }
  ];

  const missing = requiredPaths
    .filter((entry) => !input.artifacts?.[entry.key] && !fs.existsSync(path.join(input.repoRoot, entry.path)))
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));

  if (missing.length > 0) {
    throw new Error(`playbook extract patterns: missing required artifacts: ${missing.join(', ')}`);
  }
};

const normalizeCandidate = (candidate: PatternCandidate): PatternCandidate => ({
  ...candidate,
  id: candidate.id || stableId(`pattern.${candidate.detector}`, { title: candidate.title, related: candidate.related }),
  confidence: Math.max(0, Math.min(1, Number(candidate.confidence.toFixed(2)))),
  evidence: [...candidate.evidence]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.artifact.localeCompare(right.artifact) || left.pointer.localeCompare(right.pointer) || left.summary.localeCompare(right.summary)),
  related: [...new Set(candidate.related)].sort((left, right) => left.localeCompare(right))
});

const compareCandidate = (left: PatternCandidate, right: PatternCandidate): number =>
  left.detector.localeCompare(right.detector) || left.id.localeCompare(right.id) || left.title.localeCompare(right.title);

const toPatternCandidateRecord = (candidate: PatternCandidate): PatternCandidateRecord => {
  const sourceArtifact = candidate.evidence[0]?.artifact ?? '.playbook/repo-graph.json';
  const evidenceRefs = candidate.evidence.map((entry) => `${entry.artifact}#${entry.pointer}`);

  return {
    id: candidate.id,
    pattern_family: candidate.detector,
    title: candidate.title,
    description: candidate.summary,
    source_artifact: sourceArtifact,
    signals: [...candidate.related],
    confidence: candidate.confidence,
    evidence_refs: evidenceRefs,
    status: 'observed'
  };
};

export const buildPatternCandidateArtifact = (candidates: PatternCandidate[], generatedAt = '1970-01-01T00:00:00.000Z'): PatternCandidateArtifact => {
  const ordered = [...candidates].sort(compareCandidate);

  return {
    schemaVersion: '1.0',
    kind: 'pattern-candidates',
    generatedAt,
    candidates: ordered.map((candidate) => toPatternCandidateRecord(candidate))
  };
};

export const extractPatternCandidates = (input: ExtractPatternCandidatesInput): PatternCandidate[] => {
  ensureRequiredArtifacts(input);
  const artifacts = readArtifacts(input);
  const detectors = input.detectors ? [...input.detectors] : [...DEFAULT_PATTERN_CANDIDATE_DETECTORS];

  const candidates = detectors
    .flatMap((detector) => detector.detect(artifacts))
    .map((candidate) => normalizeCandidate(candidate))
    .sort(compareCandidate);

  return candidates;
};

export const writePatternCandidateArtifact = (repoRoot: string, artifact: PatternCandidateArtifact): string => {
  const artifactPath = path.join(repoRoot, PATTERN_CANDIDATES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return artifactPath;
};

export const generatePatternCandidateArtifact = (input: ExtractPatternCandidatesInput): { artifactPath: string; artifact: PatternCandidateArtifact } => {
  const artifacts = readArtifacts(input);
  const candidates = extractPatternCandidates(input);
  const artifact = buildPatternCandidateArtifact(candidates, artifacts.graph.generatedAt);
  const artifactPath = writePatternCandidateArtifact(input.repoRoot, artifact);
  return { artifactPath, artifact };
};

export type { PatternCandidateArtifact, ExtractPatternCandidatesInput };
