import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCode } from '../lib/cliContract.js';

const generateRepositoryHealth = vi.fn();
const runSchema = vi.fn();
const hasRegisteredCommand = vi.fn();
const loadVerifyRules = vi.fn();
const existsSync = vi.fn();
const loadAiContract = vi.fn();

const SUPPORTED_QUERY_FIELDS = ['architecture', 'framework', 'language', 'modules', 'database', 'rules'] as const;

const validContract = {
  schemaVersion: '1.0' as const,
  kind: 'playbook-ai-contract' as const,
  ai_runtime: 'playbook-agent' as const,
  workflow: ['index', 'query', 'plan', 'apply', 'verify'] as const,
  intelligence_sources: {
    repoIndex: '.playbook/repo-index.json' as const,
    moduleOwners: '.playbook/module-owners.json' as const
  },
  queries: ['architecture', 'dependencies', 'impact', 'risk', 'docs-coverage', 'rule-owners', 'module-owners'] as const,
  remediation: {
    canonicalFlow: ['verify', 'plan', 'apply', 'verify'] as const,
    diagnosticAugmentation: ['explain'] as const
  },
  rules: {
    requireIndexBeforeQuery: true as const,
    preferPlaybookCommandsOverAdHocInspection: true as const,
    allowDirectEditsWithoutPlan: false as const
  }
};

const doctorFixes = [
  {
    id: 'doctor.fix.docs.directory',
    description: 'Ensure docs/ directory exists.',
    safeToAutoApply: true,
    check: vi.fn(async () => ({ applicable: true })),
    fix: vi.fn(async () => ({ changes: ['docs/'] }))
  },
  {
    id: 'doctor.fix.config.file',
    description: 'Repair missing playbook.config.json using Playbook defaults.',
    safeToAutoApply: true,
    check: vi.fn(async () => ({ applicable: false })),
    fix: vi.fn(async () => ({ changes: ['playbook.config.json'] }))
  }
];

vi.mock('@zachariahredfield/playbook-engine', () => ({
  AI_CONTRACT_FILE: '.playbook/ai-contract.json',
  SUPPORTED_QUERY_FIELDS,
  generateRepositoryHealth,
  loadAiContract
}));

vi.mock('node:fs', () => ({
  default: { existsSync },
  existsSync
}));

vi.mock('./schema.js', () => ({
  runSchema
}));

vi.mock('./index.js', async () => {
  const actual = await vi.importActual('./index.js');
  return {
    ...(actual as object),
    hasRegisteredCommand
  };
});

vi.mock('../lib/loadVerifyRules.js', () => ({
  loadVerifyRules
}));

vi.mock('../lib/doctorFixes.js', () => ({
  doctorFixes
}));

const healthyReport = {
  framework: 'Next.js',
  language: 'TypeScript',
  architecture: 'Modular Monolith',
  governanceStatus: [
    { id: 'playbook-config', ok: true, message: 'Playbook config detected' },
    { id: 'architecture-docs', ok: true, message: 'Architecture docs present' },
    { id: 'checklist-verify-step', ok: true, message: 'PLAYBOOK_CHECKLIST includes verify step' },
    { id: 'repo-index', ok: true, message: 'Repo index up to date' }
  ],
  verifySummary: { ok: true, failures: 0, warnings: 0 },
  artifactHygiene: {
    classification: { runtime: [], automation: [], contract: [] },
    findings: [],
    suggestions: []
  },
  suggestedActions: [],
  issues: []
};

const setAvailableCommands = (commands: string[]): void => {
  hasRegisteredCommand.mockImplementation((name: string) => commands.includes(name));
};

const setExistsPaths = (paths: string[]): void => {
  existsSync.mockImplementation((value: string) => paths.some((suffix) => value.endsWith(suffix)));
};

