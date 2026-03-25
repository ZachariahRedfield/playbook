import fs from 'node:fs';
import path from 'node:path';

type CommandTruthCommand = {
  name: string;
  lifecycle?: string;
  role?: string;
  discoverability?: string;
  productFacing?: boolean;
};

type CommandTruth = {
  canonicalCommands: string[];
  compatibilityCommands: string[];
  utilityCommands: string[];
  bootstrapLadder: string[];
  remediationLoop: string[];
  commandTruth?: CommandTruthCommand[];
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


const REPO_ROADMAP_REQUIRED_SECTIONS = ['pillars', 'active stories'] as const;
const STORY_REQUIRED_SECTIONS = ['status', 'pillar', 'outcome', 'scope', 'non-goals', 'surfaces', 'dependencies', 'done when', 'evidence'] as const;

const POSTMORTEM_REQUIRED_SECTIONS = [
  'facts',
  'interpretation',
  'model changes',
  'promotion candidates',
  'non-promotion notes'
] as const;
const REVISION_LAYER_REQUIRED_SECTIONS = ['fact', 'interpretation', 'narrative'] as const;
const REVISION_LAYER_GOVERNED_DOC_PATHS = ['docs/PLAYBOOK_PRODUCT_ROADMAP.md', 'docs/PLAYBOOK_DEV_WORKFLOW.md'] as const;
const ARCHITECTURE_DECISION_REQUIRED_SECTIONS = [
  'constraints',
  'cost surfaces',
  'chosen shape',
  'why this fits',
  'tradeoffs / failure modes',
  'review triggers'
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

const PATTERN_STORAGE_CONTRACT_DOCS = [
  'docs/commands/README.md',
  'docs/commands/patterns.md',
  'docs/commands/promote.md',
  'docs/commands/knowledge.md',
  'docs/PLAYBOOK_PRODUCT_ROADMAP.md'
] as const;

const GLOBAL_PATTERN_MEMORY_REPO_LOCAL_PHRASE =
  /global reusable pattern memory[\s\S]{0,200}\.playbook\/memory\/knowledge\/patterns\.json/iu;

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



const hasRequiredSections = (content: string, requiredSections: readonly string[]): string[] => {
  const headings = new Set(extractHeadings(content).map((heading) => normalizeHeading(heading)));
  return requiredSections.filter((section) => !headings.has(section));
};

const listStoryDocs = (repoRoot: string): string[] => {
  const storiesPath = path.join(repoRoot, 'docs', 'stories');
  if (!fs.existsSync(storiesPath)) {
    return [];
  }

  return fs
    .readdirSync(storiesPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => `docs/stories/${entry.name}`)
    .sort();
};

const extractManagedCommandStatusNames = (content: string): string[] => {
  const startMarker = '<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->';
  const endMarker = '<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->';
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return [];
  }

  const section = content.slice(startIndex + startMarker.length, endIndex);
  const names: string[] = [];
  for (const line of section.split(/\r?\n/u)) {
    const match = /^\|\s*`([^`]+)`\s*\|/u.exec(line.trim());
    if (match) {
      names.push(match[1]);
    }
  }

  return names;
};

const unique = (values: string[]): string[] => [...new Set(values)];

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
  const duplicateRoadmapCandidates = new Set(['docs/PRODUCT_ROADMAP.md', 'docs/PLAYBOOK_ROADMAP.md']);
  for (const duplicatePath of topLevelDocs.filter((relativePath) => duplicateRoadmapCandidates.has(relativePath))) {
    findings.push({
      ruleId: 'docs.single-roadmap.duplicate',
      level: 'error',
      message: 'Duplicate strategic roadmap document detected. Keep a single strategic roadmap.',
      path: duplicatePath,
      suggestedDestination: 'docs/PLAYBOOK_PRODUCT_ROADMAP.md'
    });
  }

  const repoRoadmapPath = 'docs/ROADMAP.md';
  const repoRoadmap = readTextIfExists(repoRoot, repoRoadmapPath);
  const storyDocs = listStoryDocs(repoRoot);

  if (repoRoadmap) {
    const missingSections = hasRequiredSections(repoRoadmap, REPO_ROADMAP_REQUIRED_SECTIONS);
    if (missingSections.length > 0) {
      findings.push({
        ruleId: 'docs.repo-roadmap.contract-missing-sections',
        level: 'error',
        message: `Repo roadmap is missing required sections: ${missingSections.join(', ')}.`,
        path: repoRoadmapPath
      });
    }

    if (!fs.existsSync(path.join(repoRoot, 'docs', 'stories'))) {
      findings.push({
        ruleId: 'docs.repo-roadmap.stories-dir-missing',
        level: 'error',
        message: 'Repo roadmap contract requires docs/stories/ for repo-scoped story documents.',
        path: 'docs/stories'
      });
    }
  }

  if (storyDocs.length > 0 && !repoRoadmap) {
    findings.push({
      ruleId: 'docs.repo-roadmap.roadmap-missing',
      level: 'error',
      message: 'Story documents require a companion docs/ROADMAP.md repo roadmap.',
      path: repoRoadmapPath
    });
  }

  for (const storyDoc of storyDocs) {
    const content = readTextIfExists(repoRoot, storyDoc);
    if (!content) {
      continue;
    }

    const missingSections = hasRequiredSections(content, STORY_REQUIRED_SECTIONS);
    if (missingSections.length > 0) {
      findings.push({
        ruleId: 'docs.story-contract.missing-sections',
        level: 'error',
        message: `Story document is missing required sections: ${missingSections.join(', ')}.`,
        path: storyDoc
      });
    }
  }


  const postmortemDocsPath = path.join(repoRoot, 'docs', 'postmortems');
  if (fs.existsSync(postmortemDocsPath)) {
    const postmortemDocs = fs
      .readdirSync(postmortemDocsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => `docs/postmortems/${entry.name}`)
      .sort();

    for (const postmortemDoc of postmortemDocs) {
      const content = readTextIfExists(repoRoot, postmortemDoc);
      if (!content) {
        continue;
      }

      const missingSections = hasRequiredSections(content, POSTMORTEM_REQUIRED_SECTIONS);
      if (missingSections.length > 0) {
        findings.push({
          ruleId: 'docs.postmortem.required-sections',
          level: 'error',
          message: `Postmortem document is missing required sections: ${missingSections.join(', ')}.`,
          path: postmortemDoc,
          suggestedDestination: 'templates/repo/docs/postmortems/PLAYBOOK_POSTMORTEM_TEMPLATE.md'
        });
      }
    }
  }

  const revisionLayerGovernedDocs = new Set<string>(REVISION_LAYER_GOVERNED_DOC_PATHS as readonly string[]);
  if (fs.existsSync(postmortemDocsPath)) {
    const postmortemDocs = fs
      .readdirSync(postmortemDocsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => `docs/postmortems/${entry.name}`);

    for (const postmortemDoc of postmortemDocs) {
      revisionLayerGovernedDocs.add(postmortemDoc);
    }
  }

  const architectureDecisionDocsPath = path.join(repoRoot, 'docs', 'architecture', 'decisions');
  if (fs.existsSync(architectureDecisionDocsPath)) {
    const architectureDecisionDocs = fs
      .readdirSync(architectureDecisionDocsPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => `docs/architecture/decisions/${entry.name}`)
      .sort();

    for (const architectureDecisionDoc of architectureDecisionDocs) {
      const content = readTextIfExists(repoRoot, architectureDecisionDoc);
      if (!content) {
        continue;
      }

      const missingSections = hasRequiredSections(content, ARCHITECTURE_DECISION_REQUIRED_SECTIONS);
      if (missingSections.length > 0) {
        findings.push({
          ruleId: 'docs.architecture-rubric.required-sections',
          level: 'error',
          message: `Architecture decision doc is missing required sections: ${missingSections.join(', ')}.`,
          path: architectureDecisionDoc,
          suggestedDestination: 'templates/repo/docs/architecture/PLAYBOOK_ARCHITECTURE_DECISION_TEMPLATE.md'
        });
      }
    }
  }

  for (const governedDocPath of [...revisionLayerGovernedDocs].sort()) {
    const content = readTextIfExists(repoRoot, governedDocPath);
    if (!content) {
      continue;
    }

    const missingSections = hasRequiredSections(content, REVISION_LAYER_REQUIRED_SECTIONS);
    if (missingSections.length > 0) {
      findings.push({
        ruleId: 'docs.revision-layer.required-sections',
        level: 'error',
        message: `Governed document is missing required revision-layer sections: ${missingSections.join(', ')}.`,
        path: governedDocPath,
        suggestedDestination: 'docs/architecture/PLAYBOOK_DOCUMENTATION_REVISION_PROTOCOL.md'
      });
    }
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

    if (Array.isArray(commandTruth.commandTruth)) {
      const truthNames = commandTruth.commandTruth.map((command) => command.name);
      const duplicateTruthNames = unique(truthNames.filter((name, index) => truthNames.indexOf(name) !== index));
      for (const duplicateName of duplicateTruthNames) {
        findings.push({
          ruleId: 'docs.command-truth.duplicate-command',
          level: 'error',
          message: `Command truth metadata contains duplicate command entry: "${duplicateName}".`,
          path: 'docs/contracts/command-truth.json',
          suggestedDestination: 'packages/cli/src/lib/commandMetadata.ts'
        });
      }

      if (commandsReadme) {
        const docsStatusNames = extractManagedCommandStatusNames(commandsReadme);
        const truthProductNames = commandTruth.commandTruth.filter((command) => command.productFacing).map((command) => command.name);
        const docsMissing = unique(truthProductNames.filter((name) => !docsStatusNames.includes(name)));
        const docsUnexpected = unique(docsStatusNames.filter((name) => !truthProductNames.includes(name)));

        if (docsMissing.length > 0 || docsUnexpected.length > 0) {
          findings.push({
            ruleId: 'docs.command-truth.status-table-drift',
            level: 'error',
            message: `docs/commands/README.md managed command status block drift detected (missing: ${docsMissing.join(', ') || 'none'}; unexpected: ${docsUnexpected.join(', ') || 'none'}).`,
            path: 'docs/commands/README.md',
            suggestedDestination: 'pnpm docs:update'
          });
        }
      }
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

  for (const relativePath of PATTERN_STORAGE_CONTRACT_DOCS) {
    const content = readTextIfExists(repoRoot, relativePath);
    if (!content) {
      continue;
    }

    if (GLOBAL_PATTERN_MEMORY_REPO_LOCAL_PHRASE.test(content)) {
      findings.push({
        ruleId: 'docs.pattern-storage.scope-path-drift',
        level: 'error',
        message:
          'Global reusable pattern memory must resolve via the scope-first Playbook-home contract (`.playbook/patterns.json` under `PLAYBOOK_HOME`), not the repo-local memory path.',
        path: relativePath,
        suggestedDestination: 'docs/commands/patterns.md'
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
      checksRun: 15
    },
    findings
  };
};
