import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PLAYBOOK_HOME_ENV = 'PLAYBOOK_HOME' as const;
export const DEFAULT_PLAYBOOK_HOME_DIRNAME = '.playbook' as const;

export const resolvePlaybookHomePath = (playbookHome?: string): string => {
  const configured = playbookHome?.trim() ?? process.env[PLAYBOOK_HOME_ENV]?.trim();
  return configured && configured.length > 0
    ? path.resolve(configured)
    : path.join(os.homedir(), DEFAULT_PLAYBOOK_HOME_DIRNAME);
};

export const patternKnowledgeScopes = [
  'repo_local_memory',
  'global_reusable_pattern_memory',
  'cross_repo_proposal_bridge'
] as const;

export type PatternKnowledgeScope = (typeof patternKnowledgeScopes)[number];

type PatternKnowledgeStoreSpec = {
  scope: PatternKnowledgeScope;
  root: 'repo' | 'playbook_home';
  canonicalRelativePath: string;
  compatibilityRelativePaths: string[];
  description: string;
};

const patternKnowledgeStoreSpecs: Record<PatternKnowledgeScope, PatternKnowledgeStoreSpec> = {
  repo_local_memory: {
    scope: 'repo_local_memory',
    root: 'repo',
    canonicalRelativePath: '.playbook/memory/knowledge/patterns.json',
    compatibilityRelativePaths: [],
    description: 'Repo-local promoted memory knowledge for reusable patterns.'
  },
  global_reusable_pattern_memory: {
    scope: 'global_reusable_pattern_memory',
    root: 'playbook_home',
    canonicalRelativePath: '.playbook/patterns.json',
    compatibilityRelativePaths: ['patterns.json'],
    description: 'Global promoted reusable pattern memory shared through PLAYBOOK_HOME.'
  },
  cross_repo_proposal_bridge: {
    scope: 'cross_repo_proposal_bridge',
    root: 'repo',
    canonicalRelativePath: '.playbook/pattern-proposals.json',
    compatibilityRelativePaths: [],
    description: 'Cross-repo proposal bridge artifact for explicit governed promotion.'
  }
};

export type ResolvedPatternKnowledgeStore = PatternKnowledgeStoreSpec & {
  rootPath: string;
  absolutePath: string;
  compatibilityAbsolutePaths: string[];
  resolvedFrom: 'canonical' | 'compatibility' | 'default';
  resolvedPath: string;
  pathMetadata: {
    env: typeof PLAYBOOK_HOME_ENV;
    defaultPlaybookHomeDirname: typeof DEFAULT_PLAYBOOK_HOME_DIRNAME;
  };
};

const resolveRootPath = (scope: PatternKnowledgeScope, options?: { projectRoot?: string; playbookHome?: string }): string => {
  const spec = patternKnowledgeStoreSpecs[scope];
  if (spec.root === 'playbook_home') {
    return resolvePlaybookHomePath(options?.playbookHome);
  }
  return options?.projectRoot ?? process.cwd();
};

export const resolvePatternKnowledgeStore = (
  scope: PatternKnowledgeScope,
  options?: { projectRoot?: string; playbookHome?: string }
): ResolvedPatternKnowledgeStore => {
  const spec = patternKnowledgeStoreSpecs[scope];
  const rootPath = resolveRootPath(scope, options);
  const absolutePath = path.join(rootPath, spec.canonicalRelativePath);
  const compatibilityAbsolutePaths = spec.compatibilityRelativePaths.map((relativePath) => path.join(rootPath, relativePath));
  const existingCompatibilityPath = compatibilityAbsolutePaths.find((candidate) => fs.existsSync(candidate));
  const resolvedPath = fs.existsSync(absolutePath) ? absolutePath : existingCompatibilityPath ?? absolutePath;
  return {
    ...spec,
    rootPath,
    absolutePath,
    compatibilityAbsolutePaths,
    resolvedFrom: fs.existsSync(absolutePath) ? 'canonical' : existingCompatibilityPath ? 'compatibility' : 'default',
    resolvedPath,
    pathMetadata: {
      env: PLAYBOOK_HOME_ENV,
      defaultPlaybookHomeDirname: DEFAULT_PLAYBOOK_HOME_DIRNAME
    }
  };
};

export const readPatternKnowledgeStoreArtifact = <T>(
  scope: PatternKnowledgeScope,
  fallback: T,
  options?: { projectRoot?: string; playbookHome?: string }
): { artifact: T; store: ResolvedPatternKnowledgeStore } => {
  const store = resolvePatternKnowledgeStore(scope, options);
  if (!fs.existsSync(store.resolvedPath)) {
    return { artifact: fallback, store };
  }
  return {
    artifact: JSON.parse(fs.readFileSync(store.resolvedPath, 'utf8')) as T,
    store
  };
};
