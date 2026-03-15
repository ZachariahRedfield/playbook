import path from 'node:path';
import type { ArchitectureRegistry, ArtifactOwnership } from '@zachariahredfield/playbook-core';

export type ArchitectureValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  ownership: ArtifactOwnership[];
};

export type ValidateArtifactsOptions = {
  knownCommands: string[];
};

const isValidArtifactPath = (artifact: string): boolean => {
  if (!artifact.startsWith('.playbook/')) {
    return false;
  }

  const normalized = path.posix.normalize(artifact);
  if (normalized !== artifact) {
    return false;
  }

  return !artifact.includes('..') && !path.posix.isAbsolute(artifact);
};


const isDeterministicSubsystemName = (name: string): boolean => /^[a-z][a-z0-9_]*$/.test(name);

const detectCycle = (graph: Map<string, string[]>): string[] | null => {
  const state = new Map<string, 'visiting' | 'visited'>();
  const trail: string[] = [];

  const visit = (node: string): string[] | null => {
    const current = state.get(node);
    if (current === 'visiting') {
      const cycleStart = trail.indexOf(node);
      if (cycleStart >= 0) {
        return [...trail.slice(cycleStart), node];
      }
      return [node, node];
    }

    if (current === 'visited') {
      return null;
    }

    state.set(node, 'visiting');
    trail.push(node);

    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) {
        return cycle;
      }
    }

    trail.pop();
    state.set(node, 'visited');
    return null;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) {
      return cycle;
    }
  }

  return null;
};

export const validateArtifacts = (
  registry: ArchitectureRegistry,
  options: ValidateArtifactsOptions
): ArchitectureValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ownership: ArtifactOwnership[] = [];

  const knownCommands = new Set(options.knownCommands);
  const subsystemNames = new Set<string>();
  const artifactOwners = new Map<string, string[]>();
  const dependencyGraph = new Map<string, string[]>();

  for (const subsystem of registry.subsystems) {
    if (subsystemNames.has(subsystem.name)) {
      errors.push(`Duplicate subsystem name: ${subsystem.name}`);
    }
    subsystemNames.add(subsystem.name);

    if (!isDeterministicSubsystemName(subsystem.name)) {
      errors.push(`Invalid subsystem name "${subsystem.name}": expected deterministic snake_case token.`);
    }

    const downstream = subsystem.downstream ?? [];
    dependencyGraph.set(subsystem.name, downstream);

    for (const command of subsystem.commands) {
      if (!knownCommands.has(command)) {
        errors.push(`Unknown command mapping "${command}" in subsystem "${subsystem.name}".`);
      }
    }

    for (const artifact of subsystem.artifacts) {
      if (!isValidArtifactPath(artifact)) {
        errors.push(`Invalid artifact path "${artifact}" in subsystem "${subsystem.name}".`);
      }

      const owners = artifactOwners.get(artifact) ?? [];
      owners.push(subsystem.name);
      artifactOwners.set(artifact, owners);
      ownership.push({ artifact, subsystem: subsystem.name });
    }

    if (subsystem.commands.length === 0 && subsystem.artifacts.length === 0) {
      warnings.push(`Subsystem "${subsystem.name}" has no command or artifact mappings.`);
    }
  }

  for (const subsystem of registry.subsystems) {
    for (const relatedSubsystem of subsystem.upstream ?? []) {
      if (!subsystemNames.has(relatedSubsystem)) {
        errors.push(`Unknown upstream subsystem "${relatedSubsystem}" declared by "${subsystem.name}".`);
      }
    }

    for (const relatedSubsystem of subsystem.downstream ?? []) {
      if (!subsystemNames.has(relatedSubsystem)) {
        errors.push(`Unknown downstream subsystem "${relatedSubsystem}" declared by "${subsystem.name}".`);
      }
    }
  }

  const cycle = detectCycle(dependencyGraph);
  if (cycle) {
    errors.push(`Circular subsystem dependency detected: ${cycle.join(' -> ')}`);
  }

  for (const [artifact, owners] of artifactOwners.entries()) {
    if (owners.length > 1) {
      errors.push(`Duplicate artifact ownership: ${artifact} -> ${owners.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    ownership
  };
};
