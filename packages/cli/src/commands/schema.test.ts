import { describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';
import { runSchema } from './schema.js';

describe('runSchema', () => {
  it('prints all schemas', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', [], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toHaveProperty('rules');
    expect(payload).toHaveProperty('explain');
    expect(payload).toHaveProperty('index');
    expect(payload).toHaveProperty('verify');
    expect(payload).toHaveProperty('plan');
    expect(payload).toHaveProperty('context');
    expect(payload).toHaveProperty('ai-context');
    expect(payload).toHaveProperty('ai-contract');
    expect(payload).toHaveProperty('ai-propose');
    expect(payload).toHaveProperty('query');
    expect(payload).toHaveProperty('ignore');
    expect(payload).toHaveProperty('learn');

    logSpy.mockRestore();
  });

  it('prints the rules schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['rules'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.command).toBeUndefined();
    expect(payload.title).toBe('PlaybookRulesOutput');

    logSpy.mockRestore();
  });

  it('prints the explain schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['explain'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookExplainOutput');

    logSpy.mockRestore();
  });



  it('prints the context schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['context'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookContextOutput');

    logSpy.mockRestore();
  });

  it('prints the ai-context schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['ai-context'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookAiContextOutput');

    const guidance = ((payload.properties as Record<string, unknown>).guidance as Record<string, unknown>);
    expect(guidance.required).toEqual([
      'preferPlaybookCommands',
      'authorityRule',
      'localExecutionRule',
      'failureMode',
      'memoryCommandFamily',
      'promotedKnowledgeGuidance',
      'candidateKnowledgeGuidance'
    ]);

    const guidanceProps = guidance.properties as Record<string, unknown>;
    const memoryFamily = guidanceProps.memoryCommandFamily as Record<string, unknown>;
    expect((memoryFamily.required as string[])).toEqual(['available', 'preferredCommands']);

    logSpy.mockRestore();
  });




  it('prints the ai-contract schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['ai-contract'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookAiContractOutput');

    const contractSchema = ((payload.properties as Record<string, unknown>).contract as Record<string, unknown>);
    expect(contractSchema.required).toContain('memory');

    const contractProps = contractSchema.properties as Record<string, unknown>;
    const memorySchema = contractProps.memory as Record<string, unknown>;
    expect(memorySchema.required).toEqual(['artifactLocations', 'promotedKnowledgePolicy', 'retrieval']);

    const memoryProps = memorySchema.properties as Record<string, unknown>;
    const artifactLocations = memoryProps.artifactLocations as Record<string, unknown>;
    expect((artifactLocations.required as string[])).toEqual(['events', 'candidates', 'policyEvaluation', 'policyApplyResult', 'promotedKnowledge']);

    const retrieval = memoryProps.retrieval as Record<string, unknown>;
    expect((retrieval.required as string[])).toEqual(['requireProvenance', 'provenanceFields']);

    logSpy.mockRestore();
  });


  it('prints the ai-propose schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['ai-propose'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookAiProposeOutput');

    const properties = payload.properties as Record<string, unknown>;
    const scope = properties.scope as Record<string, unknown>;
    expect(scope.required).toEqual(['mode', 'boundaries', 'allowedInputs', 'optionalInputs']);

    logSpy.mockRestore();
  });

  it('prints the doctor schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['doctor'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookDoctorOutput');

    const required = payload.required as string[];
    expect(required).toContain('memoryDiagnostics');

    const doctorProps = payload.properties as Record<string, unknown>;
    const findings = doctorProps.findings as Record<string, unknown>;
    const findingProps = ((findings.items as Record<string, unknown>).properties ?? {}) as Record<string, unknown>;
    const category = findingProps.category as Record<string, unknown>;
    expect(category.enum).toContain('Memory');

    const memoryDiagnostics = doctorProps.memoryDiagnostics as Record<string, unknown>;
    expect(memoryDiagnostics.required).toEqual(['findings', 'suggestions']);

    logSpy.mockRestore();
  });

  it('prints the query schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['query'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookQueryOutput');

    logSpy.mockRestore();
  });

  it('prints the ignore schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['ignore'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookIgnoreOutput');

    logSpy.mockRestore();
  });


  it('prints the learn schema', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['learn'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.title).toBe('PlaybookLearnDraftOutput');

    logSpy.mockRestore();
  });



  it('emits additive schema fields for memory-aware query/explain and plan/analyze-pr outputs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(await runSchema('/repo', ['query'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const querySchema = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const queryOneOf = querySchema.oneOf as Array<Record<string, unknown>>;
    const queryWithMemory = queryOneOf.find((entry) => Array.isArray(entry.required) && (entry.required as string[]).includes('memoryKnowledge'));
    expect(queryWithMemory).toBeDefined();

    logSpy.mockClear();
    expect(await runSchema('/repo', ['explain'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const explainSchema = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const explainOneOf = explainSchema.oneOf as Array<Record<string, unknown>>;
    const successExplain = explainOneOf[1] as Record<string, unknown>;
    const explainProps = (((successExplain.properties as Record<string, unknown>).explanation as Record<string, unknown>).properties ?? {}) as Record<string, unknown>;
    expect(explainProps).toHaveProperty('memoryKnowledge');

    logSpy.mockClear();
    expect(await runSchema('/repo', ['plan'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const planSchema = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const planTaskProps = (((planSchema.properties as Record<string, unknown>).tasks as Record<string, unknown>).items as Record<string, unknown>).properties as Record<string, unknown>;
    expect(planTaskProps).toHaveProperty('advisory');

    logSpy.mockClear();
    expect(await runSchema('/repo', ['analyze-pr'], { format: 'json', quiet: false })).toBe(ExitCode.Success);
    const analyzeSchema = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    const analyzeOneOf = analyzeSchema.oneOf as Array<Record<string, unknown>>;
    const analyzeSuccess = analyzeOneOf[1] as Record<string, unknown>;
    expect(((analyzeSuccess.required as string[]) ?? [])).toContain('preventionGuidance');

    logSpy.mockRestore();
  });

  it('extends contracts schema with schema registry section', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['contracts'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload.required).toContain('schemas');

    logSpy.mockRestore();
  });

  it('fails on unknown schema target', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitCode = await runSchema('/repo', ['unknown-command'], { format: 'json', quiet: false });

    expect(exitCode).toBe(ExitCode.Failure);
    expect(errorSpy).toHaveBeenCalledWith('playbook schema: unknown schema target "unknown-command"');

    errorSpy.mockRestore();
  });
});
