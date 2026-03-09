#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const metadataPath = path.join(repoRoot, '.playbook', 'pr-metadata.json');

const warn = (message) => {
  console.warn(`sync-pr-metadata: warning: ${message}`);
};

if (!fs.existsSync(metadataPath)) {
  warn(`missing ${path.relative(repoRoot, metadataPath)}; nothing to sync`);
  process.exit(0);
}

let metadata;
try {
  metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
} catch (error) {
  warn(`invalid JSON in ${path.relative(repoRoot, metadataPath)} (${error.message})`);
  process.exit(0);
}

const suggestedTitle = typeof metadata.suggestedTitle === 'string' ? metadata.suggestedTitle.trim() : '';
const snippet =
  typeof metadata.suggestedBodySnippet === 'string'
    ? metadata.suggestedBodySnippet.trim()
    : Array.isArray(metadata.bodySections)
      ? metadata.bodySections
          .filter((section) => typeof section === 'string' && section.trim())
          .join('\n\n')
      : '';

if (!suggestedTitle || !snippet) {
  warn('pr metadata is missing suggestedTitle or suggestedBodySnippet/bodySections; nothing to sync');
  process.exit(0);
}

try {
  execFileSync('gh', ['pr', 'edit', '--title', suggestedTitle, '--body', snippet], {
    cwd: repoRoot,
    stdio: 'inherit'
  });
  console.log('sync-pr-metadata: updated PR title/body from .playbook/pr-metadata.json');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  warn(`unable to update PR metadata via gh CLI (${message}); continuing without failure`);
  process.exit(0);
}
