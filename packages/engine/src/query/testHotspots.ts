import fs from 'node:fs';
import path from 'node:path';

export const TEST_HOTSPOT_TYPES = [
  'broad-retrieval',
  'repeated-fixture-setup',
  'repeated-cli-runner',
  'manual-json-contract-plumbing'
] as const;

export type TestHotspotType = (typeof TEST_HOTSPOT_TYPES)[number];

export type TestHotspotConfidence = 'high' | 'medium';

export type TestHotspotAutomationSafety = 'safe-mechanical-refactor' | 'review-required';

export type TestHotspot = {
  type: TestHotspotType;
  file: string;
  line: number;
  confidence: TestHotspotConfidence;
  currentPattern: string;
  suggestedReplacementHelper: string;
  automationSafety: TestHotspotAutomationSafety;
};

export type TestHotspotsQueryResult = {
  schemaVersion: '1.0';
  command: 'query';
  type: 'test-hotspots';
  hotspots: TestHotspot[];
  summary: {
    totalHotspots: number;
    byType: Array<{ type: TestHotspotType; count: number }>;
  };
};

const IGNORED_DIRECTORIES = new Set(['.git', '.playbook', 'node_modules', 'dist', 'coverage', '.turbo']);

const TEST_FILE_PATTERN = /(?:\.test\.[cm]?[jt]sx?$|__tests__\/.*\.[cm]?[jt]sx?$)/;

const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lineNumberForIndex = (content: string, index: number): number => content.slice(0, Math.max(index, 0)).split(/\r?\n/).length;

