import { createHash } from 'node:crypto';
import type { Detector, PatternCandidate } from './types.js';

const clamp = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(2))));
const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

export const contractSymmetryDetector: Detector = {
  detector: 'contract-symmetry',
  detect: ({ contractsRegistry }) => {
    const runtimeDefaults = [...contractsRegistry.artifacts.runtimeDefaults].sort((left, right) => left.path.localeCompare(right.path));
    if (runtimeDefaults.length === 0) {
      return [];
    }

    const producerCounts = new Map<string, number>();
    for (const entry of runtimeDefaults) {
      producerCounts.set(entry.producer, (producerCounts.get(entry.producer) ?? 0) + 1);
    }

    const symmetricProducers = [...producerCounts.entries()].filter(([, count]) => count > 1).map(([producer]) => producer).sort((a, b) => a.localeCompare(b));
    const confidence = clamp(0.45 + Math.min(0.45, symmetricProducers.length * 0.2) + (runtimeDefaults.some((entry) => entry.path.includes('repo-graph')) && runtimeDefaults.some((entry) => entry.path.includes('repo-index')) ? 0.1 : 0));

    const idSeed = JSON.stringify({ detector: 'contract-symmetry', runtimeDefaults, symmetricProducers });

    const candidate: PatternCandidate = {
      id: `pattern.contract-symmetry.${shortHash(idSeed)}`,
      detector: 'contract-symmetry',
      title: 'Runtime contract symmetry',
      summary: `Contract metadata exposes ${runtimeDefaults.length} runtime default artifact(s) with repeated producer(s): ${symmetricProducers.join(', ') || 'none'}.`,
      confidence,
      evidence: [
        {
          artifact: '.playbook/contracts-registry.json',
          pointer: 'artifacts.runtimeDefaults',
          summary: `runtime_defaults=${runtimeDefaults.length}; symmetric_producers=${symmetricProducers.length}`
        }
      ],
      related: runtimeDefaults.map((entry) => `${entry.producer}:${entry.path}`)
    };

    return [candidate];
  }
};
