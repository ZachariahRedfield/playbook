export type { SessionContract, SessionPinnedArtifact, SessionPinnedArtifactKind, SessionStep, ResumeSessionResult } from './contracts/session.js';
export type { ArchitectureRegistry, ArtifactLineage, ArtifactOwnership, CommandInspection, Subsystem, SubsystemDependencies } from './architecture/types.js';
export type { ArtifactOwnershipDetails, CommandInspectionDetails, SubsystemOwnership } from './architecture/introspection.js';
export type { ExecutionIntent, ExecutionRun, ExecutionStep, ExecutionEvidence, ExecutionOutcome, ExecutionCheckpoint, ExecutionStepKind, ExecutionStepStatus, ExecutionRequestedBy } from './contracts/execution.js';
export type { RouteDecision, RouteMutabilityLevel, RouteSafetyConstraints, RouteTaskInput, RouteTaskKind, TaskRoute } from './contracts/routing.js';
export type { AttractorScoreBreakdown, CandidatePattern, PromotedPattern, PromotionDecision, PromotionReviewRecord } from './contracts/patternPromotion.js';
export type { CrossRepoPatternEvidenceArtifact, PatternPortabilityContract, PatternPortabilityEntry, PortabilityArtifactInput } from './contracts/patternPortabilityContract.js';
export type { TransferReadinessArtifact, TransferReadinessEntry, TransferReadinessGovernanceAlignment, TransferReadinessPresence, TransferReadinessRecommendation, TransferReadinessValidationCoverage } from './contracts/transferReadinessContract.js';
export type { LaneRuntime, LaneRuntimeState } from './execution/types.js';
export type { LaneOutcomeScore, RouterAccuracyMetric, CommandSuccessStatus, CommandExecutionQualityRecord, CommandExecutionQualitySummary, CommandExecutionQualityArtifact } from './telemetry/types.js';
export type { CompactedLearningSummary, LearningCompactionTimeWindow, LearningLanePattern, LearningRecurringSignal, LearningRoutePattern, LearningValidationPattern, PatternPortabilityScore, PortabilityConfidenceRecalibrationSummary, PortabilityDecisionStatus, PortabilityAdoptionStatus, PortabilityObservedOutcome, PortabilityOutcomeTelemetryRecord, TransferPlanGatingTier, TransferPlanRecord, TransferPlanArtifact } from './learning/types.js';
export type {
  CandidateKnowledgeRecord,
  EventFingerprint,
  MemoryArtifactKind,
  MemoryEvent,
  MemoryKnowledgeRecord,
  MemoryLifecycleState,
  MemorySchemaMetadata,
  PromotedKnowledgeRecord,
  RetiredKnowledgeRecord,
  SalienceScoreEnvelope,
  SessionEvidenceReference,
  SupersessionRetirementMetadata
} from './contracts/memory.js';
export type {
  AgentDescriptor,
  AgentRecord,
  CompiledRuntimeTaskInput,
  ApprovalRequirementSummary,
  ApprovalState,
  ControlPlaneArtifactKind,
  ControlPlaneSchemaMetadata,
  DryRunSummaryEnvelope,
  PolicyDecisionRecord,
  PolicyState,
  QueueItem,
  RunRecord,
  RunState,
  RuntimeLogEnvelope,
  RuntimeTaskKind,
  RuntimeTaskMutabilityClass,
  TaskDependencyEdge,
  TaskRecord,
  TaskState,
  PlanRuntimeCompilationMetadata,
  PlanTaskContractInput,
  SchedulingPreviewRecord
} from './contracts/controlPlaneRuntime.js';
export type Severity = 'WARN' | 'RECOMMEND' | 'INFO';

