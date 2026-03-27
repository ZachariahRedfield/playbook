import fs from 'node:fs';
import path from 'node:path';

export const PATTERN_CONVERGENCE_RELATIVE_PATH = '.playbook/pattern-convergence.json' as const;
const PATTERN_CANDIDATES_RELATIVE_PATH = '.playbook/pattern-candidates.json' as const;
const PATTERN_PROMOTED_RELATIVE_PATH = '.playbook/patterns-promoted.json' as const;
const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z';

const readJson = <T>(targetPath: string): T => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;
const round4 = (value: number): number => Number(value.toFixed(4));

type CandidatePatternRecord = {
  id: string;
  title: string;
  description: string;
  pattern_family: string;
  signals: string[];
};

type PatternCandidatesArtifact = {
  kind: 'pattern-candidates';
  generatedAt: string;
  candidates: CandidatePatternRecord[];
};

type PromotedPatternRecord = {
  id: string;
  canonicalPatternName: string;
  whyItExists: string;
  reusableEngineeringMeaning: string;
  examples: string[];
};

type PromotedPatternsArtifact = {
  kind: 'playbook-promoted-patterns';
  promotedPatterns: PromotedPatternRecord[];
};

type NormalizedPattern = {
  source: 'candidate' | 'promoted';
  id: string;
  title: string;
  intent: string;
  constraint_class: string;
  resolution_strategy: string;
};

export type PatternConvergenceMember = NormalizedPattern;

export type PatternConvergenceCluster = {
  clusterId: string;
  intent: string;
  constraint_class: string;
  resolution_strategy: string;
  members: PatternConvergenceMember[];
  shared_abstraction: string;
  convergence_confidence: number;
  recommended_higher_order_pattern: string;
};

