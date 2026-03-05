import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importChatTextSnapshot } from '../src/sessions/importers/chat_text_importer.js';

const fixture = (name: string): string => fs.readFileSync(path.join(process.cwd(), 'src/sessions/__fixtures__', name), 'utf8');

describe('session importer', () => {
  it('parses heading sections deterministically', () => {
    const snapshot = importChatTextSnapshot({
      text: fixture('chat-with-headings.md'),
      sourceName: 'headings',
      createdAt: '2026-03-05T00:00:00.000Z'
    });

    expect(snapshot.decisions.map((entry) => entry.decision)).toEqual(['Keep CLI offline by default', 'Use pnpm workspaces']);
    expect(snapshot.constraints).toEqual(['Deterministic output only', 'No network access required']);
    expect(snapshot.openQuestions).toEqual(['Should merge output include source links?']);
    expect(snapshot.artifacts).toEqual(['docs/ARCHITECTURE.md', 'https://example.com/design']);
    expect(snapshot.nextSteps).toEqual(['Add cleanup command', 'Implement parser tests']);
  });

  it('extracts artifacts and commands in fallback mode without guessing', () => {
    const snapshot = importChatTextSnapshot({
      text: fixture('chat-without-headings.md'),
      sourceName: 'fallback',
      createdAt: '2026-03-05T00:00:00.000Z'
    });

    expect(snapshot.decisions.map((entry) => entry.decision)).toEqual([
      'Keep cleanup defaults at 30 days and 50 files.',
      'Use npm scripts only for smoke tests.'
    ]);
    expect(snapshot.nextSteps).toEqual(['npm run build', 'pnpm -r test']);
    expect(snapshot.artifacts).toEqual([
      'docs/CHANGELOG.md',
      'https://example.com/runbook',
      'packages/cli/src/main.ts'
    ]);
  });
});
