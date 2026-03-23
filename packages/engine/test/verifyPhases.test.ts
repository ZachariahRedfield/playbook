import { describe, expect, it, vi } from 'vitest';

const loadConfig = vi.fn();
const resolveDiffBase = vi.fn();
const getChangedFiles = vi.fn();
const loadPlugins = vi.fn();
const resetPluginRegistry = vi.fn();
const registerRule = vi.fn();
const getRegisteredRules = vi.fn();
const getCoreRules = vi.fn();
const compactPatterns = vi.fn();
const captureMemoryRuntimeEventSafe = vi.fn();
const buildVerifyMemoryEvent = vi.fn(() => ({ type: 'verify' }));

vi.mock('../src/config/load.js', () => ({ loadConfig }));
vi.mock('../src/git/base.js', () => ({ resolveDiffBase }));
vi.mock('../src/git/diff.js', () => ({ getChangedFiles }));
vi.mock('../src/plugins/loadPlugins.js', () => ({ loadPlugins }));
vi.mock('../src/plugins/pluginRegistry.js', () => ({ resetPluginRegistry, registerRule, getRegisteredRules }));
vi.mock('../src/rules/coreRules.js', () => ({ getCoreRules }));
vi.mock('../src/compaction/compactPatterns.js', () => ({ compactPatterns }));
vi.mock('../src/memory/runtimeEvents.js', () => ({ captureMemoryRuntimeEventSafe, buildVerifyMemoryEvent }));

describe('verifyRepo phase/rule selection', () => {
  it('runs only preflight release governance rules when phase=preflight', async () => {
    const releaseRule = {
      id: 'release.version-governance',
      description: 'release governance',
      check: vi.fn(() => ({ failures: [{ id: 'release.required', message: 'missing release governance' }] }))
    };
    const protectedDocRule = {
      id: 'protected-doc.governance',
      description: 'protected docs',
      check: vi.fn(() => ({ failures: [{ id: 'protected-doc.pending', message: 'pending protected docs work' }] }))
    };

    loadConfig.mockReturnValue({ config: { verify: { rules: { requireNotesOnChanges: [] } } } });
    resolveDiffBase.mockReturnValue({ baseRef: 'origin/main', baseSha: 'abc123' });
    getChangedFiles.mockReturnValue(['packages/cli/src/commands/verify.ts']);
    getCoreRules.mockReturnValue([releaseRule, protectedDocRule]);
    getRegisteredRules.mockImplementation(() => [releaseRule, protectedDocRule]);

    const { verifyRepo } = await import('../src/verify/index.js');
    const report = verifyRepo('/repo', { phase: 'preflight' });

    expect(report.summary.phase).toBe('preflight');
    expect(report.failures).toEqual([{ id: 'release.required', message: 'missing release governance' }]);
    expect(releaseRule.check).toHaveBeenCalledTimes(1);
    expect(protectedDocRule.check).not.toHaveBeenCalled();
  });

  it('runs only explicitly selected rules when ruleIds are provided', async () => {
    const releaseRule = {
      id: 'release.version-governance',
      description: 'release governance',
      check: vi.fn(() => ({ failures: [] }))
    };
    const protectedDocRule = {
      id: 'protected-doc.governance',
      description: 'protected docs',
      check: vi.fn(() => ({ failures: [{ id: 'protected-doc.pending', message: 'pending protected docs work' }] }))
    };

    loadConfig.mockReturnValue({ config: { verify: { rules: { requireNotesOnChanges: [] } } } });
    resolveDiffBase.mockReturnValue({ baseRef: 'origin/main', baseSha: 'abc123' });
    getChangedFiles.mockReturnValue([]);
    getCoreRules.mockReturnValue([releaseRule, protectedDocRule]);
    getRegisteredRules.mockImplementation(() => [releaseRule, protectedDocRule]);

    const { verifyRepo } = await import('../src/verify/index.js');
    const report = verifyRepo('/repo', { ruleIds: ['protected-doc.governance'] });

    expect(report.summary.ruleIds).toEqual(['protected-doc.governance']);
    expect(report.failures).toEqual([{ id: 'protected-doc.pending', message: 'pending protected docs work' }]);
    expect(releaseRule.check).not.toHaveBeenCalled();
    expect(protectedDocRule.check).toHaveBeenCalledTimes(1);
  });
});