export {
  MEMORY_CONTRACT_SCHEMA_VERSION,
  assertMemoryLifecycleTransition,
  createCandidateKnowledgeRecord,
  createEventFingerprint,
  createEventInstanceId,
  createKnowledgeRecordId,
  createMemoryEvent,
  createMemorySchemaMetadata,
  isSupportedMemorySchemaVersion,
  memoryArtifactKinds,
  memoryArtifactPaths,
  memoryLifecycleStates,
  normalizeEventFingerprintDimensions,
  promoteCandidateKnowledgeRecord,
  retirePromotedKnowledgeRecord
} from './contracts/memory.js';


export {
  CONTROL_PLANE_RUNTIME_SCHEMA_VERSION,
  approvalStates,
  assertApprovalStateTransition,
  assertRunStateTransition,
  assertTaskStateTransition,
  controlPlaneArtifactKinds,
  controlPlaneRuntimePaths,
  compilePlanTaskToRuntimeTask,
  compilePlanToRuntimeDryRun,
  createAgentId,
  createControlPlaneSchemaMetadata,
  createPlanTaskId,
  createRunId,
  createTaskId,
  policyStates,
  runtimeTaskKinds,
  runtimeTaskMutabilityClasses,
  runStates,
  taskStates
} from './contracts/controlPlaneRuntime.js';

export { createPatternPortabilityContract, toCrossRepoPatternEvidenceArtifact, validatePatternPortabilityContract, writeCrossRepoPatternEvidenceArtifact } from './contracts/patternPortabilityContract.js';
export { normalizeTransferReadinessArtifact } from './contracts/transferReadinessContract.js';

export { additiveCommandFieldSchemaRegistry, getContractsSchemaRegistry, memoryArtifactSchemaRegistry } from './contracts/schemaRegistry.js';

export { runArchitectureAudit } from './audit/architecture.js';
export { ARCHITECTURE_REGISTRY_PATH, loadArchitecture } from './architecture/loadArchitecture.js';
export { explainArtifactOwnership, explainCommandOwnership, explainSubsystemOwnership } from './architecture/introspection.js';
export { resolveArtifactConsumers, resolveArtifactLineage, resolveArtifactOwner, resolveArtifactUpstream } from './architecture/artifactLineage.js';
export { decideKnowledgeCompaction } from './knowledge/compaction/compaction-engine.js';
export { canonicalizeCanonicalKey, canonicalizeKnowledgeRecord, canonicalizeKnowledgeShape } from './knowledge/compaction/canonicalize.js';
export { compareCanonicalKnowledge } from './knowledge/compaction/compare.js';
export {
  buildKnowledgeSummary,
  getKnowledgeById,
  getKnowledgeProvenance,
  getKnowledgeTimeline,
  getStaleKnowledge,
  listKnowledge,
  queryKnowledge
} from './knowledge/store.js';
export type {
  CandidateCompactionInput,
  CanonicalKnowledgeRecord,
  CompactionDecision,
  CompactionDecisionType
} from './knowledge/compaction/compaction-types.js';
export type { RunCycle, RunCycleMetrics, RunCyclePhaseOutputs } from './knowledge/run-cycle.js';
export { createEmptyRunCycle } from './knowledge/run-cycle.js';
export type {
  KnowledgeArtifactType,
  KnowledgeProvenanceResult,
  KnowledgeQueryOptions,
  KnowledgeRecord,
  KnowledgeRecordProvenance,
  KnowledgeRecordSource,
  KnowledgeRecordStatus,
  KnowledgeSourceKind,
  KnowledgeSummary,
  KnowledgeTimelineOptions
} from './knowledge/types.js';
export type {
  ArchitectureAuditCheck,
  ArchitectureAuditCheckContext,
  ArchitectureAuditReport,
  ArchitectureAuditResult,
  ArchitectureAuditSeverity,
  ArchitectureAuditStatus,
  ArchitectureAuditSummary,
  ArchitectureAuditSummaryStatus
} from './audit/types.js';

export type { FixHandler, FixResult, PlanTask, Rule, RuleContext, RuleFailure, RuleResult, Task } from './rules.js';

export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  message: string;
  why: string;
  fix: string;
  files?: string[];
};

export type ReportFailure = {
  id: string;
  message: string;
  evidence?: string;
  fix?: string;
};

