import { CSIA_SCHEMA_SOURCE, DEFAULT_CSIA_SOURCE, loadValidatedCsiaFramework } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../lib/jsonArtifact.js';
import { ExitCode } from '../../lib/cliContract.js';


type CsiaPrimitive = 'compute' | 'simulate' | 'interpret' | 'adapt';

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
  mitigation?: string;
};

type CsiaFrameworkArtifact = {
  schemaVersion: '1.0';
  kind: 'csia-framework';
  primitives: CsiaPrimitive[];
  bridges: Array<{ from: CsiaPrimitive; to: CsiaPrimitive; intent: string }>;
  regimes: CsiaRegime[];
  failureModes: CsiaFailureMode[];
};

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

const SUPPORTED_PRIMITIVES: CsiaPrimitive[] = ['compute', 'simulate', 'interpret', 'adapt'];

const readOptionValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
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

const buildDimensionFlags = (regime: CsiaRegime): Record<CsiaPrimitive, { present: boolean; role: 'dominant' | 'secondary' | 'absent' }> => {
  const regimePrimitives = collectRegimePrimitives(regime);
  return {
    compute: {
      present: regimePrimitives.has('compute'),
      role: regime.dominantPrimitive === 'compute' ? 'dominant' : regime.secondaryPrimitives.includes('compute') ? 'secondary' : 'absent'
    },
    simulate: {
      present: regimePrimitives.has('simulate'),
      role: regime.dominantPrimitive === 'simulate' ? 'dominant' : regime.secondaryPrimitives.includes('simulate') ? 'secondary' : 'absent'
    },
    interpret: {
      present: regimePrimitives.has('interpret'),
      role: regime.dominantPrimitive === 'interpret' ? 'dominant' : regime.secondaryPrimitives.includes('interpret') ? 'secondary' : 'absent'
    },
    adapt: {
      present: regimePrimitives.has('adapt'),
      role: regime.dominantPrimitive === 'adapt' ? 'dominant' : regime.secondaryPrimitives.includes('adapt') ? 'secondary' : 'absent'
    }
  };
};

const buildAssociatedExamples = (regime: CsiaRegime): string[] => {
  if (!regime.notes) {
    return [];
  }
  return [regime.notes.trim()].filter(Boolean);
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
  const sourcePath = readOptionValue(commandArgs, '--from') ?? DEFAULT_CSIA_SOURCE;
  const { artifact: loadedArtifact, sourcePathForOutput } = loadValidatedCsiaFramework(cwd, sourcePath);
  const artifact = loadedArtifact as CsiaFrameworkArtifact;
  const filteredRegimes = filterRegimes(artifact, commandArgs);
  const failureModes = selectLinkedFailureModes(artifact.failureModes, filteredRegimes);
  const dominantPrimitiveSummary = summarizeDominantPrimitives(filteredRegimes);
  const mappings = filteredRegimes.map((regime) => ({
    mapping_id: regime.id,
    dominant_dimension: regime.dominantPrimitive,
    secondary_dimensions: regime.secondaryPrimitives,
    dimensions: buildDimensionFlags(regime),
    associated_examples: buildAssociatedExamples(regime)
  }));

  const payload = {
    schemaVersion: '1.0',
    command: 'patterns',
    action: 'csia',
    mode: 'read-only',
    proposal_only: true,
    overlay: {
      kind: 'csia-overlay',
      description: 'Machine-readable CSIA mapping overlay for inspection only.'
    },
    source_path: sourcePathForOutput,
    sources: {
      schema: CSIA_SCHEMA_SOURCE,
      mappings: sourcePathForOutput
    },
    provenance: [
      { type: 'schema', path: CSIA_SCHEMA_SOURCE },
      { type: 'mappings', path: sourcePathForOutput }
    ],
    mappings,
    primitives: artifact.primitives,
    bridges: artifact.bridges,
    regimes: filteredRegimes,
    failureModes,
    dominant_primitive_summary: dominantPrimitiveSummary,
    framework_relationship: {
      minimum_cognitive_core: 'frozen reasoning kernel',
      cognitive_dynamics_framework_v0_1: 'doctrine-level interpretation and recalibration model',
      csia: 'machine-readable analysis overlay only'
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
