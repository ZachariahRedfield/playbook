import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryGraph } from '../graph/repoGraph.js';
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
  graph?: RepositoryGraph;
  artifacts?: OptionalArtifacts;
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

const graphModuleNodes = (graph?: RepositoryGraph): string[] =>
  (graph?.nodes ?? []).filter((node) => node.kind === 'module').map((node) => node.id).sort((a, b) => a.localeCompare(b));

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

const toCandidatesFromPlan = (artifact: unknown): CompactionCandidate[] => {
  const record = asRecord(artifact);
  const tasks = asArray(record?.tasks);

  return tasks.map((task, index) =>
    canonicalizeCandidate({
      sourceKind: 'plan',
      sourceRef: '.playbook/plan.json',
      subjectKind: 'task',
      subjectRef: asString(task.id) || `plan-task-${index}`,
      trigger: asString(task.ruleId),
      mechanism: asString(task.action),
      response: asString(task.autoFix) === 'true' || task.autoFix === true ? 'run apply for deterministic autofix' : 'manual remediation required',
      evidence: [
        {
          sourceKind: 'plan',
          sourceRef: '.playbook/plan.json',
          pointer: `tasks[${index}]`,
          summary: `${asString(task.action)} file=${asString(task.file)}`
        }
      ],
      related: {
        rules: asString(task.ruleId) ? [asString(task.ruleId)] : [],
        docs: asString(task.file).startsWith('docs/') ? [asString(task.file)] : [],
        tests: asString(task.file).includes('test') ? [asString(task.file)] : []
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

const toCandidatesFromAnalyzePr = (artifact: unknown): CompactionCandidate[] => {
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
      related: {
        modules: affectedModules,
        riskSignals
      }
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

  const candidates: CompactionCandidate[] = [
    ...toCandidatesFromVerify(artifactInputs.verify, graphNodes),
    ...toCandidatesFromPlan(artifactInputs.plan),
    ...toCandidatesFromApply(artifactInputs.apply),
    ...toCandidatesFromAnalyzePr(artifactInputs['analyze-pr']),
    ...toCandidatesFromDocsAudit(artifactInputs['docs-audit'])
  ];

  return candidates.sort(byCandidateOrder);
};
