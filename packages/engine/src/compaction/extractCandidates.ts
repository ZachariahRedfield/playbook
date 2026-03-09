import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryGraph } from '../graph/repoGraph.js';
import type { RepositoryIndex } from '../indexer/repoIndexer.js';
import { MODULE_CONTEXT_DIR_RELATIVE_PATH } from '../context/moduleContext.js';
import { canonicalizeCandidate } from './canonicalizeCandidate.js';
import type { CandidateSourceKind, CompactionCandidate } from './candidateTypes.js';

type OptionalArtifacts = {
  verify?: unknown;
  plan?: unknown;
  apply?: unknown;
  analyzePr?: unknown;
  docsAudit?: unknown;
};

type ExtractOptions = {
  repoRoot: string;
  index?: RepositoryIndex;
  graph?: RepositoryGraph;
  artifacts?: OptionalArtifacts;
};

type ModuleEnrichment = {
  byName: Map<string, { docs: string[]; tests: string[]; riskSignals: string[] }>;
};

const readJsonIfExists = (repoRoot: string, relativePath: string): unknown | undefined => {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch {
    return undefined;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' ? (value as Record<string, unknown>) : null);
const asArray = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') as Record<string, unknown>[] : []);
const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);

const boolLike = (value: unknown): boolean => value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');

const graphModuleNodes = (graph?: RepositoryGraph): string[] =>
  (graph?.nodes ?? []).filter((node) => node.kind === 'module').map((node) => node.id).sort((a, b) => a.localeCompare(b));

const findModuleForPath = (filePath: string, modules: string[]): string | undefined => {
  const normalized = filePath.replace(/\\/g, '/');
  return modules.find((moduleName) => {
    const pkgName = moduleName.startsWith('@') ? moduleName.split('/').pop() ?? moduleName : moduleName;
    const token = pkgName.replace(/^playbook-/, '');
    return normalized.includes(pkgName) || normalized.includes(`/${token}/`) || normalized.includes(`/${token}.`);
  });
};


const readModuleEnrichment = (repoRoot: string): ModuleEnrichment => {
  const byName = new Map<string, { docs: string[]; tests: string[]; riskSignals: string[] }>();
  const contextDir = path.join(repoRoot, MODULE_CONTEXT_DIR_RELATIVE_PATH);
  if (!fs.existsSync(contextDir) || !fs.statSync(contextDir).isDirectory()) {
    return { byName };
  }

  const files = fs.readdirSync(contextDir).filter((entry) => entry.endsWith('.json')).sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    try {
      const record = asRecord(JSON.parse(fs.readFileSync(path.join(contextDir, file), 'utf8')));
      const moduleName = asString(asRecord(record?.module)?.name);
      if (!moduleName) continue;
      byName.set(moduleName, {
        docs: asStringArray(record?.docs),
        tests: asStringArray(record?.tests),
        riskSignals: asStringArray(asRecord(record?.risk)?.signals)
      });
    } catch {
      continue;
    }
  }

  return { byName };
};

const toCandidatesFromVerify = (artifact: unknown, graphNodes: string[]): CompactionCandidate[] => {
  const record = asRecord(artifact);
  const failures = asArray(record?.failures);

  return failures.map((failure, index) =>
    canonicalizeCandidate({
      sourceKind: 'verify',
      sourceRef: '.playbook/verify.json',
      subjectKind: 'rule',
      subjectRef: asString(failure.id) || `verify-failure-${index}`,
      trigger: asString(failure.id),
      mechanism: asString(failure.message),
      response: asString(failure.fix) || 'apply deterministic remediation plan task',
      evidence: [
        {
          sourceKind: 'verify',
          sourceRef: '.playbook/verify.json',
          pointer: `failures[${index}]`,
          summary: `${asString(failure.message)} ${asString(failure.evidence)}`
        }
      ],
      related: {
        rules: asString(failure.id) ? [asString(failure.id)] : [],
        graphNodes
      }
    })
  );
};

