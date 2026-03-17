import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { emitJsonOutput, writeJsonArtifactAbsolute } from '../../lib/jsonArtifact.js';
import {
  buildRepoAdoptionReadiness,
  computeCrossRepoPatternLearning,
  readCrossRepoPatternsArtifact,
  type CrossRepoPatternsArtifact,
  type RepoAdoptionReadiness
} from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../../lib/cliContract.js';

type ObserverOptions = {
  format: 'text' | 'json';
  quiet: boolean;
};

type ObserverRepoEntry = {
  id: string;
  name: string;
  root: string;
  status: 'connected';
  artifactsRoot: string;
  tags: string[];
};

type ObserverRepoReadinessState = 'connected_only' | 'playbook_detected' | 'partially_observable' | 'observable';

type ObserverRepoReadiness = {
  connected: true;
  playbook_detected: boolean;
  playbook_directory_present: boolean;
  repo_index_present: boolean;
  cycle_state_present: boolean;
  cycle_history_present: boolean;
  policy_evaluation_present: boolean;
  policy_apply_result_present: boolean;
  pr_review_present: boolean;
  session_present: boolean;
  last_artifact_update_time: string | null;
  readiness_state: ObserverRepoReadinessState;
  missing_artifacts: string[];
  lifecycle_stage: RepoAdoptionReadiness['lifecycle_stage'];
  fallback_proof_ready: boolean;
  cross_repo_eligible: boolean;
  blockers: RepoAdoptionReadiness['blockers'];
  recommended_next_steps: string[];
};

type ObserverRepoRegistry = {
  schemaVersion: '1.0';
  kind: 'repo-registry';
  repos: ObserverRepoEntry[];
};

type ObserverRepoCreateInput = {
  path: string;
  id?: string;
  tags?: string[];
};

const OBSERVER_REPO_REGISTRY_RELATIVE_PATH = '.playbook/observer/repos.json' as const;
const OBSERVER_SNAPSHOT_RELATIVE_PATH = '.playbook/observer/snapshot.json' as const;

const OBSERVER_ARTIFACTS = [
  { kind: 'cycle-state', relativePath: '.playbook/cycle-state.json' },
  { kind: 'cycle-history', relativePath: '.playbook/cycle-history.json' },
  { kind: 'policy-evaluation', relativePath: '.playbook/policy-evaluation.json' },
  { kind: 'policy-apply-result', relativePath: '.playbook/policy-apply-result.json' },
  { kind: 'pr-review', relativePath: '.playbook/pr-review.json' },
  { kind: 'session', relativePath: '.playbook/session.json' },
  { kind: 'system-map', relativePath: '.playbook/system-map.json' }
] as const;

const READINESS_ARTIFACTS = [
  { key: 'repo_index_present', relativePath: '.playbook/repo-index.json' },
  { key: 'cycle_state_present', relativePath: '.playbook/cycle-state.json' },
  { key: 'cycle_history_present', relativePath: '.playbook/cycle-history.json' },
  { key: 'policy_evaluation_present', relativePath: '.playbook/policy-evaluation.json' },
  { key: 'policy_apply_result_present', relativePath: '.playbook/policy-apply-result.json' },
  { key: 'pr_review_present', relativePath: '.playbook/pr-review.json' },
  { key: 'session_present', relativePath: '.playbook/session.json' }
] as const;

type ObserverArtifactKind = (typeof OBSERVER_ARTIFACTS)[number]['kind'];

const printObserverHelp = (): void => {
  console.log(`Usage: playbook observer <repo|serve> [options]

Manage a deterministic local observer repo registry and read-only local API.

Subcommands:
  repo add <path> [--id <id>] [--tag <tag>] [--root <path>]
  repo list [--root <path>]
  repo remove <id> [--root <path>]
  serve [--host <host>] [--port <port>] [--root <path>]

Options:
  --root <path>                Override observer home root used for registry persistence
  --json                       Print machine-readable JSON output
  --help                       Show help`);
};

const readOptionValue = (args: string[], optionName: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1] ?? null;
  }

  const prefixed = args.find((arg) => arg.startsWith(`${optionName}=`));
  if (!prefixed) {
    return null;
  }

  return prefixed.slice(optionName.length + 1) || null;
};

