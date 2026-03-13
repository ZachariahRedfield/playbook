import fs from 'node:fs';
import path from 'node:path';

type CommandTruth = {
  canonicalCommands: string[];
  compatibilityCommands: string[];
  utilityCommands: string[];
  bootstrapLadder: string[];
  remediationLoop: string[];
};

export type DocsAuditLevel = 'error' | 'warning';
export type DocsAuditStatus = 'pass' | 'warn' | 'fail';

export type DocsAuditFinding = {
  ruleId: string;
  level: DocsAuditLevel;
  message: string;
  path: string;
  suggestedDestination?: string;
  recommendation?: 'historical keep' | 'merge into workflow' | 'archive' | 'delete after migration';
};

export type DocsAuditResult = {
  ok: boolean;
  status: DocsAuditStatus;
  summary: {
    errors: number;
    warnings: number;
    checksRun: number;
  };
  findings: DocsAuditFinding[];
};

const ACTIVE_DOC_PATHS = [
  'README.md',
  'AGENTS.md',
  'docs/index.md',
  'docs/ARCHITECTURE.md',
  'docs/commands/README.md',
  'docs/commands/docs.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/PLAYBOOK_BUSINESS_STRATEGY.md',
  'docs/CONSUMER_INTEGRATION_CONTRACT.md',
  'docs/AI_AGENT_CONTEXT.md',
  'docs/ONBOARDING_DEMO.md',
  'docs/REFERENCE/cli.md',
  'docs/FAQ.md',
  'docs/GITHUB_SETUP.md',
  'docs/roadmap/README.md',
  'docs/RELEASING.md',
  'packages/cli/README.md'
] as const;

const FRONT_DOOR_DOC_PATHS = [
  'README.md',
  'docs/index.md',
  'docs/AI_AGENT_CONTEXT.md',
  'docs/ONBOARDING_DEMO.md',
  'docs/FAQ.md',
  'packages/cli/README.md'
] as const;

const COMPATIBILITY_STUB_PATHS = new Set([
  'docs/OVERVIEW.md',
  'docs/WHY_PLAYBOOK.md',
  'docs/PRODUCT_VISION.md',
  'docs/PLAYBOOK_AGENT_GUIDE.md',
  'docs/PLAYBOOK_SYSTEM_ARCHITECTURE.md',
  'docs/PLAYBOOK_ENGINE_SPEC.md',
  'docs/REPORT_DOCS_MERGE.md',
  'docs/PLAYBOOK_IMPROVEMENTS.md'
]);

const HISTORY_PATH_PREFIXES = ['docs/archive/'] as const;
const HISTORY_PATHS = new Set(['CHANGELOG.md']);

const REQUIRED_ANCHORS = [
  'README.md',
  'AGENTS.md',
  'docs/index.md',
  'docs/ARCHITECTURE.md',
  'docs/commands/README.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/PLAYBOOK_BUSINESS_STRATEGY.md',
  'docs/CONSUMER_INTEGRATION_CONTRACT.md',
  'docs/roadmap/README.md',
  'docs/roadmap/ROADMAP.json',
  'docs/roadmap/IMPROVEMENTS_BACKLOG.md',
  'docs/archive/README.md',
  'packages/cli/README.md'
] as const;

const PLANNING_ALLOWED_PATHS = new Set([
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
  'docs/roadmap/README.md',
  'docs/roadmap/IMPROVEMENTS_BACKLOG.md',
  'docs/roadmap/IMPLEMENTATION_PLAN_NEXT_4_WEEKS.md',
  'docs/roadmap/WEEK0_WEEK1_EXECUTION_VALIDATOR.md'
]);

const IDEA_LEAKAGE_SCAN_PATHS = new Set(['AGENTS.md', 'docs/AI_AGENT_CONTEXT.md', 'docs/ONBOARDING_DEMO.md', 'packages/cli/README.md']);

const IDEA_LEAKAGE_PATTERN =
  /\b(roadmap|backlog|future\s+(?:feature|features|plan|plans|work)|upcoming|planned|next\s+up|improvement\s+ideas?|migration\s+tracker|cleanup\s+tracker)\b/i;

const CLEANUP_CANDIDATE_PATTERN = /(?:UPDATE_ROADMAP|DOCS_MERGE|CONSOLIDATION|CLEANUP|MIGRATION|TRACKER)/i;

const LEGACY_DOC_LINK_PATTERN =
  /docs\/(?:OVERVIEW|WHY_PLAYBOOK|PRODUCT_VISION|PLAYBOOK_AGENT_GUIDE|PLAYBOOK_SYSTEM_ARCHITECTURE|PLAYBOOK_ENGINE_SPEC|REPORT_DOCS_MERGE)\.md/iu;