const toCandidatesFromPlan = (artifact: unknown, modules: string[], moduleEnrichment: ModuleEnrichment): CompactionCandidate[] => {
  const record = asRecord(artifact);
  const tasks = asArray(record?.tasks);

  const moduleNames = [...modules].sort((a, b) => a.localeCompare(b));

  return tasks.map((task, index) =>
    canonicalizeCandidate({
      sourceKind: 'plan',
      sourceRef: '.playbook/plan.json',
      subjectKind: 'task',
      subjectRef: asString(task.id) || `plan-task-${index}`,
      trigger: asString(task.ruleId),
      mechanism: asString(task.action),
      response: boolLike(task.autoFix) ? 'run apply for deterministic autofix' : 'manual remediation required',
      evidence: [
        {
          sourceKind: 'plan',
          sourceRef: '.playbook/plan.json',
          pointer: `tasks[${index}]`,
          summary: `${asString(task.action)} file=${asString(task.file)}`
        }
      ],
      related: {
        modules: (() => {
          const file = asString(task.file);
          const moduleName = file ? findModuleForPath(file, moduleNames) : undefined;
          return moduleName ? [moduleName] : [];
        })(),
        rules: asString(task.ruleId) ? [asString(task.ruleId)] : [],
        docs: (() => {
          const file = asString(task.file);
          if (file.startsWith('docs/')) return [file];
          const moduleName = file ? findModuleForPath(file, moduleNames) : undefined;
          return moduleName ? (moduleEnrichment.byName.get(moduleName)?.docs ?? []) : [];
        })(),
        tests: (() => {
          const file = asString(task.file);
          if (file.includes('test')) return [file];
          const moduleName = file ? findModuleForPath(file, moduleNames) : undefined;
          return moduleName ? (moduleEnrichment.byName.get(moduleName)?.tests ?? []) : [];
        })(),
        riskSignals: (() => {
          const moduleName = findModuleForPath(asString(task.file), moduleNames);
          return moduleName ? (moduleEnrichment.byName.get(moduleName)?.riskSignals ?? []) : [];
        })()
      }
    })
  );
};

const toCandidatesFromDocsAudit = (artifact: unknown): CompactionCandidate[] => {
  const record = asRecord(artifact);
  const findings = asArray(record?.findings);

  return findings.map((finding, index) =>
    canonicalizeCandidate({
      sourceKind: 'docs-audit',
      sourceRef: '.playbook/docs-audit.json',
      subjectKind: 'docs',
      subjectRef: asString(finding.path) || `docs-finding-${index}`,
      trigger: asString(finding.ruleId),
      mechanism: asString(finding.message),
      response: asString(finding.recommendation) || 'align docs with canonical command truth',
      evidence: [
        {
          sourceKind: 'docs-audit',
          sourceRef: '.playbook/docs-audit.json',
          pointer: `findings[${index}]`,
          summary: `${asString(finding.level)} ${asString(finding.message)}`
        }
      ],
      related: {
        docs: asString(finding.path) ? [asString(finding.path)] : []
      }
    })
  );
};