export type PatternConvergenceArtifact = {
  schemaVersion: '1.0';
  kind: 'pattern-convergence';
  generatedAt: string;
  proposalOnly: true;
  sourceArtifacts: Array<typeof PATTERN_CANDIDATES_RELATIVE_PATH | typeof PATTERN_PROMOTED_RELATIVE_PATH>;
  clusters: PatternConvergenceCluster[];
};

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toSlug = (value: string): string => {
  const normalized = normalizeText(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return normalized.length > 0 ? normalized : 'unclassified';
};

const hasAny = (value: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(value));

const classifyIntent = (summary: string): string => {
  if (hasAny(summary, [/determinis/, /consisten/, /stable/, /repeatable/])) return 'deterministic-governance';
  if (hasAny(summary, [/modular/, /boundar/, /coupling/, /dependenc/])) return 'modular-boundary-safety';
  if (hasAny(summary, [/reus/, /portab/, /shared/, /cross[- ]repo/])) return 'pattern-portability';
  if (hasAny(summary, [/review/, /promot/, /human/, /approv/])) return 'review-gated-evolution';
  return 'general-governance';
};

const classifyConstraint = (summary: string): string => {
  if (hasAny(summary, [/mutation/, /write/, /side effect/, /authority/, /promot/])) return 'mutation-boundary';
  if (hasAny(summary, [/schema/, /contract/, /shape/, /typing?/])) return 'contract-shape';
  if (hasAny(summary, [/order/, /determinis/, /stable/, /same input/])) return 'deterministic-ordering';
  if (hasAny(summary, [/cross[- ]repo/, /integration/, /interop/])) return 'cross-repo-consistency';
  return 'general-constraint';
};

const classifyResolution = (summary: string): string => {
  if (hasAny(summary, [/cluster/, /normaliz/, /group/, /converg/])) return 'normalize-and-cluster';
  if (hasAny(summary, [/queue/, /review/, /gate/, /approval/])) return 'review-gated-promotion';
  if (hasAny(summary, [/index/, /query/, /artifact/, /read-only/])) return 'read-only-artifact-synthesis';
  if (hasAny(summary, [/score/, /confidence/, /signal/])) return 'evidence-driven-ranking';
  return 'deterministic-classification';
};

const normalizeCandidate = (candidate: CandidatePatternRecord): NormalizedPattern => {
  const summary = normalizeText([candidate.pattern_family, candidate.title, candidate.description, ...candidate.signals].join(' '));
  return {
    source: 'candidate',
    id: candidate.id,
    title: candidate.title,
    intent: classifyIntent(summary),
    constraint_class: classifyConstraint(summary),
    resolution_strategy: classifyResolution(summary)
  };
};

const normalizePromoted = (pattern: PromotedPatternRecord): NormalizedPattern => {
  const summary = normalizeText([pattern.canonicalPatternName, pattern.whyItExists, pattern.reusableEngineeringMeaning, ...pattern.examples].join(' '));
  return {
    source: 'promoted',
    id: pattern.id,
    title: pattern.canonicalPatternName,
    intent: classifyIntent(summary),
    constraint_class: classifyConstraint(summary),
    resolution_strategy: classifyResolution(summary)
  };
};

const readCandidatesArtifact = (cwd: string): PatternCandidatesArtifact | null => {
  const targetPath = path.join(cwd, PATTERN_CANDIDATES_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) return null;
  const artifact = readJson<PatternCandidatesArtifact>(targetPath);
  if (artifact.kind !== 'pattern-candidates') {
    throw new Error(`playbook pattern convergence: invalid artifact kind at ${PATTERN_CANDIDATES_RELATIVE_PATH}. Expected "pattern-candidates".`);
  }
  return artifact;
};

const readPromotedArtifact = (cwd: string): PromotedPatternsArtifact | null => {
  const targetPath = path.join(cwd, PATTERN_PROMOTED_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) return null;
  const artifact = readJson<PromotedPatternsArtifact>(targetPath);
  if (artifact.kind !== 'playbook-promoted-patterns') {
    throw new Error(`playbook pattern convergence: invalid artifact kind at ${PATTERN_PROMOTED_RELATIVE_PATH}. Expected "playbook-promoted-patterns".`);
  }
  return artifact;
};

const buildSharedAbstraction = (cluster: { intent: string; constraint: string; resolution: string }): string =>
  `Patterns in this cluster align on intent "${cluster.intent}", respect constraint class "${cluster.constraint}", and converge via "${cluster.resolution}".`;

const buildRecommendedText = (cluster: { intent: string; constraint: string; resolution: string; members: NormalizedPattern[] }): string => {
  const sampleMembers = cluster.members
    .slice(0, 3)
    .map((entry) => `${entry.source}:${entry.id}`)
    .join(', ');
  return `Proposed higher-order pattern: encode ${cluster.intent} under ${cluster.constraint} using ${cluster.resolution}. Seed examples: ${sampleMembers}.`;
};

const computeConvergenceConfidence = (members: NormalizedPattern[]): number => {
  const sourceDiversity = new Set(members.map((entry) => entry.source)).size;
  const sizeSignal = Math.min(members.length / 4, 1);
  const diversitySignal = sourceDiversity > 1 ? 1 : 0.7;
  return round4(Math.min(1, 0.5 * sizeSignal + 0.5 * diversitySignal));
};

const compareMembers = (left: NormalizedPattern, right: NormalizedPattern): number =>
  left.source.localeCompare(right.source) || left.id.localeCompare(right.id) || left.title.localeCompare(right.title);

const compareClusters = (left: PatternConvergenceCluster, right: PatternConvergenceCluster): number =>
  left.intent.localeCompare(right.intent) ||
  left.constraint_class.localeCompare(right.constraint_class) ||
  left.resolution_strategy.localeCompare(right.resolution_strategy) ||
  left.clusterId.localeCompare(right.clusterId);

export const buildPatternConvergenceArtifact = (cwd: string): PatternConvergenceArtifact => {
  const candidates = readCandidatesArtifact(cwd);
  const promoted = readPromotedArtifact(cwd);

  const sourceArtifacts: PatternConvergenceArtifact['sourceArtifacts'] = [];
  if (candidates) sourceArtifacts.push(PATTERN_CANDIDATES_RELATIVE_PATH);
  if (promoted) sourceArtifacts.push(PATTERN_PROMOTED_RELATIVE_PATH);

  const generatedAtCandidates = candidates?.generatedAt ?? DEFAULT_GENERATED_AT;
  const generatedAt = generatedAtCandidates > DEFAULT_GENERATED_AT ? generatedAtCandidates : DEFAULT_GENERATED_AT;

  const normalizedPatterns: NormalizedPattern[] = [
    ...(candidates?.candidates.map(normalizeCandidate) ?? []),
    ...(promoted?.promotedPatterns.map(normalizePromoted) ?? [])
  ].sort(compareMembers);

  const grouped = new Map<string, NormalizedPattern[]>();
  for (const pattern of normalizedPatterns) {
    const key = `${pattern.intent}|${pattern.constraint_class}|${pattern.resolution_strategy}`;
    const existing = grouped.get(key) ?? [];
    existing.push(pattern);
    grouped.set(key, existing);
  }

  const clusters: PatternConvergenceCluster[] = [...grouped.entries()]
    .map(([key, members]) => {
      const [intent, constraint, resolution] = key.split('|') as [string, string, string];
      const orderedMembers = [...members].sort(compareMembers);
      const clusterId = `cluster:${toSlug(`${intent}-${constraint}-${resolution}`)}`;
      return {
        clusterId,
        intent,
        constraint_class: constraint,
        resolution_strategy: resolution,
        members: orderedMembers,
        shared_abstraction: buildSharedAbstraction({ intent, constraint, resolution }),
        convergence_confidence: computeConvergenceConfidence(orderedMembers),
        recommended_higher_order_pattern: buildRecommendedText({ intent, constraint, resolution, members: orderedMembers })
      };
    })
    .sort(compareClusters);

  return {
    schemaVersion: '1.0',
    kind: 'pattern-convergence',
    generatedAt,
    proposalOnly: true,
    sourceArtifacts,
    clusters
  };
};

export const writePatternConvergenceArtifact = (cwd: string, artifact: PatternConvergenceArtifact): string => {
  const targetPath = path.join(cwd, PATTERN_CONVERGENCE_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return targetPath;
};

export const readPatternConvergenceArtifact = (cwd: string): PatternConvergenceArtifact => {
  const targetPath = path.join(cwd, PATTERN_CONVERGENCE_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    throw new Error('playbook pattern convergence: missing artifact at .playbook/pattern-convergence.json.');
  }
  return readJson<PatternConvergenceArtifact>(targetPath);
};
