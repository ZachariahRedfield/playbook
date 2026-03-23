import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldSeedDefaultVersionPolicy, versionPolicyRelativePath, writeVersionPolicy } from './versionPolicy.js';

export type MigrationCheckContext = {
  repoRoot: string;
  fromVersion?: string;
  toVersion: string;
};

export type MigrationApplyContext = MigrationCheckContext & {
  dryRun: boolean;
};

export type ManagedSurfaceCategory = 'managed_by_playbook' | 'repo_local_protected' | 'explicit_migration_required';
export type ManagedSurfaceMutationScope = 'file' | 'managed_block';

export type MigrationCheckResult = {
  needed: boolean;
  reason: string;
  safeToAutoApply?: boolean;
  boundaryCategory?: ManagedSurfaceCategory;
  targetPaths?: string[];
};

export type MigrationApplyResult = {
  changed: boolean;
  filesChanged: string[];
  summary: string;
};

export type Migration = {
  id: string;
  introducedIn: string;
  description: string;
  safeToAutoApply: boolean;
  check: (context: MigrationCheckContext) => Promise<MigrationCheckResult>;
  apply?: (context: MigrationApplyContext) => Promise<MigrationApplyResult>;
};

type ManagedSurfaceEntry = {
  path: string;
  category: ManagedSurfaceCategory;
  mutationScope: ManagedSurfaceMutationScope;
  owner: 'playbook' | 'repository';
  managedMarkers?: string[];
};

type ManagedSurfaceManifest = {
  schemaVersion: '1.0';
  kind: 'playbook-managed-surface-manifest';
  entries: ManagedSurfaceEntry[];
};

type ManagedSurfaceAssessment = {
  category: ManagedSurfaceCategory | 'unclassified';
  mutationScope: ManagedSurfaceMutationScope;
  autoApplyAllowed: boolean;
  reason: string;
};

const cliDocPath = (repoRoot: string): string => path.join(repoRoot, 'docs', 'REFERENCE', 'cli.md');
const releasePrepWorkflowRelativePath = path.join('.github', 'workflows', 'release-prep.yml');
const changelogRelativePath = path.join('docs', 'CHANGELOG.md');
const managedSurfaceManifestRelativePath = path.join('.playbook', 'managed-surfaces.json');
const changelogStartMarker = '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_START -->';
const changelogEndMarker = '<!-- PLAYBOOK:CHANGELOG_RELEASE_NOTES_END -->';

const resolveTemplateRoot = (): string => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, '../../templates/repo'),
    path.resolve(currentDir, '../templates/repo'),
    path.resolve(currentDir, '../../../templates/repo')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw new Error(`Playbook migration templates are missing. Checked: ${candidates.join(', ')}`);
};

const readTemplateFile = (relativePath: string): string => fs.readFileSync(path.join(resolveTemplateRoot(), relativePath), 'utf8');

const readCliDoc = (repoRoot: string): string | undefined => {
  const filePath = cliDocPath(repoRoot);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  return fs.readFileSync(filePath, 'utf8');
};

