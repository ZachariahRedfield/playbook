import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import * as engine from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { writeJsonArtifactAbsolute } from '../lib/jsonArtifact.js';
import { loadVerifyRules } from '../lib/loadVerifyRules.js';
import { warn } from '../lib/output.js';
import {
  buildPlanRemediation,
  deriveVerifyFailureFacts,
  parsePlanRemediation,
  remediationToApplyPrecondition,
  type PlanRemediation
} from '../lib/remediationContract.js';

type ApplyOptions = {
  format: 'text' | 'json';
  ci: boolean;
  quiet: boolean;
  help?: boolean;
  policyCheck?: boolean;
  policy?: boolean;
  fromPlan?: string;
  tasks?: string[];
  runId?: string;
  skipReleaseGovernanceBoundary?: boolean;
};

type ApplyMode = 'standard' | 'policy-check' | 'policy';

type ApplyResult = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
  status: 'applied' | 'skipped' | 'unsupported' | 'failed';
  message?: string;
  details?: Record<string, unknown>;
};

type ApplyJsonResult = {
  schemaVersion: '1.0';
  command: 'apply';
  ok: boolean;
  exitCode: number;
  remediation: PlanRemediation;
  message?: string;
  results: ApplyResult[];
  summary: {
    applied: number;
    skipped: number;
    unsupported: number;
    failed: number;
  };
};

type PlanTask = {
  id: string;
  ruleId: string;
  file: string | null;
  action: string;
  autoFix: boolean;
  task_kind?: string;
  write?: {
    operation: 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor';
    blockId: string;
    startMarker: string;
    endMarker: string;
    anchor?: string;
    content: string;
  };
  provenance?: Record<string, unknown>;
  preconditions?: Record<string, unknown>;
};

type PlanSelection = {
  tasks: PlanTask[];
  remediation: PlanRemediation;
  releaseLockstepGroups?: Array<{ name: string; taskIds: string[] }>;
};

type PolicyCheckJsonResult = {
  schemaVersion: '1.0';
  command: 'apply';
  mode: 'policy-check';
  ok: true;
  exitCode: number;
  eligible: engine.PolicyPreflightProposal[];
  requires_review: engine.PolicyPreflightProposal[];
  blocked: engine.PolicyPreflightProposal[];
  summary: {
    eligible: number;
    requires_review: number;
    blocked: number;
    total: number;
  };
};

type PolicyApplyResultEntry = {
  proposal_id: string;
  decision: 'safe' | 'requires_review' | 'blocked';
  reason: string;
};

type PolicyApplyFailureEntry = PolicyApplyResultEntry & {
  error: string;
};

type PolicyApplyResultArtifact = {
  schemaVersion: '1.0';
  kind: 'policy-apply-result';
  executed: PolicyApplyResultEntry[];
  skipped_requires_review: PolicyApplyResultEntry[];
  skipped_blocked: PolicyApplyResultEntry[];
  failed_execution: PolicyApplyFailureEntry[];
  summary: {
    executed: number;
    skipped_requires_review: number;
    skipped_blocked: number;
    failed_execution: number;
    total: number;
  };
};

type PolicyApplyJsonResult = {
  schemaVersion: '1.0';
  command: 'apply';
  mode: 'policy';
  ok: boolean;
  exitCode: number;
  resultArtifact: string;
} & PolicyApplyResultArtifact;

type DecodedPlanPayload = {
  text: string;
  likelyShellEncodingIssue: boolean;
};

type NormalizedPlanArtifact = PlanSelection;

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);
const POLICY_APPLY_RESULT_RELATIVE_PATH = '.playbook/policy-apply-result.json' as const;

const stripLeadingBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

const inferUtf16WithoutBom = (buffer: Buffer): 'utf16le' | 'utf16be' | null => {
  if (buffer.length < 4 || buffer.length % 2 !== 0) {
    return null;
  }

  let evenNulls = 0;
  let oddNulls = 0;
  const pairCount = Math.floor(buffer.length / 2);
  for (let index = 0; index < buffer.length; index += 2) {
    if (buffer[index] === 0x00) {
      evenNulls += 1;
    }
    if (buffer[index + 1] === 0x00) {
      oddNulls += 1;
    }
  }

  const threshold = Math.max(2, Math.floor(pairCount * 0.6));
  if (oddNulls >= threshold && evenNulls === 0) {
    return 'utf16le';
  }

  if (evenNulls >= threshold && oddNulls === 0) {
    return 'utf16be';
  }

  return null;
};

