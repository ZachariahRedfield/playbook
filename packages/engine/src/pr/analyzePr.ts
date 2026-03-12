import { queryDocsCoverage } from '../query/docsCoverage.js';
import { readIndexedRepository, resolveIndexedModuleContext } from '../query/moduleIntelligence.js';
import { queryModuleOwners } from '../query/moduleOwners.js';
import { queryRuleOwners } from '../query/ruleOwners.js';
import { resolveDiffAskContext } from '../ask/diffContext.js';
import { execFileSync } from 'node:child_process';
import { resolveScmDiffBase } from '../git/context.js';
import { captureMemoryEventSafe } from '../memory/index.js';

type RiskLevel = 'low' | 'medium' | 'high';

type AnalyzePrContextSource =
  | { type: 'git-diff'; baseRef: string }
  | { type: 'repo-index'; path: '.playbook/repo-index.json' }
  | { type: 'module-impact'; modules: string[] }
  | { type: 'module-risk'; modules: string[] }
  | { type: 'docs-coverage'; modules: string[] }
  | { type: 'module-owners'; path: '.playbook/module-owners.json' | 'generated-default' }
  | { type: 'rule-owners'; rules: string[] };

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
  context: {
    sources: AnalyzePrContextSource[];
  };
};

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

  return guidance;
};

export const analyzePullRequest = (projectRoot: string, options?: { baseRef?: string }): AnalyzePullRequestResult => {
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
      subjectModules: [],
      ruleIds: [],
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

  const docsChanged = uniqueSorted(diffContext.docs);

  const docsCoverage = affectedModules
    .map((moduleName) => queryDocsCoverage(projectRoot, moduleName).modules[0])
    .filter((entry): entry is { module: string; documented: boolean; sources: string[] } => Boolean(entry));

  const recommendedReview = uniqueSorted([...docsCoverage.flatMap((entry) => entry.sources), ...docsChanged]);

  const allRuleOwners = queryRuleOwners();
  const ownersList = 'rules' in allRuleOwners ? allRuleOwners.rules : [];
  const boundariesTouched = deriveArchitectureBoundaries(diffContext.changedFiles);
  const relatedRules = deriveRelatedRules({
    candidateRules: repositoryIndex.rules,
    changedFiles: diffContext.changedFiles,
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

  const reviewGuidance = deriveReviewGuidance({
    affectedModules,
    docsChanged,
    riskLevel,
    relatedRules,
    boundariesTouched
  });
  const changedLineMap = resolveChangedLineMap(projectRoot, diffContext.baseRef, diffContext.changedFiles);

  const findings: AnalyzePullRequestResult['findings'] = [];
  for (const moduleRiskEntry of moduleRisk) {
    if (moduleRiskEntry.level === 'low') {
      continue;
    }

    const moduleFile = diffContext.changedFiles.find((file) => file.startsWith(`src/${moduleRiskEntry.module}/`));
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
    const firstChangedFile = diffContext.changedFiles[0];
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

  const result: AnalyzePullRequestResult = {
    schemaVersion: '1.0',
    command: 'analyze-pr',
    baseRef: diffContext.baseRef,
    changedFiles: diffContext.changedFiles,
    summary: {
      changedFileCount: diffContext.changedFiles.length,
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
    context: {
      sources: [
        { type: 'git-diff', baseRef: diffContext.baseRef },
        { type: 'repo-index', path: '.playbook/repo-index.json' },
        { type: 'module-impact', modules: affectedModules },
        { type: 'module-risk', modules: affectedModules },
        { type: 'docs-coverage', modules: affectedModules },
        { type: 'module-owners', path: moduleOwnersList.length > 0 ? '.playbook/module-owners.json' : 'generated-default' },
        { type: 'rule-owners', rules: relatedRules }
      ]
    }
  };

  captureMemoryEventSafe(projectRoot, {
    kind: 'pr_analysis',
    sources: [
      { type: 'command', reference: 'analyze-pr' },
      { type: 'artifact', reference: '.playbook/repo-index.json' }
    ],
    subjectModules: result.affectedModules,
    ruleIds: result.rules.related,
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
      docsChangedCount: result.docs.changed.length
    }
  });

  return result;
};
