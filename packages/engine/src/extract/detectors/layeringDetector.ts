import { createHash } from 'node:crypto';
import type { Detector, PatternCandidate } from './types.js';

const clamp = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(2))));

const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

const moduleName = (nodeId: string): string => nodeId.replace(/^module:/, '');

export const layeringDetector: Detector = {
  detector: 'layering',
  detect: ({ graph }) => {
    const dependencyEdges = graph.edges.filter((edge) => edge.kind === 'depends_on');
    if (dependencyEdges.length === 0) {
      return [];
    }

    const edgeKeys = new Set(dependencyEdges.map((edge) => `${edge.from}->${edge.to}`));
    const reciprocalPairs = new Set<string>();

    for (const edge of dependencyEdges) {
      const reverseKey = `${edge.to}->${edge.from}`;
      if (edgeKeys.has(reverseKey)) {
        const pair = [edge.from, edge.to].sort((a, b) => a.localeCompare(b)).join('<->');
        reciprocalPairs.add(pair);
      }
    }

    const moduleCount = graph.nodes.filter((node) => node.kind === 'module').length;
    const confidence = clamp(0.55 + (moduleCount >= 4 ? 0.2 : 0) + (reciprocalPairs.size === 0 ? 0.2 : 0) - Math.min(0.4, reciprocalPairs.size * 0.1));

    const idSeed = JSON.stringify({ detector: 'layering', moduleCount, edgeCount: dependencyEdges.length, reciprocalPairs: [...reciprocalPairs].sort((a, b) => a.localeCompare(b)) });
    const candidate: PatternCandidate = {
      id: `pattern.layering.${shortHash(idSeed)}`,
      detector: 'layering',
      title: 'Directional dependency layering',
      summary:
        reciprocalPairs.size === 0
          ? 'Module dependencies are directional with no reciprocal depends_on pairs, consistent with strict layering boundaries.'
          : `Most dependencies are directional, but ${reciprocalPairs.size} reciprocal module pair(s) indicate layering boundary pressure.`,
      confidence,
      evidence: [
        {
          artifact: '.playbook/repo-graph.json',
          pointer: 'edges[kind=depends_on]',
          summary: `depends_on edges=${dependencyEdges.length}; reciprocalPairs=${reciprocalPairs.size}`
        }
      ],
      related: [...new Set(dependencyEdges.flatMap((edge) => [moduleName(edge.from), moduleName(edge.to)]))].sort((a, b) => a.localeCompare(b))
    };

    return [candidate];
  }
};
