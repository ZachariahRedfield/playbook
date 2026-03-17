import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { emitJsonOutput, writeJsonArtifactAbsolute } from '../../lib/jsonArtifact.js';
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
  repo add <path> [--id <id>] [--tag <tag>]
  repo list
  repo remove <id>
  serve [--host <host>] [--port <port>]

Options:
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

const registryPath = (cwd: string): string => path.join(cwd, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);

const readRegistry = (cwd: string): ObserverRepoRegistry => {
  const artifactPath = registryPath(cwd);
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
      .map((entry) => ({
        id: String(entry.id ?? ''),
        name: String(entry.name ?? ''),
        root: String(entry.root ?? ''),
        status: 'connected' as const,
        artifactsRoot: String(entry.artifactsRoot ?? ''),
        tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag)).sort((left, right) => left.localeCompare(right)) : []
      }))
      .filter((entry) => entry.id.length > 0)
  });
};

const writeRegistry = (cwd: string, registry: ObserverRepoRegistry): void => {
  writeJsonArtifactAbsolute(registryPath(cwd), normalizeRegistry(registry) as unknown as Record<string, unknown>, 'observer', { envelope: false });
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
      if (value === '--id' || value === '--tag') {
        index += 1;
      }
      continue;
    }

    values.push(value);
  }

  return values;
};

const readJsonFile = (targetPath: string): unknown => JSON.parse(fs.readFileSync(targetPath, 'utf8')) as unknown;

const loadSnapshotArtifact = (cwd: string): Record<string, unknown> | null => {
  const snapshotPath = path.join(cwd, OBSERVER_SNAPSHOT_RELATIVE_PATH);
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

const addRepoToRegistry = (cwd: string, registry: ObserverRepoRegistry, input: ObserverRepoCreateInput): { repo: ObserverRepoEntry; registry: ObserverRepoRegistry } => {
  const root = path.resolve(cwd, input.path);
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
  writeRegistry(cwd, nextRegistry);
  return { repo: entry, registry: nextRegistry };
};

const removeRepoFromRegistry = (cwd: string, registry: ObserverRepoRegistry, removeId: string): ObserverRepoRegistry => {
  const existing = registry.repos.find((repo) => repo.id === removeId);
  if (!existing) {
    throw new Error(`playbook observer repo remove: unknown id "${removeId}"`);
  }

  const nextRegistry = normalizeRegistry({ ...registry, repos: registry.repos.filter((repo) => repo.id !== removeId) });
  writeRegistry(cwd, nextRegistry);
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
      </aside>
      <section>
        <div class="layout-main">
          <div class="card"><h2 id="repoTitle">Repo Detail</h2><div id="repoDetail" class="meta">Select a repo.</div><button id="removeRepo" style="display:none">Remove repo</button></div>
          <div class="card"><h3>System Blueprint</h3><div id="blueprintMeta" class="meta">Select a repo.</div><svg id="blueprintPanel" class="blueprint" viewBox="0 0 980 420" aria-label="System Blueprint"></svg><div class="state-legend"><span class="badge">active</span><span class="badge">available</span><span class="badge">stale</span><span class="badge">idle</span><span class="badge">missing</span></div></div>
          <div class="card"><h3>Artifact Detail Viewer</h3><select id="artifactKind"></select><div id="artifactPanel"></div></div>
        </div>
        <div class="layout-side">
          <details id="selfPanel" class="card">
            <summary>Playbook Self-Observation</summary>
            <div id="selfSummary" class="meta">Waiting for observer data.</div>
          </details>
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
const selectedNodeDetailEl = document.getElementById('selectedNodeDetail');
let selectedRepoId = null;
let selectedBlueprintNodeId = null;
let homeRepoId = null;
let latestRepoPayload = null;
let latestSnapshotRepoEntry = null;

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
  const node = Array.isArray(systemMap && systemMap.nodes) ? systemMap.nodes.find((entry) => entry.id === selectedBlueprintNodeId) : null;
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
  if (!selectedRepoId && homeRepoId) selectedRepoId = homeRepoId;
  reposEl.innerHTML = '';
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
    repoDetailEl.textContent = 'Select a repo.';
    removeRepoEl.style.display = 'none';
    artifactPanelEl.innerHTML = '';
    blueprintPanelEl.innerHTML = '';
    blueprintMetaEl.textContent = 'Select a repo.';
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
    artifactPanelEl.innerHTML = '<div class="meta">Select a repo.</div>';
    return;
  }
  const kind = artifactKindEl.value;
  const artifactPayload = await getJson('/repos/' + encodeURIComponent(selectedRepoId) + '/artifacts/' + encodeURIComponent(kind));
  artifactPanelEl.innerHTML = format(artifactPayload.artifact);
};

