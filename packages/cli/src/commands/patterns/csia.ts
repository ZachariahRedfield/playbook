import fs from 'node:fs';
import path from 'node:path';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

type CsiaPrimitive = 'compute' | 'simulate' | 'interpret' | 'adapt';

type CsiaBridge = {
  from: CsiaPrimitive;
  to: CsiaPrimitive;
  intent: string;
};

type CsiaRegime = {
  id: string;
  dominantPrimitive: CsiaPrimitive;
  secondaryPrimitives: CsiaPrimitive[];
  notes?: string;
};

type CsiaFailureMode = {
  id: string;
  risk: string;
  linkedPrimitives: CsiaPrimitive[];
  mitigation: string;
};

type CsiaFrameworkArtifact = {
  schemaVersion: string;
  kind: 'csia-framework';
  primitives: CsiaPrimitive[];
  bridges: CsiaBridge[];
  regimes: CsiaRegime[];
  failureModes: CsiaFailureMode[];
};

const DEFAULT_CSIA_SOURCE = path.join('docs', 'examples', 'csia-framework.mappings.json');
const SUPPORTED_PRIMITIVES: CsiaPrimitive[] = ['compute', 'simulate', 'interpret', 'adapt'];

const readOptionValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const resolveLocalSourcePath = (cwd: string, commandArgs: string[]): { sourcePath: string; sourcePathForOutput: string } => {
  const from = readOptionValue(commandArgs, '--from') ?? DEFAULT_CSIA_SOURCE;
  const resolvedPath = path.resolve(cwd, from);
  const relativePath = path.relative(cwd, resolvedPath);

  if (path.isAbsolute(from) || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('playbook patterns csia: --from must be a repository-local relative path.');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`playbook patterns csia: mapping file not found: ${from}`);
  }

  return { sourcePath: resolvedPath, sourcePathForOutput: relativePath || '.' };
};

const readCsiaArtifact = (cwd: string, commandArgs: string[]): { artifact: CsiaFrameworkArtifact; sourcePathForOutput: string } => {
  const { sourcePath, sourcePathForOutput } = resolveLocalSourcePath(cwd, commandArgs);
  let parsed: unknown;

  try {
    parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as unknown;
  } catch {
    throw new Error(`playbook patterns csia: invalid JSON in mapping file: ${sourcePathForOutput}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`playbook patterns csia: invalid CSIA mapping artifact: ${sourcePathForOutput}`);
  }

  const candidate = parsed as Partial<CsiaFrameworkArtifact>;
  if (candidate.kind !== 'csia-framework' || !Array.isArray(candidate.regimes) || !Array.isArray(candidate.failureModes) || !Array.isArray(candidate.primitives) || !Array.isArray(candidate.bridges)) {
    throw new Error(`playbook patterns csia: invalid CSIA mapping artifact: ${sourcePathForOutput}`);
  }

  return { artifact: candidate as CsiaFrameworkArtifact, sourcePathForOutput };
};

const collectRegimePrimitives = (regime: CsiaRegime): Set<CsiaPrimitive> => new Set([regime.dominantPrimitive, ...regime.secondaryPrimitives]);

const filterRegimes = (artifact: CsiaFrameworkArtifact, commandArgs: string[]): CsiaRegime[] => {
  const regimeFilter = readOptionValue(commandArgs, '--regime');
  const primitiveFilter = readOptionValue(commandArgs, '--primitive') as CsiaPrimitive | undefined;

  if (primitiveFilter && !SUPPORTED_PRIMITIVES.includes(primitiveFilter)) {
    throw new Error('playbook patterns csia: --primitive must be one of compute|simulate|interpret|adapt.');
  }

  return artifact.regimes.filter((regime) => {
    if (regimeFilter && regime.id !== regimeFilter) {
      return false;
    }

    if (!primitiveFilter) {
      return true;
    }

    return collectRegimePrimitives(regime).has(primitiveFilter);
  });
};

const summarizeDominantPrimitives = (regimes: CsiaRegime[]): Record<CsiaPrimitive, number> => {
  const summary: Record<CsiaPrimitive, number> = {
    compute: 0,
    simulate: 0,
    interpret: 0,
    adapt: 0
  };

  for (const regime of regimes) {
    summary[regime.dominantPrimitive] += 1;
  }

  return summary;
};

const selectLinkedFailureModes = (failureModes: CsiaFailureMode[], filteredRegimes: CsiaRegime[]): CsiaFailureMode[] => {
  const selectedPrimitives = new Set<CsiaPrimitive>();
  for (const regime of filteredRegimes) {
    selectedPrimitives.add(regime.dominantPrimitive);
    for (const primitive of regime.secondaryPrimitives) {
      selectedPrimitives.add(primitive);
    }
  }

  return failureModes.filter((failureMode) => failureMode.linkedPrimitives.some((primitive) => selectedPrimitives.has(primitive)));
};

export const runPatternsCsia = (cwd: string, commandArgs: string[], options: PatternsOptions): number => {
  const { artifact, sourcePathForOutput } = readCsiaArtifact(cwd, commandArgs);
  const filteredRegimes = filterRegimes(artifact, commandArgs);
  const failureModes = selectLinkedFailureModes(artifact.failureModes, filteredRegimes);
  const dominantPrimitiveSummary = summarizeDominantPrimitives(filteredRegimes);

  const payload = {
    schemaVersion: '1.0',
    command: 'patterns',
    action: 'csia',
    source_path: sourcePathForOutput,
    primitives: artifact.primitives,
    bridges: artifact.bridges,
    regimes: filteredRegimes,
    failureModes,
    dominant_primitive_summary: dominantPrimitiveSummary,
    framework_relationship: {
      minimum_cognitive_core: 'frozen reasoning kernel',
      cognitive_dynamics_framework_v0_1: 'doctrine-level interpretation and recalibration model',
      csia: 'machine-readable analysis overlay'
    },
    next_action: 'Use filters (--regime, --primitive) to inspect CSIA slices without mutating runtime truth.'
  };

  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    return ExitCode.Success;
  }

  if (!options.quiet) {
    console.log('status: ok');
    console.log(`source path: ${sourcePathForOutput}`);
    console.log(`regimes returned: ${filteredRegimes.length}`);
    console.log(`dominant primitive summary: compute=${dominantPrimitiveSummary.compute}, simulate=${dominantPrimitiveSummary.simulate}, interpret=${dominantPrimitiveSummary.interpret}, adapt=${dominantPrimitiveSummary.adapt}`);
    console.log(`next action: ${payload.next_action}`);
  }

  return ExitCode.Success;
};