export type ReportWarning = {
  id: string;
  message: string;
};

export type VerifyResult = {
  ok: boolean;
  summary: {
    failures: number;
    warnings: number;
    baseRef?: string;
    baseSha?: string;
  };
  failures: ReportFailure[];
  warnings: ReportWarning[];
};

export type AnalyzeResult = {
  repoPath: string;
  ok: boolean;
  detectorsRun: string[];
  detected: Array<{ id: string; label: string; evidence: string[] }>;
  summary: string;
  signals: string;
  recommendations: Finding[];
  architectureSuggestions: string[];
};

export type ProjectContext = {
  repoRoot: string;
  readTextFile(pathFromRoot: string): string | undefined;
  writeTextFile(pathFromRoot: string, content: string): void;
  exists(pathFromRoot: string): boolean;
  listFiles(pathFromRoot: string): string[];
  resolveDiffBase(): { baseRef?: string; baseSha?: string; warning?: string };
  getChangedFiles(baseSha: string): string[];
};

type PackageJson = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
type PlaybookConfig = {
  verify: {
    rules: {
      requireNotesOnChanges: Array<{ whenChanged: string[]; mustTouch: string[] }>;
    };
  };
};

const defaultConfig: PlaybookConfig = {
  verify: {
    rules: {
      requireNotesOnChanges: [
        { whenChanged: ['src/**', 'app/**', 'server/**', 'supabase/**'], mustTouch: ['docs/PLAYBOOK_NOTES.md'] }
      ]
    }
  }
};

const matchesGlob = (file: string, pattern: string): boolean => {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '::DS::').replace(/\*/g, '[^/]*').replace(/::DS::/g, '.*');
  return new RegExp(`^${esc}$`).test(file);
};

const matchesAny = (file: string, patterns: string[]): boolean => patterns.some((p) => matchesGlob(file, p));

const parseConfig = (raw?: string): { config: PlaybookConfig; warning?: string } => {
  if (!raw) return { config: defaultConfig, warning: 'playbook.config.json not found; using defaults (this is not an error). Add playbook.config.json for explicit settings and .playbookignore to tune scan scope.' };
  const parsed = JSON.parse(raw) as Partial<PlaybookConfig>;
  return {
    config: {
      verify: {
        rules: {
          requireNotesOnChanges: parsed.verify?.rules?.requireNotesOnChanges ?? defaultConfig.verify.rules.requireNotesOnChanges
        }
      }
    }
  };
};