const writeCliDoc = (repoRoot: string, content: string): void => {
  const filePath = cliDocPath(repoRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const ensureTrailingNewline = (content: string): string => (content.endsWith('\n') ? content : `${content}\n`);
const normalizeRelativePath = (filePath: string): string => filePath.replace(/\\/g, '/');
const releasePrepWorkflowTemplate = readTemplateFile(normalizeRelativePath(releasePrepWorkflowRelativePath));
const changelogTemplate = readTemplateFile(normalizeRelativePath(changelogRelativePath));
const managedSurfaceManifestTemplate = readTemplateFile(normalizeRelativePath(managedSurfaceManifestRelativePath));

const parseManagedSurfaceManifest = (content: string): ManagedSurfaceManifest => {
  const parsed = JSON.parse(content) as ManagedSurfaceManifest;
  if (parsed.kind !== 'playbook-managed-surface-manifest' || !Array.isArray(parsed.entries)) {
    throw new Error('Managed surface manifest is invalid.');
  }
  return parsed;
};

const loadManagedSurfaceManifest = (repoRoot: string): ManagedSurfaceManifest => {
  const manifestPath = path.join(repoRoot, managedSurfaceManifestRelativePath);
  if (fs.existsSync(manifestPath)) {
    return parseManagedSurfaceManifest(fs.readFileSync(manifestPath, 'utf8'));
  }
  return parseManagedSurfaceManifest(managedSurfaceManifestTemplate);
};

const pathMatchesRule = (targetPath: string, rulePath: string): boolean => {
  const normalizedTarget = normalizeRelativePath(targetPath);
  const normalizedRule = normalizeRelativePath(rulePath);
  if (normalizedRule.endsWith('/**')) {
    const prefix = normalizedRule.slice(0, -3);
    return normalizedTarget === prefix || normalizedTarget.startsWith(`${prefix}/`);
  }
  return normalizedTarget === normalizedRule;
};

const assessManagedSurface = (repoRoot: string, targetPath: string): ManagedSurfaceAssessment => {
  const manifest = loadManagedSurfaceManifest(repoRoot);
  const normalizedTarget = normalizeRelativePath(targetPath);
  const entry = manifest.entries.find((candidate) => pathMatchesRule(normalizedTarget, candidate.path));

  if (!entry) {
    return {
      category: 'unclassified',
      mutationScope: 'file',
      autoApplyAllowed: false,
      reason: `${normalizedTarget} is outside the managed surface manifest and requires explicit review.`
    };
  }

  if (entry.category !== 'managed_by_playbook') {
    return {
      category: entry.category,
      mutationScope: entry.mutationScope,
      autoApplyAllowed: false,
      reason: `${normalizedTarget} is categorized as ${entry.category} and is immutable during upgrade apply.`
    };
  }

  if (entry.mutationScope === 'managed_block') {
    const absolutePath = path.join(repoRoot, normalizedTarget);
    if (fs.existsSync(absolutePath)) {
      const content = fs.readFileSync(absolutePath, 'utf8');
      const requiredMarkers = entry.managedMarkers ?? [];
      const hasAllMarkers = requiredMarkers.every((marker) => content.includes(marker));
      if (!hasAllMarkers) {
        return {
          category: 'explicit_migration_required',
          mutationScope: entry.mutationScope,
          autoApplyAllowed: false,
          reason: `${normalizedTarget} is missing the required managed markers and needs explicit migration review before Playbook can edit it.`
        };
      }
    }
  }

  return {
    category: entry.category,
    mutationScope: entry.mutationScope,
    autoApplyAllowed: true,
    reason: `${normalizedTarget} is marked as managed_by_playbook in the managed surface manifest.`
  };
};

const needsReleaseGovernanceScaffolding = (repoRoot: string): boolean => shouldSeedDefaultVersionPolicy(repoRoot);

const ensureFileWithTemplate = (
  repoRoot: string,
  relativePath: string,
  template: string,
  dryRun: boolean
): MigrationApplyResult => {
  const destination = path.join(repoRoot, relativePath);
  if (fs.existsSync(destination)) {
    return { changed: false, filesChanged: [], summary: `No changes needed; ${normalizeRelativePath(relativePath)} already exists.` };
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, template, 'utf8');
  }

  return {
    changed: true,
    filesChanged: [normalizeRelativePath(relativePath)],
    summary: dryRun
      ? `Would seed ${normalizeRelativePath(relativePath)} from the installable release-governance template.`
      : `Seeded ${normalizeRelativePath(relativePath)} from the installable release-governance template.`
  };
};

const hasManagedChangelogBlock = (content: string): boolean => content.includes(changelogStartMarker) && content.includes(changelogEndMarker);

const seedManagedChangelogBlock = (content: string | undefined): string => {
  if (!content || content.trim().length === 0) {
    return changelogTemplate;
  }

  if (hasManagedChangelogBlock(content)) {
    return ensureTrailingNewline(content);
  }

  const normalized = ensureTrailingNewline(content).trimEnd();
  if (normalized.includes('## Unreleased')) {
    const lines = normalized.split('\n');
    const unreleasedIndex = lines.findIndex((line) => line.trim() === '## Unreleased');
    const insertAt = unreleasedIndex + 1;
    const blockLines = ['', changelogStartMarker, '- Release notes are managed by Playbook release-prep.', changelogEndMarker];
    lines.splice(insertAt, 0, ...blockLines);
    return `${lines.join('\n')}\n`;
  }

  return `${normalized}\n\n## Unreleased\n\n${changelogStartMarker}\n- Release notes are managed by Playbook release-prep.\n${changelogEndMarker}\n`;
};

const explainOptionBlock = '- `--explain`: include why findings matter and suggested remediation details in text mode.';
const semanticsBlock =
  '> `playbook analyze` is informational (recommendations only). `playbook verify` enforces governance policy and can fail CI.';

export const migrationRegistry: Migration[] = [
  {
    id: 'contract.managed-surface-manifest.installable',
    introducedIn: '0.1.8',
    description: 'Seed .playbook/managed-surfaces.json so installable repos have an explicit managed-vs-local upgrade contract.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      const manifestPath = path.join(repoRoot, managedSurfaceManifestRelativePath);
      const needed = !fs.existsSync(manifestPath);
      return {
        needed,
        reason: needed
          ? '.playbook/managed-surfaces.json is missing, so upgrade boundaries are not explicitly recorded yet.'
          : '.playbook/managed-surfaces.json already exists.',
        safeToAutoApply: true,
        boundaryCategory: 'managed_by_playbook',
        targetPaths: [normalizeRelativePath(managedSurfaceManifestRelativePath)]
      };
    },
    apply: async ({ repoRoot, dryRun }) => ensureFileWithTemplate(repoRoot, managedSurfaceManifestRelativePath, managedSurfaceManifestTemplate, dryRun)
  },
  {
    id: 'policy.version.lockstep-default',
    introducedIn: '0.1.8',
    description: 'Seed .playbook/version-policy.json for publishable pnpm/node repositories so release governance is installable by default.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      if (!shouldSeedDefaultVersionPolicy(repoRoot)) {
        return { needed: false, reason: 'Repository is not an eligible publishable pnpm/node repo for default version policy seeding.' };
      }

      const assessment = assessManagedSurface(repoRoot, versionPolicyRelativePath);
      const policyPath = path.join(repoRoot, versionPolicyRelativePath);
      const needed = !fs.existsSync(policyPath);
      return {
        needed,
        reason: needed
          ? '.playbook/version-policy.json is missing for an eligible publishable pnpm/node repository.'
          : '.playbook/version-policy.json already exists.',
        safeToAutoApply: assessment.autoApplyAllowed,
        boundaryCategory: assessment.category === 'unclassified' ? undefined : assessment.category,
        targetPaths: [normalizeRelativePath(versionPolicyRelativePath)]
      };
    },
    apply: async ({ repoRoot, dryRun }) => {
      const policyPath = path.join(repoRoot, versionPolicyRelativePath);
      if (fs.existsSync(policyPath)) {
        return {
          changed: false,
          filesChanged: [],
          summary: 'No changes needed; .playbook/version-policy.json already exists.'
        };
      }

      if (dryRun) {
        return {
          changed: true,
          filesChanged: [versionPolicyRelativePath.replace(/\\/g, '/')],
          summary: 'Would seed .playbook/version-policy.json with the default lockstep version group.'
        };
      }

      writeVersionPolicy(repoRoot);
      return {
        changed: true,
        filesChanged: [versionPolicyRelativePath.replace(/\\/g, '/')],
        summary: 'Seeded .playbook/version-policy.json with the default lockstep version group.'
      };
    }
  },
  {
    id: 'workflow.release-prep.installable',
    introducedIn: '0.1.8',
    description: 'Seed the trusted/manual release-prep workflow for eligible publishable pnpm/node repositories.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      if (!needsReleaseGovernanceScaffolding(repoRoot)) {
        return { needed: false, reason: 'Repository is not an eligible publishable pnpm/node repo for release-prep workflow seeding.' };
      }

      const assessment = assessManagedSurface(repoRoot, releasePrepWorkflowRelativePath);
      const workflowPath = path.join(repoRoot, releasePrepWorkflowRelativePath);
      const needed = !fs.existsSync(workflowPath);
      return {
        needed,
        reason: needed
          ? `${assessment.reason} Missing .github/workflows/release-prep.yml for an eligible publishable pnpm/node repository.`
          : '.github/workflows/release-prep.yml already exists.',
        safeToAutoApply: assessment.autoApplyAllowed,
        boundaryCategory: assessment.category === 'unclassified' ? undefined : assessment.category,
        targetPaths: [normalizeRelativePath(releasePrepWorkflowRelativePath)]
      };
    },
    apply: async ({ repoRoot, dryRun }) => ensureFileWithTemplate(repoRoot, releasePrepWorkflowRelativePath, releasePrepWorkflowTemplate, dryRun)
  },
  {
    id: 'docs.changelog.release-notes-seam',
    introducedIn: '0.1.8',
    description: 'Ensure docs/CHANGELOG.md exposes the managed PLAYBOOK:CHANGELOG_RELEASE_NOTES block for reviewed release notes.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      if (!needsReleaseGovernanceScaffolding(repoRoot)) {
        return { needed: false, reason: 'Repository is not an eligible publishable pnpm/node repo for changelog release seam seeding.' };
      }

      const assessment = assessManagedSurface(repoRoot, changelogRelativePath);
      const changelogPath = path.join(repoRoot, changelogRelativePath);
      const content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : undefined;
      const needed = !content || !hasManagedChangelogBlock(content);
      return {
        needed,
        reason: needed
          ? `${assessment.reason} ${content ? 'docs/CHANGELOG.md is missing the managed PLAYBOOK:CHANGELOG_RELEASE_NOTES block.' : 'docs/CHANGELOG.md is missing.'}`
          : 'docs/CHANGELOG.md already includes the managed PLAYBOOK:CHANGELOG_RELEASE_NOTES block.',
        safeToAutoApply: assessment.autoApplyAllowed,
        boundaryCategory: assessment.category === 'unclassified' ? undefined : assessment.category,
        targetPaths: [normalizeRelativePath(changelogRelativePath)]
      };
    },
    apply: async ({ repoRoot, dryRun }) => {
      const changelogPath = path.join(repoRoot, changelogRelativePath);
      const current = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : undefined;
      const next = seedManagedChangelogBlock(current);
      if (current === next) {
        return {
          changed: false,
          filesChanged: [],
          summary: 'No changes needed; docs/CHANGELOG.md already includes the managed release notes block.'
        };
      }

      if (!dryRun) {
        fs.mkdirSync(path.dirname(changelogPath), { recursive: true });
        fs.writeFileSync(changelogPath, next, 'utf8');
      }

      return {
        changed: true,
        filesChanged: [normalizeRelativePath(changelogRelativePath)],
        summary: dryRun
          ? 'Would seed the managed PLAYBOOK:CHANGELOG_RELEASE_NOTES block in docs/CHANGELOG.md.'
          : 'Seeded the managed PLAYBOOK:CHANGELOG_RELEASE_NOTES block in docs/CHANGELOG.md.'
      };
    }
  },
  {
    id: 'docs.cli.explain-option',
    introducedIn: '0.1.2',
    description: 'Ensure CLI reference documents the `--explain` global flag.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      const content = readCliDoc(repoRoot);
      if (!content) {
        return { needed: true, reason: 'docs/REFERENCE/cli.md is missing.' };
      }
      const needed = !content.includes('--explain');
      return {
        needed,
        reason: needed
          ? 'CLI reference does not mention the `--explain` global option.'
          : 'CLI reference includes the `--explain` global option.'
      };
    },
    apply: async ({ repoRoot, dryRun }) => {
      const original = readCliDoc(repoRoot) ?? '# CLI Reference\n\n## Global options (all top-level commands)\n';
      const alreadyPresent = original.includes('--explain');
      if (alreadyPresent) {
        return {
          changed: false,
          filesChanged: [],
          summary: 'No changes needed; `--explain` already documented.'
        };
      }

      let updated = original;
      if (updated.includes('## Global options (all top-level commands)')) {
        const lines = updated.split('\n');
        const insertAt = lines.findIndex((line) => line.startsWith('## ') && line !== '## Global options (all top-level commands)');
        const targetIndex = insertAt === -1 ? lines.length : insertAt;
        lines.splice(targetIndex, 0, explainOptionBlock, '');
        updated = lines.join('\n');
      } else {
        updated = `${ensureTrailingNewline(updated)}\n## Global options (all top-level commands)\n\n${explainOptionBlock}\n`;
      }

      if (!dryRun) {
        writeCliDoc(repoRoot, ensureTrailingNewline(updated));
      }

      return {
        changed: true,
        filesChanged: ['docs/REFERENCE/cli.md'],
        summary: dryRun ? 'Would add `--explain` to CLI reference global options.' : 'Added `--explain` to CLI reference global options.'
      };
    }
  },
  {
    id: 'docs.cli.analyze-verify-semantics',
    introducedIn: '0.1.2',
    description: 'Ensure docs clarify analyze informational semantics versus verify policy enforcement.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      const content = readCliDoc(repoRoot);
      if (!content) {
        return { needed: true, reason: 'docs/REFERENCE/cli.md is missing.' };
      }

      const hasAnalyze = content.includes('Analyze repository stack signals and output recommendations.');
      const hasVerify = content.includes('Run deterministic governance checks.');
      const hasSemantics = content.includes('informational') && content.includes('enforces governance policy');
      const needed = !(hasAnalyze && hasVerify && hasSemantics);

      return {
        needed,
        reason: needed
          ? 'CLI reference does not clearly explain analyze (informational) vs verify (enforcement) semantics.'
          : 'CLI reference explains analyze vs verify semantics.'
      };
    },
    apply: async ({ repoRoot, dryRun }) => {
      const original = readCliDoc(repoRoot) ?? '# CLI Reference\n';
      const hasSemantics = original.includes('informational') && original.includes('enforces governance policy');
      if (hasSemantics) {
        return {
          changed: false,
          filesChanged: [],
          summary: 'No changes needed; analyze vs verify semantics already documented.'
        };
      }

      const updated = `${ensureTrailingNewline(original)}\n${semanticsBlock}\n`;
      if (!dryRun) {
        writeCliDoc(repoRoot, ensureTrailingNewline(updated));
      }

      return {
        changed: true,
        filesChanged: ['docs/REFERENCE/cli.md'],
        summary: dryRun
          ? 'Would add analyze vs verify semantics note to CLI reference.'
          : 'Added analyze vs verify semantics note to CLI reference.'
      };
    }
  }
];
