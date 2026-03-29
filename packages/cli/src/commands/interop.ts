import path from 'node:path';
import fs from 'node:fs';
import * as engineRuntime from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { printCommandHelp } from '../lib/commandSurface.js';

type InteropOptions = { format: 'text' | 'json'; quiet: boolean; help?: boolean };


type FitnessActionContract = {
  name: string;
  receiptType: string;
  routing: { channel: string; target: string; priority: string; maxDeliveryLatencySeconds: number };
};
type RemediationInteropActionKind = FitnessActionContract['name'];
type RendezvousManifest = { remediationId: string; requiredArtifactIds: string[] };
type RendezvousManifestEvaluation = {
  state: 'complete' | 'incomplete' | 'stale' | 'conflicted';
  releaseReady: boolean;
  blockers: string[];
  missingArtifactIds: string[];
  conflictingArtifactIds: string[];
  stale: boolean;
};
type FitnessContractInspectPayload = {
  sourceRepo: string;
  sourceRef: string;
  sourcePath: string;
  syncMode: string;
  sourceHash: string;
  canonicalPayloadSummary: {
    appIdentity: {
      kind: string;
      schemaVersion: string;
    };
    signalNames: string[];
    stateSnapshotTypes: string[];
    boundedActionNames: string[];
    receiptTypes: string[];
  };
  contract: unknown;
};

const fitnessIntegrationContract = (engineRuntime as unknown as { fitnessIntegrationContract: { actions: FitnessActionContract[] } }).fitnessIntegrationContract;
const actionKinds = fitnessIntegrationContract.actions.map((entry: FitnessActionContract) => entry.name);
const defaultBoundedActionInputByAction = {
  adjust_upcoming_workout_load: {
    athlete_id: 'athlete-001',
    week_id: 'week-2026-W13',
    workout_id: 'workout-001',
    load_adjustment_percent: -10,
    duration_days: 3,
    reason_code: 'fatigue_spike'
  },
  schedule_recovery_block: {
    athlete_id: 'athlete-001',
    week_id: 'week-2026-W13',
    start_date: '2026-03-30',
    duration_days: 3,
    recovery_mode: 'rest'
  },
  revise_weekly_goal_plan: {
    athlete_id: 'athlete-001',
    week_id: 'week-2026-W13',
    goal_domain: 'consistency',
    target_value: 4,
    duration_days: 7
  }
} as const;

const engine = engineRuntime as unknown as {
  readInteropRuntime: (cwd: string) => any;
  writeInteropRuntime: (cwd: string, artifact: any) => string;
  registerInteropCapability: (runtime: any, capability: any) => any;
  emitBoundedInteropActionRequest: (input: any) => { runtime: any; request: any };
  emitPlanDerivedFitnessRequest: (input: any) => { runtime: any; request: any };
  runLifelineMockRuntimeOnce: (runtime: any, runtimeId: string) => any;
  reconcileInteropRuntime: (runtime: any) => any;
  materializeFitnessContractArtifact: (options: { repoRoot: string }) => Promise<any>;
  readArtifactJson: <T>(path: string) => T;
};

const readRendezvous = (cwd: string): { manifest: RendezvousManifest; evaluation: RendezvousManifestEvaluation } => {
  const manifestPath = path.resolve(cwd, '.playbook/rendezvous-manifest.json');
  const statusPath = path.resolve(cwd, '.playbook/rendezvous-status.json');
  const manifest = engine.readArtifactJson<RendezvousManifest>(manifestPath);
  const status = fs.existsSync(statusPath)
    ? engine.readArtifactJson<{ evaluation: RendezvousManifestEvaluation }>(statusPath).evaluation
    : { state: 'complete', releaseReady: true, blockers: [], missingArtifactIds: [], conflictingArtifactIds: [], stale: false } as RendezvousManifestEvaluation;
  return { manifest, evaluation: status };
};