const decodePlanPayload = (buffer: Buffer): DecodedPlanPayload => {
  if (buffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    return { text: stripLeadingBom(buffer.toString('utf8')), likelyShellEncodingIssue: false };
  }

  if (buffer.subarray(0, UTF16LE_BOM.length).equals(UTF16LE_BOM)) {
    return { text: stripLeadingBom(buffer.subarray(UTF16LE_BOM.length).toString('utf16le')), likelyShellEncodingIssue: true };
  }

  if (buffer.subarray(0, UTF16BE_BOM.length).equals(UTF16BE_BOM)) {
    const littleEndianBuffer = Buffer.from(buffer.subarray(UTF16BE_BOM.length));
    littleEndianBuffer.swap16();
    return { text: stripLeadingBom(littleEndianBuffer.toString('utf16le')), likelyShellEncodingIssue: true };
  }

  const inferredUtf16 = inferUtf16WithoutBom(buffer);
  if (inferredUtf16 === 'utf16le') {
    return { text: stripLeadingBom(buffer.toString('utf16le')), likelyShellEncodingIssue: true };
  }

  if (inferredUtf16 === 'utf16be') {
    const littleEndianBuffer = Buffer.from(buffer);
    littleEndianBuffer.swap16();
    return { text: stripLeadingBom(littleEndianBuffer.toString('utf16le')), likelyShellEncodingIssue: true };
  }

  return { text: stripLeadingBom(buffer.toString('utf8')), likelyShellEncodingIssue: false };
};

const toPolicyApplyResultArtifact = (results: ApplyResult[]): PolicyApplyResultArtifact => {
  const executed: PolicyApplyResultEntry[] = [];
  const skippedRequiresReview: PolicyApplyResultEntry[] = [];
  const skippedBlocked: PolicyApplyResultEntry[] = [];
  const failedExecution: PolicyApplyFailureEntry[] = [];

  for (const result of results) {
    const reason = result.message ?? `${result.ruleId} ${result.status}`;
    if (result.status === 'failed') {
      failedExecution.push({
        proposal_id: result.id,
        decision: 'safe',
        reason,
        error: result.message ?? `Task ${result.id} failed during execution.`
      });
      continue;
    }

    if (result.status === 'unsupported') {
      skippedBlocked.push({
        proposal_id: result.id,
        decision: 'blocked',
        reason
      });
      continue;
    }

    if (result.status === 'skipped') {
      skippedRequiresReview.push({
        proposal_id: result.id,
        decision: 'requires_review',
        reason
      });
      continue;
    }

    executed.push({
      proposal_id: result.id,
      decision: 'safe',
      reason
    });
  }

  return {
    schemaVersion: '1.0',
    kind: 'policy-apply-result',
    executed,
    skipped_requires_review: skippedRequiresReview,
    skipped_blocked: skippedBlocked,
    failed_execution: failedExecution,
    summary: {
      executed: executed.length,
      skipped_requires_review: skippedRequiresReview.length,
      skipped_blocked: skippedBlocked.length,
      failed_execution: failedExecution.length,
      total: results.length
    }
  };
};

const writeCanonicalApplyArtifact = (cwd: string, results: ApplyResult[]): string => {
  const artifactPath = path.resolve(cwd, POLICY_APPLY_RESULT_RELATIVE_PATH);
  writeJsonArtifactAbsolute(artifactPath, toPolicyApplyResultArtifact(results), 'apply', { envelope: false });
  return artifactPath;
};