export const analyze = (ctx: ProjectContext): AnalyzeResult => {
  const pkgRaw = ctx.readTextFile('package.json');
  const pkg = (pkgRaw ? JSON.parse(pkgRaw) : {}) as PackageJson;
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const detected = [
    deps.next ? { id: 'nextjs', label: 'Next.js', evidence: ['package.json: next'] } : undefined,
    deps['@supabase/supabase-js'] ? { id: 'supabase', label: 'Supabase', evidence: ['package.json: @supabase/supabase-js'] } : undefined,
    deps.tailwindcss ? { id: 'tailwind', label: 'Tailwind CSS', evidence: ['package.json: tailwindcss'] } : undefined
  ].filter((v): v is { id: string; label: string; evidence: string[] } => Boolean(v));

  const recommendations: Finding[] = detected.length
    ? [
        {
          id: 'analyze-run-verify',
          title: 'Run governance verification',
          severity: 'RECOMMEND',
          message: 'Use verify after analyze to enforce policy checks.',
          why: 'Analyze surfaces signals while verify enforces deterministic governance rules.',
          fix: 'Run `playbook verify` before opening a pull request.'
        },
        ...detected.map((item) => ({
          id: `analyze-detected-${item.id}`,
          title: `${item.label} detected`,
          severity: 'INFO' as const,
          message: `${item.label} signal detected from repository evidence.`,
          why: `${item.label} detection helps tailor architecture-aware guidance.`,
          fix: 'Review generated architecture suggestions and keep docs aligned with implementation.',
          files: ['package.json']
        }))
      ]
    : [
        {
          id: 'analyze-no-signals',
          title: 'No stack signals detected',
          severity: 'WARN',
          message: 'No known stack detectors matched this repository.',
          why: 'Without stack signals, generated guidance may miss architecture-specific checks.',
          fix: 'Add key framework/database dependencies to package.json, then rerun playbook analyze.',
          files: ['package.json']
        },
        {
          id: 'analyze-run-init',
          title: 'Initialize governance baseline',
          severity: 'RECOMMEND',
          message: 'Ensure governance docs are initialized for this repository.',
          why: 'A documented baseline keeps architecture and delivery expectations explicit.',
          fix: 'Run `playbook init` to scaffold governance docs if they do not exist.'
        }
      ];

  const architectureSuggestions = detected
    .map((item) => (item.id === 'nextjs' ? '- Framework: Next.js' : item.id === 'supabase' ? '- Database: Supabase' : item.id === 'tailwind' ? '- Styling: Tailwind CSS' : ''))
    .filter(Boolean);

  const architectureDoc = ctx.readTextFile('docs/ARCHITECTURE.md');
  const marker = '<!-- PLAYBOOK:ANALYZE_SUGGESTIONS -->';
  if (architectureDoc && architectureDoc.includes(marker) && architectureSuggestions.length) {
    const block = `${marker}\n${architectureSuggestions.join('\n')}\n`;
    const markerLineRegex = new RegExp(`${marker}\\n(?:- (?:Framework|Database|Styling): .*\\n?)*`, 'g');
    const replaced = architectureDoc.replace(markerLineRegex, block);
    if (replaced !== architectureDoc) ctx.writeTextFile('docs/ARCHITECTURE.md', replaced);
  }

  return {
    repoPath: ctx.repoRoot,
    ok: !recommendations.some((r) => r.severity === 'WARN'),
    detectorsRun: ['nextjs', 'supabase', 'tailwind'],
    detected,
    summary: detected.length ? `Detected stack:\n${detected.map((d) => `- ${d.label}`).join('\n')}` : 'Detected stack: none',
    signals: detected.length ? `${detected.length} stack signal(s): ${detected.map((d) => d.label).join(', ')}` : 'No known stack signals detected',
    recommendations,
    architectureSuggestions
  };
};

export const verify = (ctx: ProjectContext): VerifyResult => {
  const warnings: ReportWarning[] = [];
  const { config, warning } = parseConfig(ctx.readTextFile('playbook.config.json'));
  if (warning) warnings.push({ id: 'config-missing', message: warning });

  const base = ctx.resolveDiffBase();
  if (base.warning) warnings.push({ id: 'base-selection', message: base.warning });
  const changedFiles = base.baseSha ? ctx.getChangedFiles(base.baseSha) : [];

  const failures: ReportFailure[] = [];
  if (ctx.exists('docs/PROJECT_GOVERNANCE.md')) {
    const notes = ctx.readTextFile('docs/PLAYBOOK_NOTES.md');
    if (notes === undefined) {
      failures.push({ id: 'notes.missing', message: 'docs/PLAYBOOK_NOTES.md is required when docs/PROJECT_GOVERNANCE.md exists.', evidence: 'docs/PLAYBOOK_NOTES.md', fix: "Create docs/PLAYBOOK_NOTES.md and add at least one entry describing the change." });
    } else if (!notes.trim()) {
      failures.push({ id: 'notes.empty', message: 'docs/PLAYBOOK_NOTES.md exists but is empty.', evidence: 'docs/PLAYBOOK_NOTES.md', fix: "Add at least one entry (e.g., a '## YYYY-MM-DD — Summary' section)." });
    }
  }

  for (const rule of config.verify.rules.requireNotesOnChanges) {
    const triggers = changedFiles.filter((f) => matchesAny(f, rule.whenChanged));
    if (!triggers.length) continue;
    const touchedRequired = changedFiles.some((f) => matchesAny(f, rule.mustTouch));
    if (!touchedRequired) {
      failures.push({
        id: 'requireNotesOnChanges',
        message: 'Code changes require a notes update.',
        evidence: `triggered files (${triggers.length}): ${triggers.slice(0, 10).join(', ')}`,
        fix: 'Update docs/PLAYBOOK_NOTES.md with a note describing WHAT changed and WHY.'
      });
    }
  }

  return {
    ok: failures.length === 0,
    summary: { failures: failures.length, warnings: warnings.length, baseRef: base.baseRef, baseSha: base.baseSha },
    failures,
    warnings
  };
};