const LEGACY_POSITIONING_PHRASES = [
  'AI-aware engineering governance',
  'governance product that is',
  'governance tool for software repositories'
] as const;

const normalizeHeading = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\s+/g, ' ');

const extractHeadings = (content: string): string[] => {
  const headings: string[] = [];
  for (const line of content.split(/\r?\n/u)) {
    const match = /^#{1,6}\s+(.+?)\s*$/u.exec(line);
    if (match) {
      headings.push(match[1]);
    }
  }

  return headings;
};

const readTextIfExists = (repoRoot: string, relativePath: string): string | null => {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
};

const listDocsTopLevelMarkdown = (repoRoot: string): string[] => {
  const docsPath = path.join(repoRoot, 'docs');
  if (!fs.existsSync(docsPath)) {
    return [];
  }

  return fs
    .readdirSync(docsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => `docs/${entry.name}`)
    .sort();
};

const listArchiveEntries = (repoRoot: string): string[] => {
  const archivePath = path.join(repoRoot, 'docs', 'archive');
  if (!fs.existsSync(archivePath)) {
    return [];
  }

  return fs
    .readdirSync(archivePath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `docs/archive/${entry.name}`)
    .sort();
};


const isPathInPrefixes = (relativePath: string, prefixes: readonly string[]): boolean => prefixes.some((prefix) => relativePath.startsWith(prefix));

const isActivePath = (relativePath: string): boolean => (ACTIVE_DOC_PATHS as readonly string[]).includes(relativePath);

const isFrontDoorPath = (relativePath: string): boolean => (FRONT_DOOR_DOC_PATHS as readonly string[]).includes(relativePath);

const isIntentionalCompatibilityStub = (content: string): boolean => {
  const nonEmptyLines = content.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length > 120) {
    return false;
  }

  const hasStubLanguage = /\b(compatibility|superseded|archived|archive|redirect|canonical|moved)\b/i.test(content);
  const linksCanonicalOrArchive = /(docs\/archive\/|docs\/index\.md|docs\/commands\/README\.md|README\.md|docs\/PLAYBOOK_PRODUCT_ROADMAP\.md)/i.test(
    content
  );

  return hasStubLanguage && linksCanonicalOrArchive;
};

const hasAnalyzeWithoutCompatibilityFraming = (content: string): boolean => {
  const lines = content.split(/\r?\n/u);
  const quickStartHeadingIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^#{1,6}\s+/u.test(line) && /(quick\s*start|onboarding|30-second demo|get started)/iu.test(line))
    .map(({ index }) => index);

  if (quickStartHeadingIndexes.length === 0) {
    return false;
  }

  for (const headingIndex of quickStartHeadingIndexes) {
    const sectionLines = lines.slice(headingIndex, headingIndex + 40);
    const section = sectionLines.join('\n');
    if (!/\banalyze\b/i.test(section)) {
      continue;
    }

    if (!/\b(compatibility|compatible|lightweight|legacy|optional)\b/i.test(section)) {
      return true;
    }
  }

  return false;
};