const readRequiredNonNegativeInteger = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid test-fix-plan payload: ${fieldName} must be a non-negative integer.`);
  }

  return value;
};


const normalizeReleasePlanArtifact = (normalizedPayload: Record<string, unknown>): NormalizedPlanArtifact => {
  if (normalizedPayload.kind !== 'playbook-release-plan') {
    throw new Error('Invalid release-plan payload: kind must be "playbook-release-plan".');
  }

  const tasksPayload = normalizedPayload.tasks;
  if (!Array.isArray(tasksPayload)) {
    throw new Error('Invalid release-plan payload: tasks must be an array.');
  }

  const parsedPlan = engine.parsePlanArtifact({
    schemaVersion: normalizedPayload.schemaVersion,
    command: 'plan',
    tasks: tasksPayload
  });

  const packageEntries = Array.isArray(normalizedPayload.packages) ? normalizedPayload.packages : [];
  const versionGroups = Array.isArray(normalizedPayload.versionGroups) ? normalizedPayload.versionGroups : [];
  const taskByFile = new Map<string | null, PlanTask>(parsedPlan.tasks.map((task: PlanTask) => [task.file, task] as const));
  const releaseLockstepGroups = versionGroups
    .map((group) => {
      if (!group || typeof group !== 'object') {
        return null;
      }

      const typedGroup = group as Record<string, unknown>;
      const packageNames = Array.isArray(typedGroup.packages) ? typedGroup.packages.filter((value): value is string => typeof value === 'string') : [];
      const taskIds = packageEntries
        .filter((entry) => entry && typeof entry === 'object' && packageNames.includes(String((entry as Record<string, unknown>).name ?? '')))
        .map((entry) => {
          const task = taskByFile.get(`${String((entry as Record<string, unknown>).path)}/package.json`);
          return task ? task.id : null;
        })
        .filter((value): value is string => value !== null);

      return typeof typedGroup.name === 'string' && taskIds.length > 0 ? { name: typedGroup.name, taskIds } : null;
    })
    .filter((value): value is { name: string; taskIds: string[] } => value !== null);

  return {
    tasks: parsedPlan.tasks,
    remediation: buildPlanRemediation({
      failureCount: parsedPlan.tasks.length,
      stepCount: parsedPlan.tasks.length,
      unavailableReason: 'Release plan produced no bounded mutation tasks. Review the release artifact before attempting apply.'
    }),
    releaseLockstepGroups
  };
};

const validateReleaseTaskSelection = (selection: PlanSelection, selectedTasks: PlanTask[]): void => {
  if (!selection.releaseLockstepGroups || selection.releaseLockstepGroups.length === 0) {
    return;
  }

  const selectedIds = new Set(selectedTasks.map((task) => task.id));
  for (const group of selection.releaseLockstepGroups) {
    const selectedGroupTaskIds = group.taskIds.filter((taskId) => selectedIds.has(taskId));
    if (selectedGroupTaskIds.length > 0 && selectedGroupTaskIds.length !== group.taskIds.length) {
      throw new Error(`Release plan task selection is partial for lockstep group ${group.name}. Select all package version tasks in the group or omit them entirely.`);
    }
  }
};

const normalizeApplyPlanArtifact = (payload: unknown): NormalizedPlanArtifact => {
  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
      ? ((payload as Record<string, unknown>).data as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  if (!normalizedPayload || typeof normalizedPayload !== 'object') {
    throw new Error('Invalid plan payload: expected an object envelope.');
  }

  if (normalizedPayload.command === 'plan') {
    return {
      tasks: engine.parsePlanArtifact(payload).tasks,
      remediation: parsePlanRemediation(normalizedPayload.remediation)
    };
  }

  if (normalizedPayload.command === 'test-fix-plan') {
    const parsedPlan = engine.parsePlanArtifact({
      schemaVersion: normalizedPayload.schemaVersion,
      command: 'plan',
      tasks: normalizedPayload.tasks
    });

    const summary = normalizedPayload.summary;
    if (!summary || typeof summary !== 'object') {
      throw new Error('Invalid test-fix-plan payload: summary must be an object.');
    }

    const typedSummary = summary as Record<string, unknown>;
    const totalFindings = readRequiredNonNegativeInteger(typedSummary.total_findings, 'summary.total_findings');
    const excludedFindings = readRequiredNonNegativeInteger(typedSummary.excluded_findings, 'summary.excluded_findings');

    return {
      tasks: parsedPlan.tasks,
      remediation: buildPlanRemediation({
        failureCount: totalFindings,
        stepCount: parsedPlan.tasks.length,
        unresolvedFailureCount: excludedFindings,
        unavailableReason:
          'Test-fix-plan produced no executable low-risk tasks. Review exclusions before attempting apply.'
      })
    };
  }


  if (normalizedPayload.kind === 'playbook-release-plan') {
    return normalizeReleasePlanArtifact(normalizedPayload);
  }

  if (normalizedPayload.command === 'docs-consolidate-plan') {
    const parsedPlan = engine.parsePlanArtifact({
      schemaVersion: normalizedPayload.schemaVersion,
      command: 'plan',
      tasks: normalizedPayload.tasks
    });

    const summary = normalizedPayload.summary;
    if (!summary || typeof summary !== 'object') {
      throw new Error('Invalid docs-consolidation-plan payload: summary must be an object.');
    }

    const typedSummary = summary as Record<string, unknown>;
    const totalTargets = readRequiredNonNegativeInteger(typedSummary.total_targets, 'summary.total_targets');
    const excludedTargets = readRequiredNonNegativeInteger(typedSummary.excluded_targets, 'summary.excluded_targets');

    return {
      tasks: parsedPlan.tasks,
      remediation: buildPlanRemediation({
        failureCount: totalTargets,
        stepCount: parsedPlan.tasks.length,
        unresolvedFailureCount: excludedTargets,
        unavailableReason:
          'Docs consolidation plan produced no executable managed-write tasks. Review exclusions before attempting apply.'
      })
    };
  }

  throw new Error('Invalid plan payload: command must be "plan", "test-fix-plan", or "docs-consolidate-plan", or kind must be "playbook-release-plan".');
};

const loadPlanFromFile = (cwd: string, fromPlan: string): PlanSelection => {
  const resolvedPath = path.resolve(cwd, fromPlan);

  let rawPayload = '';
  let likelyShellEncodingIssue = false;
  try {
    const rawBytes = fs.readFileSync(resolvedPath);
    const decodedPayload = decodePlanPayload(rawBytes);
    rawPayload = decodedPayload.text;
    likelyShellEncodingIssue = decodedPayload.likelyShellEncodingIssue;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read plan file at ${resolvedPath}: ${message}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const encodingHint = likelyShellEncodingIssue
      ? ' The file appears to use a shell-specific encoding (for example UTF-16/BOM from PowerShell redirection). Re-write the plan file as UTF-8 and retry.'
      : '';
    throw new Error(`Invalid plan JSON in ${resolvedPath}: ${message}.${encodingHint}`);
  }

  return normalizeApplyPlanArtifact(payload);
};

const loadPolicyEvaluationArtifact = (cwd: string): engine.PolicyEvaluationEntry[] => {
  const policyPath = path.resolve(cwd, engine.POLICY_EVALUATION_RELATIVE_PATH);

  let payload: unknown;
  try {
    const rawText = fs.readFileSync(policyPath, 'utf8');
    payload = JSON.parse(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read policy evaluation artifact at ${policyPath}: ${message}. Run \`pnpm playbook policy evaluate --json\` first.`
    );
  }

  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
      ? ((payload as Record<string, unknown>).data as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  const evaluations = normalizedPayload?.evaluations;
  if (!Array.isArray(evaluations)) {
    throw new Error(
      `Invalid policy evaluation artifact at ${policyPath}: expected \`evaluations\` array. Run \`pnpm playbook policy evaluate --json\` to regenerate.`
    );
  }

  return evaluations.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid policy evaluation artifact at ${policyPath}: evaluations must contain objects.`);
    }

    const proposalId = (entry as Record<string, unknown>).proposal_id;
    const decision = (entry as Record<string, unknown>).decision;
    const reason = (entry as Record<string, unknown>).reason;

    if (typeof proposalId !== 'string' || typeof reason !== 'string') {
      throw new Error(
        `Invalid policy evaluation artifact at ${policyPath}: each evaluation must include string proposal_id and reason.`
      );
    }

    if (decision !== 'safe' && decision !== 'requires_review' && decision !== 'blocked') {
      throw new Error(
        `Invalid policy evaluation artifact at ${policyPath}: unsupported decision \`${String(decision)}\` for proposal ${proposalId}.`
      );
    }

    return {
      proposal_id: proposalId,
      decision,
      reason
    };
  });
};