const readPlanDerivedReadiness = (cwd: string, approvedPlan: boolean): {
  source: 'rendezvous' | 'approved-plan';
  manifest?: RendezvousManifest;
  evaluation?: RendezvousManifestEvaluation;
  plan?: { command: string };
  approved?: boolean;
  remediation_id?: string;
  required_artifact_ids?: string[];
} => {
  const manifestPath = path.resolve(cwd, '.playbook/rendezvous-manifest.json');
  if (fs.existsSync(manifestPath)) {
    const { manifest, evaluation } = readRendezvous(cwd);
    return { source: 'rendezvous', manifest, evaluation };
  }

  const planPath = path.resolve(cwd, '.playbook/plan.json');
  if (!fs.existsSync(planPath)) {
    throw new Error('Cannot emit plan-derived Fitness request: missing .playbook/rendezvous-manifest.json or .playbook/plan.json.');
  }
  const plan = engine.readArtifactJson<{ command?: string }>(planPath);
  return {
    source: 'approved-plan',
    plan: { command: String(plan.command ?? '') },
    approved: approvedPlan,
    remediation_id: `plan-${path.basename(cwd)}-fitness`,
    required_artifact_ids: ['plan']
  };
};

const toFitnessContractInspectPayload = async (cwd: string): Promise<FitnessContractInspectPayload> => {
  const artifact = await engine.materializeFitnessContractArtifact({ repoRoot: cwd });
  return {
    sourceRepo: artifact.source.sourceRepo,
    sourceRef: artifact.source.sourceRef,
    sourcePath: artifact.source.sourcePath,
    syncMode: artifact.source.syncMode,
    sourceHash: artifact.fingerprint,
    canonicalPayloadSummary: {
      appIdentity: {
        kind: artifact.payload.kind,
        schemaVersion: artifact.payload.schemaVersion
      },
      signalNames: [...artifact.payload.signalTypes],
      stateSnapshotTypes: [...artifact.payload.stateSnapshotTypes],
      boundedActionNames: artifact.payload.actions.map((entry: { name: string }) => entry.name),
      receiptTypes: [...artifact.payload.receiptTypes]
    },
    contract: artifact.payload
  };
};

