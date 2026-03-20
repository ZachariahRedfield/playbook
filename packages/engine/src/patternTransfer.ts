import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PATTERN_CANDIDATES_RELATIVE_PATH } from './extract/patternCandidates.js';
import { readCanonicalPatternsArtifact, type PromotedPatternRecord } from './promotion.js';

export const PATTERN_TRANSFER_PACKAGE_SCHEMA_VERSION = '1.0' as const;
export const PATTERN_TRANSFER_PACKAGES_RELATIVE_DIR = '.playbook/pattern-transfer-packages' as const;

type RiskClass = 'low' | 'medium' | 'high' | 'critical';
type SanitizationStatus = 'sanitized' | 'unsanitized' | 'needs-review';
type CompatibilityStatus = 'compatible' | 'incompatible';

export type PatternTransferPackage = {
  schemaVersion: typeof PATTERN_TRANSFER_PACKAGE_SCHEMA_VERSION;
  kind: 'pattern-transfer-package';
  package_id: string;
  exported_at: string;
  pattern: PromotedPatternRecord;
  provenance: {
    source_pattern_id: string;
    source_candidate_id: string;
    source_ref: string;
    source_fingerprint: string;
  };
  sanitization: {
    status: SanitizationStatus;
    reviewed_at: string | null;
    notes: string[];
  };
  compatibility: {
    status: CompatibilityStatus;
    target_repo_id: string;
    target_tags: string[];
    reason: string;
  };
  risk_class: RiskClass;
  known_failure_modes: string[];
};

export type PatternTransferImportResult = {
  schemaVersion: '1.0';
  command: 'patterns.transfer.import';
  package_id: string;
  outcome: 'imported';
  candidate_only: true;
  candidate_id: string;
  artifact_path: typeof PATTERN_CANDIDATES_RELATIVE_PATH;
  package: PatternTransferPackage;
};

const stableStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pattern';
const uniqueSorted = (values: string[]): string[] => [...new Set(values.filter((v) => v.trim().length > 0))].sort((a, b) => a.localeCompare(b));
const fingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;

const readPatternCandidates = (cwd: string): { schemaVersion: '1.0'; kind: 'pattern-candidates'; generatedAt: string; candidates: Array<Record<string, unknown>> } => {
  const targetPath = path.join(cwd, PATTERN_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    return { schemaVersion: '1.0', kind: 'pattern-candidates', generatedAt: new Date(0).toISOString(), candidates: [] };
  }
  return readJson(targetPath);
};

export const exportPatternTransferPackage = (input: {
  playbookHome: string;
  patternId: string;
  targetRepoId: string;
  targetTags?: string[];
  sanitizationStatus: SanitizationStatus;
  riskClass: RiskClass;
  compatibilityStatus?: CompatibilityStatus;
  compatibilityReason?: string;
  exportedAt?: string;
}): { packagePath: string; package: PatternTransferPackage } => {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const artifact = readCanonicalPatternsArtifact(input.playbookHome);
  const pattern = artifact.patterns.find((entry) => entry.id === input.patternId);
  if (!pattern) throw new Error(`playbook patterns transfer export: promoted pattern not found: ${input.patternId}`);
  if (pattern.status !== 'active') throw new Error(`playbook patterns transfer export: only active patterns may be transferred; received ${pattern.status}`);
  const pkg: PatternTransferPackage = {
    schemaVersion: '1.0',
    kind: 'pattern-transfer-package',
    package_id: `pattern-transfer:${slugify(pattern.id)}:${fingerprint([pattern.id, exportedAt, input.targetRepoId]).slice(0, 12)}`,
    exported_at: exportedAt,
    pattern,
    provenance: {
      source_pattern_id: pattern.id,
      source_candidate_id: pattern.provenance.candidate_id,
      source_ref: pattern.provenance.source_ref,
      source_fingerprint: pattern.provenance.candidate_fingerprint
    },
    sanitization: {
      status: input.sanitizationStatus,
      reviewed_at: input.sanitizationStatus === 'sanitized' ? exportedAt : null,
      notes: input.sanitizationStatus === 'sanitized' ? ['Sanitization reviewed before transfer.'] : ['Transfer requires receiving-side review.']
    },
    compatibility: {
      status: input.compatibilityStatus ?? 'compatible',
      target_repo_id: input.targetRepoId,
      target_tags: uniqueSorted(input.targetTags ?? []),
      reason: input.compatibilityReason ?? 'Transfer package scoped for explicit receiving-side review.'
    },
    risk_class: input.riskClass,
    known_failure_modes: uniqueSorted(pattern.known_failure_modes ?? [])
  };
  const packagePath = path.join(input.playbookHome, PATTERN_TRANSFER_PACKAGES_RELATIVE_DIR, `${pkg.package_id}.json`);
  fs.mkdirSync(path.dirname(packagePath), { recursive: true });
  fs.writeFileSync(packagePath, stableStringify(pkg), 'utf8');
  return { packagePath, package: pkg };
};

export const importPatternTransferPackage = (cwd: string, packagePath: string, repoId: string, repoTags: string[] = []): PatternTransferImportResult => {
  const pkg = readJson<PatternTransferPackage>(packagePath);
  if (pkg.kind !== 'pattern-transfer-package') throw new Error('playbook patterns transfer import: invalid package kind');
  if (pkg.compatibility.status !== 'compatible') throw new Error(`playbook patterns transfer import: compatibility mismatch fails closed for ${pkg.package_id}`);
  if (pkg.compatibility.target_repo_id !== repoId) throw new Error(`playbook patterns transfer import: package targets ${pkg.compatibility.target_repo_id}, not ${repoId}`);
  const requiredTags = uniqueSorted(pkg.pattern.compatibility?.required_tags ?? []);
  const normalizedRepoTags = uniqueSorted(repoTags);
  if (requiredTags.some((tag) => !normalizedRepoTags.includes(tag))) {
    throw new Error(`playbook patterns transfer import: compatibility mismatch fails closed for ${pkg.package_id}; missing required tags`);
  }
  const current = readPatternCandidates(cwd);
  const candidate_id = `imported-${slugify(pkg.pattern.pattern_family)}-${slugify(repoId)}`;
  const candidate = {
    id: candidate_id,
    pattern_family: pkg.pattern.pattern_family,
    title: pkg.pattern.title,
    description: pkg.pattern.description,
    storySeed: pkg.pattern.storySeed,
    source_artifact: packagePath,
    signals: uniqueSorted(pkg.pattern.signals ?? []),
    confidence: pkg.pattern.confidence,
    evidence_refs: uniqueSorted([...pkg.pattern.evidence_refs, pkg.provenance.source_ref]),
    status: 'observed',
    imported_from: {
      package_id: pkg.package_id,
      repo_id: repoId,
      candidate_only: true,
      sanitization_status: pkg.sanitization.status,
      compatibility_status: pkg.compatibility.status,
      risk_class: pkg.risk_class,
      known_failure_modes: pkg.known_failure_modes
    }
  };
  const next = {
    ...current,
    generatedAt: new Date().toISOString(),
    candidates: [...current.candidates.filter((entry) => String(entry.id ?? '') !== candidate_id), candidate].sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
  };
  const targetPath = path.join(cwd, PATTERN_CANDIDATES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, stableStringify(next), 'utf8');
  return { schemaVersion: '1.0', command: 'patterns.transfer.import', package_id: pkg.package_id, outcome: 'imported', candidate_only: true, candidate_id, artifact_path: PATTERN_CANDIDATES_RELATIVE_PATH, package: pkg };
};
