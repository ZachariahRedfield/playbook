import path from 'node:path';
import { SessionSnapshot, normalizeText, stableDecisionId, stableHash } from '../schema.js';

type ImportOptions = {
  text: string;
  sourcePath?: string;
  sourceName?: string;
  createdAt?: string;
  repoHint?: string;
};

const normalizeList = (values: string[]): string[] => {
  const seen = new Set<string>();
  const collected: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) {
      continue;
    }
    const key = normalizeText(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    collected.push(value);
  }
  return collected.sort((a, b) => normalizeText(a).localeCompare(normalizeText(b)) || a.localeCompare(b));
};

const SECTION_KEYS: Record<string, keyof Pick<SessionSnapshot, 'constraints' | 'openQuestions' | 'artifacts' | 'nextSteps'>> = {
  constraints: 'constraints',
  'open questions': 'openQuestions',
  artifacts: 'artifacts',
  'next steps': 'nextSteps'
};

const PATH_PATTERN = /\b(?:\.{1,2}\/)?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+\b/g;
const URL_PATTERN = /https?:\/\/\S+/g;
const COMMAND_PATTERN = /^(\$\s+.+|(pnpm|npm|npx|playbook)\s+.+)$/i;
const DECISION_PREFIX = /^(Decision:|We decided:|Final:|Chosen:)\s*(.+)$/i;

export const importChatTextSnapshot = (options: ImportOptions): SessionSnapshot => {
  const lines = options.text.replace(/\r\n/g, '\n').split('\n');
  const decisions: SessionSnapshot['decisions'] = [];
  const constraints: string[] = [];
  const openQuestions: string[] = [];
  const artifacts: string[] = [];
  const nextSteps: string[] = [];

  const headingIndex = new Map<string, number>();
  lines.forEach((line, index) => {
    const headingMatch = line.match(/^#{1,6}\s*(.+?)\s*$/);
    if (!headingMatch) {
      return;
    }
    headingIndex.set(normalizeText(headingMatch[1]), index);
  });

  const decisionHeadingIndex = headingIndex.get('decisions');
  const hasStructuredHeadings = decisionHeadingIndex !== undefined || Object.keys(SECTION_KEYS).some((heading) => headingIndex.has(heading));

  if (hasStructuredHeadings) {
    let current: 'decisions' | keyof typeof SECTION_KEYS | null = null;
    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s*(.+?)\s*$/);
      if (headingMatch) {
        const heading = normalizeText(headingMatch[1]);
        if (heading === 'decisions' || SECTION_KEYS[heading]) {
          current = heading === 'decisions' ? 'decisions' : heading;
        } else {
          current = null;
        }
        continue;
      }

      if (!current) {
        continue;
      }

      const bulletMatch = line.match(/^\s*(?:[-*+]\s+|\d+\.\s+)(.+)$/);
      if (!bulletMatch) {
        continue;
      }

      const value = bulletMatch[1].trim();
      if (!value) {
        continue;
      }

      if (current === 'decisions') {
        decisions.push({ id: stableDecisionId(value), decision: value });
      } else {
        const target = SECTION_KEYS[current];
        if (target === 'constraints') constraints.push(value);
        if (target === 'openQuestions') openQuestions.push(value);
        if (target === 'artifacts') artifacts.push(value);
        if (target === 'nextSteps') nextSteps.push(value);
      }
    }
  } else {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const decisionMatch = trimmed.match(DECISION_PREFIX);
      if (decisionMatch && decisionMatch[2]) {
        decisions.push({ id: stableDecisionId(decisionMatch[2]), decision: decisionMatch[2].trim() });
      }

      if (COMMAND_PATTERN.test(trimmed)) {
        nextSteps.push(trimmed.replace(/^\$\s*/, ''));
      }

      const withoutUrls = trimmed.replace(URL_PATTERN, ' ');
      for (const url of trimmed.match(URL_PATTERN) ?? []) {
        artifacts.push(url);
      }
      for (const filePath of withoutUrls.match(PATH_PATTERN) ?? []) {
        artifacts.push(filePath);
      }
    }
  }

  const normalizedText = options.text.replace(/\r\n/g, '\n').trim();
  const inputName = options.sourceName || (options.sourcePath ? path.basename(options.sourcePath, path.extname(options.sourcePath)) : 'session');
  const sourceHash = stableHash(normalizedText, 16);
  const sessionId = `${inputName.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase()}-${sourceHash}`;

  const tagCorpus = normalizedText.toLowerCase();
  const tagChecks: Array<[string, RegExp]> = [
    ['ci', /\bci\b/],
    ['github-actions', /github actions|\.github\/workflows/],
    ['pnpm', /\bpnpm\b/],
    ['cli', /\bcli\b/],
    ['docs', /\bdocs?\b/],
    ['architecture', /\barchitecture\b/]
  ];

  const tags = normalizeList(
    tagChecks
      .filter(([, pattern]) => pattern.test(tagCorpus))
      .map(([tag]) => tag)
  );

  return {
    sessionId,
    source: {
      kind: 'chat-text',
      name: options.sourceName,
      path: options.sourcePath,
      hash: sourceHash
    },
    createdAt: options.createdAt ?? new Date(0).toISOString(),
    repoHint: options.repoHint,
    decisions: decisions
      .sort((a, b) => normalizeText(a.decision).localeCompare(normalizeText(b.decision)) || a.decision.localeCompare(b.decision))
      .filter((decision, index, list) => index === list.findIndex((entry) => normalizeText(entry.decision) === normalizeText(decision.decision))),
    constraints: normalizeList(constraints),
    openQuestions: normalizeList(openQuestions),
    artifacts: normalizeList(artifacts),
    nextSteps: normalizeList(nextSteps),
    tags
  };
};
