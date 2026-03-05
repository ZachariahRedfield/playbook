import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('hygiene guardrails', () => {
  it('keeps ephemeral sessions gitignored', () => {
    const gitignore = fs.readFileSync(path.join(process.cwd(), '../../.gitignore'), 'utf8');
    expect(gitignore).toContain('.playbook/');
  });

  it('keeps conversation graph concept doc concise', () => {
    const content = fs.readFileSync(path.join(process.cwd(), '../../docs/concepts/conversation-graphs.md'), 'utf8');
    expect(content.split('\n').length).toBeLessThanOrEqual(300);
  });
});
