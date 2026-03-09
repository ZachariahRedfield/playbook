import { createHash } from 'node:crypto';
import type { KnowledgeCanonicalShape } from './knowledge-types.js';

const canonicalizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonicalizeValue(nested)]);
    return Object.fromEntries(entries);
  }
  return value;
};

export const canonicalizeKnowledgeShape = (shape: KnowledgeCanonicalShape): KnowledgeCanonicalShape =>
  canonicalizeValue(shape) as KnowledgeCanonicalShape;

export const serializeCanonicalKnowledgeShape = (shape: KnowledgeCanonicalShape): string =>
  JSON.stringify(canonicalizeKnowledgeShape(shape));

export const createKnowledgeArtifactId = (canonicalKey: string, canonicalRepresentation: string): string => {
  const digest = createHash('sha256').update(`${canonicalKey}\n${canonicalRepresentation}`).digest('hex').slice(0, 16);
  return `knowledge-${digest}`;
};
