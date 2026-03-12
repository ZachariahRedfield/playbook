import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import {
  applyExecutionPlan,
  captureMemoryEvent,
  computeMemoryEventFingerprint,
  generateExecutionPlan,
  verifyRepo,
  analyzePullRequest
} from '../src/index.js';
import { verifyMemoryEventFixture } from './__fixtures__/memoryEvent.fixture.js';

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const initGitRepo = (root: string): void => {
  const run = (cmd: string) => {
    execSync(cmd, { cwd: root, stdio: 'ignore' });
  };

  run('git init');
  run('git config user.email "playbook@example.com"');
  run('git config user.name "Playbook Test"');
  run('git add .');
  run('git commit -m "initial"');
};

describe('memory event capture', () => {
  it('computes deterministic fingerprints from semantic payloads', () => {
    const fingerprintA = computeMemoryEventFingerprint(verifyMemoryEventFixture);

    const fingerprintB = computeMemoryEventFingerprint({
      ...verifyMemoryEventFixture,
      subjectModules: [...verifyMemoryEventFixture.subjectModules].reverse(),
      ruleIds: [...verifyMemoryEventFixture.ruleIds].reverse(),
      riskSummary: { ...verifyMemoryEventFixture.riskSummary, signals: [...verifyMemoryEventFixture.riskSummary.signals].reverse() }
    });

    expect(fingerprintA).toBe(fingerprintB);
  });

  it('writes deterministic event and index artifacts with stable key ordering', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-event-'));
    const event = captureMemoryEvent(root, {
      ...verifyMemoryEventFixture,
      subjectModules: ['module-b', 'module-a'],
      ruleIds: ['PB010', 'PB001']
    });

    const eventPath = path.join(root, '.playbook', 'memory', 'events', `${event.eventInstanceId}.json`);
    const indexPath = path.join(root, '.playbook', 'memory', 'index.json');

    expect(fs.existsSync(eventPath)).toBe(true);
    expect(fs.existsSync(indexPath)).toBe(true);

    const eventRaw = fs.readFileSync(eventPath, 'utf8');
    expect(eventRaw.indexOf('"eventFingerprint"')).toBeLessThan(eventRaw.indexOf('"kind"'));

    const eventPayload = readJson<Record<string, unknown>>(eventPath);
    expect(eventPayload).toMatchObject({
      schemaVersion: '1.0',
      kind: 'verify_run',
      subjectModules: ['module-a', 'module-b'],
      ruleIds: ['PB001', 'PB010']
    });

    const index = readJson<{ byModule: Record<string, string[]>; byRule: Record<string, string[]>; byFingerprint: Record<string, string[]> }>(indexPath);
    expect(Object.keys(index.byModule)).toEqual(['module-a', 'module-b']);
    expect(Object.keys(index.byRule)).toEqual(['PB001', 'PB010']);
    expect(index.byFingerprint[event.eventFingerprint]).toHaveLength(1);
  });

  it('captures verify, plan, and apply events from execution workflows', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-workflow-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'PROJECT_GOVERNANCE.md'), '# Governance\n');
    initGitRepo(root);

    verifyRepo(root);
    const plan = generateExecutionPlan(root);
    await applyExecutionPlan(root, plan.tasks, { dryRun: false });

    const eventsDir = path.join(root, '.playbook', 'memory', 'events');
    const events = fs.readdirSync(eventsDir).filter((entry) => entry.endsWith('.json'));
    const payloads = events.map((entry) => readJson<{ kind: string }>(path.join(eventsDir, entry)));
    expect(payloads.some((entry) => entry.kind === 'verify_run')).toBe(true);
    expect(payloads.some((entry) => entry.kind === 'plan_run')).toBe(true);
    expect(payloads.some((entry) => entry.kind === 'apply_run')).toBe(true);
  });

  it('captures failure_ingest when analyze-pr fails to bootstrap', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-memory-analyze-pr-failure-'));

    expect(() => analyzePullRequest(root, { baseRef: 'main' })).toThrow();

    const eventsDir = path.join(root, '.playbook', 'memory', 'events');
    const events = fs.readdirSync(eventsDir).filter((entry) => entry.endsWith('.json'));
    const payloads = events.map((entry) => readJson<{ kind: string }>(path.join(eventsDir, entry)));
    expect(payloads.some((entry) => entry.kind === 'failure_ingest')).toBe(true);
  });
});
