#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const playbookDir = path.join(repoRoot, '.playbook');
const runCyclesDir = path.join(playbookDir, 'run-cycles');
const zettelkastenDir = path.join(playbookDir, 'zettelkasten');

const jsonArtifacts = {
  aiContext: '.playbook/ai-context.json',
  aiContract: '.playbook/ai-contract.json',
  repoIndex: '.playbook/repo-index.json',
  repoGraph: '.playbook/repo-graph.json',
  verify: '.playbook/verify.json',
  plan: '.playbook/plan.json',
  apply: '.playbook/apply.json',
  postVerify: '.playbook/post-verify.json'
};

const digestFile = async (absolutePath) => {
  const raw = await readFile(absolutePath);
  return `sha256:${createHash('sha256').update(raw).digest('hex')}`;
};

const resolveRef = async (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return undefined;
    }
    return {
      path: relativePath,
      digest: await digestFile(absolutePath)
    };
  } catch {
    return undefined;
  }
};

const getShortSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknownsha';
  }
};

const getFullSha = () => {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const now = new Date();
const timestamp = now.toISOString().replace(/:/g, '-');
const shortSha = getShortSha();
const fullSha = getFullSha();
const runCycleId = `${timestamp}@${shortSha}`;

await mkdir(runCyclesDir, { recursive: true });
await mkdir(zettelkastenDir, { recursive: true });

const forwardArc = {
  aiContext: await resolveRef(jsonArtifacts.aiContext),
  aiContract: await resolveRef(jsonArtifacts.aiContract),
  repoIndex: await resolveRef(jsonArtifacts.repoIndex),
  repoGraph: await resolveRef(jsonArtifacts.repoGraph)
};

const returnArc = {
  verify: await resolveRef(jsonArtifacts.verify),
  plan: await resolveRef(jsonArtifacts.plan),
  apply: await resolveRef(jsonArtifacts.apply),
  postVerify: await resolveRef(jsonArtifacts.postVerify)
};

const zettelsRelative = '.playbook/zettelkasten/zettels.jsonl';
const linksRelative = '.playbook/zettelkasten/links.jsonl';
const zettelsPath = path.join(repoRoot, zettelsRelative);
const linksPath = path.join(repoRoot, linksRelative);

const evidencePath = returnArc.verify?.path ?? forwardArc.repoIndex?.path ?? '.playbook/repo-index.json';
const exampleZettel = {
  id: `zettel:${runCycleId}:example`,
  createdAt: now.toISOString(),
  title: 'RunCycle seed observation',
  kind: 'observation',
  body: 'Initial zettel scaffold for RunCycle capture.',
  evidence: [
    {
      path: evidencePath
    }
  ],
  tags: ['run-cycle', 'scaffold']
};

await writeFile(zettelsPath, `${JSON.stringify(exampleZettel)}\n`, 'utf8');
await writeFile(linksPath, '', 'utf8');

const zettelRefs = {
  zettels: {
    path: zettelsRelative,
    digest: await digestFile(zettelsPath)
  },
  links: {
    path: linksRelative,
    digest: await digestFile(linksPath)
  }
};

const runCycle = {
  schemaVersion: '1.0',
  kind: 'playbook-run-cycle',
  runCycleId,
  createdAt: now.toISOString(),
  repository: {
    root: '.',
    git: {
      commit: fullSha,
      shortSha
    }
  },
  forwardArc,
  returnArc,
  zettelkasten: zettelRefs,
  metrics: {
    loopClosureRate: 0,
    promotionYield: 0,
    compactionGain: 0,
    reuseRate: 0,
    driftScore: 0,
    entropyBudget: 1
  }
};

const runCycleRelative = `.playbook/run-cycles/${runCycleId}.json`;
const runCyclePath = path.join(repoRoot, runCycleRelative);
await writeFile(runCyclePath, `${JSON.stringify(runCycle, null, 2)}\n`, 'utf8');

console.log(`wrote ${runCycleRelative}`);
console.log(`wrote ${zettelsRelative}`);
console.log(`wrote ${linksRelative}`);