const readOptionValues = (args: string[], optionName: string): string[] => {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== optionName) {
      continue;
    }

    const value = args[index + 1];
    if (value && !value.startsWith('-')) {
      values.push(value);
    }
  }

  return values;
};

const stableRepoId = (repoRoot: string, repoName: string): string => {
  const digest = crypto.createHash('sha256').update(repoRoot, 'utf8').digest('hex').slice(0, 12);
  return `${repoName}-${digest}`;
};

const normalizeRegistry = (registry: ObserverRepoRegistry): ObserverRepoRegistry => ({
  schemaVersion: '1.0',
  kind: 'repo-registry',
  repos: [...registry.repos].sort((left, right) => left.id.localeCompare(right.id))
});

const defaultRegistry = (): ObserverRepoRegistry => ({
  schemaVersion: '1.0',
  kind: 'repo-registry',
  repos: []
});

const isPlaybookHomeRoot = (candidateRoot: string): boolean => {
  const packageJsonPath = path.join(candidateRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: unknown };
    return typeof pkg.name === 'string' && pkg.name.toLowerCase().includes('playbook');
  } catch {
    return false;
  }
};

export const resolveObserverHomeRoot = (explicitRoot: string | undefined, cwd: string): string => {
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return path.resolve(cwd, explicitRoot.trim());
  }

  let current = path.resolve(cwd);
  while (true) {
    if (isPlaybookHomeRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.resolve(cwd);
};

const registryPath = (observerRoot: string): string => path.join(observerRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);

const readRegistry = (observerRoot: string): ObserverRepoRegistry => {
  const artifactPath = registryPath(observerRoot);
  if (!fs.existsSync(artifactPath)) {
    return defaultRegistry();
  }

  const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as Partial<ObserverRepoRegistry>;
  if (parsed.schemaVersion !== '1.0' || parsed.kind !== 'repo-registry' || !Array.isArray(parsed.repos)) {
    throw new Error(`playbook observer: invalid registry artifact at ${OBSERVER_REPO_REGISTRY_RELATIVE_PATH}`);
  }

  return normalizeRegistry({
    schemaVersion: '1.0',
    kind: 'repo-registry',
    repos: parsed.repos
      .map((entry: any) => ({
        id: String(entry.id ?? ''),
        name: String(entry.name ?? ''),
        root: String(entry.root ?? ''),
        status: 'connected' as const,
        artifactsRoot: String(entry.artifactsRoot ?? ''),
        tags: Array.isArray(entry.tags) ? entry.tags.map((tag: unknown) => String(tag)).sort((left: string, right: string) => left.localeCompare(right)) : []
      }))
      .filter((entry: any) => entry.id.length > 0)
  });
};

const writeRegistry = (observerRoot: string, registry: ObserverRepoRegistry): void => {
  writeJsonArtifactAbsolute(registryPath(observerRoot), normalizeRegistry(registry) as unknown as Record<string, unknown>, 'observer', { envelope: false });
};

const emitObserverPayload = (cwd: string, options: ObserverOptions, payload: Record<string, unknown>, textMessage: string): void => {
  if (options.format === 'json') {
    emitJsonOutput({ cwd, command: 'observer', payload });
    return;
  }

  if (!options.quiet) {
    console.log(textMessage);
  }
};

const nonFlagPositionals = (args: string[]): string[] => {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith('-')) {
      if (value === '--id' || value === '--tag' || value === '--root' || value === '--host' || value === '--port') {
        index += 1;
      }
      continue;
    }

    values.push(value);
  }

  return values;
};

const readJsonFile = (targetPath: string): unknown => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as unknown;

const loadSnapshotArtifact = (observerRoot: string): Record<string, unknown> | null => {
  const snapshotPath = path.join(observerRoot, OBSERVER_SNAPSHOT_RELATIVE_PATH);
  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  const value = readJsonFile(snapshotPath);
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== '1.0' || candidate.kind !== 'observer-snapshot') {
    return null;
  }

  return candidate;
};

const findArtifactSpec = (kind: string): (typeof OBSERVER_ARTIFACTS)[number] | null =>
  OBSERVER_ARTIFACTS.find((artifact) => artifact.kind === kind) ?? null;