const byProposalId = <T extends { proposal_id: string }>(left: T, right: T): number => left.proposal_id.localeCompare(right.proposal_id);

export const validatePolicyApplyResultArtifact = (artifact: PolicyApplyResultArtifact): string[] => {
  const errors: string[] = [];

  if (artifact.schemaVersion !== '1.0') {
    errors.push('schemaVersion must be "1.0"');
  }
  if (artifact.kind !== 'policy-apply-result') {
    errors.push('kind must be "policy-apply-result"');
  }

  const validateEntry = (entry: PolicyApplyResultEntry | PolicyApplyFailureEntry, field: string): void => {
    if (typeof entry.proposal_id !== 'string' || entry.proposal_id.length === 0) {
      errors.push(`${field}[].proposal_id must be a non-empty string`);
    }
    if (!['safe', 'requires_review', 'blocked'].includes(entry.decision)) {
      errors.push(`${field}[].decision must be one of safe, requires_review, blocked`);
    }
    if (typeof entry.reason !== 'string' || entry.reason.length === 0) {
      errors.push(`${field}[].reason must be a non-empty string`);
    }
  };

  for (const [field, list] of [
    ['executed', artifact.executed],
    ['skipped_requires_review', artifact.skipped_requires_review],
    ['skipped_blocked', artifact.skipped_blocked]
  ] as const) {
    if (!Array.isArray(list)) {
      errors.push(`${field} must be an array`);
      continue;
    }

    for (const entry of list) {
      validateEntry(entry, field);
    }

    const sortedIds = [...list].map((entry) => entry.proposal_id).sort((left, right) => left.localeCompare(right));
    const currentIds = list.map((entry) => entry.proposal_id);
    if (sortedIds.join('\u0000') !== currentIds.join('\u0000')) {
      errors.push(`${field} must be deterministically ordered by proposal_id`);
    }
  }

  if (!Array.isArray(artifact.failed_execution)) {
    errors.push('failed_execution must be an array');
  } else {
    for (const entry of artifact.failed_execution) {
      validateEntry(entry, 'failed_execution');
      if (typeof entry.error !== 'string' || entry.error.length === 0) {
        errors.push('failed_execution[].error must be a non-empty string');
      }
    }

    const sortedIds = [...artifact.failed_execution].map((entry) => entry.proposal_id).sort((left, right) => left.localeCompare(right));
    const currentIds = artifact.failed_execution.map((entry) => entry.proposal_id);
    if (sortedIds.join('\u0000') !== currentIds.join('\u0000')) {
      errors.push('failed_execution must be deterministically ordered by proposal_id');
    }
  }

  if (!artifact.summary || typeof artifact.summary !== 'object') {
    errors.push('summary must be an object');
  } else {
    const summary = artifact.summary;
    for (const field of ['executed', 'skipped_requires_review', 'skipped_blocked', 'failed_execution', 'total'] as const) {
      const value = summary[field];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        errors.push(`summary.${field} must be a non-negative integer`);
      }
    }
  }

  return errors;
};

