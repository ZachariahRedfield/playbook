import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryIndex } from '../indexer/repoIndexer.js';

export type DocsCoverageModuleResult = {
  module: string;
  documented: boolean;
  sources: string[];
};

export type DocsCoverageSummary = {
  totalModules: number;
  documentedModules: number;
  undocumentedModules: number;
};

export type DocsCoverageQueryResult = {
  schemaVersion: '1.0';
  command: 'query';
  type: 'docs-coverage';
  modules: DocsCoverageModuleResult[];
  summary: DocsCoverageSummary;
};

const INDEX_RELATIVE_PATH = '.playbook/repo-index.json' as const;
const DOCS_DIR_RELATIVE_PATH = 'docs' as const;

const readRepositoryIndex = (projectRoot: string): RepositoryIndex => {
  const indexPath = path.join(projectRoot, INDEX_RELATIVE_PATH);
  if (!fs.existsSync(indexPath)) {
    throw new Error('playbook query: missing repository index at .playbook/repo-index.json. Run "playbook index" first.');
  }

  const raw = fs.readFileSync(indexPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<RepositoryIndex>;

  if (parsed.schemaVersion !== '1.0') {
    throw new Error(
      `playbook query: unsupported repository index schemaVersion "${String(parsed.schemaVersion)}". Expected "1.0".`
    );
  }

  return parsed as RepositoryIndex;
};

const collectMarkdownFiles = (projectRoot: string): string[] => {
  const files = new Set<string>();
  const docsRoot = path.join(projectRoot, DOCS_DIR_RELATIVE_PATH);

  if (fs.existsSync(docsRoot)) {
    const stack = [docsRoot];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const child = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(child);
          continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          files.add(path.relative(projectRoot, child).split(path.sep).join('/'));
        }
      }
    }
  }

  const readmePath = path.join(projectRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    files.add('README.md');
  }

  return Array.from(files).sort((a, b) => a.localeCompare(b));
};

const normalizeToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createModuleAliases = (moduleName: string): string[] => {
  const aliases = new Set<string>();
  const lower = moduleName.toLowerCase();
  aliases.add(lower);

  const segments = lower.split('/').filter((segment) => segment.length > 0);
  if (segments.length > 0) {
    aliases.add(segments[segments.length - 1]);
  }

  for (const segment of segments) {
    aliases.add(segment);
    if (segment.startsWith('playbook-')) {
      aliases.add(segment.slice('playbook-'.length));
    }
  }

  if (lower.startsWith('@')) {
    aliases.add(lower.slice(1));
  }

  return Array.from(aliases)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0)
    .sort((a, b) => a.localeCompare(b));
};

const createDocSlugCandidates = (moduleName: string): string[] => {
  const aliases = createModuleAliases(moduleName);
  const slugs = new Set<string>();

  for (const alias of aliases) {
    const kebab = alias
      .replace(/^@/, '')
      .replace(/[\/]+/g, '-')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (kebab.length > 0) {
      slugs.add(kebab);
    }
  }

  return Array.from(slugs).sort((a, b) => a.localeCompare(b));
};

const findExpectedDocMappings = (projectRoot: string, moduleName: string): string[] => {
  const candidates = createDocSlugCandidates(moduleName);
  const matches = new Set<string>();

  for (const candidate of candidates) {
    const pathsToCheck = [
      `docs/modules/${candidate}.md`,
      `docs/modules/${candidate}/README.md`,
      `docs/${candidate}.md`,
      `docs/${candidate}/README.md`
    ];

    for (const relativePath of pathsToCheck) {
      if (fs.existsSync(path.join(projectRoot, relativePath))) {
        matches.add(relativePath);
      }
    }
  }

  return Array.from(matches).sort((a, b) => a.localeCompare(b));
};

const containsAliasToken = (text: string, aliases: string[]): boolean => {
  const normalizedText = normalizeToken(text);

  return aliases.some((alias) => {
    const normalizedAlias = normalizeToken(alias);
    if (normalizedAlias.length === 0) {
      return false;
    }

    const tokenRegex = new RegExp(`(^|\\s)${escapeRegex(normalizedAlias)}(\\s|$)`);
    return tokenRegex.test(normalizedText);
  });
};

const fileContainsModuleHeading = (content: string, aliases: string[]): boolean => {
  const headings = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+/.test(line));

  return headings.some((heading) => containsAliasToken(heading, aliases));
};

const fileContainsArchitectureReference = (content: string, aliases: string[]): boolean => {
  return containsAliasToken(content, aliases);
};

const findDocReferences = (projectRoot: string, moduleName: string, markdownFiles: string[]): string[] => {
  const aliases = createModuleAliases(moduleName);
  const sources = new Set<string>();

  for (const relativePath of markdownFiles) {
    const absolutePath = path.join(projectRoot, relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    if (fileContainsModuleHeading(content, aliases)) {
      sources.add(relativePath);
      continue;
    }

    if (
      (relativePath === 'docs/ARCHITECTURE.md' || relativePath === 'docs/ARCHITECTURE_DIAGRAMS.md') &&
      fileContainsArchitectureReference(content, aliases)
    ) {
      sources.add(relativePath);
    }
  }

  return Array.from(sources).sort((a, b) => a.localeCompare(b));
};

const summarizeCoverage = (modules: DocsCoverageModuleResult[]): DocsCoverageSummary => {
  const documentedModules = modules.filter((entry) => entry.documented).length;

  return {
    totalModules: modules.length,
    documentedModules,
    undocumentedModules: modules.length - documentedModules
  };
};

export const queryDocsCoverage = (projectRoot: string, moduleName?: string): DocsCoverageQueryResult => {
  const index = readRepositoryIndex(projectRoot);
  const markdownFiles = collectMarkdownFiles(projectRoot);

  if (moduleName && !index.modules.some((moduleEntry) => moduleEntry.name === moduleName)) {
    throw new Error(`playbook query docs-coverage: unknown module "${moduleName}".`);
  }

  const targetModules = moduleName ? [moduleName] : index.modules.map((moduleEntry) => moduleEntry.name);

  const modules = targetModules
    .sort((a, b) => a.localeCompare(b))
    .map((moduleEntry) => {
      const mappedSources = findExpectedDocMappings(projectRoot, moduleEntry);
      const referenceSources = findDocReferences(projectRoot, moduleEntry, markdownFiles);
      const sources = Array.from(new Set([...mappedSources, ...referenceSources])).sort((a, b) => a.localeCompare(b));

      return {
        module: moduleEntry,
        documented: sources.length > 0,
        sources
      };
    });

  return {
    schemaVersion: '1.0',
    command: 'query',
    type: 'docs-coverage',
    modules,
    summary: summarizeCoverage(modules)
  };
};
