import { createHash } from 'node:crypto';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

const shortHash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 8);

export const createPatternCardId = (input: {
  trigger: string;
  context: string;
  mechanism: string;
  invariant: string;
  implication: string;
  response: string;
}): string => {
  const canonical = JSON.stringify(input);
  const base = `${slugify(input.trigger).slice(0, 24)}_${slugify(input.mechanism).slice(0, 36)}`.replace(/^_+|_+$/g, '');
  const slug = base || 'compact_pattern';
  return `pattern.${slug}_${shortHash(canonical)}`;
};