const executeSafePolicyProposal = (cwd: string, proposal: engine.PolicyEvaluationEntry): string | null => {
  const candidatesPath = path.resolve(cwd, '.playbook/improvement-candidates.json');

  let payload: unknown;
  try {
    payload = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Unable to read improvement candidates at ${candidatesPath}: ${message}. Run \`pnpm playbook improve --json\` first.`;
  }

  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
      ? ((payload as Record<string, unknown>).data as Record<string, unknown>)
      : (payload as Record<string, unknown>);
  const candidates = normalizedPayload?.candidates;
  if (!Array.isArray(candidates)) {
    return `Invalid improvement candidates artifact at ${candidatesPath}: expected \`candidates\` array.`;
  }

  const exists = candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }

    return (candidate as Record<string, unknown>).candidate_id === proposal.proposal_id;
  });

  if (!exists) {
    return `No deterministic execution target found for safe proposal \`${proposal.proposal_id}\` in ${candidatesPath}.`;
  }

  return null;
};

const runPolicyApply = (cwd: string): PolicyApplyJsonResult => {
  const preflight = engine.buildPolicyPreflight(loadPolicyEvaluationArtifact(cwd));
  const executed: PolicyApplyResultEntry[] = [];
  const failedExecution: PolicyApplyFailureEntry[] = [];

  for (const safeProposal of preflight.eligible) {
    const executionError = executeSafePolicyProposal(cwd, safeProposal);
    if (executionError) {
      failedExecution.push({ ...safeProposal, error: executionError });
      continue;
    }

    executed.push(safeProposal);
  }

  const deterministicExecuted = [...executed].sort(byProposalId);
  const deterministicSkippedRequiresReview = [...preflight.requires_review].sort(byProposalId);
  const deterministicSkippedBlocked = [...preflight.blocked].sort(byProposalId);
  const deterministicFailedExecution = [...failedExecution].sort(byProposalId);

  const resultArtifact: PolicyApplyResultArtifact = {
    schemaVersion: '1.0',
    kind: 'policy-apply-result',
    executed: deterministicExecuted,
    skipped_requires_review: deterministicSkippedRequiresReview,
    skipped_blocked: deterministicSkippedBlocked,
    failed_execution: deterministicFailedExecution,
    summary: {
      executed: deterministicExecuted.length,
      skipped_requires_review: deterministicSkippedRequiresReview.length,
      skipped_blocked: deterministicSkippedBlocked.length,
      failed_execution: deterministicFailedExecution.length,
      total: preflight.summary.total
    }
  };

  const validationErrors = validatePolicyApplyResultArtifact(resultArtifact);
  if (validationErrors.length > 0) {
    warn(`playbook apply --policy: warning: policy-apply-result artifact failed schema validation: ${validationErrors.join('; ')}`);
  }

  const resultArtifactPath = path.resolve(cwd, POLICY_APPLY_RESULT_RELATIVE_PATH);
  writeJsonArtifactAbsolute(resultArtifactPath, resultArtifact as Record<string, unknown>, 'apply', { envelope: false });

  const exitCode = deterministicFailedExecution.length > 0 ? ExitCode.Failure : ExitCode.Success;
  return {
    ...resultArtifact,
    schemaVersion: '1.0',
    command: 'apply',
    mode: 'policy',
    ok: exitCode === ExitCode.Success,
    exitCode,
    resultArtifact: POLICY_APPLY_RESULT_RELATIVE_PATH
  };
};




const selectPlanTasks = (tasks: PlanTask[], selectedTaskIds: string[] | undefined): PlanTask[] => {
  if (!selectedTaskIds) {
    return tasks;
  }

  const normalizedIds = selectedTaskIds.filter((id) => id.trim().length > 0);
  const uniqueIds = [...new Set(normalizedIds)];

  if (uniqueIds.length === 0) {
    throw new Error('No task ids were provided. Supply at least one --task <task-id>.');
  }

  const availableTaskIds = new Set(tasks.map((task) => task.id));
  const unknownTaskIds = uniqueIds.filter((id) => !availableTaskIds.has(id));
  if (unknownTaskIds.length > 0) {
    throw new Error(`Unknown task id(s): ${unknownTaskIds.join(', ')}.`);
  }

  const selectedTaskIdsSet = new Set(uniqueIds);
  return tasks.filter((task) => selectedTaskIdsSet.has(task.id));
};