const loadBlueprint = async () => {
  if (!selectedRepoId) {
    blueprintPanelEl.innerHTML = '';
    blueprintMetaEl.textContent = 'Select a repo.';
    return;
  }

  const payload = await getJson('/snapshot');
  latestSnapshotRepoEntry = (payload.snapshot && Array.isArray(payload.snapshot.repos)) ? payload.snapshot.repos.find((entry) => entry.id === selectedRepoId) : null;
  const systemMapArtifact = latestSnapshotRepoEntry && Array.isArray(latestSnapshotRepoEntry.artifacts) ? latestSnapshotRepoEntry.artifacts.find((artifact) => artifact.kind === 'system-map') : null;
  const readiness = latestRepoPayload && latestRepoPayload.readiness ? latestRepoPayload.readiness : {};
  renderSystemBlueprint(systemMapArtifact ? systemMapArtifact.value : null, readiness, latestSnapshotRepoEntry ? latestSnapshotRepoEntry.artifacts : []);
};

const refreshAll = async () => {
  try {
    const [healthStatus] = await Promise.all([loadHealth(), renderRepos()]);
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

refreshAll();
setInterval(refreshAll, 5000);
`;

const observerServerResponse = (cwd: string, pathname: string): { statusCode: number; payload: Record<string, unknown> } => {
  const registry = readRegistry(cwd);
  const homeRepoId = findHomeRepoId(registry, cwd);
  const base = { schemaVersion: '1.0', readOnly: true, localOnly: true };

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

  if (pathname === '/snapshot') {
    return {
      statusCode: 200,
      payload: {
        ...base,
        home_repo_id: homeRepoId,
        snapshot: loadSnapshotArtifact(cwd) ?? buildSnapshotFromRegistry(registry),
        readiness: registry.repos.map((repo) => ({ id: repo.id, readiness: repoReadiness(repo) }))
      }
    };
  }

  const repoMatch = /^\/repos\/([^/]+)$/.exec(pathname);
  if (repoMatch) {
    const repo = registry.repos.find((entry) => entry.id === decodeURIComponent(repoMatch[1] ?? ''));
    if (!repo) {
      return { statusCode: 404, payload: { ...base, kind: 'observer-server-error', error: 'repo-not-found' } };
    }
    return { statusCode: 200, payload: { ...base, kind: 'observer-server-repo', repo, readiness: repoReadiness(repo) } };
  }

  const artifactMatch = /^\/repos\/([^/]+)\/artifacts\/([^/]+)$/.exec(pathname);
  if (artifactMatch) {
    const repo = registry.repos.find((entry) => entry.id === decodeURIComponent(artifactMatch[1] ?? ''));
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

export const createObserverServer = (cwd: string): http.Server =>
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

        const result = addRepoToRegistry(cwd, readRegistry(cwd), { path: payload.path, id: payload.id, tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag)) : [] });
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
        const registry = removeRepoFromRegistry(cwd, readRegistry(cwd), removedId);
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

    const result = observerServerResponse(cwd, parsedUrl.pathname);
    writeJsonResponse(response, result.statusCode, result.payload);
  });

export const runObserver = async (cwd: string, args: string[], options: ObserverOptions): Promise<number> => {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printObserverHelp();
    return args.length === 0 ? ExitCode.Failure : ExitCode.Success;
  }

  const [scope, action] = args;

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

    const server = createObserverServer(cwd);

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        resolve();
      });
    });

    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : port;
    const message = `Observer server listening at http://${host}:${boundPort}`;
    if (options.format === 'json') {
      emitJsonOutput({ cwd, command: 'observer', payload: { schemaVersion: '1.0', command: 'observer-serve', host, port: boundPort, readOnly: true, localOnly: true } });
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

  const registry = readRegistry(cwd);

  try {
    if (action === 'list') {
      emitObserverPayload(
        cwd,
        options,
        { schemaVersion: '1.0', command: 'observer-repo-list', registry },
        registry.repos.length === 0 ? 'No connected observer repositories.' : registry.repos.map((repo) => `${repo.id} ${repo.root}`).join('\n')
      );
      return ExitCode.Success;
    }

    if (action === 'add') {
      const pathArg = nonFlagPositionals(args.slice(2))[0];
      if (!pathArg) {
        throw new Error('playbook observer repo add: missing <path> argument');
      }

      const result = addRepoToRegistry(cwd, registry, {
        path: pathArg,
        id: readOptionValue(args, '--id') ?? undefined,
        tags: readOptionValues(args, '--tag')
      });
      emitObserverPayload(cwd, options, { schemaVersion: '1.0', command: 'observer-repo-add', repo: result.repo, registry: result.registry }, `Connected observer repo ${result.repo.id}`);
      return ExitCode.Success;
    }

    const removeId = nonFlagPositionals(args.slice(2))[0];
    if (!removeId) {
      throw new Error('playbook observer repo remove: missing <id> argument');
    }

    const nextRegistry = removeRepoFromRegistry(cwd, registry, removeId);
    emitObserverPayload(cwd, options, { schemaVersion: '1.0', command: 'observer-repo-remove', removedId: removeId, registry: nextRegistry }, `Removed observer repo ${removeId}`);
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
