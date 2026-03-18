import fs from 'node:fs';
import path from 'node:path';
import { ingestExecutionResults, type ExecutionResult, type FleetExecutionReceipt, type FleetUpdatedAdoptionState, type FleetAdoptionWorkQueue } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { toExecutionStatusResult, toFleetStatusResult, toQueueStatusResult, writeExecutionOutcomeInput } from './status.js';

type ReceiptOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  help: boolean;
};

type ReceiptIngestResult = {
  schemaVersion: '1.0';
  command: 'receipt';
  mode: 'ingest';
  outcome_input_path: string;
  receipt: FleetExecutionReceipt;
  updated_state: FleetUpdatedAdoptionState;
  next_queue: FleetAdoptionWorkQueue;
};

const printUsage = (): void => {
  console.error('Usage: playbook receipt ingest <execution-results.json> [--json]');
};

const isExecutionResult = (value: unknown): value is ExecutionResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.repo_id !== 'string' || typeof candidate.prompt_id !== 'string') return false;
  if (candidate.status !== 'success' && candidate.status !== 'failed' && candidate.status !== 'not_run') return false;
  if (candidate.error !== undefined && typeof candidate.error !== 'string') return false;
  if (candidate.observed_transition !== undefined) {
    const transition = candidate.observed_transition;
    if (!transition || typeof transition !== 'object') return false;
    const transitionRecord = transition as Record<string, unknown>;
    if (typeof transitionRecord.from !== 'string' || typeof transitionRecord.to !== 'string') return false;
  }
  return true;
};

const loadExecutionResults = (cwd: string, fileArg: string): ExecutionResult[] => {
  const targetPath = path.resolve(cwd, fileArg);
  const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || !parsed.every(isExecutionResult)) {
    throw new Error('receipt ingest expects a JSON array of ExecutionResult objects.');
  }
  return parsed;
};

const renderText = (result: ReceiptIngestResult): void => {
  console.log(`Wrote execution outcome input: ${result.outcome_input_path}`);
  console.log(`Receipt prompts total: ${result.receipt.verification_summary.prompts_total}`);
  console.log(`Updated state repos needing retry: ${result.updated_state.summary.repos_needing_retry.length}`);
  console.log(`Updated state repos needing replan: ${result.updated_state.summary.repos_needing_replan.length}`);
  console.log(`Next queue items: ${result.next_queue.work_items.length}`);
};

export const runReceipt = async (cwd: string, commandArgs: string[], options: ReceiptOptions): Promise<number> => {
  if (options.help) {
    printUsage();
    return ExitCode.Success;
  }

  const subcommand = commandArgs[0];
  const fileArg = commandArgs[1];
  if (subcommand !== 'ingest' || !fileArg) {
    printUsage();
    return ExitCode.Failure;
  }

  try {
    const results = loadExecutionResults(cwd, fileArg);
    const fleet = toFleetStatusResult(cwd).fleet;
    const queue = toQueueStatusResult(cwd).queue;
    const executionPlan = toExecutionStatusResult(cwd).execution_plan;
    const ingested = ingestExecutionResults(results, { fleet, queue, plan: executionPlan });
    const outcomeInputPath = writeExecutionOutcomeInput(cwd, ingested.outcome_input);
    const payload: ReceiptIngestResult = {
      schemaVersion: '1.0',
      command: 'receipt',
      mode: 'ingest',
      outcome_input_path: path.relative(cwd, outcomeInputPath) || outcomeInputPath,
      receipt: ingested.receipt,
      updated_state: ingested.updated_state,
      next_queue: ingested.next_queue
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
    } else if (!options.quiet) {
      renderText(payload);
    }
    return ExitCode.Success;
  } catch (error) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'receipt', ok: false, error: String(error) }, null, 2));
    } else {
      console.error(String(error));
    }
    return ExitCode.Failure;
  }
};
