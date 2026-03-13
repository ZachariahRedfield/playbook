import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type FixtureOptions = {
  prefix?: string;
};

const SEEDED_TEMPLATE_DIR = path.resolve(import.meta.dirname, 'seeded');

const copyDirectory = (sourceDir: string, targetDir: string): void => {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
};

const createFixtureRepo = (prefix: string): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  copyDirectory(SEEDED_TEMPLATE_DIR, root);
  return root;
};

export const createSeededKnowledgeFixtureRepo = (options: FixtureOptions = {}): string =>
  createFixtureRepo(options.prefix ?? 'playbook-knowledge-fixture-');

export const createEmptyKnowledgeFixtureRepo = (options: FixtureOptions = {}): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), options.prefix ?? 'playbook-knowledge-empty-'));
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name: 'playbook-contract-fixture' }, null, 2)}\n`, 'utf8');
  return root;
};
