import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

export const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'main.js');


const SEEDED_TEMPLATE_DIR = path.join(repoRoot, 'test', 'fixtures', 'knowledge', 'seeded');

const copyDirectory = (sourceDir, targetDir) => {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
};

const createFixtureRepo = (prefix) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  copyDirectory(SEEDED_TEMPLATE_DIR, root);
  return root;
};

const createSeededKnowledgeFixtureRepo = (options = {}) => createFixtureRepo(options.prefix ?? 'playbook-knowledge-fixture-');
const createEmptyKnowledgeFixtureRepo = (options = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), options.prefix ?? 'playbook-knowledge-empty-'));
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name: 'playbook-contract-fixture' }, null, 2)}
`, 'utf8');
  return root;
};


export const commandContracts = [
  { file: 'rules.snapshot.json', args: ['rules', '--json'], schemaCommand: 'rules' },
  { file: 'index.snapshot.json', args: ['index', '--json'], schemaCommand: 'index' },
  { file: 'graph.snapshot.json', args: ['graph', '--json'], schemaCommand: 'graph' },
  { file: 'explain-PB001.snapshot.json', args: ['explain', 'PB001', '--json'], schemaCommand: 'explain' },
  { file: 'explain-architecture.snapshot.json', args: ['explain', 'architecture', '--json'], schemaCommand: 'explain' },
  { file: 'verify.snapshot.json', args: ['verify', '--json'], schemaCommand: 'verify' },
  { file: 'plan.snapshot.json', args: ['plan', '--json'], schemaCommand: 'plan' },
  { file: 'context.snapshot.json', args: ['context', '--json'], schemaCommand: 'context' },
  { file: 'ai-context.snapshot.json', args: ['ai-context', '--json'], schemaCommand: 'ai-context' },
  { file: 'ai-contract.snapshot.json', args: ['ai-contract', '--json'], schemaCommand: 'ai-contract' },
  { file: 'docs-audit.snapshot.json', args: ['docs', 'audit', '--json'], schemaCommand: 'docs' },
  { file: 'doctor.snapshot.json', args: ['doctor', '--json'], schemaCommand: 'doctor' },
  { file: 'analyze-pr.snapshot.json', args: ['analyze-pr', '--json'], schemaCommand: 'analyze-pr' },
  { file: 'contracts.snapshot.json', args: ['contracts', '--json'], schemaCommand: 'contracts' },
  { file: 'ignore-suggest.snapshot.json', args: ['ignore', 'suggest', '--json'], schemaCommand: 'ignore' },
  { file: 'knowledge-list.snapshot.json', args: ['knowledge', 'list', '--json'], schemaCommand: 'knowledge' },
  { file: 'knowledge-query.snapshot.json', args: ['knowledge', 'query', '--type', 'candidate', '--json'], schemaCommand: 'knowledge' },
  { file: 'knowledge-inspect.snapshot.json', args: ['knowledge', 'inspect', 'pattern-live', '--json'], schemaCommand: 'knowledge' },
  { file: 'knowledge-timeline.snapshot.json', args: ['knowledge', 'timeline', '--order', 'asc', '--limit', '4', '--json'], schemaCommand: 'knowledge' },
  { file: 'knowledge-provenance.snapshot.json', args: ['knowledge', 'provenance', 'pattern-live', '--json'], schemaCommand: 'knowledge' },
  { file: 'knowledge-stale.snapshot.json', args: ['knowledge', 'stale', '--json'], schemaCommand: 'knowledge' }
];

export function normalizeDynamicContractString(value) {
  return value
    .replace(/failure_ingest-[0-9a-f-]+/gi, 'failure_ingest-<RUNTIME_EVENT_ID>')
    .replace(/evt_[0-9a-f]+/gi, 'evt_<RUNTIME_EVENT_ID>')
    .replace(/evtfp_[0-9a-f]+/gi, 'evtfp_<RUNTIME_EVENT_FP>');
}

export function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

export function normalizeContractPayload(value, fixtureRepo) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeContractPayload(entry, fixtureRepo));
  }

  if (value && typeof value === 'object') {
    const normalized = {};
    for (const [key, raw] of Object.entries(value)) {
      if (key === 'timestamp' || key === 'generatedAt' || key === 'cwd' || key === 'repoRoot') continue;
      if (key === 'createdAt' && typeof raw === 'string') {
        normalized[key] = '<TIMESTAMP>';
        continue;
      }
      normalized[key] = normalizeContractPayload(raw, fixtureRepo);
    }
    return normalized;
  }

  if (typeof value === 'string') {
    return normalizeDynamicContractString(
      value
        .replaceAll('\\', '/')
        .replaceAll(fixtureRepo.replaceAll('\\', '/'), '<CONTRACT_FIXTURE_REPO>')
        .replaceAll(repoRoot.replaceAll('\\', '/'), '<REPO_ROOT>')
    );
  }

  return value;
}

export function createContractFixtureRepo() {
  const fixtureRepo = createSeededKnowledgeFixtureRepo({ prefix: 'playbook-contract-fixture-' });

  fs.mkdirSync(path.join(fixtureRepo, 'src', 'features'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRepo, 'docs', 'contracts'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRepo, 'docs', 'PLAYBOOK_NOTES.md'), '# Playbook Notes\n\n- Baseline fixture notes.\n');
  fs.writeFileSync(
    path.join(fixtureRepo, 'docs', 'contracts', 'command-truth.json'),
    JSON.stringify(
      {
        bootstrapLadder: ['ai-context', 'ai-contract', 'context'],
        remediationLoop: ['verify', 'plan', 'apply', 'verify'],
        canonicalCommands: ['ai-context'],
        compatibilityCommands: ['analyze'],
        utilityCommands: ['demo']
      },
      null,
      2
    )
  );
  fs.mkdirSync(path.join(fixtureRepo, '.playbook', 'runtime', 'current'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRepo, '.playbook', 'runtime', 'current', 'ignore-recommendations.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0',
        cycle_id: 'fixture-cycle',
        generated_at: '2026-03-11T00:00:00.000Z',
        recommendation_model: 'deterministic-v1',
        ranking_factors: ['fixture-rank'],
        recommendations: [
          {
            path: '.git/',
            rank: 1,
            class: 'vcs-internal',
            rationale: 'fixture safe default',
            confidence: 0.99,
            expected_scan_impact: {
              estimated_files_reduced: 10,
              estimated_bytes_reduced: 1024,
              impact_level: 'low'
            },
            safety_level: 'safe-default'
          },
          {
            path: 'playwright-report/',
            rank: 2,
            class: 'generated-report',
            rationale: 'fixture safe default',
            confidence: 0.97,
            expected_scan_impact: {
              estimated_files_reduced: 6,
              estimated_bytes_reduced: 2048,
              impact_level: 'low'
            },
            safety_level: 'safe-default'
          },
          {
            path: 'tmp_file.txt',
            rank: 3,
            class: 'temporary-file',
            rationale: 'fixture review-first',
            confidence: 0.61,
            expected_scan_impact: {
              estimated_files_reduced: 1,
              estimated_bytes_reduced: 64,
              impact_level: 'low'
            },
            safety_level: 'review-first'
          }
        ],
        summary: {
          total_recommendations: 3,
          safety_level_counts: {
            'safe-default': 2,
            'likely-safe': 0,
            'review-first': 1
          },
          class_counts: {
            'vcs-internal': 1,
            'build-cache': 0,
            'generated-report': 1,
            'temporary-file': 1,
            'binary-asset': 0,
            unknown: 0
          }
        }
      },
      null,
      2
    )
  );

  return fixtureRepo;
}

export function runCli(args, fixtureRepo) {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: fixtureRepo,
    encoding: 'utf8'
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  };
}

export function runCliJsonContract(args, fixtureRepo) {
  const result = runCli(args, fixtureRepo);
  const stdout = result.stdout.trim();
  if (!stdout) {
    throw new Error(`Command emitted no stdout for: ${args.join(' ')}\n${result.stderr}`);
  }

  const jsonStart = stdout.indexOf('{');
  const jsonEnd = stdout.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error(`No JSON payload was emitted for: ${args.join(' ')}`);
  }

  const payload = stdout.slice(jsonStart, jsonEnd + 1);
  return normalizeContractPayload(JSON.parse(payload), fixtureRepo);
}

function toTypeName(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

function typeMatches(schemaType, value) {
  const typeName = toTypeName(value);
  if (Array.isArray(schemaType)) {
    return schemaType.includes(typeName) || (schemaType.includes('number') && typeName === 'integer');
  }
  return schemaType === typeName || (schemaType === 'number' && typeName === 'integer');
}

export function validateAgainstSchema(value, schema) {
  if (!schema || typeof schema !== 'object') {
    return true;
  }

  if (schema.type === 'object' && typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.some((candidate) => validateAgainstSchema(value, candidate));
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    return value === schema.const;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'type') && !typeMatches(schema.type, value)) {
    return false;
  }

  if (typeof schema.minProperties === 'number') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (Object.keys(value).length < schema.minProperties) return false;
  }

  if (Array.isArray(schema.required)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    for (const key of schema.required) {
      if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(value, key)) return false;
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties && typeof schema.properties === 'object') {
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key) && !validateAgainstSchema(value[key], propertySchema)) {
        return false;
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
          return false;
        }
      }
    }
  }

  if (Array.isArray(value) && schema.items) {
    return value.every((entry) => validateAgainstSchema(entry, schema.items));
  }

  return true;
}

export function assertSnapshotPreconditions() {
  if (!fs.existsSync(cliEntry)) {
    throw new Error(`Missing CLI build output at ${path.relative(repoRoot, cliEntry)}. Run "pnpm -r build" before refreshing contract snapshots.`);
  }
}

export function generateContractSnapshots(outputDir) {
  assertSnapshotPreconditions();
  fs.mkdirSync(outputDir, { recursive: true });
  const schemaByCommand = new Map();

  for (const contract of commandContracts) {
    // Regenerate each contract from a fresh seeded repo so durable command artifacts never leak across snapshots.
    const fixtureRepo = createContractFixtureRepo();

    try {
      const actualPayload = runCliJsonContract(contract.args, fixtureRepo);
      let schema = schemaByCommand.get(contract.schemaCommand);
      if (!schema) {
        schema = runCliJsonContract(['schema', contract.schemaCommand, '--json'], fixtureRepo);
        schemaByCommand.set(contract.schemaCommand, schema);
      }
      if (!validateAgainstSchema(actualPayload, schema)) {
        throw new Error(`Schema validation failed for ${contract.args.join(' ')}`);
      }
      if (contract.file === 'knowledge-list.snapshot.json') {
        const json = JSON.stringify(actualPayload);
        if (json.includes('failure_ingest-<RUNTIME_EVENT_ID>')) {
          throw new Error('knowledge-list contract fixture was contaminated by runtime failure_ingest artifacts');
        }
      }
      fs.writeFileSync(path.join(outputDir, contract.file), `${JSON.stringify(actualPayload, null, 2)}\n`, 'utf8');
    } finally {
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  }

  const emptyRepo = createEmptyKnowledgeFixtureRepo({ prefix: 'playbook-contract-empty-fixture-' });
  try {
    for (const args of [
      ['knowledge', 'list', '--json'],
      ['knowledge', 'query', '--type', 'candidate', '--json'],
      ['knowledge', 'timeline', '--json'],
      ['knowledge', 'stale', '--json']
    ]) {
      const payload = runCliJsonContract(args, emptyRepo);
      if (payload.summary?.total !== 0 || !Array.isArray(payload.knowledge) || payload.knowledge.length !== 0) {
        throw new Error(`Empty-repository contract preflight failed for ${args.join(' ')}`);
      }
    }
  } finally {
    fs.rmSync(emptyRepo, { recursive: true, force: true });
  }

  return commandContracts.map((contract) => contract.file);
}