const collectTestFiles = (projectRoot: string): string[] => {
  const files: string[] = [];
  const stack = [projectRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
      if (TEST_FILE_PATTERN.test(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const detectBroadRetrievalHotspots = (relativePath: string, content: string): TestHotspot[] => {
  const hotspots: TestHotspot[] = [];
  const declarations = [
    {
      regex: /const\s+(\w+)\s*=\s*queryDependencies\(\s*[^,\n\)]*\s*\);/g,
      listProperty: 'dependencies',
      helper: 'queryDependencies(<repo>, <module>)'
    },
    {
      regex: /const\s+(\w+)\s*=\s*queryModuleOwners\(\s*[^,\n\)]*\s*\);/g,
      listProperty: 'modules',
      helper: 'queryModuleOwners(<repo>, <module>)'
    },
    {
      regex: /const\s+(\w+)\s*=\s*queryDocsCoverage\(\s*[^,\n\)]*\s*\);/g,
      listProperty: 'modules',
      helper: 'queryDocsCoverage(<repo>, <module>)'
    }
  ] as const;

  for (const declaration of declarations) {
    for (const match of content.matchAll(declaration.regex)) {
      const [pattern, variableName] = match;
      if (!pattern || !variableName || match.index === undefined) {
        continue;
      }

      const scanRegex = new RegExp(`${escapeRegExp(variableName)}\\.${declaration.listProperty}\\.(find|filter)\\(`);
      if (!scanRegex.test(content)) {
        continue;
      }

      hotspots.push({
        type: 'broad-retrieval',
        file: relativePath,
        line: lineNumberForIndex(content, match.index),
        confidence: 'high',
        currentPattern: `${pattern} followed by ${variableName}.${declaration.listProperty}.find/filter(...)`,
        suggestedReplacementHelper: declaration.helper,
        automationSafety: 'safe-mechanical-refactor'
      });
    }
  }

  return hotspots;
};

const detectRepeatedFixtureSetupHotspots = (relativePath: string, content: string): TestHotspot[] => {
  const writeMatches = content.match(/fs\.writeFileSync\(path\.join\(repo,/g) ?? [];
  if (writeMatches.length < 4) {
    return [];
  }

  const firstMatchIndex = content.indexOf('fs.writeFileSync(path.join(repo,');

  return [
    {
      type: 'repeated-fixture-setup',
      file: relativePath,
      line: lineNumberForIndex(content, firstMatchIndex),
      confidence: 'medium',
      currentPattern: `${writeMatches.length} inline fs.writeFileSync(path.join(repo, ...)) calls for fixture setup`,
      suggestedReplacementHelper: 'extract fixture builder helper (for example writeRepoIndexFixture/writeVerifyFixture)',
      automationSafety: 'safe-mechanical-refactor'
    }
  ];
};

const detectRepeatedCliRunnerHotspots = (relativePath: string, content: string): TestHotspot[] => {
  const runCliMatches = content.match(/runCli\(/g) ?? [];
  const shellCliMatches = content.match(/(?:execSync|spawnSync)\([^\n]*packages\/cli\/dist\/main\.js/g) ?? [];
  const occurrences = runCliMatches.length + shellCliMatches.length;

  if (occurrences < 3) {
    return [];
  }

  const firstIndex = content.search(/runCli\(|(?:execSync|spawnSync)\([^\n]*packages\/cli\/dist\/main\.js/);

  return [
    {
      type: 'repeated-cli-runner',
      file: relativePath,
      line: lineNumberForIndex(content, firstIndex),
      confidence: 'medium',
      currentPattern: `${occurrences} repeated CLI invocation snippets in a single test file`,
      suggestedReplacementHelper: 'extract canonical CLI runner helper for deterministic command execution',
      automationSafety: 'safe-mechanical-refactor'
    }
  ];
};

const detectManualJsonContractPlumbingHotspots = (relativePath: string, content: string): TestHotspot[] => {
  const spyParseMatches = content.match(/JSON\.parse\(String\(logSpy\.mock\.calls\[/g) ?? [];
  const artifactParseMatches = content.match(/JSON\.parse\(fs\.readFileSync\(/g) ?? [];
  const occurrences = spyParseMatches.length + artifactParseMatches.length;

  if (occurrences < 3) {
    return [];
  }

  const firstIndex = content.search(/JSON\.parse\(String\(logSpy\.mock\.calls\[|JSON\.parse\(fs\.readFileSync\(/);

  return [
    {
      type: 'manual-json-contract-plumbing',
      file: relativePath,
      line: lineNumberForIndex(content, firstIndex),
      confidence: 'medium',
      currentPattern: `${occurrences} repeated JSON.parse(...) contract extraction snippets`,
      suggestedReplacementHelper: 'extract deterministic JSON contract helper (for example parseLoggedJsonPayload)',
      automationSafety: 'review-required'
    }
  ];
};

const summarizeHotspots = (hotspots: TestHotspot[]): Array<{ type: TestHotspotType; count: number }> =>
  TEST_HOTSPOT_TYPES.map((type) => ({
    type,
    count: hotspots.filter((hotspot) => hotspot.type === type).length
  })).filter((entry) => entry.count > 0);

export const queryTestHotspots = (projectRoot: string): TestHotspotsQueryResult => {
  const testFiles = collectTestFiles(projectRoot);
  const hotspots: TestHotspot[] = [];

  for (const relativePath of testFiles) {
    const absolutePath = path.join(projectRoot, relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    hotspots.push(...detectBroadRetrievalHotspots(relativePath, content));
    hotspots.push(...detectRepeatedFixtureSetupHotspots(relativePath, content));
    hotspots.push(...detectRepeatedCliRunnerHotspots(relativePath, content));
    hotspots.push(...detectManualJsonContractPlumbingHotspots(relativePath, content));
  }

  const sortedHotspots = hotspots.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }

    if (left.line !== right.line) {
      return left.line - right.line;
    }

    return left.type.localeCompare(right.type);
  });

  return {
    schemaVersion: '1.0',
    command: 'query',
    type: 'test-hotspots',
    hotspots: sortedHotspots,
    summary: {
      totalHotspots: sortedHotspots.length,
      byType: summarizeHotspots(sortedHotspots)
    }
  };
};