export const formatJson = (report: VerifyResult): string => JSON.stringify(report, null, 2);
export const formatHuman = (report: VerifyResult): string => {
  const lines: string[] = [];
  lines.push(report.ok ? '✔ Verification passed' : '✖ Verification failed');
  if (report.summary.baseRef || report.summary.baseSha) lines.push(`Base: ${report.summary.baseRef ?? 'unknown'} (${report.summary.baseSha ?? 'unknown'})`);
  if (report.failures.length) {
    lines.push('');
    for (const failure of report.failures) {
      lines.push(`[${failure.id}] ${failure.message}`);
      if (failure.evidence) lines.push(`Evidence: ${failure.evidence}`);
      if (failure.fix) lines.push(`Fix: ${failure.fix}`);
      lines.push('');
    }
  }
  if (report.warnings.length) {
    lines.push('Warnings:');
    for (const w of report.warnings) lines.push(`- [${w.id}] ${w.message}`);
  }
  return lines.join('\n').trimEnd();
};

const severityRank: Record<Severity, number> = { WARN: 0, RECOMMEND: 1, INFO: 2 };
const sortRecommendations = (recommendations: Finding[]): Finding[] => [...recommendations].sort((a, b) => (severityRank[a.severity] - severityRank[b.severity]) || a.id.localeCompare(b.id));
const formatRecommendation = (recommendation: Finding): string[] => {
  const lines = [`[${recommendation.severity}] ${recommendation.title}  (id: ${recommendation.id})`, `  Why: ${recommendation.why}`, `  Fix: ${recommendation.fix}`];
  if (recommendation.files?.length) lines.push(`  Files: ${recommendation.files.join(', ')}`);
  return lines;
};

export const formatAnalyzeHuman = (report: AnalyzeResult): string => {
  const recs = sortRecommendations(report.recommendations);
  const next = recs.find((i) => i.severity === 'WARN') ?? recs.find((i) => i.severity === 'RECOMMEND');
  const lines = ['Playbook Analyze', `Repo: ${report.repoPath}`, `Signals: ${report.signals}`, '', `Recommendations (${recs.length})`];
  for (const r of recs) {
    lines.push(...formatRecommendation(r));
    lines.push('');
  }
  lines.push(`Next: ${next ? next.fix : 'No action required.'}`);
  return lines.join('\n').trimEnd();
};

export const formatAnalyzeCi = (report: AnalyzeResult): string => {
  const recs = sortRecommendations(report.recommendations);
  const warnCount = recs.filter((i) => i.severity === 'WARN').length;
  const recommendCount = recs.filter((i) => i.severity === 'RECOMMEND').length;
  const infoCount = recs.filter((i) => i.severity === 'INFO').length;
  const lines = [`playbook analyze: ${warnCount > 0 ? 'FAIL' : 'PASS'}  (warns=${warnCount} recommends=${recommendCount} info=${infoCount})`];
  for (const r of recs.filter((i) => i.severity !== 'INFO')) lines.push(...formatRecommendation(r));
  return lines.join('\n').trimEnd();
};

export const formatAnalyzeJson = (report: AnalyzeResult): string =>
  JSON.stringify({ ok: report.recommendations.every((i) => i.severity !== 'WARN'), signals: report.signals, recommendations: sortRecommendations(report.recommendations) }, null, 2);
