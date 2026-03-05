import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolveSessionMergeInputs } from './sessionMergeInputs.js';

const createFile = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '{}\n', 'utf8');
};

describe('resolveSessionMergeInputs', () => {
  it('supports explicit file inputs', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cli-session-'));
    createFile(path.join(cwd, '.playbook/sessions/one.json'));
    createFile(path.join(cwd, '.playbook/sessions/two.json'));

    const resolved = resolveSessionMergeInputs(cwd, ['.playbook/sessions/one.json', '.playbook/sessions/two.json']);

    expect(resolved).toEqual([
      path.join(cwd, '.playbook/sessions/one.json'),
      path.join(cwd, '.playbook/sessions/two.json')
    ]);
  });

  it('supports directory inputs by expanding top-level json files', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cli-session-dir-'));
    createFile(path.join(cwd, '.playbook/sessions/b.json'));
    createFile(path.join(cwd, '.playbook/sessions/a.json'));
    createFile(path.join(cwd, '.playbook/sessions/ignore.txt'));

    const resolved = resolveSessionMergeInputs(cwd, ['.playbook/sessions']);

    expect(resolved).toEqual([
      path.join(cwd, '.playbook/sessions/a.json'),
      path.join(cwd, '.playbook/sessions/b.json')
    ]);
  });

  it('supports glob inputs', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cli-session-glob-'));
    createFile(path.join(cwd, '.playbook/sessions/2.json'));
    createFile(path.join(cwd, '.playbook/sessions/1.json'));

    const resolved = resolveSessionMergeInputs(cwd, ['.playbook/sessions/*.json']);

    expect(resolved).toEqual([
      path.join(cwd, '.playbook/sessions/1.json'),
      path.join(cwd, '.playbook/sessions/2.json')
    ]);
  });

  it('warns when a glob input has no matches', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cli-session-empty-glob-'));
    const warn = vi.fn();

    const resolved = resolveSessionMergeInputs(cwd, ['.playbook/sessions/*.json'], { warn });

    expect(resolved).toEqual([]);
    expect(warn).toHaveBeenCalledWith('No snapshot files matched glob pattern: .playbook/sessions/*.json');
  });
});
