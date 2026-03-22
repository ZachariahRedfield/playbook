import fs from 'node:fs/promises';
import path from 'node:path';
import { applySafePlaybookIgnoreRecommendations, getDefaultPlaybookIgnoreSuggestions } from '../indexer/playbookIgnore.js';
import { createHash } from 'node:crypto';
import type { DocsWritePreconditions, FixHandler } from './types.js';

const PLAYBOOK_NOTES_STARTER = `# Playbook Notes

## YYYY-MM-DD

- WHAT changed:
- WHY it changed:
`;


type ReleasePackageVersionProvenance = {
  package_name: string;
  package_path: string;
  current_version: string;
  next_version: string;
  version_group?: string | null;
  linked_workspace_versions?: Array<{ name: string; currentVersion: string; nextVersion: string }>;
};

const readReleasePackageVersionProvenance = (task: { provenance?: Record<string, unknown>; file: string | null }): ReleasePackageVersionProvenance => {
  if (!task.provenance) {
    throw new Error('Release package version task must include provenance. Rebuild the reviewed release-plan artifact before apply.');
  }

  const packageName = task.provenance.package_name;
  const packagePath = task.provenance.package_path;
  const currentVersion = task.provenance.current_version;
  const nextVersion = task.provenance.next_version;
  const linkedWorkspaceVersions = task.provenance.linked_workspace_versions;

  if (typeof packageName !== 'string' || typeof packagePath !== 'string' || typeof currentVersion !== 'string' || typeof nextVersion !== 'string') {
    throw new Error('Release package version task provenance must include package_name, package_path, current_version, and next_version strings.');
  }

  if (!Array.isArray(linkedWorkspaceVersions) || linkedWorkspaceVersions.some((entry) => !entry || typeof entry !== 'object' || typeof (entry as { name?: unknown }).name !== 'string' || typeof (entry as { currentVersion?: unknown }).currentVersion !== 'string' || typeof (entry as { nextVersion?: unknown }).nextVersion !== 'string')) {
    throw new Error('Release package version task provenance must include linked_workspace_versions objects with name/currentVersion/nextVersion strings.');
  }

  return {
    package_name: packageName,
    package_path: packagePath,
    current_version: currentVersion,
    next_version: nextVersion,
    version_group: typeof task.provenance.version_group === 'string' ? task.provenance.version_group : null,
    linked_workspace_versions: linkedWorkspaceVersions as Array<{ name: string; currentVersion: string; nextVersion: string }>
  };
};

const rewriteLinkedWorkspaceVersion = (spec: string, currentVersion: string, nextVersion: string): string | null => {
  if (spec === currentVersion) {
    return nextVersion;
  }

  for (const prefix of ['workspace:', '', '^', '~', 'workspace:^', 'workspace:~'] as const) {
    if (`${prefix}${currentVersion}` === spec) {
      return `${prefix}${nextVersion}`;
    }
  }

  return null;
};

const fixReleasePackageJsonVersion: FixHandler = async ({ repoRoot, dryRun, task }) => {
  if (!task.file) {
    throw new Error('Release package version task must target a package.json file.');
  }

  const provenance = readReleasePackageVersionProvenance(task);
  const targetPath = path.join(repoRoot, task.file);
  const raw = await fs.readFile(targetPath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (parsed.name !== provenance.package_name) {
    throw new Error(`Release package version task target drift: expected package ${provenance.package_name} but found ${String(parsed.name ?? 'unknown')}.`);
  }

  if (parsed.version !== provenance.current_version) {
    throw new Error(`Release package version task target drift: expected version ${provenance.current_version} for ${provenance.package_name} but found ${String(parsed.version ?? 'unknown')}.`);
  }

  parsed.version = provenance.next_version;
  const linkedVersions = new Map(provenance.linked_workspace_versions?.map((entry) => [entry.name, entry] as const) ?? []);

  const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
  for (const field of dependencyFields) {
    const section = parsed[field];
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      continue;
    }

    for (const [dependencyName, dependencySpec] of Object.entries(section)) {
      if (typeof dependencySpec !== 'string') {
        continue;
      }

      const linkedVersion = linkedVersions.get(dependencyName);
      if (!linkedVersion) {
        continue;
      }

      const rewritten = rewriteLinkedWorkspaceVersion(dependencySpec, linkedVersion.currentVersion, linkedVersion.nextVersion);
      if (rewritten) {
        (section as Record<string, unknown>)[dependencyName] = rewritten;
      }
    }
  }

  const next = `${JSON.stringify(parsed, null, 2)}
`;
  if (next === raw) {
    return {
      status: 'skipped',
      message: `${task.file} already matched release version ${provenance.next_version}.`
    };
  }

  if (!dryRun) {
    await fs.writeFile(targetPath, next, 'utf8');
  }

  return {
    status: 'applied',
    filesChanged: [task.file],
    summary: `Updated ${provenance.package_name} package.json to ${provenance.next_version} with bounded linked workspace version rewrites.`
  };
};