const hasQuickStartSection = (content: string): boolean =>
  content
    .split(/\r?\n/u)
    .some((line) => /^#{1,6}\s+/u.test(line) && /(quick\s*start|onboarding|30-second demo|get started)/iu.test(line));

const hasAllMarkers = (content: string, markers: readonly string[]): boolean => {
  const normalized = content.toLowerCase();
  return markers.every((marker) => normalized.includes(marker.toLowerCase()));
};

const readCommandTruth = (repoRoot: string): CommandTruth | null => {
  const truthPath = path.join(repoRoot, 'docs/contracts/command-truth.json');
  if (!fs.existsSync(truthPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(truthPath, 'utf8')) as CommandTruth;
    if (!Array.isArray(parsed.bootstrapLadder) || !Array.isArray(parsed.remediationLoop)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const runDocsAudit = (repoRoot: string): DocsAuditResult => {
  const findings: DocsAuditFinding[] = [];
  const commandTruth = readCommandTruth(repoRoot);

  for (const requiredPath of REQUIRED_ANCHORS) {
    if (!fs.existsSync(path.join(repoRoot, requiredPath))) {
      findings.push({
        ruleId: 'docs.required-anchor.missing',
        level: 'error',
        message: 'Required documentation anchor is missing.',
        path: requiredPath
      });
    }
  }

  if (!commandTruth) {
    findings.push({
      ruleId: 'docs.command-truth.missing',
      level: 'error',
      message: 'Command truth contract is missing or invalid. Regenerate managed docs and contracts.',
      path: 'docs/contracts/command-truth.json'
    });
  }

  const topLevelDocs = listDocsTopLevelMarkdown(repoRoot);
  const duplicateRoadmapCandidates = new Set(['docs/ROADMAP.md', 'docs/PRODUCT_ROADMAP.md', 'docs/PLAYBOOK_ROADMAP.md']);
  for (const duplicatePath of topLevelDocs.filter((relativePath) => duplicateRoadmapCandidates.has(relativePath))) {
    findings.push({
      ruleId: 'docs.single-roadmap.duplicate',
      level: 'error',
      message: 'Duplicate strategic roadmap document detected. Keep a single strategic roadmap.',
      path: duplicatePath,
      suggestedDestination: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md'
    });
  }

  for (const relativePath of ACTIVE_DOC_PATHS) {
    const content = readTextIfExists(repoRoot, relativePath);
    if (!content) {
      continue;
    }

    if (IDEA_LEAKAGE_SCAN_PATHS.has(relativePath) && !PLANNING_ALLOWED_PATHS.has(relativePath) && IDEA_LEAKAGE_PATTERN.test(content)) {
      findings.push({
        ruleId: 'docs.idea-leakage.detected',
        level: 'warning',
        message: 'Planning language detected outside approved planning surfaces.',
        path: relativePath,
        suggestedDestination: 'docs/roadmap/IMPROVEMENTS_BACKLOG.md'
      });
    }

    if (/\bnpx\s+playbook\b/i.test(content)) {
      findings.push({
        ruleId: 'docs.active-surface.unscoped-npx',
        level: 'error',
        message: 'Active docs must not use unscoped `npx playbook` examples.',
        path: relativePath,
        suggestedDestination: '@fawxzzy/playbook'
      });
    }

    if (/\bnpm\s+install\s+-g\s+playbook\b/i.test(content) || /@zachariahredfield\/playbook\b/i.test(content) || /\bnpx\s+@zachariahredfield\/playbook\b/i.test(content)) {
      findings.push({
        ruleId: 'docs.active-surface.package-scope',
        level: 'error',
        message: 'Active docs must use the scoped public package `@fawxzzy/playbook`.',
        path: relativePath,
        suggestedDestination: '@fawxzzy/playbook'
      });
    }

    if (LEGACY_DOC_LINK_PATTERN.test(content) && !COMPATIBILITY_STUB_PATHS.has(relativePath)) {
      findings.push({
        ruleId: 'docs.active-surface.legacy-link',
        level: 'error',
        message: 'Active docs must not reference superseded compatibility stub paths.',
        path: relativePath,
        suggestedDestination: 'docs/index.md'
      });
    }

    for (const phrase of LEGACY_POSITIONING_PHRASES) {
      if (!content.includes(phrase)) {
        continue;
      }

      findings.push({
        ruleId: 'docs.active-surface.legacy-positioning',
        level: 'warning',
        message: `Legacy positioning phrase detected: "${phrase}".`,
        path: relativePath
      });
    }

    if (isFrontDoorPath(relativePath)) {
      const requiredLadderMarkers = ['ai-context', 'ai-contract', 'context', 'verify', 'plan', 'apply'];
      const normalizedContent = content.toLowerCase();
      const missingMarkers = requiredLadderMarkers.filter((marker) => !normalizedContent.includes(marker));

      if (hasQuickStartSection(content) && missingMarkers.length > 0) {
        findings.push({
          ruleId: 'docs.front-door.ladder-drift',
          level: 'warning',
          message: `Front-door docs should represent the canonical serious-user ladder; missing ${missingMarkers.join(', ')}.`,
          path: relativePath,
          suggestedDestination: 'README.md'
        });
      }

      if (hasAnalyzeWithoutCompatibilityFraming(content)) {
        findings.push({
          ruleId: 'docs.front-door.ladder-drift',
          level: 'warning',
          message: 'Front-door quick-start sections must frame `analyze` as compatibility/lightweight, not the primary serious-user path.',
          path: relativePath,
          suggestedDestination: 'README.md'
        });
      }
    }
  }

  if (commandTruth) {
    const readme = readTextIfExists(repoRoot, 'README.md');
    const commandsReadme = readTextIfExists(repoRoot, 'docs/commands/README.md');
    const onboarding = readTextIfExists(repoRoot, 'docs/ONBOARDING_DEMO.md');
    const roadmap = readTextIfExists(repoRoot, 'docs/PLAYBOOK_PRODUCT_ROADMAP.md');

    if (readme && !hasAllMarkers(readme, commandTruth.bootstrapLadder)) {
      findings.push({
        ruleId: 'docs.command-truth.bootstrap-ladder',
        level: 'warning',
        message: 'README.md must include the canonical bootstrap ladder commands from command truth metadata.',
        path: 'README.md',
        suggestedDestination: 'docs/contracts/command-truth.json'
      });
    }

    if (onboarding && !hasAllMarkers(onboarding, commandTruth.bootstrapLadder)) {
      findings.push({
        ruleId: 'docs.command-truth.bootstrap-ladder',
        level: 'warning',
        message: 'ONBOARDING_DEMO must include the canonical bootstrap ladder commands from command truth metadata.',
        path: 'docs/ONBOARDING_DEMO.md',
        suggestedDestination: 'docs/contracts/command-truth.json'
      });
    }

    if (commandsReadme && !/lifecycle|role|discoverability/iu.test(commandsReadme)) {
      findings.push({
        ruleId: 'docs.command-truth.classification-missing',
        level: 'warning',
        message: 'docs/commands/README.md should expose lifecycle, role, and discoverability fields from command metadata.',
        path: 'docs/commands/README.md',
        suggestedDestination: 'docs/contracts/command-truth.json'
      });
    }

    if (onboarding && !/supported question classes|unsupported question classes|deterministic fallback/iu.test(onboarding)) {
      findings.push({
        ruleId: 'docs.ask-boundary.contract-missing',
        level: 'warning',
        message: 'ONBOARDING_DEMO should include ask --repo-context supported/unsupported question classes and deterministic fallback guidance.',
        path: 'docs/ONBOARDING_DEMO.md',
        suggestedDestination: 'docs/commands/README.md'
      });
    }

    if (roadmap && !/roadmap entries describe implementation intent.*source of truth for live command availability/isu.test(roadmap)) {
      findings.push({
        ruleId: 'docs.command-truth.roadmap-live-boundary',
        level: 'warning',
        message: 'Roadmap must explicitly separate planned intent from live CLI command availability.',
        path: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md',
        suggestedDestination: 'docs/commands/README.md'
      });
    }
  }

  const planningDocs = ['docs/PLAYBOOK_PRODUCT_ROADMAP.md', 'docs/roadmap/README.md', 'docs/roadmap/IMPROVEMENTS_BACKLOG.md'] as const;
  const headingIndex = new Map<string, string>();
  for (const planningDoc of planningDocs) {
    const content = readTextIfExists(repoRoot, planningDoc);
    if (!content) {
      continue;
    }

    for (const heading of extractHeadings(content)) {
      const normalized = normalizeHeading(heading);
      const existingPath = headingIndex.get(normalized);
      if (!existingPath) {
        headingIndex.set(normalized, planningDoc);
      } else if (existingPath !== planningDoc) {
        findings.push({
          ruleId: 'docs.responsibility-boundary.duplicate-heading',
          level: 'warning',
          message: `Heading "${heading}" is duplicated across planning docs (${existingPath} and ${planningDoc}).`,
          path: planningDoc
        });
      }
    }
  }

  const archiveEntries = listArchiveEntries(repoRoot);
  const archiveNamingPattern = /^docs\/archive\/[A-Z0-9_]+_\d{4}(?:-\d{2})?\.md$/u;
  for (const archiveEntry of archiveEntries) {
    if (!archiveEntry.toLowerCase().endsWith('.md')) {
      continue;
    }

    if (archiveEntry === 'docs/archive/README.md') {
      continue;
    }

    if (!archiveNamingPattern.test(archiveEntry)) {
      findings.push({
        ruleId: 'docs.backlog-hygiene.archive-name',
        level: 'warning',
        message: 'Archive file name should follow BASENAME_<YYYY>.md or BASENAME_<YYYY-MM>.md.',
        path: archiveEntry
      });
    }
  }

  for (const candidatePath of topLevelDocs.filter((relativePath) => CLEANUP_CANDIDATE_PATTERN.test(path.basename(relativePath)))) {
    if (!isActivePath(candidatePath) || HISTORY_PATHS.has(candidatePath) || isPathInPrefixes(candidatePath, HISTORY_PATH_PREFIXES)) {
      continue;
    }

    if (COMPATIBILITY_STUB_PATHS.has(candidatePath)) {
      const stubContent = readTextIfExists(repoRoot, candidatePath);
      if (stubContent && isIntentionalCompatibilityStub(stubContent)) {
        continue;
      }
    }

    let recommendation: DocsAuditFinding['recommendation'];
    if (/^docs\/REPORT_/iu.test(candidatePath)) {
      recommendation = 'historical keep';
    } else if (/UPDATE/iu.test(candidatePath)) {
      recommendation = 'delete after migration';
    } else if (/MERGE|CONSOLIDATION/iu.test(candidatePath)) {
      recommendation = 'archive';
    } else {
      recommendation = 'merge into workflow';
    }

    findings.push({
      ruleId: 'docs.cleanup-dedupe.candidate',
      level: 'warning',
      message: `One-off documentation cleanup/migration tracker detected (${recommendation}).`,
      path: candidatePath,
      recommendation
    });
  }

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;

  return {
    ok: errors === 0,
    status: errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    summary: {
      errors,
      warnings,
      checksRun: 10
    },
    findings
  };
};
