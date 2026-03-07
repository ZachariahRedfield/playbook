import fs from 'node:fs';
import path from 'node:path';
import type { ArchitectureAuditCheck, ArchitectureAuditResult, ArchitectureAuditStatus } from '../types.js';

const exists = (repoRoot: string, relativePath: string): boolean => fs.existsSync(path.join(repoRoot, relativePath));

const readText = (repoRoot: string, relativePath: string): string | undefined => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }
  return fs.readFileSync(absolutePath, 'utf8');
};

const readJsonRecord = (repoRoot: string, relativePath: string): Record<string, unknown> | undefined => {
  const raw = readText(repoRoot, relativePath);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

const statusFromCounts = (warnCount: number, failCount: number): ArchitectureAuditStatus => {
  if (failCount > 0) {
    return 'fail';
  }
  return warnCount > 0 ? 'warn' : 'pass';
};

const containsAny = (value: string | undefined, phrases: string[]): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return phrases.some((phrase) => normalized.includes(phrase.toLowerCase()));
};

export const architectureAuditChecks: ArchitectureAuditCheck[] = [
  {
    id: 'artifact.evolution-policy',
    title: 'Artifact evolution policy',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const policyPath = 'docs/contracts/ARTIFACT_EVOLUTION_POLICY.md';
      const policyExists = exists(repoRoot, policyPath);

      return {
        id: 'artifact.evolution-policy',
        title: 'Artifact evolution policy',
        status: policyExists ? 'pass' : 'warn',
        severity: 'medium',
        evidence: policyExists
          ? [`Found ${policyPath}.`]
          : [`Missing required architecture contract doc: ${policyPath}.`],
        recommendation: policyExists
          ? 'Keep this policy updated whenever persisted artifact contracts evolve.'
          : `Create ${policyPath} with schema evolution, compatibility, and regeneration guidance.`
      };
    }
  },
  {
    id: 'artifact.schema-versioning',
    title: 'Artifact schema versioning',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const artifactFiles = ['.playbook/repo-index.json', '.playbook/repo-graph.json'];
      const presentFiles = artifactFiles.filter((relativePath) => exists(repoRoot, relativePath));

      if (presentFiles.length === 0) {
        return {
          id: 'artifact.schema-versioning',
          title: 'Artifact schema versioning',
          status: 'warn',
          severity: 'medium',
          evidence: ['No persisted repository intelligence artifacts found (.playbook/repo-index.json, .playbook/repo-graph.json).'],
          recommendation: 'Run `playbook index` and ensure persisted artifacts include a top-level `schemaVersion` field.'
        };
      }

      const missingSchemaVersion = presentFiles.filter((relativePath) => {
        const artifact = readJsonRecord(repoRoot, relativePath);
        return !artifact || typeof artifact.schemaVersion !== 'string' || artifact.schemaVersion.trim().length === 0;
      });

      const evidence = presentFiles.map((relativePath) => {
        const artifact = readJsonRecord(repoRoot, relativePath);
        return typeof artifact?.schemaVersion === 'string'
          ? `${relativePath} schemaVersion=${artifact.schemaVersion}`
          : `${relativePath} missing schemaVersion`;
      });

      return {
        id: 'artifact.schema-versioning',
        title: 'Artifact schema versioning',
        status: missingSchemaVersion.length > 0 ? 'warn' : 'pass',
        severity: 'medium',
        evidence,
        recommendation:
          missingSchemaVersion.length > 0
            ? `Ensure all persisted artifacts include a top-level schemaVersion (missing: ${missingSchemaVersion.join(', ')}).`
            : 'Preserve schemaVersion in all persisted artifacts and bump versions using the artifact evolution policy.'
      };
    }
  },
  {
    id: 'scm.context-layer',
    title: 'SCM/git context normalization layer',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const sharedScmCandidates = ['packages/engine/src/git/base.ts', 'packages/engine/src/git/diff.ts'];
      const foundCandidates = sharedScmCandidates.filter((relativePath) => exists(repoRoot, relativePath));
      const docsPath = 'docs/architecture/SCM_CONTEXT_LAYER.md';
      const docsExists = exists(repoRoot, docsPath);
      const warnCount = (foundCandidates.length === 0 ? 1 : 0) + (docsExists ? 0 : 1);

      const evidence = [
        foundCandidates.length > 0
          ? `Found shared SCM normalization utilities: ${foundCandidates.join(', ')}`
          : 'No shared SCM normalization utility found in expected engine git module paths.',
        docsExists ? `Found ${docsPath}.` : `Missing ${docsPath}.`
      ];

      return {
        id: 'scm.context-layer',
        title: 'SCM/git context normalization layer',
        status: statusFromCounts(warnCount, 0),
        severity: 'medium',
        evidence,
        recommendation:
          warnCount > 0
            ? 'Centralize SCM normalization in shared git-context utilities and document boundaries in docs/architecture/SCM_CONTEXT_LAYER.md.'
            : 'Keep SCM context normalization centralized and update docs when SCM abstractions change.'
      };
    }
  },
  {
    id: 'remediation.trust-model',
    title: 'Remediation trust model',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const trustModelPath = 'docs/architecture/REMEDIATION_TRUST_MODEL.md';
      const trustDoc = readText(repoRoot, trustModelPath);
      const hasDoc = Boolean(trustDoc);
      const hasExplicitLevels = containsAny(trustDoc, ['level 0', 'level 1', 'level 2', 'level 3']);
      const hasBoundedScopeLanguage = containsAny(trustDoc, ['bounded']) && containsAny(trustDoc, ['change level', 'change-scope']);
      const hasBoundedScope = hasExplicitLevels || hasBoundedScopeLanguage;
      const warnCount = (hasDoc ? 0 : 1) + (hasBoundedScope ? 0 : 1);

      return {
        id: 'remediation.trust-model',
        title: 'Remediation trust model',
        status: statusFromCounts(warnCount, 0),
        severity: 'high',
        evidence: [
          hasDoc ? `Found ${trustModelPath}.` : `Missing ${trustModelPath}.`,
          hasBoundedScope ? 'Trust model references bounded change-scope levels.' : 'Trust model documentation does not clearly describe bounded change-scope levels.'
        ],
        recommendation:
          warnCount > 0
            ? `Document deterministic remediation trust boundaries and explicit change levels in ${trustModelPath}.`
            : 'Preserve explicit remediation trust boundaries and keep change-scope levels aligned with plan/apply behavior.'
      };
    }
  },
  {
    id: 'ai.determinism-boundary',
    title: 'AI vs deterministic boundary',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const docPath = 'docs/architecture/AI_DETERMINISM_BOUNDARY.md';
      const docExists = exists(repoRoot, docPath);

      return {
        id: 'ai.determinism-boundary',
        title: 'AI vs deterministic boundary',
        status: docExists ? 'pass' : 'warn',
        severity: 'high',
        evidence: docExists ? [`Found ${docPath}.`] : [`Missing ${docPath}.`],
        recommendation: docExists
          ? 'Keep AI versus deterministic boundaries explicit as new commands and automation features are added.'
          : `Create ${docPath} to define where AI assistance ends and deterministic enforcement begins.`
      };
    }
  },
  {
    id: 'ecosystem.adapter-boundaries',
    title: 'Ecosystem adapter boundaries',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const docPath = 'docs/architecture/ECOSYSTEM_ADAPTERS.md';
      const docExists = exists(repoRoot, docPath);

      return {
        id: 'ecosystem.adapter-boundaries',
        title: 'Ecosystem adapter boundaries',
        status: docExists ? 'pass' : 'warn',
        severity: 'medium',
        evidence: docExists ? [`Found ${docPath}.`] : [`Missing ${docPath}.`],
        recommendation: docExists
          ? 'Keep ecosystem adapter boundaries documented as integration surfaces expand.'
          : `Create ${docPath} to define external tool isolation and adapter boundary contracts.`
      };
    }
  },
  {
    id: 'performance.context-efficiency',
    title: 'Context/token efficiency strategy',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const docPath = 'docs/architecture/CONTEXT_EFFICIENCY_STRATEGY.md';
      const docExists = exists(repoRoot, docPath);

      return {
        id: 'performance.context-efficiency',
        title: 'Context/token efficiency strategy',
        status: docExists ? 'pass' : 'warn',
        severity: 'medium',
        evidence: docExists ? [`Found ${docPath}.`] : [`Missing ${docPath}.`],
        recommendation: docExists
          ? 'Keep context-efficiency strategy aligned with ask/context/index command behavior.'
          : `Create ${docPath} with deterministic context/token efficiency patterns.`
      };
    }
  },
  {
    id: 'docs.roadmap-coverage',
    title: 'Roadmap/docs coverage for hardening controls',
    run: ({ repoRoot }): ArchitectureAuditResult => {
      const roadmapPath = 'docs/PLAYBOOK_PRODUCT_ROADMAP.md';
      const roadmap = readText(repoRoot, roadmapPath);
      const hasRoadmap = Boolean(roadmap);
      const requiredSignals: Array<{ label: string; phrases: string[] }> = [
        { label: 'artifact versioning', phrases: ['artifact schema', 'artifact version'] },
        { label: 'SCM context abstraction', phrases: ['scm context', 'git context', 'scm normalization'] },
        { label: 'remediation trust model', phrases: ['remediation trust', 'change level', 'trust model'] },
        { label: 'context efficiency', phrases: ['context efficiency', 'token efficiency'] }
      ];
      const missingSignals = requiredSignals
        .filter((signal) => !signal.phrases.some((phrase) => roadmap?.toLowerCase().includes(phrase)))
        .map((signal) => signal.label);

      const hasPlatformHardeningHeading = containsAny(roadmap, ['platform hardening']);
      const warnCount = (hasRoadmap ? 0 : 1) + (hasPlatformHardeningHeading ? 0 : 1) + (missingSignals.length > 0 ? 1 : 0);

      return {
        id: 'docs.roadmap-coverage',
        title: 'Roadmap/docs coverage for hardening controls',
        status: statusFromCounts(warnCount, 0),
        severity: 'medium',
        evidence: [
          hasRoadmap ? `Found ${roadmapPath}.` : `Missing ${roadmapPath}.`,
          hasPlatformHardeningHeading ? 'Roadmap includes a Platform Hardening section.' : 'Roadmap does not include a Platform Hardening section.',
          missingSignals.length === 0
            ? 'Roadmap includes hardening coverage for artifact versioning, SCM context abstraction, remediation trust model, and context efficiency.'
            : `Roadmap hardening coverage missing topics: ${missingSignals.join(', ')}.`
        ],
        recommendation:
          warnCount > 0
            ? 'Add a Platform Hardening roadmap section that explicitly covers artifact versioning, SCM normalization, remediation trust boundaries, ecosystem adapter isolation, context efficiency, and repeatable architecture audits.'
            : 'Keep roadmap hardening coverage synchronized with architecture guardrail docs and audit checks.'
      };
    }
  }
];