const notesPath = (repoRoot: string): string => path.join(repoRoot, 'docs', 'PLAYBOOK_NOTES.md');

const upsertLineEntries = async (filePath: string, entries: string[], dryRun: boolean): Promise<boolean> => {
  let current = '';
  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch {
    current = '';
  }

  const existing = new Set(current.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0));
  const missing = entries.filter((entry) => !existing.has(entry));

  if (missing.length === 0) {
    return false;
  }

  if (!dryRun) {
    const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
    const payload = `${current}${separator}${missing.join('\n')}\n`;
    await fs.writeFile(filePath, payload, 'utf8');
  }

  return true;
};

const fixNotesMissing: FixHandler = async ({ repoRoot, dryRun }) => {
  const targetPath = notesPath(repoRoot);

  if (!dryRun) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, PLAYBOOK_NOTES_STARTER, 'utf8');
  }

  return {
    status: 'applied',
    filesChanged: ['docs/PLAYBOOK_NOTES.md'],
    summary: 'Created docs/PLAYBOOK_NOTES.md with a minimal starter template.'
  };
};

const fixNotesEmpty: FixHandler = async ({ repoRoot, dryRun }) => {
  const targetPath = notesPath(repoRoot);

  if (!dryRun) {
    await fs.writeFile(targetPath, PLAYBOOK_NOTES_STARTER, 'utf8');
  }

  return {
    status: 'applied',
    filesChanged: ['docs/PLAYBOOK_NOTES.md'],
    summary: 'Wrote a minimal starter template to docs/PLAYBOOK_NOTES.md.'
  };
};

const fixPb012PlaybookIgnore: FixHandler = async ({ repoRoot, dryRun }) => {
  if (dryRun) {
    return {
      status: 'applied',
      filesChanged: ['.playbookignore'],
      summary: 'Would apply safe-default ranked ignore recommendations to .playbookignore.'
    };
  }

  try {
    const result = applySafePlaybookIgnoreRecommendations(repoRoot);

    return {
      status: result.changed ? 'applied' : 'skipped',
      filesChanged: result.changed ? ['.playbookignore'] : [],
      summary: result.changed
        ? 'Applied safe-default ranked ignore recommendations to .playbookignore.'
        : '.playbookignore already matched safe-default ranked ignore recommendations.'
    };
  } catch {
    const targetPath = path.join(repoRoot, '.playbookignore');
    const fallbackEntries = getDefaultPlaybookIgnoreSuggestions().filter((entry) =>
      ['.git', '.next/cache', 'node_modules', 'playwright-report'].includes(entry)
    );
    const changed = await upsertLineEntries(targetPath, fallbackEntries, false);

    return {
      status: changed ? 'applied' : 'skipped',
      filesChanged: changed ? ['.playbookignore'] : [],
      summary: changed
        ? 'Applied fallback safe-default .playbookignore entries because ranked recommendations were unavailable.'
        : '.playbookignore already contained fallback safe-default entries.'
    };
  }
};

const fixPb013GitIgnore: FixHandler = async ({ repoRoot, dryRun }) => {
  const entries = ['.playbook/repo-index.json', '.playbook/plan.json', '.playbook/verify.json'];
  const targetPath = path.join(repoRoot, '.gitignore');
  const changed = await upsertLineEntries(targetPath, entries, dryRun);

  return {
    status: changed ? 'applied' : 'skipped',
    filesChanged: changed ? ['.gitignore'] : [],
    summary: changed ? 'Updated .gitignore with runtime artifact entries.' : '.gitignore already contained runtime artifact entries.'
  };
};



