import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { MemoryKnowledgeArtifact, MemoryKnowledgeEntry } from '../memory/knowledge.js';

export const AUTOMATION_SUGGESTIONS_SCHEMA_VERSION = '1.0' as const;
export const AUTOMATION_SUGGESTIONS_RELATIVE_PATH = '.playbook/automation-suggestions.json' as const;

const PROMOTED_KNOWLEDGE_PATHS = [
  '.playbook/memory/knowledge/decisions.json',
  '.playbook/memory/knowledge/patterns.json',
  '.playbook/memory/knowledge/failure-modes.json',
  '.playbook/memory/knowledge/invariants.json'
] as const;

const EXCLUDED_SOURCES = [
  'raw-chat-memory',
  'unreviewed-candidate-knowledge',
  'evidence-free-inferred-rules'
] as const;

type ExcludedSource = (typeof EXCLUDED_SOURCES)[number];

type PromotedKnowledgeEntry = MemoryKnowledgeEntry & { _knowledgeGeneratedAt: string; _sourcePath: string };

export type AutomationSuggestion = {
  suggestionId: string;
  sourceKnowledgeRefs: string[];
  suggestedAutomationPattern: string;
  rationale: string;
  confidence: number;
  riskSummary: {
    level: 'low' | 'medium' | 'high';
    summary: string;
  };
  rollbackAccountability: {
    owner: 'governance-reviewer';
    rollbackPlan: string;
    accountabilityRefs: string[];
  };
  provenanceRefs: Array<{
    knowledgeId: string;
    eventId: string;
    sourcePath: string;
    fingerprint: string;
  }>;
  freshness: {
    promotedAt: string;
    knowledgeGeneratedAt: string;
    ageDays: number;
    stale: boolean;
  };
  policyPackRefs?: string[];
};

export type AutomationSuggestionsArtifact = {
  schemaVersion: typeof AUTOMATION_SUGGESTIONS_SCHEMA_VERSION;
  kind: 'playbook-automation-suggestions';
  proposalOnly: true;
  authority: 'read-only';
  generatedAt: string;
  artifactPath: typeof AUTOMATION_SUGGESTIONS_RELATIVE_PATH;
  inputs: {
    promotedKnowledgePaths: string[];
    approvedPolicyPackRefs: string[];
    excludedSources: ExcludedSource[];
  };
  suggestions: AutomationSuggestion[];
};

