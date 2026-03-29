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
  routing: { topic: string; must_route_through_playbook_plan: boolean; no_direct_lifeline_bypass: boolean };
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

const fitnessIntegrationContract = (engineRuntime as unknown as { fitnessIntegrationContract: { actions: FitnessActionContract[] } }).fitnessIntegrationContract;
const actionKinds = fitnessIntegrationContract.actions.map((entry: FitnessActionContract) => entry.name);

const engine = engineRuntime as unknown as {
  readInteropRuntime: (cwd: string) => any;
  writeInteropRuntime: (cwd: string, artifact: any) => string;
  registerInteropCapability: (runtime: any, capability: any) => any;
  emitBoundedInteropActionRequest: (input: any) => { runtime: any; request: any };
  runLifelineMockRuntimeOnce: (runtime: any, runtimeId: string) => any;
  reconcileInteropRuntime: (runtime: any) => any;
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

export const runInterop = async (cwd: string, commandArgs: string[], options: InteropOptions): Promise<number> => {
  if (options.help) {
    printCommandHelp({
      usage: 'playbook interop <register|emit|run-mock|reconcile|capabilities|requests|receipts|health> [--json]',
      description: 'Inspect and operate remediation-first Playbook↔Lifeline interop runtime artifacts.',
      options: [
        '--capability <id>   capability id for register/emit',
        '--action <kind>     remediation action kind',
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
    let runtime = engine.readInteropRuntime(cwd);
    const runtimeId = valueFor('--runtime') ?? 'lifeline-mock-runtime';

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
      const { manifest, evaluation } = readRendezvous(cwd);
      const emitted = engine.emitBoundedInteropActionRequest({ runtime, manifest, evaluation, action_kind: action, capability_id: capability });
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
