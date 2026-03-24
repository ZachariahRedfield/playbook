import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('cli --repo with --out json artifacts', () => {
  const scriptPath = path.resolve(process.cwd(), '..', '..', 'scripts', 'run-playbook.mjs');
  let tempRoot = '';
  let targetRepo = '';

  beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-external-out-'));
    targetRepo = path.join(tempRoot, 'consumer-repo');
    fs.mkdirSync(path.join(targetRepo, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(targetRepo, 'package.json'),
      JSON.stringify({ name: 'consumer-repo', version: '0.0.1', scripts: { test: 'echo ok' } }, null, 2),
      'utf8'
    );
    fs.writeFileSync(path.join(targetRepo, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');
  });

  afterAll(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes parseable artifacts for external repo targeting and supports later query reads', { timeout: 45000 }, () => {
    const findingsPath = path.join(targetRepo, '.playbook', 'findings.json');
    const planPath = path.join(targetRepo, '.playbook', 'plan.json');

    execFileSync('node', [scriptPath, '--repo', targetRepo, 'verify', '--json', '--out', findingsPath], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    execFileSync('node', [scriptPath, '--repo', targetRepo, 'plan', '--json', '--out', planPath], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(() => JSON.parse(fs.readFileSync(findingsPath, 'utf8'))).not.toThrow();
    expect(() => JSON.parse(fs.readFileSync(planPath, 'utf8'))).not.toThrow();

    execFileSync('node', [scriptPath, '--repo', targetRepo, 'index', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const queryRaw = execFileSync('node', [scriptPath, '--repo', targetRepo, 'query', 'modules', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    const queryJson = JSON.parse(queryRaw.slice(queryRaw.indexOf('{')));
    expect(queryJson.command).toBe('query');
    expect(Array.isArray(queryJson.result)).toBe(true);
  });

  it('persists canonical lifecycle artifacts for external repo targeting without --out', { timeout: 45000 }, () => {
    execFileSync('node', [scriptPath, '--repo', targetRepo, 'plan', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    execFileSync('node', [scriptPath, '--repo', targetRepo, 'apply', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const planArtifactPath = path.join(targetRepo, '.playbook', 'plan.json');
    const applyArtifactPath = path.join(targetRepo, '.playbook', 'policy-apply-result.json');
    expect(fs.existsSync(planArtifactPath)).toBe(true);
    expect(fs.existsSync(applyArtifactPath)).toBe(true);

    const planArtifact = JSON.parse(fs.readFileSync(planArtifactPath, 'utf8'));
    expect(planArtifact.command).toBe('plan');

    const applyArtifact = JSON.parse(fs.readFileSync(applyArtifactPath, 'utf8'));
    expect(applyArtifact.kind).toBe('policy-apply-result');
  });
});
