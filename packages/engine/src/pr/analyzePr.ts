import { queryDocsCoverage } from '../query/docsCoverage.js';
import { readIndexedRepository, resolveIndexedModuleContext } from '../query/moduleIntelligence.js';
import { queryModuleOwners } from '../query/moduleOwners.js';
import { queryRuleOwners } from '../query/ruleOwners.js';
import { resolveDiffAskContext } from '../ask/diffContext.js';
import { execFileSync } from 'node:child_process';
import { resolveScmDiffBase } from '../git/context.js';
import { captureMemoryEventSafe } from '../memory/index.js';
import { expandMemoryProvenance, lookupPromotedMemoryKnowledge } from '../memory/inspection.js';
import type { MemoryKnowledgeEntry } from '../memory/knowledge.js';

type RiskLevel = 'low' | 'medium' | 'high';

type AnalyzePrContextSource =
  | { type: 'git-diff'; baseRef: string }
  | { type: 'repo-index'; path: '.playbook/repo-index.json' }
  | { type: 'module-impact'; modules: string[] }
  | { type: 'module-risk'; modules: string[] }
  | { type: 'docs-coverage'; modules: string[] }
  | { type: 'module-owners'; path: '.playbook/module-owners.json' | 'generated-default' }
  | { type: 'rule-owners'; rules: string[] }
  | { type: 'promoted-knowledge'; knowledgeIds: string[] };

type ContractImpactCategory = 'schema-registry' | 'knowledge-list' | 'cli-json-output' | 'persisted-artifact' | 'snapshot-fixture';

type PreventionGuidance = {
  target: {
    module: string;
    ruleId: string;
    failureShape: string;
  };
  rationale: string;
  nextBestActions: string[];
  provenance: {
    knowledgeId: string;
    kind: MemoryKnowledgeEntry['kind'];
    sourceCandidateIds: string[];
    sourceEventFingerprints: string[];
    evidenceChain: Array<{
      eventId: string;
      sourcePath: string;
      fingerprint: string;
      runId: string | null;
      outcomeStatus: string | null;
      outcomeSummary: string | null;
    }>;
  };
};

export type AnalyzePullRequestResult = {
  schemaVersion: '1.0';
  command: 'analyze-pr';
  baseRef: string;
  changedFiles: string[];
  summary: {
    changedFileCount: number;
    affectedModuleCount: number;
    riskLevel: RiskLevel;
  };
  affectedModules: string[];
  impact: Array<{
    module: string;
    dependencies: string[];
    directDependents: string[];
    dependents: string[];
  }>;
  architecture: {
    boundariesTouched: string[];
  };
  risk: {
    level: RiskLevel;
    signals: string[];
    moduleRisk: Array<{
      module: string;
      level: RiskLevel;
      score: number;
      signals: string[];
    }>;
  };
  docs: {
    changed: string[];
    recommendedReview: string[];
  };
  rules: {
    related: string[];
    owners: Array<{
      ruleId: string;
      area: string;
      owners: string[];
      remediationType: string;
    }>;
  };
  moduleOwners: Array<{
    module: string;
    owners: string[];
    area: string;
  }>;
  findings: Array<{
    ruleId: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    recommendation?: string;
    file?: string;
    line?: number;
  }>;
  reviewGuidance: string[];
  contractSurface: {
    hasImpact: boolean;
    categories: ContractImpactCategory[];
    changedFiles: string[];
    requiredUpdates: string[];
    changelogUpdated: boolean;
  };
  preventionGuidance: PreventionGuidance[];
  context: {
    sources: AnalyzePrContextSource[];
  };
};

const KNOWLEDGE_STALE_DAYS = 180;

const parseAddedLineFromPatch = (patch: string): number | undefined => {
  const match = patch.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/m);
  if (!match) {
    return undefined;
  }

  const line = Number(match[1]);
  return Number.isFinite(line) && line > 0 ? line : undefined;
};