const readRepoArtifact = (repo: ObserverRepoEntry, kind: ObserverArtifactKind): { kind: ObserverArtifactKind; value: unknown | null } => {
  const spec = findArtifactSpec(kind);
  if (!spec) {
    return { kind, value: null };
  }

  const artifactPath = path.join(repo.root, spec.relativePath);
  if (!fs.existsSync(artifactPath)) {
    return { kind, value: null };
  }

  try {
    return { kind, value: readJsonFile(artifactPath) };
  } catch {
    return { kind, value: null };
  }
};

const repoReadiness = (repo: ObserverRepoEntry): ObserverRepoReadiness => {
  const playbookDirectoryPresent = fs.existsSync(repo.artifactsRoot) && fs.statSync(repo.artifactsRoot).isDirectory();
  const adoption = buildRepoAdoptionReadiness({ repoRoot: repo.root, connected: true });

  const flags = Object.fromEntries(
    READINESS_ARTIFACTS.map((artifact) => [artifact.key, fs.existsSync(path.join(repo.root, artifact.relativePath))])
  ) as Record<(typeof READINESS_ARTIFACTS)[number]['key'], boolean>;

  const presentArtifactPaths = READINESS_ARTIFACTS.filter((artifact) => flags[artifact.key]).map((artifact) => path.join(repo.root, artifact.relativePath));
  const lastArtifactUpdateTime =
    presentArtifactPaths.length === 0
      ? null
      : new Date(
          Math.max(
            ...presentArtifactPaths.map((artifactPath) => {
              try {
                return fs.statSync(artifactPath).mtimeMs;
              } catch {
                return 0;
              }
            })
          )
        ).toISOString();

  const observableFlags = READINESS_ARTIFACTS.every((artifact) => flags[artifact.key]);
  const anyArtifactsPresent = READINESS_ARTIFACTS.some((artifact) => flags[artifact.key]);
  const readinessState: ObserverRepoReadinessState = !adoption.playbook_detected
    ? 'connected_only'
    : observableFlags
      ? 'observable'
      : anyArtifactsPresent
        ? 'partially_observable'
        : 'playbook_detected';

  return {
    connected: true,
    playbook_detected: adoption.playbook_detected,
    playbook_directory_present: playbookDirectoryPresent,
    repo_index_present: flags.repo_index_present,
    cycle_state_present: flags.cycle_state_present,
    cycle_history_present: flags.cycle_history_present,
    policy_evaluation_present: flags.policy_evaluation_present,
    policy_apply_result_present: flags.policy_apply_result_present,
    pr_review_present: flags.pr_review_present,
    session_present: flags.session_present,
    last_artifact_update_time: lastArtifactUpdateTime,
    readiness_state: readinessState,
    missing_artifacts: READINESS_ARTIFACTS.filter((artifact) => !flags[artifact.key]).map((artifact) => artifact.relativePath),
    lifecycle_stage: adoption.lifecycle_stage,
    fallback_proof_ready: adoption.fallback_proof_ready,
    cross_repo_eligible: adoption.cross_repo_eligible,
    blockers: adoption.blockers,
    recommended_next_steps: adoption.recommended_next_steps
  };
};

const findHomeRepoId = (registry: ObserverRepoRegistry, cwd: string): string | null => {
  const cwdRoot = path.resolve(cwd);
  const fromExactRoot = registry.repos.find((repo) => path.resolve(repo.root) === cwdRoot);
  if (fromExactRoot) {
    return fromExactRoot.id;
  }

  const fromTags = registry.repos.find((repo) => repo.tags.some((tag) => tag === 'self' || tag === 'home'));
  if (fromTags) {
    return fromTags.id;
  }

  const fromName = registry.repos.find((repo) => repo.name.toLowerCase() === 'playbook' || repo.id.toLowerCase() === 'playbook');
  return fromName?.id ?? null;
};

