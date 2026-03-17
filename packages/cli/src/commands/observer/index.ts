import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { emitJsonOutput, writeJsonArtifactAbsolute } from '../../lib/jsonArtifact.js';
import { computeCrossRepoPatternLearning, readCrossRepoPatternsArtifact, type CrossRepoPatternsArtifact } from '@zachariahredfield/playbook-engine';
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
  const playbookDetected =
    playbookDirectoryPresent ||
    fs.existsSync(path.join(repo.root, 'playbook.config.json')) ||
    fs.existsSync(path.join(repo.root, '.playbook', 'config.json'));

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
  const readinessState: ObserverRepoReadinessState = !playbookDetected
    ? 'connected_only'
    : observableFlags
      ? 'observable'
      : anyArtifactsPresent
        ? 'partially_observable'
        : 'playbook_detected';

  return {
    connected: true,
    playbook_detected: playbookDetected,
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
    missing_artifacts: READINESS_ARTIFACTS.filter((artifact) => !flags[artifact.key]).map((artifact) => artifact.relativePath)
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

const observerDashboardJs = (): string => `const artifactKinds = ['cycle-state','cycle-history','policy-evaluation','policy-apply-result','pr-review','session','system-map'];
const reposEl = document.getElementById('repos');
const healthEl = document.getElementById('health');
const repoTitleEl = document.getElementById('repoTitle');
const repoDetailEl = document.getElementById('repoDetail');
const removeRepoEl = document.getElementById('removeRepo');
const artifactKindEl = document.getElementById('artifactKind');
const artifactPanelEl = document.getElementById('artifactPanel');
const blueprintMetaEl = document.getElementById('blueprintMeta');
const blueprintPanelEl = document.getElementById('blueprintPanel');
const selfSummaryEl = document.getElementById('selfSummary');
const observerRegistryMetaEl = document.getElementById('observerRegistryMeta');
const selectedNodeDetailEl = document.getElementById('selectedNodeDetail');
const compareLeftEl = document.getElementById('compareLeft');
const compareRightEl = document.getElementById('compareRight');
const compareBtnEl = document.getElementById('compareBtn');
const compareAllBtnEl = document.getElementById('compareAllBtn');
const crossRepoPanelEl = document.getElementById('crossRepoPanel');
const repoModeBtnEl = document.getElementById('repoModeBtn');
const crossRepoModeBtnEl = document.getElementById('crossRepoModeBtn');
const repoViewPanelEl = document.getElementById('repoViewPanel');
const crossRepoViewPanelEl = document.getElementById('crossRepoViewPanel');
let selectedRepoId = null;
let selectedBlueprintNodeId = null;
let homeRepoId = null;
let latestRepoPayload = null;
let latestSnapshotRepoEntry = null;
let activeView = 'repo';

const NODE_LINKED_ARTIFACT = {
  'cycle-state': 'cycle-state',
  'cycle-history': 'cycle-history',
  policy: 'policy-evaluation',
  'policy-artifact': 'policy-evaluation',
  apply: 'policy-apply-result',
  'apply-artifact': 'policy-apply-result',
  'review-pr': 'pr-review',
  'pr-review-artifact': 'pr-review',
  session: 'session',
  'session-artifact': 'session',
  'cycle-artifact': 'cycle-state',
  'observer-server': 'system-map'
};

const boolStatus = (value) => value ? 'present' : 'missing';
const FRESH_WINDOW_MS = 1000 * 60 * 60 * 24;
const parseTimestamp = (value) => {
  if (!value || typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const format = (value) => '<pre>' + JSON.stringify(value, null, 2) + '</pre>';
const getJson = async (url, init) => {
  const response = await fetch(url, init);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || 'request-failed');
  }
  return json;
};

const renderSelfObservation = (repoPayload, healthStatus) => {
  if (!repoPayload || !repoPayload.repo) {
    selfSummaryEl.innerHTML = '<div><strong>Self/home repo:</strong> not connected</div><div>Connect this Playbook repo to surface first-class self-observation.</div>';
    return;
  }

  const readiness = repoPayload.readiness || {};
  const missingArtifacts = Array.isArray(readiness.missing_artifacts) ? readiness.missing_artifacts : [];
  const hasControlPlane = !!(readiness.policy_evaluation_present && readiness.policy_apply_result_present && readiness.pr_review_present && readiness.session_present);
  const hasRuntimeLoop = !!(readiness.cycle_state_present && readiness.cycle_history_present);
  const hasReviewLoop = !!(readiness.pr_review_present && readiness.policy_evaluation_present);
  const hasBlueprint = !missingArtifacts.includes('.playbook/system-map.json');
  const blueprintGuidance = hasBlueprint
    ? 'Blueprint available from governed artifact \`.playbook/system-map.json\`.'
    : 'Blueprint missing. Run \`pnpm playbook diagram system\` to generate \`.playbook/system-map.json\`.';

  selfSummaryEl.innerHTML =
    '<div><strong>Self/home repo:</strong> ' + repoPayload.repo.id + '</div>' +
    '<div><strong>Observer server health:</strong> ' + (healthStatus || 'unknown') + '</div>' +
    '<div><strong>Readiness:</strong> ' + (readiness.readiness_state || 'unknown') + '</div>' +
    '<div><strong>Control-plane artifacts present:</strong> ' + (hasControlPlane ? 'yes' : 'no') + '</div>' +
    '<div><strong>Review loop available:</strong> ' + (hasReviewLoop ? 'yes' : 'no') + '</div>' +
    '<div><strong>Runtime loop available:</strong> ' + (hasRuntimeLoop ? 'yes' : 'no') + '</div>' +
    '<div><strong>Blueprint:</strong> ' + (hasBlueprint ? 'available' : 'missing') + '</div>' +
    '<div>' + blueprintGuidance + '</div>';
};

const deriveNodeState = (node, readiness, artifactsByKind) => {
  const updatedMs = parseTimestamp(readiness && readiness.last_artifact_update_time);
  const stale = updatedMs !== null && Date.now() - updatedMs > FRESH_WINDOW_MS;
  const linkedArtifact = NODE_LINKED_ARTIFACT[node.id] || null;
  const has = (k) => !!(readiness && readiness[k]);

  let state = 'idle';
  if (['cycle', 'cycle-state', 'cycle-history', 'telemetry'].includes(node.id)) {
    state = has('cycle_state_present') ? 'active' : 'missing';
  } else if (['policy', 'policy-artifact'].includes(node.id)) {
    state = has('policy_evaluation_present') ? 'active' : 'missing';
  } else if (['apply', 'apply-artifact'].includes(node.id)) {
    state = has('policy_apply_result_present') ? 'active' : 'missing';
  } else if (['review-pr', 'pr-review-artifact'].includes(node.id)) {
    state = has('pr_review_present') ? 'active' : 'missing';
  } else if (['analyze-pr', 'improve'].includes(node.id)) {
    state = has('pr_review_present') ? 'available' : 'idle';
  } else if (['session', 'session-artifact', 'evidence-envelope'].includes(node.id)) {
    state = has('session_present') ? 'available' : 'missing';
  } else if (node.id === 'observer-server') {
    state = artifactsByKind['system-map'] ? 'available' : 'missing';
  } else if (node.id.includes('artifact')) {
    state = linkedArtifact && artifactsByKind[linkedArtifact] ? 'available' : 'missing';
  }

  if (state !== 'missing' && stale) state = 'stale';
  return { state, linkedArtifact };
};

const computeActiveNodes = (readiness) => {
  const activeNodes = new Set();
  if (readiness && readiness.cycle_state_present && readiness.cycle_history_present && readiness.policy_evaluation_present && readiness.policy_apply_result_present) {
    ['cycle', 'cycle-state', 'cycle-history', 'telemetry', 'policy', 'apply'].forEach((id) => activeNodes.add(id));
  }
  if (readiness && readiness.pr_review_present && readiness.policy_evaluation_present) {
    ['analyze-pr', 'improve', 'policy', 'review-pr'].forEach((id) => activeNodes.add(id));
  }
  return activeNodes;
};

const renderSelectedNode = (systemMap, nodeStates) => {
  if (!selectedBlueprintNodeId) {
    selectedNodeDetailEl.textContent = 'Click a node to inspect layer, state, and artifact linkage.';
    return;
  }
  const node = Array.isArray(systemMap && systemMap.nodes) ? systemMap.nodes.find((entry: any) => entry.id === selectedBlueprintNodeId) : null;
  if (!node) {
    selectedNodeDetailEl.textContent = 'Selected node is no longer available.';
    return;
  }
  const derived = nodeStates[node.id] || { state: 'idle', linkedArtifact: null };
  selectedNodeDetailEl.innerHTML = '<div><strong>Node ID:</strong> ' + escapeHtml(node.id) + '</div><div><strong>Layer:</strong> ' + escapeHtml(node.layer || 'unknown') + '</div><div><strong>Derived state:</strong> ' + escapeHtml(derived.state) + '</div><div><strong>Linked artifact:</strong> ' + escapeHtml(derived.linkedArtifact || 'none') + '</div>';
};

const renderSystemBlueprint = (systemMap, readiness, artifacts) => {
  if (!systemMap || !Array.isArray(systemMap.layers) || !Array.isArray(systemMap.nodes) || !Array.isArray(systemMap.edges)) {
    blueprintMetaEl.textContent = 'System map artifact unavailable for selected repo.';
    blueprintPanelEl.innerHTML = '';
    selectedNodeDetailEl.textContent = 'Click a node to inspect layer, state, and artifact linkage.';
    return;
  }

  const artifactsByKind = {};
  for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
    if (artifact && typeof artifact.kind === 'string') artifactsByKind[artifact.kind] = artifact.value;
  }

  const layers = systemMap.layers;
  const nodes = systemMap.nodes;
  const edges = systemMap.edges;
  const nodeStates = {};
  for (const node of nodes) {
    nodeStates[node.id] = deriveNodeState(node, readiness || {}, artifactsByKind);
  }
  const activeNodes = computeActiveNodes(readiness || {});

  const width = 980;
  const height = 420;
  const laneHeight = Math.max(48, Math.floor(height / Math.max(layers.length, 1)));
  const nodeByLayer = new Map();
  for (const layer of layers) {
    nodeByLayer.set(layer.id, nodes.filter((node) => node.layer === layer.id).sort((a, b) => a.id.localeCompare(b.id)));
  }

  const positions = new Map();
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    const layerNodes = nodeByLayer.get(layer.id) || [];
    const usableWidth = width - 220;
    const spacing = layerNodes.length > 0 ? usableWidth / (layerNodes.length + 1) : usableWidth / 2;
    layerNodes.forEach((node, nodeIndex) => {
      positions.set(node.id, { x: 180 + Math.floor(spacing * (nodeIndex + 1)), y: layerIndex * laneHeight + Math.floor(laneHeight / 2) });
    });
  }

  const layerSvg = layers.map((layer, index) =>
    '<rect class="layer-band" x="0" y="' + (index * laneHeight) + '" width="980" height="' + laneHeight + '"></rect>' +
    '<text class="layer-label" x="12" y="' + (index * laneHeight + 24) + '">' + escapeHtml(layer.label || layer.id) + '</text>'
  ).join('');

  const edgeSvg = edges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return '';
    const active = activeNodes.has(edge.from) && activeNodes.has(edge.to);
    return '<line class="edge-line' + (active ? ' active' : '') + '" x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '"></line>';
  }).join('');

  const nodeSvg = nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) return '';
    const isSelected = node.id === selectedBlueprintNodeId;
    const derived = nodeStates[node.id] || { state: 'idle' };
    return '<g data-node-id="' + escapeHtml(node.id) + '" data-layer-id="' + escapeHtml(node.layer) + '">' +
      '<rect class="node-box node-state-' + escapeHtml(derived.state) + (isSelected ? ' selected' : '') + '" x="' + (position.x - 56) + '" y="' + (position.y - 16) + '" width="112" height="32"></rect>' +
      '<text class="node-label" x="' + (position.x - 49) + '" y="' + (position.y + 4) + '">' + escapeHtml(node.id) + '</text>' +
      '</g>';
  }).join('');

  blueprintPanelEl.innerHTML = '<defs><marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0 0, 6 3, 0 6" fill="#6b8cd6"></polygon></marker></defs>' + layerSvg + edgeSvg + nodeSvg;

  blueprintPanelEl.querySelectorAll('g[data-node-id]').forEach((group) => {
    group.addEventListener('click', () => {
      selectedBlueprintNodeId = group.getAttribute('data-node-id');
      const linkedArtifact = NODE_LINKED_ARTIFACT[selectedBlueprintNodeId || ''] || null;
      if (linkedArtifact && artifactKinds.includes(linkedArtifact)) {
        artifactKindEl.value = linkedArtifact;
        loadArtifact();
      }
      renderSystemBlueprint(systemMap, readiness, artifacts);
    });
  });

  blueprintMetaEl.textContent = selectedBlueprintNodeId && nodeStates[selectedBlueprintNodeId]
    ? 'Selected node: ' + selectedBlueprintNodeId + ' (state: ' + nodeStates[selectedBlueprintNodeId].state + ')'
    : 'System map loaded. Click nodes for stateful detail.';
  renderSelectedNode(systemMap, nodeStates);
};

artifactKinds.forEach((kind) => {
  const option = document.createElement('option');
  option.value = kind;
  option.textContent = kind;
  artifactKindEl.appendChild(option);
});

const loadHealth = async () => {
  const health = await getJson('/health');
  healthEl.textContent = 'health: ' + health.status;
  return health.status;
};

const renderRepos = async () => {
  const payload = await getJson('/repos');
  homeRepoId = payload.home_repo_id || null;
  observerRegistryMetaEl.innerHTML =
    '<div><strong>observer_root:</strong> ' + escapeHtml(payload.observer_root || 'unknown') + '</div>' +
    '<div><strong>registry_path:</strong> ' + escapeHtml(payload.registry_path || 'unknown') + '</div>' +
    '<div><strong>repo_count:</strong> ' + escapeHtml(payload.repo_count === undefined ? 'unknown' : String(payload.repo_count)) + '</div>';
  if (!selectedRepoId && homeRepoId) selectedRepoId = homeRepoId;
  reposEl.innerHTML = '';
  if (!Array.isArray(payload.repos) || payload.repos.length === 0) {
    reposEl.innerHTML = '<div class="empty-state">No repos connected in ' + escapeHtml(payload.registry_path || 'unknown-registry-path') + '.</div>';
    return payload;
  }
  for (const repo of payload.repos) {
    const item = document.createElement('div');
    item.className = 'card repo' + (repo.id === selectedRepoId ? ' selected' : '');
    const readiness = repo.readiness || { readiness_state: 'connected_only' };
    const isHome = homeRepoId && repo.id === homeRepoId;
    item.innerHTML = '<strong>' + repo.id + (isHome ? ' (self/home)' : '') + '</strong><div class="meta">' + repo.root + '</div><div class="meta">readiness: ' + readiness.readiness_state + '</div>';
    item.onclick = () => { selectedRepoId = repo.id; selectedBlueprintNodeId = null; loadRepoDetail(); renderRepos(); };
    reposEl.appendChild(item);
  }
  return payload;
};

const loadRepoDetail = async () => {
  if (!selectedRepoId) {
    repoTitleEl.textContent = 'Repo Detail';
    repoDetailEl.innerHTML = '<div class="empty-state">Connect a repo to inspect readiness, blueprint, and governed artifacts.</div>';
    removeRepoEl.style.display = 'none';
    artifactPanelEl.innerHTML = '<div class="empty-state">Artifact detail appears after a repo is selected.</div>';
    blueprintPanelEl.innerHTML = '';
    blueprintMetaEl.innerHTML = 'Connect and select a repo to render the system blueprint.';
    selectedNodeDetailEl.textContent = 'Click a node to inspect layer, state, and artifact linkage.';
    return;
  }

  latestRepoPayload = await getJson('/repos/' + encodeURIComponent(selectedRepoId));
  repoTitleEl.textContent = 'Repo: ' + latestRepoPayload.repo.id;
  const readiness = latestRepoPayload.readiness || {};
  const missing = Array.isArray(readiness.missing_artifacts) && readiness.missing_artifacts.length > 0 ? readiness.missing_artifacts.join(', ') : 'none';
  const lastUpdate = readiness.last_artifact_update_time || 'n/a';
  repoDetailEl.innerHTML =
    '<div class="meta"><strong>Readiness:</strong> ' + (readiness.readiness_state || 'unknown') + '</div>' +
    '<div class="meta"><strong>Last artifact update:</strong> ' + lastUpdate + '</div>' +
    '<div class="meta"><strong>Missing artifacts:</strong> ' + missing + '</div>' +
    format(latestRepoPayload.repo);
  removeRepoEl.style.display = '';
  await loadArtifact();
  await loadBlueprint();
};

const loadArtifact = async () => {
  if (!selectedRepoId) {
    artifactPanelEl.innerHTML = '<div class="empty-state">Select a repo to view artifact details.</div>';
    return;
  }
  const kind = artifactKindEl.value;
  const artifactPayload = await getJson('/repos/' + encodeURIComponent(selectedRepoId) + '/artifacts/' + encodeURIComponent(kind));
  artifactPanelEl.innerHTML = format(artifactPayload.artifact);
};

const loadBlueprint = async () => {
  if (!selectedRepoId) {
    blueprintPanelEl.innerHTML = '';
    blueprintMetaEl.innerHTML = 'Connect and select a repo to render the system blueprint.';
    return;
  }

  const payload = await getJson('/snapshot');
  latestSnapshotRepoEntry = (payload.snapshot && Array.isArray(payload.snapshot.repos)) ? payload.snapshot.repos.find((entry: any) => entry.id === selectedRepoId) : null;
  const systemMapArtifact = latestSnapshotRepoEntry && Array.isArray(latestSnapshotRepoEntry.artifacts) ? latestSnapshotRepoEntry.artifacts.find((artifact) => artifact.kind === 'system-map') : null;
  const readiness = latestRepoPayload && latestRepoPayload.readiness ? latestRepoPayload.readiness : {};
  renderSystemBlueprint(systemMapArtifact ? systemMapArtifact.value : null, readiness, latestSnapshotRepoEntry ? latestSnapshotRepoEntry.artifacts : []);
};


const setActiveView = (view) => {
  activeView = view === 'cross-repo' ? 'cross-repo' : 'repo';
  const repoMode = activeView === 'repo';
  repoViewPanelEl.classList.toggle('hidden', !repoMode);
  crossRepoViewPanelEl.classList.toggle('hidden', repoMode);
  repoModeBtnEl.classList.toggle('active', repoMode);
  crossRepoModeBtnEl.classList.toggle('active', !repoMode);
  repoModeBtnEl.setAttribute('aria-selected', repoMode ? 'true' : 'false');
  crossRepoModeBtnEl.setAttribute('aria-selected', repoMode ? 'false' : 'true');
};

const renderCompareSelectors = (repos) => {
  compareLeftEl.innerHTML = '';
  compareRightEl.innerHTML = '';
  for (const repo of repos) {
    const leftOption = document.createElement('option');
    leftOption.value = repo.id;
    leftOption.textContent = repo.id;
    compareLeftEl.appendChild(leftOption);
    const rightOption = document.createElement('option');
    rightOption.value = repo.id;
    rightOption.textContent = repo.id;
    compareRightEl.appendChild(rightOption);
  }
  if (!compareLeftEl.value && repos.length > 0) compareLeftEl.value = repos[0].id;
  if (!compareRightEl.value && repos.length > 1) compareRightEl.value = repos[1].id;
  if (repos.length < 2) {
    crossRepoPanelEl.innerHTML = '<div class="empty-state">Connect at least 2 repos to compare governed artifacts.</div>';
  }
};

const renderEvidenceRow = (repoId, evidence) => {
  const artifactKind = evidence.artifact_kind || evidence.artifactKind || 'unknown';
  const artifactPath = evidence.artifact_path || evidence.artifactPath || 'unknown';
  const pointer = evidence.pointer || evidence.path || '/';
  const excerpt = evidence.excerpt || evidence.digest || evidence.summary || '';
  return '<li><button class="repo" data-drill-repo="' + escapeHtml(repoId) + '" data-drill-kind="' + escapeHtml(artifactKind) + '">' +
    escapeHtml(repoId + ' • ' + artifactKind) + '</button><div class="meta">' +
    escapeHtml(artifactPath + ' @ ' + pointer + (excerpt ? ' — ' + excerpt : '')) + '</div></li>';
};

const attachDrilldownHandlers = () => {
  for (const el of crossRepoPanelEl.querySelectorAll('[data-drill-repo]')) {
    el.onclick = async () => {
      selectedRepoId = el.getAttribute('data-drill-repo');
      const nextKind = el.getAttribute('data-drill-kind');
      if (nextKind && artifactKinds.includes(nextKind)) artifactKindEl.value = nextKind;
      await loadRepoDetail();
      renderRepos();
      setActiveView('repo');
    };
  }
};

const renderCrossRepoEvidence = (payload) => {
  const summary = payload.summary || {};
  const comparison = payload.comparison || null;
  const repoDelta = payload.repo_delta || (comparison && comparison.repo_deltas) || [];
  const candidatePatterns = Array.isArray(payload.candidates) ? payload.candidates : [];

  if (summary.candidate_count !== undefined) {
    crossRepoPanelEl.innerHTML = '<div class="meta"><strong>Source repos:</strong> ' + (summary.source_repos || []).join(', ') + '</div>' +
      '<div class="meta"><strong>Comparisons:</strong> ' + (summary.comparison_count || 0) + '</div>' +
      '<div class="meta"><strong>Candidate patterns:</strong> ' + (summary.candidate_count || 0) + '</div>';
    return;
  }

  const sections = [];
  if (comparison) {
    sections.push('<div class="cross-repo-item"><strong>Repo deltas</strong><div class="meta">' + escapeHtml((comparison.left_repo_id || '?') + ' vs ' + (comparison.right_repo_id || '?')) + '</div>' + format(repoDelta) + '</div>');
    const evidence = [];
    for (const item of repoDelta) {
      const leftEvidence = Array.isArray(item.left_evidence) ? item.left_evidence : [];
      for (const entry of leftEvidence) evidence.push(renderEvidenceRow(comparison.left_repo_id, entry));
      const rightEvidence = Array.isArray(item.right_evidence) ? item.right_evidence : [];
      for (const entry of rightEvidence) evidence.push(renderEvidenceRow(comparison.right_repo_id, entry));
    }
    if (evidence.length > 0) {
      sections.push('<div class="cross-repo-item"><strong>Evidence drilldown</strong><ul>' + evidence.join('') + '</ul></div>');
    }
  }

  if (candidatePatterns.length > 0) {
    const rows = [];
    for (const pattern of candidatePatterns) {
      const evidences = Array.isArray(pattern.evidence) ? pattern.evidence : [];
      const sourceRepo = Array.isArray(pattern.source_repo_ids) && pattern.source_repo_ids.length > 0 ? pattern.source_repo_ids[0] : '';
      for (const evidence of evidences) {
        rows.push(renderEvidenceRow(sourceRepo || evidence.repo_id || 'unknown', evidence));
      }
    }
    sections.push('<div class="cross-repo-item"><strong>Candidate portable patterns</strong>' + (rows.length ? '<ul>' + rows.join('') + '</ul>' : '<div class="meta">No evidence rows available.</div>') + '</div>');
  }

  if (sections.length === 0) {
    crossRepoPanelEl.innerHTML = '<div class="empty-state">No cross-repo comparison data is available yet.</div>';
    return;
  }

  crossRepoPanelEl.innerHTML = '<div class="cross-repo-list">' + sections.join('') + '</div>';
  attachDrilldownHandlers();
};

const loadCrossRepoPair = async () => {
  const left = compareLeftEl.value;
  const right = compareRightEl.value;
  if (!left || !right || left === right) {
    crossRepoPanelEl.innerHTML = '<div class="empty-state">Select two distinct repos for pair comparison.</div>';
    return;
  }
  const payload = await getJson('/api/cross-repo/compare?left=' + encodeURIComponent(left) + '&right=' + encodeURIComponent(right));
  renderCrossRepoEvidence(payload);
};

const loadCrossRepoAggregate = async () => {
  const reposPayload = await getJson('/repos');
  const repos = Array.isArray(reposPayload.repos) ? reposPayload.repos : [];
  if (repos.length < 2) {
    crossRepoPanelEl.innerHTML = '<div class="empty-state">Connect at least 2 repos to compare governed artifacts.</div>';
    return;
  }

  const [summaryPayload, candidatePayload] = await Promise.all([
    getJson('/api/cross-repo/summary'),
    getJson('/api/cross-repo/candidates')
  ]);
  renderCrossRepoEvidence(summaryPayload);
  if (Array.isArray(candidatePayload.candidates) && candidatePayload.candidates.length > 0) {
    renderCrossRepoEvidence(candidatePayload);
  }
};

const refreshAll = async () => {
  try {
    const [healthStatus, reposPayload] = await Promise.all([loadHealth(), renderRepos()]);
    const repos = reposPayload.repos || [];
    if ((!selectedRepoId || !repos.find((repo) => repo.id === selectedRepoId)) && repos.length > 0) {
      selectedRepoId = repos[0].id;
    }
    renderCompareSelectors(repos);
    await loadRepoDetail();
    if (homeRepoId) {
      const selfPayload = await getJson('/repos/' + encodeURIComponent(homeRepoId));
      renderSelfObservation(selfPayload, healthStatus);
    } else {
      renderSelfObservation(null, healthStatus);
    }
  } catch (error) {
    healthEl.textContent = 'error: ' + error.message;
  }
};

document.getElementById('refresh').onclick = refreshAll;
compareBtnEl.onclick = loadCrossRepoPair;
compareAllBtnEl.onclick = loadCrossRepoAggregate;
artifactKindEl.onchange = loadArtifact;
document.getElementById('addRepo').onclick = async () => {
  const repoPath = document.getElementById('repoPath').value.trim();
  const repoId = document.getElementById('repoId').value.trim();
  const tags = document.getElementById('repoTags').value.split(',').map((tag) => tag.trim()).filter(Boolean);
  if (!repoPath) {
    healthEl.textContent = 'error: repo path is required';
    return;
  }
  await getJson('/repos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repoPath, id: repoId || undefined, tags }) });
  await refreshAll();
};

removeRepoEl.onclick = async () => {
  if (!selectedRepoId) return;
  await getJson('/repos/' + encodeURIComponent(selectedRepoId), { method: 'DELETE' });
  selectedRepoId = null;
  selectedBlueprintNodeId = null;
  await refreshAll();
};


repoModeBtnEl.onclick = () => setActiveView('repo');
crossRepoModeBtnEl.onclick = () => setActiveView('cross-repo');
setActiveView('repo');

refreshAll();
setInterval(refreshAll, 5000);
`;

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
