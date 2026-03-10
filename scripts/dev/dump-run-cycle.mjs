#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const playbookDir = path.join(repoRoot, '.playbook');
const runCyclesDir = path.join(playbookDir, 'run-cycles');
const zettelkastenDir = path.join(playbookDir, 'zettelkasten');
const graphSnapshotsDir = path.join(playbookDir, 'graph', 'snapshots');
const graphGroupsDir = path.join(playbookDir, 'graph', 'groups');
const candidatePatternsDir = path.join(playbookDir, 'compaction', 'candidate-patterns');
const patternCardDraftsDir = path.join(playbookDir, 'pattern-cards', 'drafts');
const promotionQueueDir = path.join(playbookDir, 'promotion', 'review-queue');
const promotionDecisionsDir = path.join(playbookDir, 'promotion', 'decisions');
const promotedPatternCardsDir = path.join(playbookDir, 'pattern-cards', 'promoted');

const shouldEmitGraph = !process.argv.includes('--no-graph');
const shouldEmitGroups = shouldEmitGraph && !process.argv.includes('--no-groups');
const shouldEmitCandidatePatterns = shouldEmitGroups && !process.argv.includes('--no-candidate-patterns');
const shouldEmitPatternCardDrafts = shouldEmitCandidatePatterns && !process.argv.includes('--no-pattern-card-drafts');
const shouldEmitPromotionQueue = shouldEmitPatternCardDrafts && !process.argv.includes('--no-promotion-review-queue');

const getArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const promotionDecisionInput = getArgValue('--promotion-decisions');

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
if (shouldEmitGraph) await mkdir(graphSnapshotsDir, { recursive: true });
if (shouldEmitGroups) await mkdir(graphGroupsDir, { recursive: true });
if (shouldEmitCandidatePatterns) await mkdir(candidatePatternsDir, { recursive: true });
if (shouldEmitPatternCardDrafts) await mkdir(patternCardDraftsDir, { recursive: true });
if (shouldEmitPromotionQueue) await mkdir(promotionQueueDir, { recursive: true });
if (promotionDecisionInput) await mkdir(promotionDecisionsDir, { recursive: true });
if (promotionDecisionInput) await mkdir(promotedPatternCardsDir, { recursive: true });

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
const exampleZettels = [
  {
    id: `zettel:${runCycleId}:example-a`,
    createdAt: now.toISOString(),
    originCycleId: runCycleId,
    title: 'RunCycle seed observation',
    subject: 'run-cycle seed observation',
    canonicalKey: 'zettel:run-cycle-seed-observation',
    kind: 'observation',
    body: 'Initial zettel scaffold for RunCycle capture.',
    summary: 'RunCycle scaffold zettel for deterministic graph grouping preview.',
    subjectDomain: 'run-cycle',
    mechanism: 'deterministic-linkage',
    invariant: 'preserve-lineage',
    contractRefs: ['contract:run-cycle-artifact'],
    artifactRefs: [evidencePath],
    evidence: [{ path: evidencePath }],
    tags: ['run-cycle', 'scaffold']
  },
  {
    id: `zettel:${runCycleId}:example-b`,
    createdAt: now.toISOString(),
    originCycleId: runCycleId,
    title: 'RunCycle linkage refinement',
    subject: 'run-cycle seed observation',
    canonicalKey: 'zettel:run-cycle-seed-observation',
    kind: 'pattern',
    body: 'Second zettel to force deterministic candidate synthesis.',
    summary: 'Companion evidence for deterministic contraction preview.',
    subjectDomain: 'run-cycle',
    mechanism: 'deterministic-linkage',
    invariant: 'preserve-lineage',
    contractRefs: ['contract:run-cycle-artifact'],
    artifactRefs: [evidencePath],
    evidence: [{ path: evidencePath }],
    tags: ['run-cycle', 'scaffold']
  }
];

