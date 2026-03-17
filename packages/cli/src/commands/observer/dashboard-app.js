const showObserverBootstrapError = (error) => {
  const errorText = error instanceof Error ? error.message : String(error);
  const existing = document.getElementById('observerBootstrapErrorBanner');
  if (existing) {
    existing.textContent = 'Observer UI bootstrap failed: ' + errorText;
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'observerBootstrapErrorBanner';
  banner.setAttribute('role', 'alert');
  banner.style.position = 'fixed';
  banner.style.left = '12px';
  banner.style.right = '12px';
  banner.style.bottom = '12px';
  banner.style.padding = '8px 10px';
  banner.style.border = '1px solid #cf6a8e';
  banner.style.background = '#3a1f2f';
  banner.style.color = '#ffd7e5';
  banner.style.borderRadius = '8px';
  banner.style.fontSize = '12px';
  banner.style.zIndex = '1000';
  banner.textContent = 'Observer UI bootstrap failed: ' + errorText;
  document.body.appendChild(banner);
};

const startObserverDashboard = () => {
const artifactKinds = ['cycle-state','cycle-history','policy-evaluation','policy-apply-result','pr-review','session','system-map'];
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
    '<div><strong>Lifecycle stage:</strong> ' + (readiness.lifecycle_stage || 'unknown') + '</div>' +
    '<div><strong>Fallback proof ready:</strong> ' + (readiness.fallback_proof_ready ? 'yes' : 'no') + '</div>' +
    '<div><strong>Cross-repo eligible:</strong> ' + (readiness.cross_repo_eligible ? 'yes' : 'no') + '</div>' +
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
    item.innerHTML = '<strong>' + repo.id + (isHome ? ' (self/home)' : '') + '</strong><div class="meta">' + repo.root + '</div><div class="meta">readiness: ' + readiness.readiness_state + ' / ' + (readiness.lifecycle_stage || 'unknown') + '</div><div class="meta">next: ' + escapeHtml((readiness.recommended_next_steps && readiness.recommended_next_steps[0]) || 'n/a') + '</div>';
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
  const blockers = Array.isArray(readiness.blockers) && readiness.blockers.length > 0 ? readiness.blockers.map((b) => b.code).join(', ') : 'none';
  const nextStep = Array.isArray(readiness.recommended_next_steps) && readiness.recommended_next_steps.length > 0 ? readiness.recommended_next_steps[0] : 'n/a';
  repoDetailEl.innerHTML =
    '<div class="meta"><strong>Readiness:</strong> ' + (readiness.readiness_state || 'unknown') + '</div>' +
    '<div class="meta"><strong>Lifecycle stage:</strong> ' + (readiness.lifecycle_stage || 'unknown') + '</div>' +
    '<div class="meta"><strong>Fallback proof:</strong> ' + (readiness.fallback_proof_ready ? 'eligible' : 'blocked') + '</div>' +
    '<div class="meta"><strong>Cross-repo:</strong> ' + (readiness.cross_repo_eligible ? 'eligible' : 'blocked') + '</div>' +
    '<div class="meta"><strong>Blockers:</strong> ' + blockers + '</div>' +
    '<div class="meta"><strong>Next command:</strong> ' + escapeHtml(nextStep) + '</div>' +
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
  latestSnapshotRepoEntry = (payload.snapshot && Array.isArray(payload.snapshot.repos)) ? payload.snapshot.repos.find((entry) => entry.id === selectedRepoId) : null;
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
};

try {
  startObserverDashboard();
} catch (error) {
  console.error('Observer UI bootstrap failed.', error);
  showObserverBootstrapError(error);
}