const toCandidatesFromAnalyzePr = (artifact: unknown, modules: string[], moduleEnrichment: ModuleEnrichment): CompactionCandidate[] => {
  const record = asRecord(artifact);
  const findings = asArray(record?.findings);
  const affectedModules = Array.isArray(record?.affectedModules) ? (record?.affectedModules as string[]).filter((entry) => typeof entry === 'string') : [];
  const riskSignals = Array.isArray(asRecord(record?.risk)?.signals) ? ((asRecord(record?.risk)?.signals as unknown[])
    .filter((entry) => typeof entry === 'string') as string[]) : [];

  return findings.map((finding, index) =>
    canonicalizeCandidate({
      sourceKind: 'analyze-pr',
      sourceRef: '.playbook/analyze-pr.json',
      subjectKind: 'module',
      subjectRef: asString(finding.file) || affectedModules[0] || `analyze-pr-finding-${index}`,
      trigger: asString(finding.ruleId) || 'analyze-pr-finding',
      mechanism: asString(finding.message),
      response: asString(finding.recommendation) || 'review module risk and ownership context',
      evidence: [
        {
          sourceKind: 'analyze-pr',
          sourceRef: '.playbook/analyze-pr.json',
          pointer: `findings[${index}]`,
          summary: `${asString(finding.severity)} ${asString(finding.message)}`
        }
      ],
      related: (() => {
        const inferredFromFile = findModuleForPath(asString(finding.file), modules);
        const allModules = Array.from(new Set([...affectedModules, ...(inferredFromFile ? [inferredFromFile] : [])])).sort((a, b) => a.localeCompare(b));
        return {
          modules: allModules,
          docs: allModules.flatMap((moduleName) => moduleEnrichment.byName.get(moduleName)?.docs ?? []),
          tests: allModules.flatMap((moduleName) => moduleEnrichment.byName.get(moduleName)?.tests ?? []),
          riskSignals: [...riskSignals, ...allModules.flatMap((moduleName) => moduleEnrichment.byName.get(moduleName)?.riskSignals ?? [])]
        };
      })()
    })
  );
};

const toCandidatesFromApply = (artifact: unknown): CompactionCandidate[] => {
  const record = asRecord(artifact);
  const results = asArray(record?.results);
  return results.map((result, index) =>
    canonicalizeCandidate({
      sourceKind: 'apply',
      sourceRef: '.playbook/apply.json',
      subjectKind: 'artifact',
      subjectRef: asString(result.taskId) || `apply-result-${index}`,
      trigger: asString(result.status) || 'apply-result',
      mechanism: asString(result.summary) || asString(result.message),
      evidence: [
        {
          sourceKind: 'apply',
          sourceRef: '.playbook/apply.json',
          pointer: `results[${index}]`,
          summary: asString(result.summary) || asString(result.message) || 'apply result'
        }
      ],
      related: {
        tests: Array.isArray(result.filesChanged) ? (result.filesChanged as string[]) : []
      }
    })
  );
};

const byCandidateOrder = (left: CompactionCandidate, right: CompactionCandidate): number =>
  left.sourceKind.localeCompare(right.sourceKind) ||
  left.subjectKind.localeCompare(right.subjectKind) ||
  left.subjectRef.localeCompare(right.subjectRef) ||
  left.canonical.fingerprint.localeCompare(right.canonical.fingerprint);

export const extractCompactionCandidates = (options: ExtractOptions): CompactionCandidate[] => {
  const artifactInputs: Record<CandidateSourceKind, unknown | undefined> = {
    verify: options.artifacts?.verify ?? readJsonIfExists(options.repoRoot, '.playbook/verify.json'),
    plan: options.artifacts?.plan ?? readJsonIfExists(options.repoRoot, '.playbook/plan.json'),
    apply: options.artifacts?.apply ?? readJsonIfExists(options.repoRoot, '.playbook/apply.json'),
    'analyze-pr': options.artifacts?.analyzePr ?? readJsonIfExists(options.repoRoot, '.playbook/analyze-pr.json'),
    'docs-audit': options.artifacts?.docsAudit ?? readJsonIfExists(options.repoRoot, '.playbook/docs-audit.json')
  };

  const graphNodes = graphModuleNodes(options.graph);
  const modules = options.index?.modules.map((entry) => entry.name) ?? [];
  const moduleEnrichment = readModuleEnrichment(options.repoRoot);

  const candidates: CompactionCandidate[] = [
    ...toCandidatesFromVerify(artifactInputs.verify, graphNodes),
    ...toCandidatesFromPlan(artifactInputs.plan, modules, moduleEnrichment),
    ...toCandidatesFromApply(artifactInputs.apply),
    ...toCandidatesFromAnalyzePr(artifactInputs['analyze-pr'], modules, moduleEnrichment),
    ...toCandidatesFromDocsAudit(artifactInputs['docs-audit'])
  ];

  return candidates.sort(byCandidateOrder);
};
