import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  redactSecretsForLogs,
  validateRepoBoundary
} from '../../../packages/engine/dist/security/guards.js';
import { FixExecutor, HandlerResolver } from '../../../packages/engine/dist/execution/fixExecutor.js';
import { PlanGenerator } from '../../../packages/engine/dist/execution/planGenerator.js';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const contractsDir = path.join(repoRoot, 'docs/contracts/security');
const cliEntrypoint = path.join(repoRoot, 'packages/cli/dist/main.js');

const readContract = (fileName) => {
  const payload = fs.readFileSync(path.join(contractsDir, fileName), 'utf8');
  return JSON.parse(payload);
};

const makeTempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test('security contracts are machine-readable and include required fields', () => {
  const expectedFiles = [
    'repo-boundary.json',
    'apply-scope.json',
    'plan-determinism.json',
    'secret-redaction.json',
    'policy-gate.json'
  ];

  for (const file of expectedFiles) {
    const contract = readContract(file);
    assert.equal(typeof contract.id, 'string');
    assert.equal(typeof contract.description, 'string');
    assert.equal(typeof contract.enforcedBy, 'string');
    assert.ok(Array.isArray(contract.expectedBehavior));
    assert.ok(Array.isArray(contract.failureModes));
    assert.ok(contract.expectedBehavior.length > 0);
    assert.ok(contract.failureModes.length > 0);
  }
});

test('repo.boundary blocks traversal and symlink escape attempts', () => {
  const tempRepo = makeTempDir('playbook-security-contracts-');
  fs.mkdirSync(path.join(tempRepo, 'docs'), { recursive: true });

  assert.throws(() => validateRepoBoundary(tempRepo, '../../etc/passwd'), /escapes repository root/);

  const outside = makeTempDir('playbook-security-outside-');
  fs.writeFileSync(path.join(outside, 'secrets.txt'), 'nope');
  fs.symlinkSync(outside, path.join(tempRepo, 'docs', 'link-out'));

  assert.throws(() => validateRepoBoundary(tempRepo, 'docs/link-out/secrets.txt'), /symlink traversal is not allowed/);
});

test('apply.scope fails handlers that mutate files outside declared task scope', async () => {
  const tempRepo = makeTempDir('playbook-apply-scope-');
  fs.mkdirSync(path.join(tempRepo, 'docs'), { recursive: true });

  const resolver = new HandlerResolver({
    builtIn: {
      'notes.missing': async () => ({
        status: 'applied',
        summary: 'wrote a different file',
        filesChanged: ['docs/another-file.md']
      })
    }
  });

  const executor = new FixExecutor(resolver);
  const result = await executor.apply(
    [
      {
        id: 'task-1',
        ruleId: 'notes.missing',
        file: 'docs/PLAYBOOK_NOTES.md',
        action: 'Create docs/PLAYBOOK_NOTES.md',
        autoFix: true
      }
    ],
    { repoRoot: tempRepo, dryRun: false }
  );

  assert.equal(result.summary.failed, 1);
  assert.match(result.results[0]?.message ?? '', /filesChanged must include docs\/PLAYBOOK_NOTES\.md/);
});

test('plan.determinism returns stable tasks for equivalent findings', () => {
  const generator = new PlanGenerator();
  const findings = [
    { id: 'b.rule', message: 'second', evidence: 'docs/B.md', fix: 'Fix B' },
    { id: 'a.rule', message: 'first', evidence: 'docs/A.md', fix: 'Fix A' }
  ];

  const first = generator.generate(findings);
  const second = generator.generate([...findings].reverse());

  assert.deepEqual(first, second);
});

test('secret.redaction removes sensitive values from log output (scanner-safe fixtures)', () => {
  const input = [
    'token=super-secret-value',
    'ghp_abcdefghijklmnopqrstuvwxyz1234',
    'password=high-entropy-looking-but-fake-value-123456',
    '-----BEGIN OPENSSH PRIVATE KEY-----\nsecret material\n-----END OPENSSH PRIVATE KEY-----'
  ].join(' ');

  const redacted = redactSecretsForLogs(input);
  assert.equal(redacted.includes('super-secret-value'), false);
  assert.equal(redacted.includes('ghp_abcdefghijklmnopqrstuvwxyz1234'), false);
  assert.equal(redacted.includes('high-entropy-looking-but-fake-value-123456'), false);
  assert.equal(redacted.includes('secret material'), false);
  assert.match(redacted, /\[REDACTED\]/);
});

test('policy.gate enforces configured policy violations in verify --policy mode', () => {
  const tempRepo = makeTempDir('playbook-policy-gate-');
  fs.mkdirSync(path.join(tempRepo, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tempRepo, 'docs'), { recursive: true });

  fs.writeFileSync(path.join(tempRepo, 'src/index.ts'), 'export const demo = 1;\n');
  fs.writeFileSync(path.join(tempRepo, 'docs/PLAYBOOK_NOTES.md'), '# Notes\n\n- initial\n');
  fs.writeFileSync(
    path.join(tempRepo, 'playbook.config.json'),
    JSON.stringify(
      {
        version: 1,
        verify: {
          policy: {
            rules: ['requireNotesOnChanges']
          },
          rules: {
            requireNotesOnChanges: [
              {
                whenChanged: ['src/**'],
                mustTouch: ['docs/PLAYBOOK_NOTES.md']
              }
            ]
          }
        }
      },
      null,
      2
    )
  );

  spawnSync('git', ['init', '-b', 'main'], { cwd: tempRepo, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'playbook@example.com'], { cwd: tempRepo, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Playbook Bot'], { cwd: tempRepo, encoding: 'utf8' });
  spawnSync('git', ['add', '.'], { cwd: tempRepo, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', 'initial'], { cwd: tempRepo, encoding: 'utf8' });

  fs.writeFileSync(path.join(tempRepo, 'src/index.ts'), 'export const demo = 2;\n');
  spawnSync('git', ['add', 'src/index.ts'], { cwd: tempRepo, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', 'second'], { cwd: tempRepo, encoding: 'utf8' });

  fs.writeFileSync(path.join(tempRepo, 'src/index.ts'), 'export const demo = 3;\n');

  const result = spawnSync('node', [cliEntrypoint, 'verify', '--policy', '--json', '--ci'], {
    cwd: tempRepo,
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.ok(Array.isArray(payload.policyViolations));
  assert.ok(payload.policyViolations.some((violation) => violation.policyId === 'requireNotesOnChanges'));
});
