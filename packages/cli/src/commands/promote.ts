import fs from 'node:fs';
import path from 'node:path';
import {
  GLOBAL_PATTERNS_RELATIVE_PATH,
  materializePatternFromCandidate,
  materializeStoryFromSource,
  type PromotionSourceRef
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { emitPromotionReceipt, stageWorkflowArtifact } from '../lib/workflowPromotion.js';

const isPlaybookHomeRoot = (candidateRoot: string): boolean => {
  const packageJsonPath = path.join(candidateRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: unknown };
    return typeof pkg.name === 'string' && pkg.name.toLowerCase().includes('playbook');
  } catch {
    return false;
  }
};

const resolvePlaybookHome = (cwd: string): string => {
  if (process.env.PLAYBOOK_HOME && process.env.PLAYBOOK_HOME.trim()) {
    return path.resolve(cwd, process.env.PLAYBOOK_HOME.trim());
  }
  let current = path.resolve(cwd);
  while (true) {
    if (isPlaybookHomeRoot(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(cwd);
};

const readOption = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : undefined;
};

const print = (format: 'text' | 'json', payload: unknown): void => {
  if (format === 'json') console.log(JSON.stringify(payload, null, 2));
  else console.log(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
};

type PromoteOptions = { format: 'text' | 'json'; quiet: boolean };

type RepoRegistry = {
  repos?: Array<{ id?: string; root?: string }>;
};

const resolveRepoRootById = (playbookHome: string, cwd: string, repoId: string): string => {
  const cwdName = path.basename(cwd);
  if (cwdName === repoId || path.basename(path.resolve(cwd)) === repoId) {
    return cwd;
  }
  const registryPath = path.join(playbookHome, '.playbook', 'observer', 'repos.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error(`playbook promote: repo ${repoId} is not registered in ${path.relative(playbookHome, registryPath)}`);
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as RepoRegistry;
  const match = registry.repos?.find((entry) => entry.id === repoId && typeof entry.root === 'string');
  if (!match?.root) {
    throw new Error(`playbook promote: repo ${repoId} is not registered in .playbook/observer/repos.json`);
  }
  return match.root;
};

export const runPromote = (cwd: string, args: string[], options: PromoteOptions): number => {
  const target = args[0];
  const sourceRef = args[1] as PromotionSourceRef | undefined;
  const playbookHome = resolvePlaybookHome(cwd);

  if ((target !== 'story' && target !== 'pattern') || !sourceRef) {
    print(options.format, {
      schemaVersion: '1.0',
      command: 'promote',
      error: 'Usage: playbook promote <story|pattern> <candidate-ref> [--repo <repo-id>] [--story-id <id>] [--pattern-id <id>] --json (story refs: repo/<repo-id>/story-candidates/<candidate-id> | global/pattern-candidates/<candidate-id> | global/patterns/<pattern-id>)'
    });
    return ExitCode.Failure;
  }

  try {
    if (target === 'story') {
      const parsedRepoId = /^repo\/([^/]+)\//.exec(sourceRef)?.[1];
      const repoId = readOption(args, '--repo') ?? parsedRepoId;
      if (!repoId) {
        throw new Error('playbook promote: story promotion requires --repo <repo-id> or a repo/<repo-id>/... source ref');
      }
      const targetRepoRoot = resolveRepoRootById(playbookHome, cwd, repoId);
      const sourceRepoRoot = parsedRepoId ? resolveRepoRootById(playbookHome, cwd, parsedRepoId) : undefined;
      const prepared = materializeStoryFromSource({
        sourceRef,
        sourceRepoRoot,
        targetRepoId: repoId,
        targetStoryId: readOption(args, '--story-id'),
        targetRepoRoot,
        playbookHome
      });
      const promotion = stageWorkflowArtifact({
        cwd: prepared.targetRoot,
        workflowKind: 'promote-story',
        candidateRelativePath: prepared.stagedRelativePath,
        committedRelativePath: prepared.committedRelativePath,
        artifact: prepared.artifact,
        validate: () => [],
        generatedAt: prepared.record.provenance?.promoted_at,
        successSummary: prepared.outcome === 'noop' ? `Promotion no-op for story ${prepared.targetId}` : `Promoted ${prepared.sourceRef} to story ${prepared.targetId}`,
        blockedSummary: `Story promotion blocked for ${prepared.targetId}`
      });
      const receipt = emitPromotionReceipt({
        cwd: prepared.targetRoot,
        promotionKind: 'story',
        workflowKind: 'promote-story',
        sourceRef: prepared.sourceRef,
        sourceFingerprint: prepared.sourceFingerprint,
        targetArtifactPath: prepared.committedRelativePath,
        targetId: prepared.targetId,
        beforeFingerprint: prepared.beforeFingerprint,
        afterFingerprint: prepared.afterFingerprint,
        outcome: prepared.outcome,
        summary: prepared.outcome === 'conflict' ? `Conflict promoting ${prepared.sourceRef} to story ${prepared.targetId}` : promotion.summary,
        generatedAt: prepared.record.provenance?.promoted_at,
        conflictReason: prepared.conflictReason ?? null
      });
      print(options.format, {
        schemaVersion: '1.0',
        command: 'promote.story',
        source_ref: sourceRef,
        repo_id: repoId,
        story: prepared.record,
        noop: prepared.outcome === 'noop',
        outcome: prepared.outcome,
        promotion,
        receipt
      });
      return prepared.outcome === 'conflict' ? ExitCode.Failure : ExitCode.Success;
    }

    if (!sourceRef.startsWith('global/pattern-candidates/')) {
      throw new Error('playbook promote: pattern promotion only supports global/pattern-candidates/<candidate-id> sources');
    }
    const prepared = materializePatternFromCandidate({
      sourceRef,
      playbookHome,
      targetPatternId: readOption(args, '--pattern-id')
    });
    const promotion = stageWorkflowArtifact({
      cwd: prepared.targetRoot,
      workflowKind: 'promote-pattern',
      candidateRelativePath: prepared.stagedRelativePath,
      committedRelativePath: prepared.committedRelativePath,
      artifact: prepared.artifact,
      validate: () => [],
      generatedAt: prepared.record.provenance.promoted_at,
      successSummary: prepared.outcome === 'noop' ? `Promotion no-op for pattern ${prepared.targetId}` : `Promoted ${prepared.sourceRef} to pattern ${prepared.targetId}`,
      blockedSummary: `Pattern promotion blocked for ${prepared.targetId}`
    });
    const receipt = emitPromotionReceipt({
      cwd: prepared.targetRoot,
      promotionKind: 'pattern',
      workflowKind: 'promote-pattern',
      sourceRef: prepared.sourceRef,
      sourceFingerprint: prepared.sourceFingerprint,
      targetArtifactPath: prepared.committedRelativePath,
      targetId: prepared.targetId,
      beforeFingerprint: prepared.beforeFingerprint,
      afterFingerprint: prepared.afterFingerprint,
      outcome: prepared.outcome,
      summary: prepared.outcome === 'conflict' ? `Conflict promoting ${prepared.sourceRef} to pattern ${prepared.targetId}` : promotion.summary,
      generatedAt: prepared.record.provenance.promoted_at,
      conflictReason: prepared.conflictReason ?? null
    });
    print(options.format, {
      schemaVersion: '1.0',
      command: 'promote.pattern',
      source_ref: sourceRef,
      pattern: prepared.record,
      noop: prepared.outcome === 'noop',
      outcome: prepared.outcome,
      artifact_path: GLOBAL_PATTERNS_RELATIVE_PATH,
      promotion,
      receipt
    });
    return prepared.outcome === 'conflict' ? ExitCode.Failure : ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    print(options.format, { schemaVersion: '1.0', command: 'promote', error: message });
    return ExitCode.Failure;
  }
};
