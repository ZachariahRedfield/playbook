#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const isCi = args.has('--ci');
const enforcePrFeatureId = args.has('--enforce-pr-feature-id');
const repoRoot = process.cwd();
const roadmapPath = path.join(repoRoot, 'docs', 'roadmap', 'ROADMAP.json');

const fail = (message) => {
  console.error(`roadmap-contract: ${message}`);
  process.exitCode = 1;
};

if (!fs.existsSync(roadmapPath)) {
  fail(`missing required roadmap contract file at ${path.relative(repoRoot, roadmapPath)}`);
  process.exit(process.exitCode ?? 1);
}

let roadmap;
try {
  roadmap = JSON.parse(fs.readFileSync(roadmapPath, 'utf8'));
} catch (error) {
  fail(`invalid JSON in ${path.relative(repoRoot, roadmapPath)} (${error.message})`);
  process.exit(process.exitCode ?? 1);
}

if (roadmap.schemaVersion !== '1.0') {
  fail(`expected schemaVersion "1.0", got ${JSON.stringify(roadmap.schemaVersion)}`);
}

if (!Array.isArray(roadmap.features) || roadmap.features.length === 0) {
  fail('features must be a non-empty array');
}

const requiredFields = [
  'feature_id',
  'version',
  'title',
  'goal',
  'commands',
  'contracts',
  'tests',
  'docs',
  'dependencies',
  'verification_commands',
  'status'
];

const featureIds = new Set();
for (const [index, feature] of (roadmap.features ?? []).entries()) {
  for (const field of requiredFields) {
    if (!(field in feature)) {
      fail(`features[${index}] missing required field: ${field}`);
    }
  }

  if (typeof feature.feature_id !== 'string' || !/^PB-V[0-9]+[-A-Z0-9]+$/.test(feature.feature_id)) {
    fail(`features[${index}].feature_id must match PB-V... format`);
  }

  if (featureIds.has(feature.feature_id)) {
    fail(`duplicate feature_id detected: ${feature.feature_id}`);
  }
  featureIds.add(feature.feature_id);

  for (const listField of ['commands', 'contracts', 'tests', 'docs', 'dependencies', 'verification_commands']) {
    if (!Array.isArray(feature[listField])) {
      fail(`features[${index}].${listField} must be an array`);
    }
  }
}

if (isCi && process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
  try {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const pr = event.pull_request;
    if (pr && enforcePrFeatureId) {
      const text = `${pr.title ?? ''}\n${pr.body ?? ''}`;
      const matched = [...featureIds].some((id) => text.includes(id));
      if (!matched) {
        fail('pull request title/body must reference at least one roadmap feature_id from docs/roadmap/ROADMAP.json');
      }
    }
  } catch (error) {
    fail(`unable to parse GITHUB_EVENT_PATH payload (${error.message})`);
  }
}

if (!process.exitCode) {
  console.log(`roadmap-contract: ok (${featureIds.size} features validated)`);
}