const renderTextApply = (result: ApplyJsonResult): void => {
  console.log('Apply');
  console.log('────────');
  console.log('');
  console.log(`Applied: ${result.summary.applied}`);
  console.log(`Skipped: ${result.summary.skipped}`);
  console.log(`Unsupported: ${result.summary.unsupported}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log('');

  if (result.results.length === 0) {
    console.log('(none)');
    return;
  }

  for (const entry of result.results) {
    const target = entry.file ?? '(no file)';
    console.log(`${entry.id} ${entry.ruleId} ${entry.status} ${target}`);
  }
};

const renderTextPolicyCheck = (result: PolicyCheckJsonResult): void => {
  console.log('Apply policy preflight (read-only)');
  console.log('────────────────────────────────');
  console.log(`Eligible: ${result.summary.eligible}`);
  console.log(`Requires review: ${result.summary.requires_review}`);
  console.log(`Blocked: ${result.summary.blocked}`);
  console.log(`Total: ${result.summary.total}`);

  const printGroup = (title: string, entries: engine.PolicyPreflightProposal[]): void => {
    console.log('');
    console.log(`${title}:`);
    if (entries.length === 0) {
      console.log('  (none)');
      return;
    }

    for (const entry of entries) {
      console.log(`  - ${entry.proposal_id}: ${entry.reason}`);
    }
  };

  printGroup('eligible', result.eligible);
  printGroup('requires_review', result.requires_review);
  printGroup('blocked', result.blocked);
};

const printApplyHelp = (): void => {
  console.log('Usage: playbook apply [options]');
  console.log('');
  console.log('Execute deterministic auto-fixable plan tasks from generated or saved plan artifacts.');
  console.log('');
  console.log('Options:');
  console.log('  --policy-check             Read-only preflight of policy-evaluated proposal eligibility');
  console.log('  --policy                   Controlled policy-gated execution for safe proposals only');
  console.log('  --from-plan <path>         Apply tasks from a previously saved `playbook plan --json` artifact');
  console.log('  --task <id>                Apply only selected task ID (repeatable; requires --from-plan)');
  console.log('  --json                     Alias for --format=json');
  console.log('  --format <text|json>       Output format');
  console.log('  --quiet                    Suppress success output in text mode');
  console.log('  --help                     Show help');
};

const resolveApplyMode = (options: ApplyOptions): ApplyMode => {
  if (options.policyCheck) {
    return 'policy-check';
  }

  if (options.policy) {
    return 'policy';
  }

  return 'standard';
};

const validateApplyOptions = (options: ApplyOptions, mode: ApplyMode): void => {
  if (mode === 'policy-check') {
    if (options.policy) {
      throw new Error('The --policy flag cannot be combined with --policy-check.');
    }
    if (options.fromPlan) {
      throw new Error('The --policy-check flag is read-only and cannot be combined with --from-plan.');
    }
    if ((options.tasks?.length ?? 0) > 0) {
      throw new Error('The --policy-check flag is read-only and cannot be combined with --task.');
    }
  }

  if (mode === 'policy') {
    if (options.fromPlan) {
      throw new Error('The --policy flag cannot be combined with --from-plan.');
    }
    if ((options.tasks?.length ?? 0) > 0) {
      throw new Error('The --policy flag cannot be combined with --task.');
    }
  }

  if (mode === 'standard' && (options.tasks?.length ?? 0) > 0 && !options.fromPlan) {
    throw new Error('The --task flag requires --from-plan so task selection is tied to a reviewed artifact.');
  }
};

const emitApplyOutput = (options: ApplyOptions, payload: ApplyJsonResult, renderText: (result: ApplyJsonResult) => void): number => {
  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return payload.exitCode;
  }

  if (!options.quiet) {
    renderText(payload);
  }

  return payload.exitCode;
};

const emitPolicyCheckOutput = (options: ApplyOptions, payload: PolicyCheckJsonResult): number => {
  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return ExitCode.Success;
  }

  if (!options.quiet) {
    renderTextPolicyCheck(payload);
  }

  return ExitCode.Success;
};

const emitPolicyApplyOutput = (options: ApplyOptions, payload: PolicyApplyJsonResult): number => {
  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return payload.exitCode;
  }

  if (!options.quiet) {
    console.log('Apply policy execution (safe proposals only)');
    console.log('──────────────────────────────────────────');
    console.log(`Executed: ${payload.summary.executed}`);
    console.log(`Skipped (requires_review): ${payload.summary.skipped_requires_review}`);
    console.log(`Skipped (blocked): ${payload.summary.skipped_blocked}`);
    console.log(`Failed execution: ${payload.summary.failed_execution}`);
    console.log(`Result artifact: ${payload.resultArtifact}`);
  }

  return payload.exitCode;
};

const attachApplyRunArtifacts = (cwd: string, runId: string, fromPlan: string | undefined): void => {
  const runArtifactPath = engine.executionRunPath(cwd, runId);
  engine.attachSessionRunState(cwd, {
    step: 'apply',
    runId,
    goal: 'apply deterministic remediation plan',
    artifacts: [
      { artifact: runArtifactPath, kind: 'run' },
      ...(fromPlan ? [{ artifact: fromPlan, kind: 'plan' as const }] : [])
    ]
  });
};


const attachPolicyArtifactsToSession = (cwd: string): void => {
  const artifacts = [
    '.playbook/improvement-candidates.json',
    '.playbook/policy-evaluation.json',
    '.playbook/policy-apply-result.json'
  ];

  for (const artifact of artifacts) {
    if (fs.existsSync(path.resolve(cwd, artifact))) {
      engine.pinSessionArtifact(cwd, artifact, 'artifact');
    }
  }

  engine.updateSession(cwd, { currentStep: 'apply' });
};

const runPolicyCheckFlow = (cwd: string, options: ApplyOptions): number => {
  const evaluations = loadPolicyEvaluationArtifact(cwd);
  const preflight = engine.buildPolicyPreflight(evaluations);
  const payload: PolicyCheckJsonResult = {
    ...preflight,
    command: 'apply',
    mode: 'policy-check',
    ok: true,
    exitCode: ExitCode.Success
  };

  attachPolicyArtifactsToSession(cwd);
  return emitPolicyCheckOutput(options, payload);
};

const runPolicyApplyFlow = (cwd: string, options: ApplyOptions): number => {
  const payload = runPolicyApply(cwd);
  attachPolicyArtifactsToSession(cwd);
  return emitPolicyApplyOutput(options, payload);
};


const shouldRunReleaseSyncBoundary = (cwd: string): boolean => {
  const versionPolicyPath = path.resolve(cwd, '.playbook', 'version-policy.json');
  if (fs.existsSync(versionPolicyPath)) {
    return true;
  }

  const packageJsonPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return true;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: unknown };
    return parsed.name === 'playbook-monorepo';
  } catch {
    return false;
  }
};

type ReleaseBoundaryResult =
  | { status: 'skipped' | 'no_drift' }
  | { status: 'auto_applied'; note: string };

const applyReleaseSyncCommitBoundary = (cwd: string): ReleaseBoundaryResult => {
  if (!shouldRunReleaseSyncBoundary(cwd)) {
    return { status: 'skipped' };
  }

  const initialAssessment = engine.assessReleaseSync(cwd, { mode: 'check' });
  const reconciliation = engine.classifyReleaseSyncReconciliation(initialAssessment);

  if (reconciliation.status === 'no_drift') {
    return { status: 'no_drift' };
  }

  if (reconciliation.status === 'blocked_drift') {
    throw new Error(
      `playbook apply: release-governed drift is blocked and cannot be auto-fixed in apply boundary (${reconciliation.reason}). Run \`pnpm playbook release sync --check\` for details.`
    );
  }

  execSync('pnpm playbook release sync --json --out .playbook/release-plan.json', { cwd, stdio: 'inherit' });

  const finalAssessment = engine.assessReleaseSync(cwd, { mode: 'check' });
  const finalReconciliation = engine.classifyReleaseSyncReconciliation(finalAssessment);
  if (finalReconciliation.status !== 'no_drift') {
    throw new Error('playbook apply: release sync did not converge to a release-clean state.');
  }

  const versionLabel = reconciliation.plannedVersions.length > 0 ? reconciliation.plannedVersions.join(', ') : initialAssessment.plan.summary.recommendedBump;
  return {
    status: 'auto_applied',
    note: `Release governance auto-applied (${reconciliation.taskCount} task${reconciliation.taskCount === 1 ? '' : 's'}, planned version ${versionLabel}).`
  };
};