export type BuildAutomationSuggestionsOptions = {
  generatedAt?: string;
  staleAfterDays?: number;
  approvedPolicyPackRefs?: string[];
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const asIsoOrEpoch = (value: unknown): string => {
  if (typeof value !== 'string') {
    return new Date(0).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? new Date(0).toISOString() : new Date(parsed).toISOString();
};

const sanitizePolicyPackRefs = (refs: string[]): string[] =>
  [...new Set(refs.filter((entry) => isNonEmptyString(entry) && entry.startsWith('.playbook/')))].sort((left, right) => left.localeCompare(right));

const parsePromotedKnowledge = (repoRoot: string): PromotedKnowledgeEntry[] => {
  const collected: PromotedKnowledgeEntry[] = [];

  for (const relativePath of PROMOTED_KNOWLEDGE_PATHS) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const parsed = readJson<Partial<MemoryKnowledgeArtifact>>(fullPath);
    const knowledgeGeneratedAt = asIsoOrEpoch(parsed.generatedAt);
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    for (const candidate of entries) {
      if (!candidate || typeof candidate !== 'object' || !isNonEmptyString((candidate as { knowledgeId?: unknown }).knowledgeId)) {
        continue;
      }
      const entry = candidate as MemoryKnowledgeEntry;
      if (entry.status !== 'active') {
        continue;
      }
      if (!Array.isArray(entry.provenance) || entry.provenance.length === 0) {
        continue;
      }
      collected.push({
        ...entry,
        promotedAt: asIsoOrEpoch(entry.promotedAt),
        _knowledgeGeneratedAt: knowledgeGeneratedAt,
        _sourcePath: relativePath
      });
    }
  }

  return collected.sort((left, right) => left.knowledgeId.localeCompare(right.knowledgeId));
};

const toAgeDays = (generatedAtMs: number, promotedAtIso: string): number => {
  const promotedAtMs = Date.parse(promotedAtIso);
  if (Number.isNaN(promotedAtMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((generatedAtMs - promotedAtMs) / (1000 * 60 * 60 * 24)));
};

const toSuggestedPattern = (entry: MemoryKnowledgeEntry): string => {
  if (entry.kind === 'invariant') return 'guardrail-check-template';
  if (entry.kind === 'failure_mode') return 'regression-sentinel-template';
  if (entry.kind === 'decision') return 'decision-drift-review-template';
  return 'pattern-conformance-template';
};

const deriveConfidence = (entry: MemoryKnowledgeEntry, stale: boolean): number => {
  const provenanceSignal = Math.min(0.25, entry.provenance.length * 0.05);
  const baseline = 0.6 + provenanceSignal;
  const stalePenalty = stale ? 0.15 : 0;
  return Math.max(0, Math.min(1, Number((baseline - stalePenalty).toFixed(2))));
};

const deriveRiskLevel = (confidence: number, stale: boolean): 'low' | 'medium' | 'high' => {
  if (stale || confidence < 0.6) return 'high';
  if (confidence < 0.75) return 'medium';
  return 'low';
};

const toSuggestionId = (entry: MemoryKnowledgeEntry, suggestedPattern: string): string => {
  const digest = createHash('sha256').update(`${entry.knowledgeId}:${suggestedPattern}`).digest('hex').slice(0, 12);
  return `suggestion.${entry.knowledgeId}.${digest}`;
};

export const buildAutomationSuggestionsArtifact = (
  repoRoot: string,
  options: BuildAutomationSuggestionsOptions = {}
): AutomationSuggestionsArtifact => {
  const generatedAtIso = asIsoOrEpoch(options.generatedAt ?? new Date().toISOString());
  const staleAfterDays = Math.max(1, Math.floor(options.staleAfterDays ?? 45));
  const approvedPolicyPackRefs = sanitizePolicyPackRefs(options.approvedPolicyPackRefs ?? []);
  const generatedAtMs = Date.parse(generatedAtIso);
  const promotedKnowledge = parsePromotedKnowledge(repoRoot);

  const suggestions: AutomationSuggestion[] = promotedKnowledge.map((entry) => {
    const ageDays = toAgeDays(generatedAtMs, entry.promotedAt);
    const stale = ageDays >= staleAfterDays;
    const suggestedAutomationPattern = toSuggestedPattern(entry);
    const confidence = deriveConfidence(entry, stale);
    const riskLevel = deriveRiskLevel(confidence, stale);

    const provenanceRefs = [...entry.provenance]
      .filter((record) => isNonEmptyString(record.eventId) && isNonEmptyString(record.sourcePath) && isNonEmptyString(record.fingerprint))
      .map((record) => ({
        knowledgeId: entry.knowledgeId,
        eventId: record.eventId,
        sourcePath: record.sourcePath,
        fingerprint: record.fingerprint
      }))
      .sort((left, right) => {
        const eventOrder = left.eventId.localeCompare(right.eventId);
        if (eventOrder !== 0) return eventOrder;
        const pathOrder = left.sourcePath.localeCompare(right.sourcePath);
        if (pathOrder !== 0) return pathOrder;
        return left.fingerprint.localeCompare(right.fingerprint);
      });

    return {
      suggestionId: toSuggestionId(entry, suggestedAutomationPattern),
      sourceKnowledgeRefs: [`knowledge:${entry.knowledgeId}`, `artifact:${entry._sourcePath}`],
      suggestedAutomationPattern,
      rationale: `Promoted knowledge ${entry.knowledgeId} (${entry.kind}) remains inspectable and provenance-linked, so emit a proposal-only automation template for governed human review.`,
      confidence,
      riskSummary: {
        level: riskLevel,
        summary: stale
          ? `Knowledge is ${ageDays} days old; require governance review before using ${suggestedAutomationPattern}.`
          : `Suggestion uses promoted, provenance-linked knowledge only (${entry.provenance.length} provenance refs).`
      },
      rollbackAccountability: {
        owner: 'governance-reviewer',
        rollbackPlan: `Reject ${toSuggestionId(entry, suggestedAutomationPattern)} during review or remove the row from ${AUTOMATION_SUGGESTIONS_RELATIVE_PATH}.`,
        accountabilityRefs: [`knowledge:${entry.knowledgeId}`, ...provenanceRefs.map((record) => `event:${record.eventId}`)]
      },
      provenanceRefs,
      freshness: {
        promotedAt: entry.promotedAt,
        knowledgeGeneratedAt: entry._knowledgeGeneratedAt,
        ageDays,
        stale
      },
      ...(approvedPolicyPackRefs.length > 0 ? { policyPackRefs: approvedPolicyPackRefs } : {})
    } satisfies AutomationSuggestion;
  }).sort((left, right) => left.suggestionId.localeCompare(right.suggestionId));

  return {
    schemaVersion: AUTOMATION_SUGGESTIONS_SCHEMA_VERSION,
    kind: 'playbook-automation-suggestions',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt: generatedAtIso,
    artifactPath: AUTOMATION_SUGGESTIONS_RELATIVE_PATH,
    inputs: {
      promotedKnowledgePaths: [...PROMOTED_KNOWLEDGE_PATHS],
      approvedPolicyPackRefs,
      excludedSources: [...EXCLUDED_SOURCES]
    },
    suggestions
  };
};

export const writeAutomationSuggestionsArtifact = (
  repoRoot: string,
  artifact: AutomationSuggestionsArtifact,
  relativePath: string = AUTOMATION_SUGGESTIONS_RELATIVE_PATH
): string => {
  const outputPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};