await writeFile(zettelsPath, `${exampleZettels.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
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

const graphMemoryRefs = {};

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
  graphMemory: graphMemoryRefs,
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

if (shouldEmitGraph) {
  const { buildGraphSnapshot } = await import(path.join(repoRoot, 'packages/engine/dist/graph/buildGraphSnapshot.js'));
  const graphSnapshot = buildGraphSnapshot({ projectRoot: repoRoot, runCycle, createdAt: now.toISOString() });

  const graphSnapshotRelative = `.playbook/graph/snapshots/${runCycleId}.json`;
  const graphSnapshotPath = path.join(repoRoot, graphSnapshotRelative);
  await writeFile(graphSnapshotPath, `${JSON.stringify(graphSnapshot, null, 2)}\n`, 'utf8');
  graphMemoryRefs.snapshot = { path: graphSnapshotRelative, digest: await digestFile(graphSnapshotPath) };
  console.log(`wrote ${graphSnapshotRelative}`);

  if (shouldEmitGroups) {
    const { groupDeterministicMemory } = await import(path.join(repoRoot, 'packages/engine/dist/graph/groupDeterministicMemory.js'));
    const groupsArtifact = groupDeterministicMemory({ snapshot: graphSnapshot, createdAt: now.toISOString() });

    const groupsRelative = `.playbook/graph/groups/${runCycleId}.json`;
    const groupsPath = path.join(repoRoot, groupsRelative);
    await writeFile(groupsPath, `${JSON.stringify(groupsArtifact, null, 2)}\n`, 'utf8');
    graphMemoryRefs.groups = { path: groupsRelative, digest: await digestFile(groupsPath) };
    console.log(`wrote ${groupsRelative}`);

    if (shouldEmitCandidatePatterns) {
      const { buildCandidatePatterns } = await import(path.join(repoRoot, 'packages/engine/dist/compaction/buildCandidatePatterns.js'));
      const candidatePatternsArtifact = buildCandidatePatterns({ snapshot: graphSnapshot, groupsArtifact, createdAt: now.toISOString() });

      const candidatesRelative = `.playbook/compaction/candidate-patterns/${runCycleId}.json`;
      const candidatesPath = path.join(repoRoot, candidatesRelative);
      await writeFile(candidatesPath, `${JSON.stringify(candidatePatternsArtifact, null, 2)}\n`, 'utf8');
      graphMemoryRefs.candidatePatterns = { path: candidatesRelative, digest: await digestFile(candidatesPath) };
      console.log(`wrote ${candidatesRelative}`);

      if (shouldEmitPatternCardDrafts) {
        const { synthesizePatternCardDrafts } = await import(path.join(repoRoot, 'packages/engine/dist/compaction/synthesizePatternCardDrafts.js'));
        const draftArtifact = synthesizePatternCardDrafts({ snapshot: graphSnapshot, candidateArtifact: candidatePatternsArtifact, createdAt: now.toISOString() });

        const draftRelative = `.playbook/pattern-cards/drafts/${runCycleId}.json`;
        const draftPath = path.join(repoRoot, draftRelative);
        await writeFile(draftPath, `${JSON.stringify(draftArtifact, null, 2)}\n`, 'utf8');
        graphMemoryRefs.draftPatternCards = { path: draftRelative, digest: await digestFile(draftPath) };
        console.log(`wrote ${draftRelative}`);

        if (shouldEmitPromotionQueue) {
          const { buildPromotionReviewQueue } = await import(path.join(repoRoot, 'packages/engine/dist/promotion/buildPromotionReviewQueue.js'));
          const reviewQueue = buildPromotionReviewQueue({ draftArtifact, createdAt: now.toISOString() });

          const promotionQueueRelative = `.playbook/promotion/review-queue/${runCycleId}.json`;
          const promotionQueuePath = path.join(repoRoot, promotionQueueRelative);
          await writeFile(promotionQueuePath, `${JSON.stringify(reviewQueue, null, 2)}\n`, 'utf8');
          graphMemoryRefs.promotionReviewQueue = { path: promotionQueueRelative, digest: await digestFile(promotionQueuePath) };
          console.log(`wrote ${promotionQueueRelative}`);

          if (promotionDecisionInput) {
            const decisionInputPath = path.isAbsolute(promotionDecisionInput)
              ? promotionDecisionInput
              : path.join(repoRoot, promotionDecisionInput);
            const decisionInputRaw = await readFile(decisionInputPath, 'utf8');
            const parsedDecisionInput = JSON.parse(decisionInputRaw);
            const decisionList = Array.isArray(parsedDecisionInput) ? parsedDecisionInput : parsedDecisionInput.decisions ?? [];

            const {
              applyPromotionDecision,
              buildPromotionDecisionArtifact,
              buildPatternCardCollectionArtifact
            } = await import(path.join(repoRoot, 'packages/engine/dist/promotion/applyPromotionDecision.js'));

            let promotedPatterns = [];
            for (const decision of decisionList) {
              const result = applyPromotionDecision({ draftArtifact, decision, existingPatterns: promotedPatterns });
              promotedPatterns = result.patterns;
            }

            const decisionsArtifact = buildPromotionDecisionArtifact({
              originCycleId: runCycleId,
              createdAt: now.toISOString(),
              decisions: decisionList
            });
            const promotedArtifact = buildPatternCardCollectionArtifact({
              originCycleId: runCycleId,
              createdAt: now.toISOString(),
              cards: promotedPatterns
            });

            const promotionDecisionRelative = `.playbook/promotion/decisions/${runCycleId}.json`;
            const promotionDecisionPath = path.join(repoRoot, promotionDecisionRelative);
            await writeFile(promotionDecisionPath, `${JSON.stringify(decisionsArtifact, null, 2)}\n`, 'utf8');
            graphMemoryRefs.promotionDecisions = { path: promotionDecisionRelative, digest: await digestFile(promotionDecisionPath) };
            console.log(`wrote ${promotionDecisionRelative}`);

            const promotedPatternCardsRelative = `.playbook/pattern-cards/promoted/${runCycleId}.json`;
            const promotedPatternCardsPath = path.join(repoRoot, promotedPatternCardsRelative);
            await writeFile(promotedPatternCardsPath, `${JSON.stringify(promotedArtifact, null, 2)}\n`, 'utf8');
            graphMemoryRefs.promotedPatternCards = {
              path: promotedPatternCardsRelative,
              digest: await digestFile(promotedPatternCardsPath)
            };
            console.log(`wrote ${promotedPatternCardsRelative}`);
          }
        }
      }
    }
  }

  await writeFile(runCyclePath, `${JSON.stringify(runCycle, null, 2)}\n`, 'utf8');
  console.log(`updated ${runCycleRelative}`);
}
