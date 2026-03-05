import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanupSessionSnapshots } from '../src/sessions/cleanup.js';

const makeFile = (dir: string, name: string, daysAgo: number): string => {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, '{}\n', 'utf8');
  const ts = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  fs.utimesSync(filePath, ts / 1000, ts / 1000);
  return filePath;
};

describe('session cleanup', () => {
  it('deletes by age and max count with deterministic retention', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cleanup-'));
    makeFile(dir, 'old.json', 40);
    makeFile(dir, 'recent-a.json', 1);
    makeFile(dir, 'recent-b.json', 2);

    const result = cleanupSessionSnapshots({ sessionsDir: dir, maxDays: 30, maxCount: 1 });

    expect(result.keptCount).toBe(1);
    expect(result.deletedCount).toBe(2);
    expect(fs.existsSync(path.join(dir, 'old.json'))).toBe(false);
  });

  it('supports dry-run without deleting files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cleanup-dry-'));
    const file = makeFile(dir, 'old.json', 100);

    const result = cleanupSessionSnapshots({ sessionsDir: dir, maxDays: 30, maxCount: 50, dryRun: true });

    expect(result.deletedCount).toBe(1);
    expect(fs.existsSync(file)).toBe(true);
  });
});