export const runInterop = async (cwd: string, commandArgs: string[], options: InteropOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook interop <register|emit|emit-fitness-plan|run-mock|reconcile|capabilities|requests|receipts|health|fitness-contract> [--json]',
      description: 'Inspect and operate remediation-first Playbook↔Lifeline interop runtime artifacts.',
      options: [
        '--capability <id>   capability id for register/emit',
        '--action <kind>     remediation action kind',
        '--action-input-json <json>  bounded action input payload (Fitness contract-shaped)',
        '--approved-plan     require explicit approval when deriving from .playbook/plan.json',
        '--runtime <id>      runtime id (default lifeline-mock-runtime)',
        '--json              emit machine-readable output',
        '--help              show help'
      ],
      artifacts: ['.playbook/lifeline-interop-runtime.json', '.playbook/rendezvous-manifest.json']
    });
    return ExitCode.Success;
  }

  const sub = commandArgs[0] ?? 'health';
  const valueFor = (name: string): string | undefined => {
    const index = commandArgs.indexOf(name);
    return index >= 0 ? commandArgs[index + 1] : undefined;
  };

  try {
    const runtimeId = valueFor('--runtime') ?? 'lifeline-mock-runtime';
    const actionInputJson = valueFor('--action-input-json');
    if (sub === 'fitness-contract') {
      const payload = await toFitnessContractInspectPayload(cwd);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'interop', payload: { command: 'interop', subcommand: sub, payload } });
      } else if (!options.quiet) {
        console.log(`sourceRepo: ${payload.sourceRepo}`);
        console.log(`sourceRef: ${payload.sourceRef}`);
        console.log(`sourcePath: ${payload.sourcePath}`);
        console.log(`syncMode: ${payload.syncMode}`);
        console.log(`sourceHash: ${payload.sourceHash}`);
        console.log(`app: ${payload.canonicalPayloadSummary.appIdentity.kind}@${payload.canonicalPayloadSummary.appIdentity.schemaVersion}`);
        console.log(`signals: ${payload.canonicalPayloadSummary.signalNames.join(', ')}`);
        console.log(`state snapshots: ${payload.canonicalPayloadSummary.stateSnapshotTypes.join(', ')}`);
        console.log(`bounded actions: ${payload.canonicalPayloadSummary.boundedActionNames.join(', ')}`);
        console.log(`receipts: ${payload.canonicalPayloadSummary.receiptTypes.join(', ')}`);
      }
      return ExitCode.Success;
    }

    let runtime = engine.readInteropRuntime(cwd);

    if (sub === 'register') {
      const capability = valueFor('--capability') ?? 'lifeline-remediation-v1';
      const action = (valueFor('--action') ?? 'adjust_upcoming_workout_load') as RemediationInteropActionKind;
      if (!actionKinds.includes(action)) throw new Error(`Unsupported --action ${action}`);
      const actionContract = fitnessIntegrationContract.actions.find((entry: FitnessActionContract) => entry.name === action)!;
      runtime = engine.registerInteropCapability(runtime, {
        capability_id: capability,
        action_kind: action,
        receipt_type: actionContract.receiptType,
        routing: actionContract.routing,
        version: '1.0.0',
        runtime_id: runtimeId,
        idempotency_key_prefix: `lifeline:${action}`
      });
      engine.writeInteropRuntime(cwd, runtime);
    } else if (sub === 'emit') {
      const capability = valueFor('--capability') ?? 'lifeline-remediation-v1';
      const action = (valueFor('--action') ?? 'adjust_upcoming_workout_load') as RemediationInteropActionKind;
      if (!actionKinds.includes(action)) throw new Error(`Unsupported --action ${action}`);
      const boundedActionInput = actionInputJson
        ? JSON.parse(actionInputJson) as Record<string, unknown>
        : defaultBoundedActionInputByAction[action as keyof typeof defaultBoundedActionInputByAction];
      const { manifest, evaluation } = readRendezvous(cwd);
      const emitted = engine.emitBoundedInteropActionRequest({
        runtime,
        manifest,
        evaluation,
        action_kind: action,
        bounded_action_input: boundedActionInput,
        capability_id: capability
      });
      runtime = emitted.runtime;
      engine.writeInteropRuntime(cwd, runtime);
    } else if (sub === 'emit-fitness-plan') {
      const capability = valueFor('--capability') ?? 'lifeline-remediation-v1';
      const action = (valueFor('--action') ?? 'adjust_upcoming_workout_load') as RemediationInteropActionKind;
      if (!actionKinds.includes(action)) throw new Error(`Unsupported --action ${action}`);
      const boundedActionInput = actionInputJson
        ? JSON.parse(actionInputJson) as Record<string, unknown>
        : defaultBoundedActionInputByAction[action as keyof typeof defaultBoundedActionInputByAction];
      const approvedPlan = commandArgs.includes('--approved-plan');
      const readiness = readPlanDerivedReadiness(cwd, approvedPlan);
      const emitted = readiness.source === 'rendezvous'
        ? engine.emitPlanDerivedFitnessRequest({
          runtime,
          readiness: {
            source: 'rendezvous',
            manifest: readiness.manifest!,
            evaluation: readiness.evaluation!
          },
          action_kind: action,
          bounded_action_input: boundedActionInput,
          capability_id: capability
        })
        : engine.emitPlanDerivedFitnessRequest({
          runtime,
          readiness: {
            source: 'approved-plan',
            plan: readiness.plan!,
            approved: Boolean(readiness.approved),
            remediation_id: readiness.remediation_id!,
            required_artifact_ids: readiness.required_artifact_ids!
          },
          action_kind: action,
          bounded_action_input: boundedActionInput,
          capability_id: capability
        });
      runtime = emitted.runtime;
      engine.writeInteropRuntime(cwd, runtime);
    } else if (sub === 'run-mock') {
      runtime = engine.runLifelineMockRuntimeOnce(runtime, runtimeId);
      engine.writeInteropRuntime(cwd, runtime);
    } else if (sub === 'reconcile') {
      runtime = engine.reconcileInteropRuntime(runtime);
      engine.writeInteropRuntime(cwd, runtime);
    }

    const payload = sub === 'capabilities' ? runtime.capabilities
      : sub === 'requests' ? runtime.requests
      : sub === 'receipts' ? runtime.receipts
      : sub === 'health' ? runtime.heartbeat
      : runtime;

    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'interop', payload: { command: 'interop', subcommand: sub, payload } });
    } else if (!options.quiet) {
      console.log(JSON.stringify(payload, null, 2));
    }
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') console.log(JSON.stringify({ schemaVersion: '1.0', command: 'interop', error: message }, null, 2));
    else console.error(message);
    return ExitCode.Failure;
  }
};
