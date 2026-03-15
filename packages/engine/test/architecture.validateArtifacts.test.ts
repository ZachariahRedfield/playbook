import { describe, expect, it } from 'vitest';
import type { ArchitectureRegistry } from '@zachariahredfield/playbook-core';
import { validateArtifacts } from '../src/architecture/validateArtifacts.js';

const knownCommands = ['context', 'query', 'execute', 'telemetry'];

const baseRegistry = (): ArchitectureRegistry => ({
  version: 1,
  subsystems: [
    {
      name: 'bootstrap_contract_surface',
      purpose: 'Machine-readable interface for humans and agents',
      commands: ['context'],
      artifacts: ['.playbook/ai-contract.json'],
      downstream: ['knowledge_lifecycle']
    },
    {
      name: 'knowledge_lifecycle',
      purpose: 'Promote durable patterns',
      commands: ['query'],
      artifacts: [],
      upstream: ['bootstrap_contract_surface']
    }
  ]
});

describe('validateArtifacts subsystem dependencies', () => {
  it('accepts valid upstream/downstream relationships', () => {
    const result = validateArtifacts(baseRegistry(), { knownCommands });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects unknown referenced subsystems', () => {
    const registry = baseRegistry();
    registry.subsystems[0].downstream = ['missing_subsystem'];

    const result = validateArtifacts(registry, { knownCommands });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unknown downstream subsystem "missing_subsystem" declared by "bootstrap_contract_surface".');
  });

  it('rejects circular subsystem dependencies', () => {
    const registry = baseRegistry();
    registry.subsystems[1].downstream = ['bootstrap_contract_surface'];

    const result = validateArtifacts(registry, { knownCommands });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Circular subsystem dependency detected: bootstrap_contract_surface -> knowledge_lifecycle -> bootstrap_contract_surface');
  });

  it('rejects non-deterministic subsystem names', () => {
    const registry = baseRegistry();
    registry.subsystems[0].name = 'Bootstrap Contract';

    const result = validateArtifacts(registry, { knownCommands });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid subsystem name "Bootstrap Contract": expected deterministic snake_case token.');
  });
});
