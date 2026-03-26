import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as engineRuntime from '@zachariahredfield/playbook-engine';
import type { TestAutofixArtifact } from '@zachariahredfield/playbook-core';
import { ExitCode } from '../lib/cliContract.js';
import { emitJsonOutput } from '../lib/jsonArtifact.js';
import { printCommandHelp } from '../lib/commandSurface.js';
import { renderBriefOutput } from '../lib/briefOutput.js';

type RendezvousArtifactId = 'failure-log' | 'test-triage' | 'test-fix-plan' | 'apply-result' | 'test-autofix' | 'remediation-status';

type RendezvousManifestArtifact = {
  artifactId: RendezvousArtifactId;
  path: string;
  sha256: string;
  verification: 'passed' | 'failed' | 'unknown';
};

type RendezvousManifestArtifactObservations = Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>>;

type RendezvousManifest = {
  schemaVersion: '1.0';
  kind: 'artifact-rendezvous-manifest';
  generatedAt: string;
  baseSha: string;
  remediationId: string;
  requiredArtifactIds: RendezvousArtifactId[];
  artifacts: Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>>;
  blockers: Array<{ artifactId: RendezvousArtifactId; reason: string }>;
  confidence: number;
  staleOnShaChange: boolean;
};

type RendezvousManifestEvaluation = {
  state: 'complete' | 'incomplete' | 'stale' | 'conflicted';
  releaseReady: boolean;
  blockers: string[];
  missingArtifactIds: RendezvousArtifactId[];
  conflictingArtifactIds: RendezvousArtifactId[];
  stale: boolean;
};

const rendezvousArtifactIds: RendezvousArtifactId[] = [
  'failure-log',
  'test-triage',
  'test-fix-plan',
  'apply-result',
  'test-autofix',
  'remediation-status'
];

type RendezvousOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  help?: boolean;
};

type RendezvousPayload = {
  schemaVersion: '1.0';
  command: 'rendezvous';
  subcommand: 'create' | 'status' | 'release';
  manifestPath: string;
  manifest: RendezvousManifest;
  evaluation: RendezvousManifestEvaluation;
  observedArtifacts: RendezvousManifestArtifactObservations;
  currentSha: string;
  nextAction: string;
  dryRun?: boolean;
};

const MANIFEST_PATH = '.playbook/rendezvous-manifest.json' as const;
const DEFAULT_ARTIFACT_PATHS: Record<RendezvousArtifactId, string> = {
  'failure-log': '.playbook/ci-failure.log',
  'test-triage': '.playbook/test-triage.json',
  'test-fix-plan': '.playbook/test-fix-plan.json',
  'apply-result': '.playbook/test-autofix-apply.json',
  'test-autofix': '.playbook/test-autofix.json',
  'remediation-status': '.playbook/remediation-status.json'
};

const engine = engineRuntime as unknown as {
  buildRendezvousManifest: (input: {
    generatedAt: string;
    baseSha: string;
    remediationId: string;
    requiredArtifactIds: RendezvousArtifactId[];
    artifacts: Partial<Record<RendezvousArtifactId, RendezvousManifestArtifact>>;
    blockers?: Array<{ artifactId: RendezvousArtifactId; reason: string }>;
    confidence?: number;
    staleOnShaChange?: boolean;
  }) => RendezvousManifest;
  evaluateRendezvousManifest: (
    manifest: RendezvousManifest,
    options: {
      currentSha: string;
      observedArtifacts?: RendezvousManifestArtifactObservations;
      refreshedBaseSha?: boolean;
    }
  ) => RendezvousManifestEvaluation;
  readArtifactJson: <T>(artifactPath: string) => T;
};

const deterministicStringify = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const hashFile = (absolutePath: string): string => createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');

const readJsonArtifact = <T>(cwd: string, artifactPath: string): T =>
  engine.readArtifactJson<T>(path.resolve(cwd, artifactPath));