const addRepoToRegistry = (observerRoot: string, registry: ObserverRepoRegistry, input: ObserverRepoCreateInput): { repo: ObserverRepoEntry; registry: ObserverRepoRegistry } => {
  const root = path.resolve(observerRoot, input.path);
  const rootStat = fs.existsSync(root) ? fs.statSync(root) : null;
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`playbook observer repo add: repository root does not exist: ${root}`);
  }

  const artifactsRoot = path.join(root, '.playbook');
  if (fs.existsSync(artifactsRoot)) {
    const artifactsStat = fs.statSync(artifactsRoot);
    if (!artifactsStat.isDirectory()) {
      throw new Error(`playbook observer repo add: expected directory at ${artifactsRoot}`);
    }
  }

  const repoName = path.basename(root);
  const requestedId = input.id;
  const repoId = requestedId && requestedId.trim().length > 0 ? requestedId.trim() : stableRepoId(root, repoName);
  const duplicateId = registry.repos.find((repo) => repo.id === repoId);
  if (duplicateId) {
    throw new Error(`playbook observer repo add: duplicate id "${repoId}"`);
  }

  const duplicateRoot = registry.repos.find((repo) => repo.root === root);
  if (duplicateRoot) {
    throw new Error(`playbook observer repo add: duplicate root "${root}" already registered as "${duplicateRoot.id}"`);
  }

  const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0))].sort((left, right) => left.localeCompare(right));
  const entry: ObserverRepoEntry = {
    id: repoId,
    name: repoName,
    root,
    status: 'connected',
    artifactsRoot,
    tags
  };

  const nextRegistry = normalizeRegistry({ ...registry, repos: [...registry.repos, entry] });
  writeRegistry(observerRoot, nextRegistry);
  return { repo: entry, registry: nextRegistry };
};

const removeRepoFromRegistry = (observerRoot: string, registry: ObserverRepoRegistry, removeId: string): ObserverRepoRegistry => {
  const existing = registry.repos.find((repo) => repo.id === removeId);
  if (!existing) {
    throw new Error(`playbook observer repo remove: unknown id "${removeId}"`);
  }

  const nextRegistry = normalizeRegistry({ ...registry, repos: registry.repos.filter((repo) => repo.id !== removeId) });
  writeRegistry(observerRoot, nextRegistry);
  return nextRegistry;
};

const buildSnapshotFromRegistry = (registry: ObserverRepoRegistry): Record<string, unknown> => ({
  schemaVersion: '1.0',
  kind: 'observer-snapshot',
  repos: registry.repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    status: repo.status,
    artifacts: OBSERVER_ARTIFACTS.map((artifact) => readRepoArtifact(repo, artifact.kind))
  }))
});


const buildCrossRepoArtifact = (observerRoot: string, registry: ObserverRepoRegistry): CrossRepoPatternsArtifact => {
  try {
    return readCrossRepoPatternsArtifact(observerRoot);
  } catch {
    const repos = registry.repos.map((repo) => ({ id: repo.id, repoPath: repo.root }));
    return computeCrossRepoPatternLearning(repos);
  }
};