const fingerprint = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const collectAnchorContext = (targetText: string, anchor: string): string | null => {
  const anchorIndex = targetText.indexOf(anchor);
  if (anchorIndex < 0) return null;
  const lineStart = targetText.lastIndexOf('\n', anchorIndex);
  const nextLineBreak = targetText.indexOf('\n', anchorIndex + anchor.length);
  const lineEnd = nextLineBreak >= 0 ? nextLineBreak : targetText.length;
  return targetText.slice(lineStart >= 0 ? lineStart + 1 : 0, lineEnd);
};

const readDocsWritePreconditions = (task: { file: string | null; write?: { operation: 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor'; blockId: string; startMarker: string; endMarker: string; anchor?: string; content: string }; preconditions?: DocsWritePreconditions }): DocsWritePreconditions => {
  if (!task.preconditions) {
    throw new Error('Docs consolidation task must include reviewed preconditions. Rebuild the docs-consolidation-plan artifact before apply.');
  }

  return task.preconditions;
};

const validateDocsWritePreconditions = (task: { file: string | null; write?: { operation: 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor'; blockId: string; startMarker: string; endMarker: string; anchor?: string; content: string }; preconditions?: DocsWritePreconditions }, current: string): void => {
  const preconditions = readDocsWritePreconditions(task);
  const details: Record<string, unknown> = {
    reason: 'target-drift-detected',
    target_path: task.file,
    planned_operation: preconditions.planned_operation,
    approved_fragment_ids: preconditions.approved_fragment_ids,
    expected: preconditions
  };

  if (task.file !== preconditions.target_path) {
    details.current = { target_path: task.file };
    throw new Error(`Docs consolidation conflict: ${JSON.stringify(details)}`);
  }

  const currentFileFingerprint = fingerprint(current);
  if (currentFileFingerprint !== preconditions.target_file_fingerprint) {
    details.current = { target_file_fingerprint: currentFileFingerprint };
    throw new Error(`Docs consolidation conflict: ${JSON.stringify(details)}`);
  }

  if (!task.write) {
    details.current = { write: null };
    throw new Error(`Docs consolidation conflict: ${JSON.stringify(details)}`);
  }

  const { startMarker, endMarker, anchor } = task.write;
  const startIndex = current.indexOf(startMarker);
  const endIndex = startIndex >= 0 ? current.indexOf(endMarker, startIndex + startMarker.length) : -1;
  const managedBlockText = startIndex >= 0 && endIndex >= startIndex
    ? current.slice(startIndex, endIndex + endMarker.length)
    : '__PLAYBOOK_MANAGED_BLOCK_ABSENT__';
  const currentManagedBlockFingerprint = fingerprint(managedBlockText);

  if (preconditions.managed_block_fingerprint && currentManagedBlockFingerprint !== preconditions.managed_block_fingerprint) {
    details.current = { managed_block_fingerprint: currentManagedBlockFingerprint };
    throw new Error(`Docs consolidation conflict: ${JSON.stringify(details)}`);
  }

  if (preconditions.anchor_context_hash) {
    const anchorContext = collectAnchorContext(current, anchor ?? '');
    const currentAnchorContextHash = fingerprint(anchorContext ?? '__PLAYBOOK_ANCHOR_MISSING__');
    if (currentAnchorContextHash !== preconditions.anchor_context_hash) {
      details.current = { anchor_context_hash: currentAnchorContextHash };
      throw new Error(`Docs consolidation conflict: ${JSON.stringify(details)}`);
    }
  }
};

const rewriteManagedDocBlock = async (
  repoRoot: string,
  task: { file: string | null; write?: { operation: 'replace-managed-block' | 'append-managed-block' | 'insert-under-anchor'; blockId: string; startMarker: string; endMarker: string; anchor?: string; content: string }; preconditions?: DocsWritePreconditions },
  dryRun: boolean
): Promise<{ changed: boolean; summary: string }> => {
  if (!task.file || !task.write) {
    throw new Error('Docs consolidation task must include target file and write instructions.');
  }

  const targetPath = path.join(repoRoot, task.file);
  let current = '';
  try {
    current = await fs.readFile(targetPath, 'utf8');
  } catch {
    throw new Error(`Docs consolidation target not found: ${task.file}`);
  }

  validateDocsWritePreconditions(task, current);

  const { operation, startMarker, endMarker, anchor, content, blockId } = task.write;
  const startIndex = current.indexOf(startMarker);
  const endIndex = current.indexOf(endMarker);
  let next = current;

  if (operation === 'replace-managed-block') {
    if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
      throw new Error(`Managed block ${blockId} not found in ${task.file}.`);
    }
    const before = current.slice(0, startIndex);
    const after = current.slice(endIndex + endMarker.length);
    next = `${before}${content}${after}`;
  } else if (operation === 'append-managed-block') {
    if (startIndex >= 0 || endIndex >= 0) {
      throw new Error(`Managed block ${blockId} already exists in ${task.file}; append-managed-block refuses to mutate it.`);
    }
    const separator = current.endsWith('\n') || current.length === 0 ? '' : '\n';
    next = `${current}${separator}${content}\n`;
  } else {
    if (!anchor) {
      throw new Error(`Insert-under-anchor task ${blockId} is missing anchor text.`);
    }
    if (startIndex >= 0 || endIndex >= 0) {
      throw new Error(`Managed block ${blockId} already exists in ${task.file}; insert-under-anchor will not duplicate it.`);
    }
    const anchorIndex = current.indexOf(anchor);
    if (anchorIndex < 0) {
      throw new Error(`Anchor not found for managed block ${blockId} in ${task.file}.`);
    }
    const insertAt = anchorIndex + anchor.length;
    const needsLeadingNewline = current.slice(insertAt, insertAt + 1) !== '\n';
    next = `${current.slice(0, insertAt)}${needsLeadingNewline ? '\n' : ''}\n${content}\n${current.slice(insertAt)}`;
  }

  if (next === current) {
    return { changed: false, summary: `Managed block ${blockId} in ${task.file} already matched the planned content.` };
  }

  if (!dryRun) {
    await fs.writeFile(targetPath, next, 'utf8');
  }

  return { changed: true, summary: `Updated protected docs managed block ${blockId} in ${task.file} via ${operation}.` };
};

const fixDocsConsolidationManagedWrite: FixHandler = async ({ repoRoot, dryRun, task }) => {
  const result = await rewriteManagedDocBlock(repoRoot, task, dryRun);
  return {
    status: result.changed ? 'applied' : 'skipped',
    ...(result.changed ? { filesChanged: [task.file!] , summary: result.summary } : { message: result.summary })
  };
};

const fixPb014MoveArtifacts: FixHandler = async ({ repoRoot, dryRun }) => {
  const candidates = ['repo-index.json', 'plan.json', 'verify.json'];
  const changes: string[] = [];

  for (const file of candidates) {
    const source = path.join(repoRoot, file);
    const destination = path.join(repoRoot, '.playbook', file);
    try {
      await fs.access(source);
    } catch {
      continue;
    }

    try {
      await fs.access(destination);
      continue;
    } catch {
      // destination missing: move candidate
    }

    if (!dryRun) {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
    }

    changes.push(file);
  }

  return {
    status: changes.length > 0 ? 'applied' : 'skipped',
    filesChanged: changes.map((entry) => entry),
    summary: changes.length > 0 ? `Moved runtime artifacts into .playbook/: ${changes.join(', ')}` : 'No movable runtime artifacts found at repository root.'
  };
};

export const defaultFixHandlers: Record<string, FixHandler> = {
  'notes.missing': fixNotesMissing,
  'notes.empty': fixNotesEmpty,
  PB012: fixPb012PlaybookIgnore,
  PB013: fixPb013GitIgnore,
  PB014: fixPb014MoveArtifacts,
  'docs-consolidation.managed-write': fixDocsConsolidationManagedWrite,
  'release.package-json.version': fixReleasePackageJsonVersion
};
