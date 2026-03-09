#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const isCi = args.has('--ci');
const enforcePrFeatureId = args.has('--enforce-pr-feature-id');
const repoRoot = process.cwd();
const roadmapPath = path.join(repoRoot, 'docs', 'roadmap', 'ROADMAP.json');
const prMetadataPath = path.join(repoRoot, '.playbook', 'pr-metadata.json');

const fail = (message) => {
  console.error(`roadmap-contract: ${message}`);
  process.exitCode = 1;
};

const warn = (message) => {
  console.warn(`roadmap-contract: warning: ${message}`);
};

const readJsonFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON in ${path.relative(repoRoot, filePath)} (${error.message})`);
    return null;
  }
};

const hasFeatureIdMatch = (text, featureIds) => {
  if (typeof text !== 'string' || !text.trim()) return false;
  return [...featureIds].some((id) => text.includes(id));
};

const getRepoMetadataFeatureIds = (filePath, featureIds) => {
  if (!fs.existsSync(filePath)) return [];
  const payload = readJsonFile(filePath);
  if (!payload || !Array.isArray(payload.featureIds)) return [];
  return payload.featureIds.filter((id) => typeof id === 'string' && featureIds.has(id));
};

if (!fs.existsSync(roadmapPath)) {
  fail(`missing required roadmap contract file at ${path.relative(repoRoot, roadmapPath)}`);
  process.exit(process.exitCode ?? 1);
}

const roadmap = readJsonFile(roadmapPath);
if (!roadmap) {
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
  'package_ownership',
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

  for (const listField of ['commands', 'contracts', 'tests', 'docs', 'dependencies', 'package_ownership', 'verification_commands']) {
    if (!Array.isArray(feature[listField])) {
      fail(`features[${index}].${listField} must be an array`);
    }
  }

  if (feature.package_ownership.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    fail(`features[${index}].package_ownership must contain non-empty package names`);
  }
}

if (isCi && enforcePrFeatureId) {
  let titleMatched = false;
  let bodyMatched = false;

  if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
    const event = readJsonFile(process.env.GITHUB_EVENT_PATH);
    if (event) {
      const pr = event.pull_request;
      titleMatched = hasFeatureIdMatch(pr?.title ?? '', featureIds);
      bodyMatched = hasFeatureIdMatch(pr?.body ?? '', featureIds);
    }
  }

  const repoMetadataFeatureIds = getRepoMetadataFeatureIds(prMetadataPath, featureIds);

  if (!titleMatched && !bodyMatched && repoMetadataFeatureIds.length === 0) {
    fail(
      'PR feature-id enforcement failed: no valid roadmap feature_id found in pull request title, pull request body, or .playbook/pr-metadata.json featureIds'
    );
  }

  if (!titleMatched && !bodyMatched && repoMetadataFeatureIds.length > 0) {
    warn(
      `pull request title/body missing roadmap feature_id while .playbook/pr-metadata.json provides valid featureIds (${repoMetadataFeatureIds.join(', ')})`
    );
  }
}

if (!process.exitCode) {
  console.log(`roadmap-contract: ok (${featureIds.size} features validated)`);
}
