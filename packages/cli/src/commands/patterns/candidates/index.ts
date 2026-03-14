import { bucketCompactionCandidates, extractCompactionCandidates, readPatternCards, toExistingPatternTargets, type BucketedCandidateEntry } from '@zachariahredfield/playbook-engine';
import { emitJsonOutput } from '../../../lib/jsonArtifact.js';
import { ExitCode } from '../../../lib/cliContract.js';

type PatternsOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  outFile?: string;
};

type RawCandidate = ReturnType<typeof extractCompactionCandidates>[number];

type CandidateInspectionRecord = {
  candidateId: string;
  sourceKind: string;
  subjectKind: string;
  subjectRef: string;
  trigger: string;
  mechanism: string;
  response: string;
  fingerprint: string;
};

type CandidateLinkRecord = {
  candidateId: string;
  bucket: BucketedCandidateEntry['bucket'];
  targetId?: string;
  targetOrigin?: BucketedCandidateEntry['targetOrigin'];
  relationKind: BucketedCandidateEntry['relation']['relationKind'];
  similarityScore: number;
  reason: string;
  deferredGeneralizationCandidate: boolean;
};

const toInspectionRecord = (candidate: RawCandidate): CandidateInspectionRecord => ({
  candidateId: candidate.candidateId,
  sourceKind: candidate.sourceKind,
  subjectKind: candidate.subjectKind,
  subjectRef: candidate.subjectRef,
  trigger: candidate.trigger,
  mechanism: candidate.mechanism,
  response: candidate.response,
  fingerprint: candidate.canonical.fingerprint
});

const byCandidateId = <T extends { candidateId: string }>(left: T, right: T): number => left.candidateId.localeCompare(right.candidateId);

const emitError = (cwd: string, options: PatternsOptions, message: string): number => {
  if (options.format === 'json') {
    emitJsonOutput({
      cwd,
      command: 'patterns',
      payload: { schemaVersion: '1.0', command: 'patterns', action: 'candidates', error: message },
      outFile: options.outFile
    });
  } else {
    console.error(message);
  }

  return ExitCode.Failure;
};

const loadCandidateContext = (cwd: string): { candidates: CandidateInspectionRecord[]; links: CandidateLinkRecord[] } => {
  const rawCandidates = extractCompactionCandidates({ repoRoot: cwd });
  const candidates = rawCandidates.map(toInspectionRecord).sort(byCandidateId);
  const existingTargets = toExistingPatternTargets(readPatternCards(cwd));
  const links = bucketCompactionCandidates({ candidates: rawCandidates, existingTargets })
    .map((entry) => ({
      candidateId: entry.candidateId,
      bucket: entry.bucket,
      targetId: entry.targetId,
      targetOrigin: entry.targetOrigin,
      relationKind: entry.relation.relationKind,
      similarityScore: Number(entry.relation.similarityScore.toFixed(4)),
      reason: entry.reason,
      deferredGeneralizationCandidate: entry.deferredGeneralizationCandidate
    }))
    .sort(byCandidateId);

  return { candidates, links };
};

const printCandidates = (candidates: CandidateInspectionRecord[]): void => {
  console.log('Compaction candidates');
  console.log('─────────────────────');
  if (candidates.length === 0) {
    console.log('none');
    return;
  }

  for (const candidate of candidates) {
    console.log(`${candidate.candidateId} (${candidate.sourceKind}/${candidate.subjectKind})`);
  }
};

const printShowCandidate = (candidate: CandidateInspectionRecord, link?: CandidateLinkRecord): void => {
  console.log(`Candidate ${candidate.candidateId}`);
  console.log('────────────────────────');
  console.log(`Source: ${candidate.sourceKind}`);
  console.log(`Subject: ${candidate.subjectKind} ${candidate.subjectRef}`);
  console.log(`Trigger: ${candidate.trigger}`);
  console.log(`Mechanism: ${candidate.mechanism}`);
  console.log(`Response: ${candidate.response}`);
  console.log(`Fingerprint: ${candidate.fingerprint}`);
  if (link) {
    console.log(`Bucket: ${link.bucket}`);
    console.log(`Relation: ${link.relationKind} (${link.similarityScore})`);
    console.log(`Target: ${link.targetId ?? 'none'}`);
  }
};

const printLinks = (links: CandidateLinkRecord[]): void => {
  console.log('Candidate links');
  console.log('───────────────');
  if (links.length === 0) {
    console.log('none');
    return;
  }

  for (const link of links) {
    console.log(`${link.candidateId}: ${link.bucket} -> ${link.targetId ?? 'unmatched'} (${link.relationKind}/${link.similarityScore})`);
  }
};

export const runPatternsCandidates = (cwd: string, commandArgs: string[], options: PatternsOptions): number => {
  const action = commandArgs[0] ?? 'list';
  const { candidates, links } = loadCandidateContext(cwd);

  if (action === 'list') {
    const payload = { schemaVersion: '1.0', command: 'patterns', action: 'candidates', candidates };
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    } else {
      printCandidates(candidates);
    }
    return ExitCode.Success;
  }

  if (action === 'show') {
    const id = commandArgs[1];
    if (!id) {
      return emitError(cwd, options, 'playbook patterns candidates show: requires <id>.');
    }

    const candidate = candidates.find((entry) => entry.candidateId === id);
    if (!candidate) {
      return emitError(cwd, options, `playbook patterns candidates show: candidate not found: ${id}`);
    }

    const link = links.find((entry) => entry.candidateId === id);
    const payload = { schemaVersion: '1.0', command: 'patterns', action: 'candidates-show', candidate, link: link ?? null };
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    } else {
      printShowCandidate(candidate, link);
    }
    return ExitCode.Success;
  }

  if (action === 'unmatched') {
    const unmatched = candidates.filter((candidate) => {
      const link = links.find((entry) => entry.candidateId === candidate.candidateId);
      return !link?.targetId;
    });

    const payload = { schemaVersion: '1.0', command: 'patterns', action: 'candidates-unmatched', candidates: unmatched };
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    } else {
      printCandidates(unmatched);
    }
    return ExitCode.Success;
  }

  if (action === 'link') {
    const linked = links.filter((entry) => Boolean(entry.targetId));
    const payload = { schemaVersion: '1.0', command: 'patterns', action: 'candidates-link', links: linked };
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'patterns', payload, outFile: options.outFile });
    } else {
      printLinks(linked);
    }
    return ExitCode.Success;
  }

  return emitError(cwd, options, 'playbook patterns candidates: unsupported subcommand. Use show <id>, unmatched, or link.');
};