const resolveCurrentSha = (cwd: string): string => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return 'no-git-head';
  }
};

const verifyArtifact = (cwd: string, artifactId: RendezvousArtifactId, artifactPath: string): { verification: 'passed' | 'failed' | 'unknown'; reason?: string } => {
  const absolute = path.resolve(cwd, artifactPath);
  if (!fs.existsSync(absolute)) {
    return { verification: 'unknown', reason: 'artifact is missing' };
  }

  try {
    if (artifactId === 'failure-log') {
      const content = fs.readFileSync(absolute, 'utf8').trim();
      return content.length > 0 ? { verification: 'passed' } : { verification: 'failed', reason: 'failure log is empty' };
    }

    const parsed = readJsonArtifact<Record<string, unknown>>(cwd, artifactPath);
    if (artifactId === 'test-autofix') {
      return parsed.command === 'test-autofix' ? { verification: 'passed' } : { verification: 'failed', reason: 'artifact command must be test-autofix' };
    }
    if (artifactId === 'remediation-status') {
      return parsed.command === 'remediation-status' ? { verification: 'passed' } : { verification: 'failed', reason: 'artifact command must be remediation-status' };
    }

    return { verification: 'passed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { verification: 'failed', reason: `artifact is unreadable: ${message}` };
  }
};

const collectObservedArtifacts = (cwd: string, artifactPaths: Record<RendezvousArtifactId, string>): RendezvousManifestArtifactObservations => {
  const observed: RendezvousManifestArtifactObservations = {};

  for (const artifactId of rendezvousArtifactIds) {
    const artifactPath = artifactPaths[artifactId];
    const absolute = path.resolve(cwd, artifactPath);
    if (!fs.existsSync(absolute)) {
      continue;
    }

    const verification = verifyArtifact(cwd, artifactId, artifactPath);
    observed[artifactId] = {
      artifactId,
      path: artifactPath,
      sha256: hashFile(absolute),
      verification: verification.verification
    };
  }

  return observed;
};

const deriveGeneratedAt = (cwd: string, artifactPaths: Record<RendezvousArtifactId, string>): string => {
  const mtimes = rendezvousArtifactIds
    .map((artifactId) => path.resolve(cwd, artifactPaths[artifactId]))
    .filter((absolute) => fs.existsSync(absolute))
    .map((absolute) => fs.statSync(absolute).mtimeMs);

  if (mtimes.length === 0) {
    return '1970-01-01T00:00:00.000Z';
  }

  return new Date(Math.max(...mtimes)).toISOString();
};

const deriveRemediationId = (cwd: string): string => {
  try {
    const latest = readJsonArtifact<TestAutofixArtifact>(cwd, DEFAULT_ARTIFACT_PATHS['test-autofix']);
    const signature = latest.failure_signatures?.[0] ?? 'none';
    return `${latest.run_id}-${signature}`;
  } catch {
    return 'rendezvous-unset';
  }
};


const uniqueSorted = <T extends string>(values: T[]): T[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const reconcileEvaluation = (
  manifest: RendezvousManifest,
  evaluation: RendezvousManifestEvaluation,
  observed: RendezvousManifestArtifactObservations
): RendezvousManifestEvaluation => {
  const observedMissing = manifest.requiredArtifactIds.filter((artifactId) => !observed[artifactId]);
  const observedVerificationFailures = manifest.requiredArtifactIds.filter(
    (artifactId) => observed[artifactId] && observed[artifactId]?.verification !== 'passed'
  );

  const blockers = uniqueSorted([
    ...evaluation.blockers,
    ...observedMissing.map((artifactId) => `${artifactId}: observed artifact is currently missing`),
    ...observedVerificationFailures.map((artifactId) => `${artifactId}: observed verification status must be passed`)
  ]);

  const missingArtifactIds = uniqueSorted([...evaluation.missingArtifactIds, ...observedMissing]);
  const conflictingArtifactIds = uniqueSorted([...evaluation.conflictingArtifactIds]);
  const stale = evaluation.stale;

  const state: RendezvousManifestEvaluation['state'] =
    conflictingArtifactIds.length > 0
      ? 'conflicted'
      : stale
        ? 'stale'
        : missingArtifactIds.length > 0 || observedVerificationFailures.length > 0 || blockers.length > 0
          ? 'incomplete'
          : 'complete';

  return {
    state,
    releaseReady: state === 'complete' && blockers.length === 0,
    blockers,
    missingArtifactIds,
    conflictingArtifactIds,
    stale
  };
};

const nextActionFromEvaluation = (evaluation: RendezvousManifestEvaluation): string => {
  if (evaluation.state === 'complete' && evaluation.releaseReady) {
    return 'Release gate is ready; run release with --dry-run for operator confirmation.';
  }

  if (evaluation.state === 'stale') {
    return 'Recreate rendezvous manifest so baseSha matches current HEAD.';
  }

  if (evaluation.state === 'conflicted') {
    return 'Rebuild conflicting artifacts and recreate rendezvous manifest to capture fresh hashes.';
  }

  if (evaluation.missingArtifactIds.length > 0) {
    return `Generate missing artifacts (${evaluation.missingArtifactIds.join(', ')}) and rerun rendezvous create.`;
  }

  return 'Resolve blockers listed in rendezvous status and rerun rendezvous create.';
};

const renderText = (subcommand: 'create' | 'status' | 'release', payload: RendezvousPayload): string =>
  renderBriefOutput({
    title: `Artifact rendezvous ${subcommand}`,
    decision: payload.evaluation.releaseReady ? 'release-ready' : 'hold',
    status: payload.evaluation.state,
    blockers: payload.evaluation.blockers,
    affectedSurfaces: [
      `${payload.evaluation.missingArtifactIds.length} missing artifact(s)`,
      `${payload.evaluation.conflictingArtifactIds.length} conflicting artifact(s)`,
      payload.evaluation.stale ? 'manifest stale on head sha change' : 'manifest sha current'
    ],
    nextAction: payload.nextAction,
    artifactRefs: [payload.manifestPath],
    extraSections: [
      {
        label: 'Missing artifacts',
        items: payload.evaluation.missingArtifactIds.length > 0 ? payload.evaluation.missingArtifactIds : ['none']
      },
      {
        label: 'Blockers',
        items: payload.evaluation.blockers.length > 0 ? payload.evaluation.blockers : ['none']
      }
    ]
  });

const createManifest = (cwd: string): RendezvousPayload => {
  const currentSha = resolveCurrentSha(cwd);
  const observed = collectObservedArtifacts(cwd, DEFAULT_ARTIFACT_PATHS);
  const blockers = rendezvousArtifactIds
    .map((artifactId) => {
      const verification = verifyArtifact(cwd, artifactId, DEFAULT_ARTIFACT_PATHS[artifactId]);
      if (verification.reason && verification.verification !== 'passed') {
        return { artifactId, reason: verification.reason };
      }
      return null;
    })
    .filter((entry): entry is { artifactId: RendezvousArtifactId; reason: string } => entry !== null);

  const passed = Object.values(observed).filter((entry) => entry.verification === 'passed').length;
  const confidence = passed / rendezvousArtifactIds.length;

  const manifest = engine.buildRendezvousManifest({
    generatedAt: deriveGeneratedAt(cwd, DEFAULT_ARTIFACT_PATHS),
    baseSha: currentSha,
    remediationId: deriveRemediationId(cwd),
    requiredArtifactIds: [...rendezvousArtifactIds],
    artifacts: observed,
    blockers,
    confidence,
    staleOnShaChange: true
  });

  const manifestAbsolute = path.resolve(cwd, MANIFEST_PATH);
  fs.mkdirSync(path.dirname(manifestAbsolute), { recursive: true });
  fs.writeFileSync(manifestAbsolute, deterministicStringify(manifest), 'utf8');

  const evaluation = reconcileEvaluation(
    manifest,
    engine.evaluateRendezvousManifest(manifest, {
      currentSha,
      observedArtifacts: observed
    }),
    observed
  );

  return {
    schemaVersion: '1.0',
    command: 'rendezvous',
    subcommand: 'create',
    manifestPath: MANIFEST_PATH,
    manifest,
    evaluation,
    observedArtifacts: observed,
    currentSha,
    nextAction: nextActionFromEvaluation(evaluation)
  };
};

const readManifest = (cwd: string): RendezvousManifest => {
  try {
    return readJsonArtifact<RendezvousManifest>(cwd, MANIFEST_PATH);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`playbook rendezvous: missing or invalid manifest at ${MANIFEST_PATH}. ${message}`);
  }
};

const buildStatusPayload = (cwd: string, subcommand: 'status' | 'release', dryRun?: boolean): RendezvousPayload => {
  const currentSha = resolveCurrentSha(cwd);
  const manifest = readManifest(cwd);
  const observed = collectObservedArtifacts(cwd, DEFAULT_ARTIFACT_PATHS);
  const evaluation = reconcileEvaluation(
    manifest,
    engine.evaluateRendezvousManifest(manifest, {
      currentSha,
      observedArtifacts: observed
    }),
    observed
  );

  return {
    schemaVersion: '1.0',
    command: 'rendezvous',
    subcommand,
    manifestPath: MANIFEST_PATH,
    manifest,
    evaluation,
    observedArtifacts: observed,
    currentSha,
    nextAction: nextActionFromEvaluation(evaluation),
    dryRun
  };
};

export const runRendezvous = async (cwd: string, commandArgs: string[], options: RendezvousOptions): Promise<number> => {
  const subcommand = commandArgs.find((arg) => !arg.startsWith('-'));
  if (options.help || !subcommand || subcommand === 'help') {
    printCommandHelp({
      usage: 'playbook rendezvous <create|status|release> [--dry-run] [--json]',
      description: 'Read-first artifact rendezvous surface for pause/resume/release remediation readiness from canonical artifacts.',
      options: [
        'create                   Build/update .playbook/rendezvous-manifest.json from canonical remediation artifacts',
        'status                   Evaluate rendezvous readiness from manifest + observed artifacts',
        'release --dry-run        Evaluate release gate only (no mutation path in v1)',
        '--json                   Print full details in JSON',
        '--help                   Show help'
      ],
      artifacts: [MANIFEST_PATH]
    });
    return subcommand || options.help ? ExitCode.Success : ExitCode.Failure;
  }

  try {
    if (subcommand === 'create') {
      const payload = createManifest(cwd);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'rendezvous', payload });
      } else if (!options.quiet) {
        console.log(renderText('create', payload));
      }
      return ExitCode.Success;
    }

    if (subcommand === 'status') {
      const payload = buildStatusPayload(cwd, 'status');
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'rendezvous', payload });
      } else if (!options.quiet) {
        console.log(renderText('status', payload));
      }
      return ExitCode.Success;
    }

    if (subcommand === 'release') {
      const dryRun = commandArgs.includes('--dry-run');
      if (!dryRun) {
        throw new Error('playbook rendezvous release: only --dry-run is supported in v1 (no direct mutation path).');
      }

      const payload = buildStatusPayload(cwd, 'release', true);
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'rendezvous', payload });
      } else if (!options.quiet) {
        console.log(renderText('release', payload));
      }

      return payload.evaluation.releaseReady ? ExitCode.Success : ExitCode.Failure;
    }

    throw new Error(`playbook rendezvous: unknown subcommand "${subcommand}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      console.log(JSON.stringify({ schemaVersion: '1.0', command: 'rendezvous', error: message }, null, 2));
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};