const resolveRunId = (cwd: string, requestedRunId: string | undefined): string => {
  if (requestedRunId) {
    return requestedRunId;
  }

  const latest = engine.getLatestMutableRun ? engine.getLatestMutableRun(cwd) : null;
  if (latest) {
    return latest.id;
  }

  const intent = engine.createExecutionIntent('apply deterministic remediation plan', ['plan', 'apply', 'verify'], ['approved-plan-required'], 'user');
  return engine.createExecutionRun(cwd, intent).id;
};

export const runApply = async (cwd: string, options: ApplyOptions): Promise<number> => {
  if (options.help) {
    printApplyHelp();
    return ExitCode.Success;
  }

  const mode = resolveApplyMode(options);
  validateApplyOptions(options, mode);

  if (mode === 'policy-check') {
    return runPolicyCheckFlow(cwd, options);
  }

  if (mode === 'policy') {
    return runPolicyApplyFlow(cwd, options);
  }

  const routeDecision = engine.routeTask(cwd, 'apply approved remediation plan', {
    taskKind: 'patch_execution',
    hasApprovedPlan: true,
    safetyConstraints: { allowRepositoryMutation: true, requiresApprovedPlan: true }
  });

  if (routeDecision.route === 'unsupported') {
    throw new Error(`Cannot execute apply flow: ${routeDecision.why}`);
  }

  const runId = resolveRunId(cwd, options.runId);

  const plan = options.fromPlan
    ? loadPlanFromFile(cwd, options.fromPlan)
    : (() => {
        const generatedPlan = engine.generatePlanContract(cwd);
        const verifyPayload = typeof generatedPlan === 'object' && generatedPlan !== null && 'verify' in generatedPlan
          ? (generatedPlan as { verify?: unknown }).verify ?? null
          : null;
        const tasks = Array.isArray((generatedPlan as { tasks?: unknown[] } | null)?.tasks)
          ? (generatedPlan as { tasks: PlanTask[] }).tasks
          : [];
        const failureFacts = deriveVerifyFailureFacts(verifyPayload);
        return {
          tasks,
          remediation: buildPlanRemediation({ failureCount: failureFacts.failureCount, stepCount: tasks.length })
        };
      })();
  const applyPrecondition = remediationToApplyPrecondition(plan.remediation);

  if (applyPrecondition.action === 'fail') {
    throw new Error(`Cannot apply remediation: ${applyPrecondition.message}`);
  }

  if (applyPrecondition.action === 'no_op') {
    const payload: ApplyJsonResult = {
      schemaVersion: '1.0',
      command: 'apply',
        ok: true,
      exitCode: ExitCode.Success,
      remediation: plan.remediation,
      message: applyPrecondition.message,
      results: [],
      summary: { applied: 0, skipped: 0, unsupported: 0, failed: 0 }
    };

    engine.appendExecutionStep(cwd, runId, {
      kind: 'apply',
      status: 'skipped',
      inputs: { fromPlan: options.fromPlan ?? null, selectedTaskCount: 0 },
      outputs: payload.summary,
      evidence: options.fromPlan ? [{ id: 'evidence-plan-artifact', kind: 'artifact', ref: options.fromPlan }] : []
    });

    writeCanonicalApplyArtifact(cwd, []);
    attachApplyRunArtifacts(cwd, runId, options.fromPlan);
    const releaseBoundaryResult = options.skipReleaseGovernanceBoundary ? { status: 'skipped' as const } : applyReleaseSyncCommitBoundary(cwd);
    if (releaseBoundaryResult.status === 'auto_applied') {
      payload.message = payload.message ? `${payload.message} ${releaseBoundaryResult.note}` : releaseBoundaryResult.note;
      if (options.format !== 'json' && !options.quiet) {
        console.log(`playbook apply: ${releaseBoundaryResult.note}`);
      }
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
      return ExitCode.Success;
    }

    if (!options.quiet) {
      console.log(applyPrecondition.message);
    }

    return ExitCode.Success;
  }

  const selectedTasks = selectPlanTasks(plan.tasks, options.tasks);
  validateReleaseTaskSelection(plan, selectedTasks);
  engine.validateRemediationPlan(cwd, selectedTasks);
  const verifyRules = await loadVerifyRules(cwd);

  const handlers: Record<string, NonNullable<(typeof verifyRules)[number]['fix']>> = {};
  for (const task of selectedTasks) {
    const pluginRule = verifyRules.find((rule) => rule.id === task.ruleId);
    if (pluginRule?.fix) {
      handlers[task.ruleId] = pluginRule.fix;
    }
  }

  const execution = await engine.applyExecutionPlan(cwd, selectedTasks, { dryRun: false, handlers });

  const exitCode = execution.summary.failed > 0 ? ExitCode.Failure : ExitCode.Success;
  const payload: ApplyJsonResult = {
    schemaVersion: '1.0',
    command: 'apply',
    ok: exitCode === ExitCode.Success,
    exitCode,
    remediation: plan.remediation,
    message: applyPrecondition.message,
    results: execution.results,
    summary: execution.summary
  };

  engine.appendExecutionStep(cwd, runId, {
    kind: 'apply',
    status: exitCode === ExitCode.Success ? 'passed' : 'failed',
    inputs: {
      fromPlan: options.fromPlan ?? null,
      selectedTaskCount: selectedTasks.length
    },
    outputs: payload.summary,
    evidence: [
      ...(options.fromPlan ? [{ id: 'evidence-plan-artifact', kind: 'artifact' as const, ref: options.fromPlan }] : []),
      ...execution.results.map((result: ApplyResult, index: number) => ({
        id: `evidence-apply-${String(index + 1).padStart(3, '0')}`,
        kind: 'log' as const,
        ref: `${result.ruleId}:${result.status}`,
        note: result.message
      }))
    ]
  });

  writeCanonicalApplyArtifact(cwd, execution.results);
  attachApplyRunArtifacts(cwd, runId, options.fromPlan);

  if (exitCode === ExitCode.Success) {
    const releaseBoundaryResult = options.skipReleaseGovernanceBoundary ? { status: 'skipped' as const } : applyReleaseSyncCommitBoundary(cwd);
    if (releaseBoundaryResult.status === 'auto_applied') {
      payload.message = payload.message ? `${payload.message} ${releaseBoundaryResult.note}` : releaseBoundaryResult.note;
      if (options.format !== 'json' && !options.quiet) {
        console.log(`playbook apply: ${releaseBoundaryResult.note}`);
      }
    }
  }

  return emitApplyOutput(options, payload, renderTextApply);
};
