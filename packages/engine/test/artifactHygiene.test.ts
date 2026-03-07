import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { generateRepositoryHealth, generatePlanContract } from '../src/index.js';

const createRepo = (name: string): string => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  execSync('git init', { cwd: repo, stdio: 'ignore' });
  execSync('git config user.email "playbook@example.com"', { cwd: repo });
  execSync('git config user.name "Playbook Test"', { cwd: repo });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'artifact-test' }, null, 2));
  return repo;
};

describe('artifact hygiene diagnostics', () => {
  it('detects committed runtime artifacts and suggests deterministic fixes', () => {
    const repo = createRepo('playbook-artifact-hygiene-runtime');
    fs.mkdirSync(path.join(repo, '.playbook'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbook', 'repo-index.json'), JSON.stringify({ ok: true }, null, 2));
    fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules\n');
    execSync('git add .', { cwd: repo });
    execSync('git commit -m "seed"', { cwd: repo, stdio: 'ignore' });

    const report = generateRepositoryHealth(repo);
    const runtimeFinding = report.artifactHygiene.findings.find((finding) => finding.type === 'runtime-artifact-committed');

    expect(runtimeFinding?.path).toBe('.playbook/repo-index.json');
    expect(report.artifactHygiene.suggestions.map((entry) => entry.id)).toContain('PB013');

    const plan = generatePlanContract(repo);
    expect(plan.tasks.map((task) => task.ruleId)).toContain('PB013');
  });

  it('flags missing .playbookignore on large repositories', () => {
    const repo = createRepo('playbook-artifact-hygiene-ignore');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });

    for (let i = 0; i < 220; i += 1) {
      const filePath = path.join(repo, 'src', `file-${String(i).padStart(3, '0')}.ts`);
      fs.writeFileSync(filePath, `export const value${i} = ${i};\n`);
    }

    execSync('git add .', { cwd: repo });
    execSync('git commit -m "seed"', { cwd: repo, stdio: 'ignore' });

    const report = generateRepositoryHealth(repo);

    expect(report.artifactHygiene.findings.map((finding) => finding.type)).toContain('missing-playbookignore');
    const pb012 = report.artifactHygiene.suggestions.find((suggestion) => suggestion.id === 'PB012');
    expect(pb012?.entries).toEqual(expect.arrayContaining(['node_modules', 'dist', 'coverage']));
  });

  it('applies PB012 by creating .playbookignore with recommended entries', async () => {
    const repo = createRepo('playbook-artifact-hygiene-apply');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });

    for (let i = 0; i < 220; i += 1) {
      fs.writeFileSync(path.join(repo, 'src', `artifact-${i}.ts`), `export const artifact${i} = ${i};\n`);
    }

    execSync('git add .', { cwd: repo });
    execSync('git commit -m "seed"', { cwd: repo, stdio: 'ignore' });

    const plan = generatePlanContract(repo);
    const pb012 = plan.tasks.find((task) => task.ruleId === 'PB012');
    expect(pb012).toBeDefined();

    if (!pb012) {
      return;
    }

    const { applyExecutionPlan } = await import('../src/index.js');
    await applyExecutionPlan(repo, [pb012], { dryRun: false });

    const ignore = fs.readFileSync(path.join(repo, '.playbookignore'), 'utf8');
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('.playbook/cache');
  });

});
