import { createHash } from 'node:crypto';
import type { Detector, PatternCandidate } from './types.js';

const clamp = (value: number): number => Math.max(0, Math.min(1, Number(value.toFixed(2))));
const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

export const modularityDetector: Detector = {
  detector: 'modularity',
  detect: ({ graph }) => {
    const modules = graph.nodes.filter((node) => node.kind === 'module');
    if (modules.length === 0) {
      return [];
    }

    const governedBy = graph.edges.filter((edge) => edge.kind === 'governed_by');
    const governedModules = new Set(governedBy.map((edge) => edge.from));
    const governedCoverage = modules.filter((node) => governedModules.has(node.id)).length / modules.length;
    const confidence = clamp(0.5 + Math.min(0.4, governedCoverage * 0.4) + (modules.length >= 3 ? 0.1 : 0));

    const idSeed = JSON.stringify({ detector: 'modularity', modules: modules.map((module) => module.id), governedBy: governedBy.length, governedCoverage });

    const candidate: PatternCandidate = {
      id: `pattern.modularity.${shortHash(idSeed)}`,
      detector: 'modularity',
      title: 'Module governance symmetry',
      summary: `Repository graph tracks ${modules.length} module node(s) with governed_by coverage ${(governedCoverage * 100).toFixed(0)}%, indicating explicit modular governance boundaries.`,
      confidence,
      evidence: [
        {
          artifact: '.playbook/repo-graph.json',
          pointer: 'stats.nodeKinds.module + edges[kind=governed_by]',
          summary: `modules=${modules.length}; governed_by_edges=${governedBy.length}; coverage=${governedCoverage.toFixed(2)}`
        }
      ],
      related: modules.map((module) => module.name).sort((a, b) => a.localeCompare(b))
    };

    return [candidate];
  }
};