const writeJsonResponse = (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>): void => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const readRequestBody = async (request: http.IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const observerDashboardHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Playbook Observer UI</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
      body { margin: 0; background: #0b1020; color: #dbe5ff; }
      header { padding: 12px 18px; border-bottom: 1px solid #243252; }
      main { display: grid; grid-template-columns: 300px 1fr; min-height: calc(100vh - 52px); }
      aside, section { padding: 12px; border-right: 1px solid #243252; }
      section { border-right: none; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 10px; align-content: start; }
      h1, h2, h3 { margin: 0 0 8px; font-weight: 600; }
      .card { background: #111935; border: 1px solid #243252; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
      .repo { cursor: pointer; }
      .repo.selected { border-color: #a5c4ff; }
      button { cursor: pointer; border-radius: 6px; border: 1px solid #35519c; background: #1d3270; color: #e7eeff; padding: 5px 8px; }
      input, select { width: 100%; box-sizing: border-box; margin: 4px 0 8px; padding: 5px; background: #111935; color: #e7eeff; border: 1px solid #243252; border-radius: 6px; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0a1129; border: 1px solid #243252; padding: 10px; border-radius: 6px; max-height: 340px; overflow: auto; }
      .row { display: flex; gap: 8px; align-items: center; }
      .meta { color: #95addf; font-size: 12px; }
      .blueprint { width: 100%; height: 420px; background: #0a1129; border: 1px solid #243252; border-radius: 6px; }
      .layer-band { fill: #0f1734; stroke: #243252; stroke-width: 1; }
      .edge-line { stroke: #4a639f; stroke-width: 1.2; marker-end: url(#arrowhead); }
      .edge-line.active { stroke: #87afff; stroke-width: 2; }
      .node-label, .layer-label { fill: #dbe5ff; font-size: 12px; }
      .node-box { stroke-width: 1.4; rx: 6; }
      .node-state-active { fill: #173964; stroke: #4cb6ff; }
      .node-state-available { fill: #1e325e; stroke: #7ba6ff; }
      .node-state-idle { fill: #202f4d; stroke: #7f8fb0; }
      .node-state-missing { fill: #3a1f2f; stroke: #cf6a8e; }
      .node-state-stale { fill: #3b321f; stroke: #d8a052; }
      .node-box.selected { stroke: #ffffff; stroke-width: 2.3; }
      .badge { display: inline-flex; border-radius: 999px; padding: 2px 8px; border: 1px solid #35519c; font-size: 11px; margin-right: 6px; }
      .layout-main { min-width: 0; }
      .layout-side { min-width: 0; }
      .mode-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
      .mode-tab.active { border-color: #a5c4ff; background: #29458e; }
      .hidden { display: none; }
      .empty-state { padding: 10px; border: 1px dashed #35519c; border-radius: 6px; color: #95addf; font-size: 12px; }
      .cross-repo-list { display: grid; gap: 8px; }
      .cross-repo-item { border: 1px solid #243252; border-radius: 6px; padding: 8px; background: #0a1129; }
      details summary { cursor: pointer; font-weight: 600; }
      .state-legend { margin-top: 6px; }
      .state-legend .badge { margin-bottom: 4px; }
      @media (max-width: 1200px) {
        section { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header class="row"><h1>Observer Dashboard</h1><button id="refresh">Refresh</button><span id="health" class="meta"></span></header>
    <main>
      <aside>
        <div class="card"><h2>Connected Repos</h2><div id="repos"></div></div>
        <div class="card"><h3>Add Repo</h3><input id="repoPath" placeholder="/path/to/repo" /><input id="repoId" placeholder="optional-id" /><input id="repoTags" placeholder="tags comma-separated" /><button id="addRepo">Connect</button></div>
        <details id="selfPanel" class="card">
          <summary>Playbook Self-Observation</summary>
          <div id="observerRegistryMeta" class="meta">Observer root metadata pending.</div>
          <div id="selfSummary" class="meta">Waiting for observer data.</div>
        </details>
      </aside>
      <section>
        <div class="layout-main">
          <div class="mode-tabs" role="tablist" aria-label="Observer modes">
            <button id="repoModeBtn" class="mode-tab active" role="tab" aria-selected="true">Repo View</button>
            <button id="crossRepoModeBtn" class="mode-tab" role="tab" aria-selected="false">Cross-Repo View</button>
          </div>
          <div id="repoViewPanel">
          <div class="card"><h2 id="repoTitle">Repo Detail</h2><div id="repoDetail" class="meta">Select a repo.</div><button id="removeRepo" style="display:none">Remove repo</button></div>
          <div class="card"><h3>System Blueprint</h3><div id="blueprintMeta" class="meta">Select a repo.</div><svg id="blueprintPanel" class="blueprint" viewBox="0 0 980 420" aria-label="System Blueprint"></svg></div>
          <div class="card"><h3>Artifact Detail Viewer</h3><select id="artifactKind"></select><div id="artifactPanel"></div></div>
          </div>
          <div id="crossRepoViewPanel" class="hidden">
          <div class="card"><h3>Cross-Repo Intelligence</h3>
            <div class="row"><label class="meta">Left repo</label><select id="compareLeft"></select></div>
            <div class="row"><label class="meta">Right repo</label><select id="compareRight"></select></div>
            <div class="row"><button id="compareBtn">Compare pair</button><button id="compareAllBtn">All connected repos</button></div>
            <div id="crossRepoPanel" class="meta">Choose repos to compare governed artifacts.</div>
          </div>
          </div>
        </div>
        <div class="layout-side">
          <div class="card"><h3>Selected Blueprint Node</h3><div id="selectedNodeDetail" class="meta">Click a node to inspect layer, state, and artifact linkage.</div></div>
        </div>
      </section>
    </main>
    <script src="/ui/app.js"></script>
  </body>
</html>`;

const OBSERVER_DASHBOARD_APP_SOURCE_PATH = new URL('./dashboard-app.js', import.meta.url);

const observerDashboardScriptHasTypeScriptLeakage = (source: string): boolean => {
  const typeAnnotationLeakage = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$][\w$<>,\s\[\]\|&]*\s*(?:=|;)/m;
  const anyAnnotationLeakage = /\b:\s*any\b/m;
  const typeAssertionLeakage = /\bas\s+(?:const|any|unknown|never|[A-Z][\w$]*(?:<[^>]+>)?)\b/m;
  const genericArrowLeakage = /=\s*<[A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*>\s*\(/m;
  return typeAnnotationLeakage.test(source) || anyAnnotationLeakage.test(source) || typeAssertionLeakage.test(source) || genericArrowLeakage.test(source);
};

const observerDashboardJs = (): string => {
  const source = fs.readFileSync(OBSERVER_DASHBOARD_APP_SOURCE_PATH, 'utf8');
  if (observerDashboardScriptHasTypeScriptLeakage(source)) {
    throw new Error('playbook observer: dashboard app.js contains TypeScript-only syntax; browser bootstrap refused');
  }
  return source;
};

const observerServerResponse = (observerRoot: string, invocationCwd: string, pathname: string, searchParams: URLSearchParams): { statusCode: number; payload: Record<string, unknown> } => {
  const registry = readRegistry(observerRoot);
  const homeRepoId = findHomeRepoId(registry, invocationCwd);
  const base = {
    schemaVersion: '1.0',
    readOnly: true,
    localOnly: true,
    cwd: invocationCwd,
    observer_root: observerRoot,
    registry_path: registryPath(observerRoot),
    repo_count: registry.repos.length
  };

  if (pathname === '/health') {
    return {
      statusCode: 200,
      payload: { ...base, kind: 'observer-server-health', status: 'ok' }
    };
  }

  if (pathname === '/repos') {
    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: 'observer-server-repos',
        home_repo_id: homeRepoId,
        repos: registry.repos.map((repo) => ({ ...repo, readiness: repoReadiness(repo) }))
      }
    };
  }

  if (pathname === '/api/cross-repo/summary') {
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    return { statusCode: 200, payload: { ...base, kind: 'observer-cross-repo-summary', summary: { source_repos: artifact.source_repos, candidate_count: artifact.candidate_patterns.length, comparison_count: artifact.comparisons.length } } };
  }

  if (pathname === '/api/cross-repo/candidates') {
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    return { statusCode: 200, payload: { ...base, kind: 'observer-cross-repo-candidates', candidates: artifact.candidate_patterns } };
  }

  if (pathname === '/api/cross-repo/compare' || pathname === '/api/cross-repo/repo-delta') {
    const left = searchParams.get('left');
    const right = searchParams.get('right');
    if (!left || !right) {
      return { statusCode: 400, payload: { ...base, kind: 'observer-server-error', error: 'missing-left-right' } };
    }
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    const comparison = artifact.comparisons.find((entry: any) =>
      (entry.left_repo_id === left && entry.right_repo_id === right) || (entry.left_repo_id === right && entry.right_repo_id === left)
    );
    if (!comparison) {
      return { statusCode: 404, payload: { ...base, kind: 'observer-server-error', error: 'comparison-not-found' } };
    }
    return { statusCode: 200, payload: { ...base, kind: pathname.endsWith('repo-delta') ? 'observer-cross-repo-repo-delta' : 'observer-cross-repo-compare', comparison, repo_delta: comparison.repo_deltas } };
  }

  const patternMatch = /^\/api\/cross-repo\/patterns\/([^/]+)$/.exec(pathname);
  if (patternMatch) {
    const patternId = decodeURIComponent(patternMatch[1] ?? '');
    const artifact = buildCrossRepoArtifact(observerRoot, registry);
    const pattern = artifact.candidate_patterns.find((entry: any) => entry.id === patternId);
    if (!pattern) {
      return { statusCode: 404, payload: { ...base, kind: 'observer-server-error', error: 'pattern-not-found' } };
    }
    return { statusCode: 200, payload: { ...base, kind: 'observer-cross-repo-pattern', pattern } };
  }

  if (pathname === '/snapshot') {
    return {
      statusCode: 200,
      payload: {
        ...base,
        home_repo_id: homeRepoId,
        snapshot: loadSnapshotArtifact(observerRoot) ?? buildSnapshotFromRegistry(registry),
        readiness: registry.repos.map((repo) => ({ id: repo.id, readiness: repoReadiness(repo) }))
      }
    };
  }

  const repoMatch = /^\/repos\/([^/]+)$/.exec(pathname);
  if (repoMatch) {
    const repo = registry.repos.find((entry: any) => entry.id === decodeURIComponent(repoMatch[1] ?? ''));
    if (!repo) {
      return { statusCode: 404, payload: { ...base, kind: 'observer-server-error', error: 'repo-not-found' } };
    }
    return { statusCode: 200, payload: { ...base, kind: 'observer-server-repo', repo, readiness: repoReadiness(repo) } };
  }

  const artifactMatch = /^\/repos\/([^/]+)\/artifacts\/([^/]+)$/.exec(pathname);
  if (artifactMatch) {
    const repo = registry.repos.find((entry: any) => entry.id === decodeURIComponent(artifactMatch[1] ?? ''));
    if (!repo) {
      return { statusCode: 404, payload: { ...base, kind: 'observer-server-error', error: 'repo-not-found' } };
    }

    const artifactKind = decodeURIComponent(artifactMatch[2] ?? '');
    const spec = findArtifactSpec(artifactKind);
    if (!spec) {
      return { statusCode: 404, payload: { ...base, kind: 'observer-server-error', error: 'artifact-kind-not-found' } };
    }

    return {
      statusCode: 200,
      payload: {
        ...base,
        kind: 'observer-server-artifact',
        repoId: repo.id,
        artifact: readRepoArtifact(repo, spec.kind)
      }
    };
  }

  return { statusCode: 404, payload: { ...base, kind: 'observer-server-error', error: 'not-found' } };
};

export const createObserverServer = (observerRoot: string, invocationCwd = observerRoot): http.Server =>
  http.createServer(async (request, response) => {
    const parsedUrl = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && (parsedUrl.pathname === '/' || parsedUrl.pathname === '/ui')) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(observerDashboardHtml());
      return;
    }

    if (request.method === 'GET' && parsedUrl.pathname === '/ui/app.js') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/javascript; charset=utf-8');
      response.end(observerDashboardJs());
      return;
    }

    if (request.method === 'POST' && parsedUrl.pathname === '/repos') {
      try {
        const body = await readRequestBody(request);
        const payload = JSON.parse(body) as Partial<ObserverRepoCreateInput>;
        if (!payload.path || payload.path.trim().length === 0) {
          writeJsonResponse(response, 400, { schemaVersion: '1.0', kind: 'observer-server-error', error: 'missing-path', localOnly: true });
          return;
        }

        const result = addRepoToRegistry(observerRoot, readRegistry(observerRoot), { path: payload.path, id: payload.id, tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag)) : [] });
        writeJsonResponse(response, 200, { schemaVersion: '1.0', kind: 'observer-server-repo-add', readOnly: false, localOnly: true, repo: result.repo, registry: result.registry });
      } catch (error) {
        writeJsonResponse(response, 400, { schemaVersion: '1.0', kind: 'observer-server-error', error: error instanceof Error ? error.message : String(error), localOnly: true });
      }
      return;
    }

    const deleteRepoMatch = /^\/repos\/([^/]+)$/.exec(parsedUrl.pathname);
    if (request.method === 'DELETE' && deleteRepoMatch) {
      try {
        const removedId = decodeURIComponent(deleteRepoMatch[1] ?? '');
        const registry = removeRepoFromRegistry(observerRoot, readRegistry(observerRoot), removedId);
        writeJsonResponse(response, 200, { schemaVersion: '1.0', kind: 'observer-server-repo-remove', readOnly: false, localOnly: true, removedId, registry });
      } catch (error) {
        writeJsonResponse(response, 404, { schemaVersion: '1.0', kind: 'observer-server-error', error: error instanceof Error ? error.message : String(error), localOnly: true });
      }
      return;
    }

    if (request.method !== 'GET') {
      writeJsonResponse(response, 405, { schemaVersion: '1.0', kind: 'observer-server-error', error: 'method-not-allowed', readOnly: true, localOnly: true });
      return;
    }

    const result = observerServerResponse(observerRoot, invocationCwd, parsedUrl.pathname, parsedUrl.searchParams);
    writeJsonResponse(response, result.statusCode, result.payload);
  });

export const runObserver = async (cwd: string, args: string[], options: ObserverOptions): Promise<number> => {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printObserverHelp();
    return args.length === 0 ? ExitCode.Failure : ExitCode.Success;
  }

  const [scope, action] = args;
  const observerRoot = resolveObserverHomeRoot(readOptionValue(args, '--root') ?? undefined, cwd);
  const resolvedRegistryPath = registryPath(observerRoot);

  if (scope === 'serve') {
    const requestedHost = readOptionValue(args, '--host')?.trim();
    const host = requestedHost && requestedHost.length > 0 ? requestedHost : '127.0.0.1';
    const requestedPort = readOptionValue(args, '--port');
    const parsedPort = requestedPort ? Number.parseInt(requestedPort, 10) : 4300;
    const port = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : Number.NaN;
    if (Number.isNaN(port)) {
      const message = 'playbook observer serve: --port must be an integer between 0 and 65535';
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer', error: message } });
      } else {
        console.error(message);
      }
      return ExitCode.Failure;
    }

    if (host !== '127.0.0.1' && host !== 'localhost') {
      const message = 'playbook observer serve: only local hosts are supported in v1 (127.0.0.1 or localhost).';
      if (options.format === 'json') {
        emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer', error: message } });
      } else {
        console.error(message);
      }
      return ExitCode.Failure;
    }

    const server = createObserverServer(observerRoot, cwd);

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        resolve();
      });
    });

    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : port;
    const repoCount = readRegistry(observerRoot).repos.length;
    const message = [
      `Observer server listening at http://${host}:${boundPort}`,
      `Observer home root: ${observerRoot}`,
      `Registry path: ${resolvedRegistryPath}`,
      `Loaded repos: ${repoCount}`
    ].join('\n');
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer-serve', host, port: boundPort, readOnly: true, localOnly: true, observer_root: observerRoot, registry_path: resolvedRegistryPath, repo_count: repoCount } });
    } else if (!options.quiet) {
      console.log(message);
    }

    await new Promise<void>((resolve) => {
      const closeServer = (): void => {
        server.close(() => resolve());
      };

      process.once('SIGINT', closeServer);
      process.once('SIGTERM', closeServer);
    });

    return ExitCode.Success;
  }

  if (scope !== 'repo' || !['add', 'list', 'remove'].includes(action ?? '')) {
    const message = 'playbook observer: use `playbook observer repo <add|list|remove>` or `playbook observer serve`.';
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer', error: message } });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }

  const registry = readRegistry(observerRoot);

  try {
    if (action === 'list') {
      emitObserverPayload(
        cwd,
        options,
        { schemaVersion: '1.0', command: 'observer-repo-list', observer_root: observerRoot, registry_path: resolvedRegistryPath, repo_count: registry.repos.length, registry },
        registry.repos.length === 0 ? 'No connected observer repositories.' : registry.repos.map((repo) => `${repo.id} ${repo.root}`).join('\n')
      );
      return ExitCode.Success;
    }

    if (action === 'add') {
      const pathArg = nonFlagPositionals(args.slice(2))[0];
      if (!pathArg) {
        throw new Error('playbook observer repo add: missing <path> argument');
      }

      const result = addRepoToRegistry(observerRoot, registry, {
        path: pathArg,
        id: readOptionValue(args, '--id') ?? undefined,
        tags: readOptionValues(args, '--tag')
      });
      emitObserverPayload(cwd, options, { schemaVersion: '1.0', command: 'observer-repo-add', observer_root: observerRoot, registry_path: resolvedRegistryPath, repo_count: result.registry.repos.length, repo: result.repo, registry: result.registry }, `Connected observer repo ${result.repo.id}`);
      return ExitCode.Success;
    }

    const removeId = nonFlagPositionals(args.slice(2))[0];
    if (!removeId) {
      throw new Error('playbook observer repo remove: missing <id> argument');
    }

    const nextRegistry = removeRepoFromRegistry(observerRoot, registry, removeId);
    emitObserverPayload(cwd, options, { schemaVersion: '1.0', command: 'observer-repo-remove', observer_root: observerRoot, registry_path: resolvedRegistryPath, repo_count: nextRegistry.repos.length, removedId: removeId, registry: nextRegistry }, `Removed observer repo ${removeId}`);
    return ExitCode.Success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer', error: message } });
    } else {
      console.error(message);
    }
    return ExitCode.Failure;
  }
};

export { OBSERVER_REPO_REGISTRY_RELATIVE_PATH };