const resolveChangedLineMap = (projectRoot: string, baseRef: string, changedFiles: string[]): Map<string, number> => {
  const lineMap = new Map<string, number>();

  let baseSha: string | undefined;
  try {
    baseSha = resolveScmDiffBase(projectRoot, { baseRef, commandName: 'playbook analyze-pr' }).baseSha;
  } catch {
    return lineMap;
  }

  for (const file of changedFiles) {
    try {
      const patch = execFileSync('git', ['diff', '--unified=0', `${baseSha}..HEAD`, '--', file], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const addedLine = parseAddedLineFromPatch(patch);
      if (addedLine) {
        lineMap.set(file, addedLine);
      }
    } catch {
      // ignore per-file diff parse failures to keep analysis deterministic.
    }
  }

  return lineMap;
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const toComparableTimestamp = (value: string | undefined): number => {
  if (typeof value !== 'string') {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isStalePromotedKnowledge = (entry: MemoryKnowledgeEntry): boolean => {
  if (entry.status !== 'active') {
    return true;
  }

  const promotedAt = toComparableTimestamp(entry.promotedAt);
  if (promotedAt === 0) {
    return false;
  }

  const cutoff = Date.now() - KNOWLEDGE_STALE_DAYS * 24 * 60 * 60 * 1000;
  return promotedAt < cutoff;
};

const resolvePreventionActions = (entry: MemoryKnowledgeEntry): string[] => {
  const actions = [
    `Review promoted knowledge ${entry.knowledgeId} before merge and validate guardrails for ${entry.module}.`,
    `Run \`playbook verify --json\` and confirm ${entry.ruleId} stays compliant in this change set.`
  ];

  if (entry.failureShape.toLowerCase().includes('docs')) {
    actions.push('Confirm documentation updates are included for impacted behavior.');
  }

  return actions;
};

const derivePreventionGuidance = (projectRoot: string, analysis: {
  affectedModules: string[];
  relatedRules: string[];
  findings: AnalyzePullRequestResult['findings'];
}): PreventionGuidance[] => {
  const matchedRuleIds = new Set<string>([
    ...analysis.relatedRules,
    ...analysis.findings.map((finding) => finding.ruleId)
  ]);
  const matchedModules = new Set<string>(analysis.affectedModules);

  const promotedKnowledge = lookupPromotedMemoryKnowledge(projectRoot)
    .filter((entry) => !isStalePromotedKnowledge(entry))
    .filter((entry) => matchedModules.has(entry.module) || matchedRuleIds.has(entry.ruleId));

  return promotedKnowledge
    .map((entry) => {
      const expanded = expandMemoryProvenance(projectRoot, entry.provenance);
      const evidenceChain = expanded.map((provenance) => ({
        eventId: provenance.eventId,
        sourcePath: provenance.sourcePath,
        fingerprint: provenance.fingerprint,
        runId: provenance.runId,
        outcomeStatus: provenance.event?.outcome.status ?? null,
        outcomeSummary: provenance.event?.outcome.summary ?? null
      }));

      const moduleMatch = matchedModules.has(entry.module) ? 1 : 0;
      const ruleMatch = matchedRuleIds.has(entry.ruleId) ? 1 : 0;
      const relevanceScore = moduleMatch + ruleMatch;

      return {
        guidance: {
          target: {
            module: entry.module,
            ruleId: entry.ruleId,
            failureShape: entry.failureShape
          },
          rationale: entry.summary,
          nextBestActions: resolvePreventionActions(entry),
          provenance: {
            knowledgeId: entry.knowledgeId,
            kind: entry.kind,
            sourceCandidateIds: [...entry.sourceCandidateIds],
            sourceEventFingerprints: [...entry.sourceEventFingerprints],
            evidenceChain
          }
        } satisfies PreventionGuidance,
        relevanceScore,
        promotedAt: toComparableTimestamp(entry.promotedAt),
        knowledgeId: entry.knowledgeId
      };
    })
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }
      if (right.promotedAt !== left.promotedAt) {
        return right.promotedAt - left.promotedAt;
      }
      return left.knowledgeId.localeCompare(right.knowledgeId);
    })
    .map((entry) => entry.guidance);
};

const classifyFinding = (finding: AnalyzePullRequestResult['findings'][number]): string => {
  if (finding.ruleId === 'playbook.pr.risk.module') {
    return 'module-risk';
  }

  if (finding.ruleId.startsWith('PLAYBOOK_DOCS_') || finding.ruleId.startsWith('PB007') || finding.ruleId.startsWith('PB009')) {
    return 'documentation';
  }

  if (finding.ruleId.startsWith('PB')) {
    return 'governance-rule';
  }

  return 'general-review';
};

const toActionClass = (message: string): string => {
  if (message.includes('playbook verify')) return 'run-verify';
  if (message.includes('playbook plan') || message.includes('playbook apply')) return 'plan-apply-remediation';
  if (message.includes('playbook doctor')) return 'risk-investigation';
  if (message.includes('playbook query impact')) return 'module-impact-review';
  if (message.toLowerCase().includes('docs')) return 'documentation-review';
  if (message.toLowerCase().includes('ownership')) return 'ownership-review';
  if (message.toLowerCase().includes('architecture')) return 'architecture-review';
  return 'general-review';
};

const summarizeActionClasses = (reviewGuidance: string[], findings: AnalyzePullRequestResult['findings']): string[] => {
  const counts = new Map<string, number>();

  for (const message of reviewGuidance) {
    const actionClass = toActionClass(message);
    counts.set(actionClass, (counts.get(actionClass) ?? 0) + 1);
  }

  for (const finding of findings) {
    if (!finding.recommendation) {
      continue;
    }

    const actionClass = toActionClass(finding.recommendation);
    counts.set(actionClass, (counts.get(actionClass) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([actionClass, count]) => `${actionClass}:${count}`);
};

const toAnalyzePrError = (message: string): Error => {
  const normalized = message
    .replace('playbook ask --diff-context', 'playbook analyze-pr')
    .replace('playbook query:', 'playbook analyze-pr:');

  return new Error(normalized);
};

const riskPriority: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2
};

const resolveRiskLevel = (levels: RiskLevel[]): RiskLevel => {
  if (levels.length === 0) {
    return 'low';
  }

  return levels.reduce<RiskLevel>((highest, current) => (riskPriority[current] > riskPriority[highest] ? current : highest), 'low');
};

const deriveArchitectureBoundaries = (changedFiles: string[]): string[] => {
  const boundaries = new Set<string>();

  for (const file of changedFiles) {
    if (file.startsWith('src/')) {
      boundaries.add('source');
      continue;
    }

    if (file.startsWith('docs/')) {
      boundaries.add('docs');
      continue;
    }

    if (file.startsWith('.playbook/')) {
      boundaries.add('playbook-artifacts');
      continue;
    }

    if (file.startsWith('.github/')) {
      boundaries.add('automation');
      continue;
    }

    if (file === 'README.md') {
      boundaries.add('docs');
      continue;
    }

    const topLevel = file.split('/')[0];
    boundaries.add(topLevel || 'root');
  }

  return uniqueSorted([...boundaries]);
};


const isDocsPath = (filePath: string): boolean => filePath.startsWith('docs/') || filePath.toLowerCase().includes('readme');

const EPHEMERAL_RUNTIME_ARTIFACT_PREFIXES = [
  '.playbook/memory/events/',
  '.playbook/runtime/',
  '.playbook/telemetry/'
] as const;

const STABLE_CONTRACT_ARTIFACT_PATHS = new Set([
  '.playbook/contracts-registry.json',
  '.playbook/cycle-history.json',
  '.playbook/cycle-state.json',
  '.playbook/improvement-candidates.json',
  '.playbook/learning-state.json',
  '.playbook/module-owners.json',
  '.playbook/pattern-knowledge-graph.json',
  '.playbook/policy-apply-result.json',
  '.playbook/policy-evaluation.json',
  '.playbook/pr-review.json',
  '.playbook/repo-graph.json',
  '.playbook/repo-index.json',
  '.playbook/session.json',
  '.playbook/stories.json',
  '.playbook/system-map.json',
  '.playbook/test-autofix-history.json'
]);

const isStableContractArtifactPath = (filePath: string): boolean => {
  if (!filePath.startsWith('.playbook/')) {
    return false;
  }

  if (EPHEMERAL_RUNTIME_ARTIFACT_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
    return false;
  }

  return STABLE_CONTRACT_ARTIFACT_PATHS.has(filePath);
};

const CONTRACT_SURFACE_PATTERNS: Array<{
  category: ContractImpactCategory;
  match: (filePath: string) => boolean;
}> = [
  {
    category: 'schema-registry',
    match: (filePath) => filePath.startsWith('packages/contracts/src/') || filePath === 'packages/cli/src/commands/contracts.ts' || filePath === 'packages/engine/src/schema/cliSchemas.ts'
  },
  {
    category: 'knowledge-list',
    match: (filePath) => filePath.startsWith('packages/cli/src/commands/knowledge/') || filePath === 'packages/engine/src/query/knowledge.ts' || filePath === 'packages/contracts/src/knowledge.schema.json' || filePath === 'docs/commands/knowledge.md'
  },
  {
    category: 'cli-json-output',
    match: (filePath) => filePath.startsWith('packages/cli/src/commands/') || filePath.startsWith('packages/engine/src/formatters/') || filePath === 'packages/engine/src/schema/cliSchemas.ts'
  },
  {
    category: 'persisted-artifact',
    match: (filePath) =>
      isStableContractArtifactPath(filePath) ||
      filePath.startsWith('packages/engine/src/observer/') ||
      filePath.startsWith('packages/engine/src/session') ||
      filePath.startsWith('packages/cli/src/lib/jsonArtifact')
  },
  {
    category: 'snapshot-fixture',
    match: (filePath) => filePath.startsWith('tests/contracts/') || filePath.startsWith('packages/cli/test/')
  }
];

const CONTRACT_REQUIRED_UPDATES: Record<ContractImpactCategory, string> = {
  'schema-registry': 'Update schema registry/contracts surfaces and keep entry ordering deterministic.',
  'knowledge-list': 'Refresh knowledge list/query snapshots and docs if knowledge records or ordering changed.',
  'cli-json-output': 'Run focused CLI contract coverage and refresh snapshots before the full suite.',
  'persisted-artifact': 'Review artifact ids/paths/versions for intentional compatibility and deterministic ordering.',
  'snapshot-fixture': 'Treat snapshot fixture edits as implementation work, not end-of-run cleanup.'
};

const deriveContractSurface = (changedFiles: string[]): AnalyzePullRequestResult['contractSurface'] => {
  const categories = CONTRACT_SURFACE_PATTERNS
    .filter(({ match }) => changedFiles.some((filePath) => match(filePath)))
    .map(({ category }) => category)
    .filter((category, index, array) => array.indexOf(category) === index)
    .sort((left, right) => left.localeCompare(right));

  const changedContractFiles = changedFiles
    .filter((filePath) => CONTRACT_SURFACE_PATTERNS.some(({ match }) => match(filePath)))
    .sort((left, right) => left.localeCompare(right));

  return {
    hasImpact: categories.length > 0,
    categories,
    changedFiles: changedContractFiles,
    requiredUpdates: categories.map((category) => CONTRACT_REQUIRED_UPDATES[category]),
    changelogUpdated: changedFiles.includes('docs/CHANGELOG.md')
  };
};

const deriveRelatedRules = (input: {
  candidateRules: string[];
  changedFiles: string[];
  affectedModules: string[];
  boundariesTouched: string[];
  ownersList: Array<{
    ruleId: string;
    area: string;
  }>;
}): string[] => {
  const docsTouched = input.changedFiles.some((filePath) => isDocsPath(filePath));
  const sourceTouched = input.changedFiles.some((filePath) => filePath.startsWith('src/'));
  const playbookArtifactTouched = input.changedFiles.some((filePath) => filePath.startsWith('.playbook/'));
  const automationTouched = input.changedFiles.some((filePath) => filePath.startsWith('.github/'));
  const docsOnlyChange = input.changedFiles.length > 0 && input.changedFiles.every((filePath) => isDocsPath(filePath));
  const ownerAreaByRule = new Map(input.ownersList.map((entry) => [entry.ruleId, entry.area.toLowerCase()]));

  return uniqueSorted(
    input.candidateRules.filter((ruleId) => {
      const ownerArea = ownerAreaByRule.get(ruleId);

      if (docsOnlyChange) {
        return ownerArea === 'documentation';
      }

      if (!ownerArea) {
        return sourceTouched || input.affectedModules.length > 0 || input.boundariesTouched.length > 1;
      }

      if (ownerArea === 'documentation') {
        return docsTouched;
      }

      if (ownerArea === 'governance') {
        return sourceTouched || playbookArtifactTouched || input.affectedModules.length > 0;
      }

      if (ownerArea === 'quality' || ownerArea === 'testing') {
        return sourceTouched || automationTouched || input.affectedModules.length > 0;
      }

      return sourceTouched || input.affectedModules.length > 0 || input.boundariesTouched.length > 1;
    })
  );
};

const deriveReviewGuidance = (analysis: {
  affectedModules: string[];
  docsChanged: string[];
  riskLevel: RiskLevel;
  relatedRules: string[];
  boundariesTouched: string[];
  contractSurface: AnalyzePullRequestResult['contractSurface'];
}): string[] => {
  const guidance: string[] = [
    'Run `playbook verify --json` before merge to validate governance and testing expectations.',
    'If verify produces failures, follow the canonical flow `playbook plan --json` -> `playbook apply --from-plan .playbook/plan.json` -> `playbook verify --json`.'
  ];

  if (analysis.affectedModules.length > 0) {
    guidance.push(`Re-check module impact for changed modules with \`playbook query impact <module>\` (${analysis.affectedModules.join(', ')}).`);
  }

  if (analysis.riskLevel !== 'low') {
    guidance.push('Risk is elevated for this change set; run `playbook doctor --json` and review module risk reasoning before merge.');
  }

  if (analysis.docsChanged.length === 0) {
    guidance.push('No docs were changed in this diff; consider whether `README.md` or module docs need updates.');
  }

  if (analysis.relatedRules.length > 0) {
    guidance.push(`Validate rule ownership review for related rules: ${analysis.relatedRules.join(', ')}.`);
  }

  if (analysis.boundariesTouched.length > 1) {
    guidance.push(`Multiple repository boundaries are touched (${analysis.boundariesTouched.join(', ')}); prioritize architecture-aware review.`);
  }

  if (analysis.contractSurface.hasImpact) {
    guidance.push(`Contract-surface impact detected (${analysis.contractSurface.categories.join(', ')}); update machine-readable artifacts and snapshots in the same implementation pass.`);
    guidance.push('Run `pnpm exec vitest run packages/cli/test/cliContracts.test.ts` before broader verification when contract surfaces change.');

    if (!analysis.contractSurface.changelogUpdated) {
      guidance.push('Add a `docs/CHANGELOG.md` note for intentional contract-surface expansion before merge.');
    }
  }

  return guidance;
};

const shouldExcludeChangedFile = (
  filePath: string,
  options?: { excludePaths?: string[]; excludePrefixes?: string[] }
): boolean => {
  const excludePaths = options?.excludePaths ?? [];
  if (excludePaths.includes(filePath)) {
    return true;
  }

  const excludePrefixes = options?.excludePrefixes ?? [];
  return excludePrefixes.some((prefix) => filePath.startsWith(prefix));
};

export const analyzePullRequest = (
  projectRoot: string,
  options?: { baseRef?: string; excludePaths?: string[]; excludePrefixes?: string[] }
): AnalyzePullRequestResult => {
  let diffContext;
  let repositoryIndex;

  try {
    diffContext = resolveDiffAskContext(projectRoot, { baseRef: options?.baseRef });
    repositoryIndex = readIndexedRepository(projectRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = toAnalyzePrError(message);

    captureMemoryEventSafe(projectRoot, {
      kind: 'failure_ingest',
      sources: [{ type: 'command', reference: 'analyze-pr' }],
      scope: { modules: [], ruleIds: [] },
      riskSummary: {
        level: 'high',
        signals: ['analyze-pr-bootstrap-failure']
      },
      outcome: {
        status: 'failure',
        summary: normalized.message
      },
      salienceInputs: {
        command: 'analyze-pr',
        baseRef: options?.baseRef ?? null
      }
    });

    throw normalized;
  }

  const changedFiles = diffContext.changedFiles.filter((filePath) => !shouldExcludeChangedFile(filePath, options));
  if (changedFiles.length === 0) {
    throw new Error('playbook analyze-pr: no changed files remained after excluding runtime-generated review artifacts.');
  }

  const affectedModules = [...diffContext.affectedModules];

  const impact = affectedModules.map((moduleName) => {
    const moduleContext = resolveIndexedModuleContext(projectRoot, moduleName, { unknownModulePrefix: 'playbook analyze-pr' });

    return {
      module: moduleName,
      dependencies: moduleContext.impact.dependencies,
      directDependents: moduleContext.impact.directDependents,
      dependents: moduleContext.impact.dependents
    };
  });

  const moduleRisk = diffContext.risk.moduleRisk.map((risk) => ({
    module: risk.module,
    level: risk.level,
    score: risk.score,
    signals: [...risk.signals]
  }));

  const docsChanged = uniqueSorted(diffContext.docs.filter((filePath) => changedFiles.includes(filePath)));

  const docsCoverage = affectedModules
    .map((moduleName) => queryDocsCoverage(projectRoot, moduleName).modules[0])
    .filter((entry): entry is { module: string; documented: boolean; sources: string[] } => Boolean(entry));

  const recommendedReview = uniqueSorted([...docsCoverage.flatMap((entry) => entry.sources), ...docsChanged]);

  const allRuleOwners = queryRuleOwners();
  const ownersList = 'rules' in allRuleOwners ? allRuleOwners.rules : [];
  const boundariesTouched = deriveArchitectureBoundaries(changedFiles);
  const relatedRules = deriveRelatedRules({
    candidateRules: repositoryIndex.rules,
    changedFiles,
    affectedModules,
    boundariesTouched,
    ownersList
  });
  const relatedRuleOwners = ownersList.filter((entry) => relatedRules.includes(entry.ruleId));

  const moduleOwnersResult = queryModuleOwners(projectRoot);
  const moduleOwnersList = 'modules' in moduleOwnersResult ? moduleOwnersResult.modules : [];
  const affectedModuleOwners = moduleOwnersList
    .filter((entry) => affectedModules.includes(entry.name))
    .map((entry) => ({ module: entry.name, owners: entry.owners, area: entry.area }));

  const riskLevel = resolveRiskLevel(moduleRisk.map((entry) => entry.level));
  const riskSignals = uniqueSorted(moduleRisk.flatMap((entry) => entry.signals));

  const contractSurface = deriveContractSurface(changedFiles);

  const reviewGuidance = deriveReviewGuidance({
    affectedModules,
    docsChanged,
    riskLevel,
    relatedRules,
    boundariesTouched,
    contractSurface
  });
  const changedLineMap = resolveChangedLineMap(projectRoot, diffContext.baseRef, changedFiles);

  const findings: AnalyzePullRequestResult['findings'] = [];
  for (const moduleRiskEntry of moduleRisk) {
    if (moduleRiskEntry.level === 'low') {
      continue;
    }

    const moduleFile = changedFiles.find((file) => file.startsWith(`src/${moduleRiskEntry.module}/`));
    const moduleLine = moduleFile ? changedLineMap.get(moduleFile) : undefined;
    findings.push({
      ruleId: 'playbook.pr.risk.module',
      severity: moduleRiskEntry.level === 'high' ? 'error' : 'warning',
      message: `Risk level for module "${moduleRiskEntry.module}" is ${moduleRiskEntry.level}.`,
      recommendation: 'Review module risk signals and run `playbook doctor --json` before merge.',
      ...(moduleFile ? { file: moduleFile } : {}),
      ...(typeof moduleLine === 'number' ? { line: moduleLine } : {})
    });
  }

  for (const ruleId of relatedRules) {
    const firstChangedFile = changedFiles[0];
    const changedLine = firstChangedFile ? changedLineMap.get(firstChangedFile) : undefined;
    findings.push({
      ruleId,
      severity: 'warning',
      message: `Related governance rule requires review: ${ruleId}.`,
      recommendation: 'Run `playbook verify --json` and resolve any findings before merge.',
      ...(firstChangedFile ? { file: firstChangedFile } : {}),
      ...(typeof changedLine === 'number' ? { line: changedLine } : {})
    });
  }

  if (contractSurface.hasImpact) {
    const firstContractFile = contractSurface.changedFiles[0];
    const contractLine = firstContractFile ? changedLineMap.get(firstContractFile) : undefined;
    findings.push({
      ruleId: 'playbook.pr.contract-surface',
      severity: contractSurface.changelogUpdated ? 'info' : 'warning',
      message: `Contract-surface change detected: ${contractSurface.categories.join(', ')}.`,
      recommendation: contractSurface.changelogUpdated
        ? 'Run focused contract checks first and confirm snapshots/registry ordering are intentional.'
        : 'Update contract artifacts/snapshots in the same PR and add a docs/CHANGELOG.md note before merge.',
      ...(firstContractFile ? { file: firstContractFile } : {}),
      ...(typeof contractLine === 'number' ? { line: contractLine } : {})
    });
  }

  const preventionGuidance = derivePreventionGuidance(projectRoot, {
    affectedModules,
    relatedRules,
    findings
  });

  const result: AnalyzePullRequestResult = {
    schemaVersion: '1.0',
    command: 'analyze-pr',
    baseRef: diffContext.baseRef,
    changedFiles,
    summary: {
      changedFileCount: changedFiles.length,
      affectedModuleCount: affectedModules.length,
      riskLevel
    },
    affectedModules,
    impact,
    architecture: {
      boundariesTouched
    },
    risk: {
      level: riskLevel,
      signals: riskSignals,
      moduleRisk
    },
    docs: {
      changed: docsChanged,
      recommendedReview
    },
    rules: {
      related: relatedRules,
      owners: relatedRuleOwners
    },
    moduleOwners: affectedModuleOwners,
    findings,
    reviewGuidance,
    contractSurface,
    preventionGuidance,
    context: {
      sources: [
        { type: 'git-diff', baseRef: diffContext.baseRef },
        { type: 'repo-index', path: '.playbook/repo-index.json' },
        { type: 'module-impact', modules: affectedModules },
        { type: 'module-risk', modules: affectedModules },
        { type: 'docs-coverage', modules: affectedModules },
        { type: 'module-owners', path: moduleOwnersList.length > 0 ? '.playbook/module-owners.json' : 'generated-default' },
        { type: 'rule-owners', rules: relatedRules },
        { type: 'promoted-knowledge', knowledgeIds: preventionGuidance.map((entry) => entry.provenance.knowledgeId) }
      ]
    }
  };

  captureMemoryEventSafe(projectRoot, {
    kind: 'pr_analysis',
    sources: [
      { type: 'command', reference: 'analyze-pr' },
      { type: 'artifact', reference: '.playbook/repo-index.json' },
      { type: 'artifact', reference: '.playbook/module-owners.json' },
      { type: 'artifact', reference: '.playbook/memory/events' },
      { type: 'artifact', reference: '.playbook/analyze-pr.json' }
    ],
    scope: { modules: result.affectedModules, ruleIds: result.rules.related },
    riskSummary: {
      level: result.risk.level,
      signals: result.risk.signals
    },
    outcome: {
      status: 'success',
      summary: 'analyze-pr completed',
      metrics: {
        changedFileCount: result.summary.changedFileCount,
        affectedModuleCount: result.summary.affectedModuleCount,
        findingCount: result.findings.length
      }
    },
    salienceInputs: {
      command: 'analyze-pr',
      baseRef: result.baseRef,
      boundariesTouched: result.architecture.boundariesTouched,
      docsChangedCount: result.docs.changed.length,
      trigger: `analyze-pr:${result.baseRef}`,
      triggerChangedFileCount: result.changedFiles.length,
      triggerAffectedModuleCount: result.affectedModules.length,
      contractSurfaceCategories: result.contractSurface.categories,
      contractSurfaceChangedFileCount: result.contractSurface.changedFiles.length,
      findingClasses: uniqueSorted(result.findings.map((finding) => classifyFinding(finding))),
      actionClassSummary: summarizeActionClasses(result.reviewGuidance, result.findings),
      evidenceRefs: uniqueSorted([
        '.playbook/analyze-pr.json',
        '.playbook/repo-index.json',
        '.playbook/module-owners.json',
        ...result.changedFiles.map((filePath) => `git:${filePath}`),
        ...result.findings
          .map((finding) => finding.file)
          .filter((filePath): filePath is string => typeof filePath === 'string' && filePath.length > 0)
          .map((filePath) => `git:${filePath}`)
      ])
    }
  });

  return result;
};