describe('runDoctor', () => {
  beforeEach(() => {
    generateRepositoryHealth.mockReset();
    runSchema.mockReset();
    hasRegisteredCommand.mockReset();
    loadVerifyRules.mockReset();
    existsSync.mockReset();
    loadAiContract.mockReset();
    doctorFixes[0].check.mockClear();
    doctorFixes[1].check.mockClear();

    runSchema.mockResolvedValue(ExitCode.Success);
    loadVerifyRules.mockResolvedValue([{ id: 'rule-1' }]);
    setAvailableCommands(['context', 'index', 'query', 'plan', 'apply', 'verify', 'ai-contract', 'explain']);
    setExistsPaths(['.playbook/repo-index.json', '.playbook/module-owners.json', '.playbook/ai-contract.json']);
    loadAiContract.mockReturnValue({ source: 'file', contract: validContract, contractFile: '.playbook/ai-contract.json' });
  });

  it('prints repository health text output', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    generateRepositoryHealth.mockReturnValue(healthyReport);

    const exitCode = await runDoctor(process.cwd(), {
      format: 'text',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: false
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('Repository Health');
    expect(output).toContain('Framework: Next.js');
    expect(output).toContain('Automation');
    expect(output).toContain('1 safe fixes available');

    logSpy.mockRestore();
  });

  it('prints doctor json contract output', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    generateRepositoryHealth.mockReturnValue({
      ...healthyReport,
      issues: ['Repo index outdated'],
      suggestedActions: ['playbook analyze'],
      artifactHygiene: {
        classification: { runtime: [], automation: [], contract: [] },
        findings: [],
        suggestions: []
      }
    });

    const exitCode = await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: false
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(exitCode).toBe(ExitCode.Success);
    expect(payload).toEqual({
      command: 'doctor',
      framework: 'Next.js',
      architecture: 'Modular Monolith',
      issues: ['Repo index outdated'],
      suggestedActions: ['playbook analyze'],
      artifactHygiene: {
        classification: { runtime: [], automation: [], contract: [] },
        findings: [],
        suggestions: []
      }
    });

    logSpy.mockRestore();
  });

  it('prints doctor --ai text output with contract readiness sections', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const exitCode = await runDoctor(process.cwd(), {
      format: 'text',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: true
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(exitCode).toBe(ExitCode.Success);
    expect(output).toContain('AI Environment Check');
    expect(output).toContain('Core AI Checks');
    expect(output).toContain('AI Contract Readiness');
    expect(output).toContain('✓ AI contract available (source: file)');
    expect(output).toContain('✓ AI contract valid');
    expect(output).toContain('✓ Required query surface available');
    expect(output).toContain('✓ Remediation workflow ready');
    expect(output).toContain('Result');
    expect(output).toContain('Playbook repository is AI-contract ready.');

    logSpy.mockRestore();
  });

  it('returns generated-contract fallback as warn', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    setExistsPaths(['.playbook/repo-index.json', '.playbook/module-owners.json']);
    loadAiContract.mockReturnValue({ source: 'generated', contract: validContract, contractFile: '.playbook/ai-contract.json' });

    await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: true
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.checks).toContainEqual({
      name: 'aiContractAvailability',
      status: 'warn',
      source: 'generated'
    });

    logSpy.mockRestore();
  });

  it('fails when AI contract cannot be loaded', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    loadAiContract.mockImplementation(() => {
      throw new Error('Unsupported AI contract schemaVersion "2.0". Expected "1.0".');
    });

    await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: true
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.checks).toContainEqual(
      expect.objectContaining({ name: 'aiContractValidity', status: 'fail' })
    );

    logSpy.mockRestore();
  });

  it('fails for missing required intelligence source', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    setExistsPaths(['.playbook/ai-contract.json']);

    await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: true
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const intelligenceSources = payload.checks.find((check: { name: string }) => check.name === 'intelligenceSources');
    expect(intelligenceSources.status).toBe('fail');

    logSpy.mockRestore();
  });

  it('warns for missing optional intelligence source', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    setExistsPaths(['.playbook/repo-index.json', '.playbook/ai-contract.json']);

    await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: true
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const intelligenceSources = payload.checks.find((check: { name: string }) => check.name === 'intelligenceSources');
    expect(intelligenceSources.status).toBe('warn');

    logSpy.mockRestore();
  });

  it('fails required query and command surface checks when unavailable', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    loadAiContract.mockReturnValue({
      source: 'file',
      contract: {
        ...validContract,
        queries: [...validContract.queries, 'not-a-query']
      },
      contractFile: '.playbook/ai-contract.json'
    });
    setAvailableCommands(['context', 'index', 'query', 'apply', 'verify']);

    await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: true
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const querySurface = payload.checks.find((check: { name: string }) => check.name === 'querySurface');
    const commandSurface = payload.checks.find((check: { name: string }) => check.name === 'commandSurface');

    expect(querySurface.status).toBe('fail');
    expect(querySurface.missingQueries).toContain('not-a-query');
    expect(commandSurface.status).toBe('fail');
    expect(commandSurface.missingCommands).toEqual(expect.arrayContaining(['plan', 'ai-contract']));

    logSpy.mockRestore();
  });

  it('fails remediation workflow readiness when required command is missing', async () => {
    const { runDoctor } = await import('./doctor.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    setAvailableCommands(['context', 'index', 'query', 'plan', 'verify', 'ai-contract', 'explain']);

    await runDoctor(process.cwd(), {
      format: 'json',
      quiet: false,
      fix: false,
      dryRun: false,
      yes: false,
      ai: true
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    const remediation = payload.checks.find((check: { name: string }) => check.name === 'remediationWorkflow');
    expect(remediation.status).toBe('fail');
    expect(remediation.missingCommands).toContain('apply');

    logSpy.mockRestore();
  });
});
