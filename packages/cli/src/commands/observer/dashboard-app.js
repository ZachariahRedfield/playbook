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
const fleetSummaryPanelEl = document.getElementById('fleetSummaryPanel');
const queueSummaryPanelEl = document.getElementById('queueSummaryPanel');
const executionReceiptPanelEl = document.getElementById('executionReceiptPanel');
const promotionPanelEl = document.getElementById('promotionPanel');
const updatedStatePanelEl = document.getElementById('updatedStatePanel');
const nextQueuePanelEl = document.getElementById('nextQueuePanel');
const executionPlanPanelEl = document.getElementById('executionPlanPanel');
const controlLoopSummaryPanelEl = document.getElementById('controlLoopSummaryPanel');
const backlogSummaryPanelEl = document.getElementById('backlogSummaryPanel');
const backlogListPanelEl = document.getElementById('backlogListPanel');
const storyDetailPanelEl = document.getElementById('storyDetailPanel');
let selectedRepoId = null;
let selectedBlueprintNodeId = null;
let homeRepoId = null;
let latestRepoPayload = null;
let latestSnapshotRepoEntry = null;
let activeView = 'repo';
let latestFleetPayload = null;
let latestQueuePayload = null;
let latestExecutionPlanPayload = null;
let latestExecutionReceiptPayload = null;
let latestPromotionPayload = null;
let latestUpdatedStatePayload = null;
let latestNextQueuePayload = null;
let latestBacklogPayload = null;
let latestStoryDetailPayload = null;
let selectedStoryId = null;

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
const toArray = (value) => Array.isArray(value) ? value : [];
const describeCommandish = (value) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'n/a';
  if (typeof value.command === 'string' && value.command) return value.command;
  if (typeof value.label === 'string' && value.label) return value.label;
  if (typeof value.title === 'string' && value.title) return value.title;
  if (typeof value.message === 'string' && value.message) return value.message;
  if (typeof value.code === 'string' && value.code) return value.code;
  return JSON.stringify(value);
};
const describeEvidence = (value) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'n/a';
  const parts = [];
  if (value.repo_id) parts.push(value.repo_id);
  if (value.artifact_kind) parts.push(value.artifact_kind);
  if (value.pointer) parts.push(value.pointer);
  if (value.excerpt) parts.push(value.excerpt);
  return parts.length ? parts.join(' • ') : JSON.stringify(value);
};
const describeBlocker = (value) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'n/a';
  if (value.message && value.code) return value.code + ': ' + value.message;
  if (value.message) return value.message;
  if (value.code) return value.code;
  return describeCommandish(value);
};

const renderSummaryMetric = (label, value) => '<div class="summary-metric"><div class="summary-metric-label">' + escapeHtml(label) + '</div><div class="summary-metric-value">' + escapeHtml(value || 'n/a') + '</div></div>';
const renderSummaryPill = (label, tone) => '<span class="summary-pill ' + escapeHtml(tone || '') + '">' + escapeHtml(label) + '</span>';

const renderInterpretation = (interpretation) => {
  const defaultView = interpretation && interpretation.progressive_disclosure && interpretation.progressive_disclosure.default_view;
  const secondaryView = interpretation && interpretation.progressive_disclosure && interpretation.progressive_disclosure.secondary_view;
  const deepView = interpretation && interpretation.progressive_disclosure && interpretation.progressive_disclosure.deep_view;
  if (!defaultView) return '';
  const blockers = toArray(secondaryView && secondaryView.blockers).slice(0, 5).map(describeBlocker);
  const reasoning = toArray(secondaryView && secondaryView.reasoning).slice(0, 5).map(describeBlocker);
  const secondaryActions = toArray(secondaryView && secondaryView.secondary_actions).slice(0, 3).map(describeCommandish);
  const rawTruthRefs = toArray(deepView && deepView.raw_truth_refs).slice(0, 6).map(describeBlocker);
  const artifactPaths = toArray(deepView && deepView.artifact_paths).slice(0, 6).map(describeBlocker);
  const promotionRefs = toArray(deepView && deepView.promotion_metadata_refs).slice(0, 4).map(describeBlocker);
  const diagnostics = toArray(deepView && deepView.diagnostics).slice(0, 5).map(describeBlocker);
  const nextStep = describeCommandish(defaultView.next_step);
  return '<div class="narrative-card">' +
    '<div class="summary-strip">' +
    renderSummaryMetric('Current state', defaultView.state || 'unknown') +
    renderSummaryMetric('Why', defaultView.why || 'n/a') +
    renderSummaryMetric('Next step', nextStep) +
    '</div>' +
    '<div class="narrative-primary"><strong>Primary next action:</strong> ' + escapeHtml(nextStep) + '</div>' +
    (blockers[0] ? '<div class="narrative-secondary"><strong>Key blocker:</strong> ' + escapeHtml(blockers[0]) + '</div>' : '') +
    '<details class="narrative-secondary"><summary>Secondary detail</summary>' +
    '<div><strong>Blockers</strong><ul>' + (blockers.length ? blockers.map((blocker) => '<li>' + escapeHtml(blocker) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Reasoning</strong><ul>' + (reasoning.length ? reasoning.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Secondary actions</strong><ul>' + (secondaryActions.length ? secondaryActions.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '</details>' +
    '<details class="raw-truth-note"><summary>Deep/raw truth references</summary>' +
    '<div><strong>Raw refs</strong><ul>' + (rawTruthRefs.length ? rawTruthRefs.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Artifact paths</strong><ul>' + (artifactPaths.length ? artifactPaths.map((item) => '<li><code>' + escapeHtml(item) + '</code></li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Promotion metadata refs</strong><ul>' + (promotionRefs.length ? promotionRefs.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Diagnostics</strong><ul>' + (diagnostics.length ? diagnostics.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div class="meta">Raw canonical artifacts remain available below via the existing artifact viewer and governed readiness endpoints.</div>' +
    '</details>' +
    '</div>';
};

const computePlanStatus = () => {
  const plan = latestExecutionPlanPayload && latestExecutionPlanPayload.execution_plan;
  const queue = latestQueuePayload && latestQueuePayload.queue;
  const updatedState = latestUpdatedStatePayload && latestUpdatedStatePayload.updated_state;
  if (!plan || !queue) return 'missing';
  if (Array.isArray(updatedState && updatedState.summary && updatedState.summary.stale_or_superseded_repo_ids) && updatedState.summary.stale_or_superseded_repo_ids.length > 0) {
    return 'stale';
  }
  if (Array.isArray(plan.blocked_followups) && plan.blocked_followups.length > 0) return 'blocked';
  if (Array.isArray(queue.blocked_items) && queue.blocked_items.length > 0 && (!Array.isArray(queue.work_items) || queue.work_items.length === 0)) return 'blocked';
  if (Array.isArray(plan.codex_prompts) && plan.codex_prompts.length > 0) return 'ready';
  return 'idle';
};


const storyStatusOrder = ['ready', 'in_progress', 'blocked', 'proposed', 'done', 'archived'];

const renderLinkButton = (repoId, storyId, label) => '<button class="repo" data-story-repo="' + escapeHtml(repoId) + '" data-story-id="' + escapeHtml(storyId) + '">' + escapeHtml(label) + '</button>';

const attachStoryHandlers = () => {
  for (const el of document.querySelectorAll('[data-story-id]')) {
    el.onclick = async () => {
      selectedRepoId = el.getAttribute('data-story-repo');
      selectedStoryId = el.getAttribute('data-story-id');
      await loadRepoDetail();
      renderRepos();
    };
  }
};

const renderBacklogSummary = (repoId, backlog, readiness) => {
  if (!backlog || !backlog.summary) {
    backlogSummaryPanelEl.innerHTML = '<div class="empty-state">No canonical backlog artifact detected yet. Generate or promote candidate stories so planning can sit above lower-level operational detail.</div>';
    return;
  }
  const summary = backlog.summary;
  const counts = summary.counts_by_status || {};
  const highest = summary.highest_priority_ready_story;
  const blocked = Array.isArray(summary.blocked_stories) ? summary.blocked_stories : [];
  backlogSummaryPanelEl.innerHTML =
    '<div class="summary-strip">' +
    storyStatusOrder.map((status) => renderSummaryMetric(status.replace('_', ' '), String(counts[status] || 0))).join('') +
    '</div>' +
    '<div class="narrative-primary"><strong>Primary next action:</strong> ' + escapeHtml(summary.primary_next_action || 'No obvious next action yet.') + '</div>' +
    '<div class="meta"><strong>Highest-priority ready story:</strong> ' + (highest ? renderLinkButton(repoId, highest.id, highest.id + ' • ' + highest.title) : 'none') + '</div>' +
    '<div class="meta"><strong>Blocked stories:</strong> ' + (blocked.length ? blocked.map((story) => renderLinkButton(repoId, story.id, story.id)).join(' ') : 'none') + '</div>' +
    '<details class="narrative-secondary"><summary>Reasons / blockers</summary><ul>' +
    (blocked.length ? blocked.map((story) => '<li>' + escapeHtml(story.id + ': ' + (story.dependencies.length ? 'depends on ' + story.dependencies.join(', ') : 'blocked without explicit dependency list')) + '</li>').join('') : '<li>none</li>') +
    '</ul></details>' +
    '<div class="meta">Raw backlog JSON stays available via the story detail deep disclosure and artifact viewer.</div>';
  attachStoryHandlers();
};

const renderBacklogList = (repoId, backlog) => {
  const stories = backlog && Array.isArray(backlog.stories) ? backlog.stories : [];
  if (!stories.length) {
    backlogListPanelEl.innerHTML = '<div class="empty-state">No canonical stories found in .playbook/stories.json. Generate or promote candidate stories to create a planning surface before dropping into execution artifacts.</div>';
    return;
  }
  backlogListPanelEl.innerHTML = '<div><strong>Backlog list</strong><ul>' + stories.map((story) =>
    '<li>' + renderLinkButton(repoId, story.id, story.id + ' • ' + story.title) +
    '<div class="meta">status: ' + escapeHtml(story.status) + ' • priority: ' + escapeHtml(story.priority) + ' • route: ' + escapeHtml(story.suggested_route || 'n/a') + '</div></li>'
  ).join('') + '</ul></div>';
  attachStoryHandlers();
};

const renderStoryDetail = (detail) => {
  if (!detail || !detail.story) {
    storyDetailPanelEl.innerHTML = '<div class="empty-state">Select a story to inspect evidence, rationale, dependencies, lane, and suggested route.</div>';
    return;
  }
  const story = detail.story;
  const evidence = Array.isArray(detail.linked_evidence) ? detail.linked_evidence : [];
  storyDetailPanelEl.innerHTML =
    '<div class="summary-strip">' +
    renderSummaryMetric('Status', story.status) +
    renderSummaryMetric('Priority', story.priority) +
    renderSummaryMetric('Execution lane', story.execution_lane || 'n/a') +
    renderSummaryMetric('Suggested route', story.suggested_route || 'n/a') +
    '</div>' +
    '<div class="narrative-primary"><strong>' + escapeHtml(story.title) + '</strong></div>' +
    '<div><strong>Rationale:</strong> ' + escapeHtml(story.rationale || 'none') + '</div>' +
    '<div><strong>Acceptance criteria</strong><ul>' + ((story.acceptance_criteria || []).length ? story.acceptance_criteria.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Dependencies</strong><ul>' + ((story.dependencies || []).length ? story.dependencies.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Current status linkage:</strong> ' + escapeHtml((detail.linked_status && detail.linked_status.readiness_state) || 'unknown') + ' / ' + escapeHtml((detail.linked_status && detail.linked_status.lifecycle_stage) || 'unknown') + '</div>' +
    '<details class="narrative-secondary"><summary>Evidence / route</summary><div><strong>Evidence</strong><ul>' + (evidence.length ? evidence.map((item) => '<li>' + escapeHtml(item.label + ' → ' + item.artifact_path) + '</li>').join('') : '<li>none</li>') + '</ul></div><div><strong>Suggested route</strong><ul><li>' + escapeHtml((detail.linked_route && detail.linked_route.label) || story.suggested_route || 'none') + '</li></ul></div></details>' +
    '<details class="raw-truth-note"><summary>Deep/raw story artifact</summary><div><code>' + escapeHtml(detail.raw_artifact_path || '.playbook/stories.json') + '</code></div>' + format(detail) + '</details>';
};

const loadBacklog = async () => {
  if (!selectedRepoId) {
    latestBacklogPayload = null;
    backlogSummaryPanelEl.innerHTML = '<div class="empty-state">Select a repo to load backlog summary.</div>';
    backlogListPanelEl.innerHTML = '<div class="empty-state">Select a repo to load backlog list.</div>';
    renderStoryDetail(null);
    return;
  }
  const payload = await getJson('/repos/' + encodeURIComponent(selectedRepoId) + '/backlog');
  latestBacklogPayload = payload;
  renderBacklogSummary(selectedRepoId, payload.backlog, payload.readiness || null);
  renderBacklogList(selectedRepoId, payload.backlog);
  const stories = payload.backlog && Array.isArray(payload.backlog.stories) ? payload.backlog.stories : [];
  if (!selectedStoryId || !stories.find((story) => story.id === selectedStoryId)) selectedStoryId = stories[0] ? stories[0].id : null;
  if (selectedStoryId) await loadStoryDetail();
  else renderStoryDetail(null);
};

const loadStoryDetail = async () => {
  if (!selectedRepoId || !selectedStoryId) {
    latestStoryDetailPayload = null;
    renderStoryDetail(null);
    return;
  }
  latestStoryDetailPayload = await getJson('/repos/' + encodeURIComponent(selectedRepoId) + '/backlog/stories/' + encodeURIComponent(selectedStoryId));
  renderStoryDetail(latestStoryDetailPayload.detail || null);
};


const renderControlLoopSummary = () => {
  if (activeView === 'repo') {
    if (!latestRepoPayload || !latestRepoPayload.repo) {
      controlLoopSummaryPanelEl.innerHTML = '<div class="empty-state">Select a repo to summarize current state, why, and next step.</div>';
      return;
    }
    const readiness = latestRepoPayload.readiness || {};
    const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
    const promotion = latestPromotionPayload && latestPromotionPayload.promotion;
    const nextQueue = latestNextQueuePayload && latestNextQueuePayload.next_queue;
    const nextStep = Array.isArray(readiness.recommended_next_steps) && readiness.recommended_next_steps.length > 0 ? readiness.recommended_next_steps[0] : 'n/a';
    const missingArtifacts = Array.isArray(readiness.missing_artifacts) ? readiness.missing_artifacts : [];
    const planStatus = computePlanStatus();
    const pills = [
      renderSummaryPill('Promotion: ' + ((promotion && (promotion.promotion_status || (promotion.promoted ? 'promoted' : 'blocked'))) || 'unknown'), promotion && promotion.promoted ? 'good' : ((promotion && promotion.promotion_status === 'blocked') ? 'bad' : 'warn')),
      renderSummaryPill('Plan: ' + planStatus, planStatus === 'ready' ? 'good' : (planStatus === 'blocked' ? 'bad' : 'warn')),
      renderSummaryPill('New queue work: ' + (((nextQueue && Array.isArray(nextQueue.work_items) && nextQueue.work_items.length > 0) || false) ? 'yes' : 'no'), (nextQueue && Array.isArray(nextQueue.work_items) && nextQueue.work_items.length > 0) ? 'warn' : 'good')
    ];
    controlLoopSummaryPanelEl.innerHTML =
      '<div class="summary-strip">' +
      renderSummaryMetric('Current state', readiness.lifecycle_stage || readiness.readiness_state || 'unknown') +
      renderSummaryMetric('Why', describeBlocker(blockers[0]) || (missingArtifacts[0] ? 'Missing artifact: ' + missingArtifacts[0] : 'Repo truth surfaces are available for inspection.')) +
      renderSummaryMetric('Next step', describeCommandish(nextStep)) +
      '</div>' +
      '<div class="summary-pill-row">' + pills.join('') + '</div>' +
      '<details class="narrative-secondary"><summary>Secondary detail</summary>' +
      '<div><strong>Blockers</strong><ul>' + (blockers.length ? blockers.map((blocker) => '<li>' + escapeHtml(describeBlocker(blocker)) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
      '<div><strong>Reasoning</strong><ul><li>' + escapeHtml('Readiness state is derived from canonical repo adoption artifacts only.') + '</li><li>' + escapeHtml('Missing artifacts: ' + (missingArtifacts.length ? missingArtifacts.join(', ') : 'none')) + '</li></ul></div>' +
      '<div><strong>Promotion / receipt summary</strong><ul><li>' + escapeHtml((promotion && (promotion.summary || promotion.promotion_status)) || 'No fleet promotion summary available yet.') + '</li></ul></div>' +
      '<div><strong>Drift indicators</strong><ul><li>' + escapeHtml(planStatus === 'stale' ? 'Updated state contains stale or superseded repo results.' : 'No stale plan indicator for the currently loaded fleet state.') + '</li></ul></div>' +
      '</details>' +
      '<div class="meta">Deep/raw truth remains available through Artifact Detail Viewer and the readiness panels.</div>';
    return;
  }

  const fleetInterpretation = latestFleetPayload && latestFleetPayload.interpretation;
  const queueInterpretation = latestQueuePayload && latestQueuePayload.interpretation;
  const nextQueue = latestNextQueuePayload && latestNextQueuePayload.next_queue;
  const promotion = latestPromotionPayload && latestPromotionPayload.promotion;
  const queue = latestQueuePayload && latestQueuePayload.queue;
  const plan = latestExecutionPlanPayload && latestExecutionPlanPayload.execution_plan;
  if (!fleetInterpretation || !queueInterpretation || !queue || !plan) {
    controlLoopSummaryPanelEl.innerHTML = '<div class="empty-state">Fleet control-loop summary unavailable.</div>';
    return;
  }
  const fleetDefault = fleetInterpretation.progressive_disclosure.default_view || {};
  const queueDefault = queueInterpretation.progressive_disclosure.default_view || {};
  const blockers = queueInterpretation.progressive_disclosure.secondary_view && Array.isArray(queueInterpretation.progressive_disclosure.secondary_view.blockers)
    ? queueInterpretation.progressive_disclosure.secondary_view.blockers
    : [];
  const promotionStatus = (promotion && (promotion.promotion_status || (promotion.promoted ? 'promoted' : 'blocked'))) || 'unknown';
  const planStatus = computePlanStatus();
  const hasNewQueueWork = !!(nextQueue && Array.isArray(nextQueue.work_items) && nextQueue.work_items.length > 0);
  controlLoopSummaryPanelEl.innerHTML =
    '<div class="summary-strip">' +
    renderSummaryMetric('Current state', fleetDefault.state || 'unknown') +
    renderSummaryMetric('Why', queueDefault.why || fleetDefault.why || 'n/a') +
    renderSummaryMetric('Next step', (queueDefault.next_step && (queueDefault.next_step.command || queueDefault.next_step.label)) || 'n/a') +
    '</div>' +
    '<div class="summary-pill-row">' +
    renderSummaryPill('Promotion: ' + promotionStatus, promotionStatus === 'promoted' ? 'good' : (promotionStatus === 'blocked' ? 'bad' : 'warn')) +
    renderSummaryPill('Plan: ' + planStatus, planStatus === 'ready' ? 'good' : (planStatus === 'blocked' ? 'bad' : 'warn')) +
    renderSummaryPill('New queue work: ' + (hasNewQueueWork ? 'yes' : 'no'), hasNewQueueWork ? 'warn' : 'good') +
    '</div>' +
    '<details class="narrative-secondary"><summary>Secondary detail</summary>' +
    '<div><strong>Blocker list</strong><ul>' + (blockers.length ? blockers.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Reasoning</strong><ul>' +
    '<li>' + escapeHtml(fleetDefault.why || 'Fleet interpretation unavailable.') + '</li>' +
    '<li>' + escapeHtml(queueDefault.why || 'Queue interpretation unavailable.') + '</li>' +
    '<li>' + escapeHtml((promotion && (promotion.summary || promotion.blocked_reason || promotion.error_summary)) || 'No promotion summary available.') + '</li>' +
    '</ul></div>' +
    '<div><strong>Promotion / receipt summary</strong><ul><li>' + escapeHtml((promotion && (promotion.summary || promotion.promotion_status)) || 'none') + '</li><li>' + escapeHtml((latestExecutionReceiptPayload && latestExecutionReceiptPayload.receipt && latestExecutionReceiptPayload.receipt.verification_summary && ('Drift count: ' + (latestExecutionReceiptPayload.receipt.verification_summary.mismatch_count || 0))) || 'Receipt summary unavailable') + '</li></ul></div>' +
    '<div><strong>Drift indicators</strong><ul><li>' + escapeHtml(planStatus === 'stale' ? 'Updated state reports stale or superseded work.' : 'No stale-plan signal from updated state.') + '</li></ul></div>' +
    '</details>' +
    '<div class="meta">Deep/raw truth remains available through each readiness panel and the existing artifact detail viewer.</div>';
};

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
  latestBacklogPayload = latestRepoPayload.backlog ? { backlog: latestRepoPayload.backlog, readiness: latestRepoPayload.readiness } : null;
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
    '<div class="meta">Raw repo JSON remains available in the Artifact Detail Viewer and repo API payloads; the repo view now stays story-first.</div>';
  removeRepoEl.style.display = '';
  await loadArtifact();
  await loadBlueprint();
  await loadBacklog();
  renderControlLoopSummary();
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



const renderFleetSummary = (fleet, interpretation) => {
  if (!fleet || typeof fleet !== 'object') {
    fleetSummaryPanelEl.innerHTML = '<div class="empty-state">Fleet summary unavailable.</div>';
    return;
  }

  const blockerRows = Array.isArray(fleet.blocker_frequencies) ? fleet.blocker_frequencies.slice(0, 5).map((entry) =>
    '<li>' + escapeHtml(entry.blocker_code + ': ' + entry.count) + '</li>'
  ).join('') : '';
  const actionRows = Array.isArray(fleet.recommended_actions) ? fleet.recommended_actions.slice(0, 5).map((entry) =>
    '<li>' + escapeHtml(entry.command + ' (' + entry.count + ')') + '</li>'
  ).join('') : '';
  const topRepos = Array.isArray(fleet.repos_by_priority) ? fleet.repos_by_priority.slice(0, 5).map((entry) =>
    '<li>' + escapeHtml(entry.repo_id + ' • ' + entry.priority_stage + ' • ' + (entry.next_action || 'n/a')) + '</li>'
  ).join('') : '';

  fleetSummaryPanelEl.innerHTML =
    renderInterpretation(interpretation) +    '<div><strong>Total repos:</strong> ' + escapeHtml(String(fleet.total_repos || 0)) + '</div>' +
    '<div><strong>Lifecycle counts:</strong> ' + escapeHtml(JSON.stringify(fleet.by_lifecycle_stage || {})) + '</div>' +
    '<div><strong>Fallback-proof ready:</strong> ' + escapeHtml(String(fleet.fallback_proof_ready_count || 0)) + '</div>' +
    '<div><strong>Cross-repo eligible:</strong> ' + escapeHtml(String(fleet.cross_repo_eligible_count || 0)) + '</div>' +
    '<div><strong>Top blockers</strong><ul>' + (blockerRows || '<li>none</li>') + '</ul></div>' +
    '<div><strong>Top actions</strong><ul>' + (actionRows || '<li>none</li>') + '</ul></div>' +
    '<div><strong>Repos by priority</strong><ul>' + (topRepos || '<li>none</li>') + '</ul></div>';
};

const loadFleetSummary = async () => {
  const payload = await getJson('/api/readiness/fleet');
  latestFleetPayload = payload;
  renderFleetSummary(payload.fleet || null, payload.interpretation || null);
  renderControlLoopSummary();
};




const renderPromotionSummary = (promotion) => {
  if (!promotion || typeof promotion !== 'object') {
    promotionPanelEl.innerHTML = '<div class="empty-state">Promotion state unavailable.</div>';
    return;
  }

  const stagedCandidates = promotion.candidate_artifact_path ? 1 : 0;
  const affectedArtifacts = [promotion.candidate_artifact_path, promotion.committed_target_path].filter(Boolean);
  const resultLabel = promotion.promoted ? 'promoted' : (promotion.promotion_status || 'blocked');
  const validationLabel = promotion.validation_status || (promotion.validation_passed ? 'passed' : 'blocked');
  const blockedReason = promotion.blocked_reason || promotion.error_summary || 'none';

  promotionPanelEl.innerHTML =
    '<div><strong>Last promotion result:</strong> ' + escapeHtml(resultLabel) + '</div>' +
    '<div><strong>Validated:</strong> ' + escapeHtml(validationLabel) + '</div>' +
    '<div><strong>Committed state:</strong> ' + escapeHtml(promotion.committed_state_preserved ? 'preserved / source of truth' : 'mutated') + '</div>' +
    '<div><strong>Staged candidates:</strong> ' + escapeHtml(String(stagedCandidates)) + '</div>' +
    '<div><strong>Candidate artifact:</strong> ' + escapeHtml(promotion.candidate_artifact_path || 'none') + '</div>' +
    '<div><strong>Committed artifact:</strong> ' + escapeHtml(promotion.committed_target_path || 'none') + '</div>' +
    '<div><strong>Blocked reason:</strong> ' + escapeHtml(blockedReason) + '</div>' +
    '<div><strong>Affected artifacts</strong><ul>' + (affectedArtifacts.length > 0 ? affectedArtifacts.map((artifact) => '<li><code>' + escapeHtml(artifact) + '</code></li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Summary:</strong> ' + escapeHtml(promotion.summary || 'none') + '</div>';
};

const loadPromotionSummary = async () => {
  const payload = await getJson('/api/readiness/promotion');
  latestPromotionPayload = payload;
  renderPromotionSummary(payload.promotion || null);
  renderControlLoopSummary();
};

const renderExecutionReceiptSummary = (receipt, interpretation) => {
  if (!receipt || typeof receipt !== 'object') {
    executionReceiptPanelEl.innerHTML = '<div class="empty-state">Execution outcome receipt unavailable.</div>';
    return;
  }

  const latestWave = Array.isArray(receipt.wave_results) && receipt.wave_results.length > 0 ? receipt.wave_results[receipt.wave_results.length - 1] : null;
  const summary = receipt.verification_summary || {};
  executionReceiptPanelEl.innerHTML =
    renderInterpretation(interpretation) +    '<div><strong>Latest wave result:</strong> ' + escapeHtml(latestWave ? latestWave.wave_id + ' • ' + latestWave.status : 'none') + '</div>' +
    '<div><strong>Completed prompts:</strong> ' + escapeHtml(String(summary.succeeded_count || 0)) + '</div>' +
    '<div><strong>Failed prompts:</strong> ' + escapeHtml(String((summary.failed_count || 0) + (summary.mismatch_count || 0))) + '</div>' +
    '<div><strong>Repos needing retry:</strong> ' + escapeHtml(Array.isArray(summary.repos_needing_retry) && summary.repos_needing_retry.length > 0 ? summary.repos_needing_retry.join(', ') : 'none') + '</div>' +
    '<div><strong>Planned vs actual drift:</strong> ' + escapeHtml(String((summary.planned_vs_actual_drift || []).length || 0)) + '</div>';
};

const loadExecutionReceipt = async () => {
  const payload = await getJson('/api/readiness/receipt');
  latestExecutionReceiptPayload = payload;
  renderExecutionReceiptSummary(payload.receipt || null, payload.interpretation || null);
  renderPromotionSummary((payload.receipt && payload.receipt.workflow_promotion) || payload.promotion || null);
  renderControlLoopSummary();
};


const renderUpdatedStateSummary = (updatedState, interpretation) => {
  if (!updatedState || typeof updatedState !== 'object') {
    updatedStatePanelEl.innerHTML = '<div class="empty-state">Reconciled updated state unavailable.</div>';
    return;
  }

  const summary = updatedState.summary || {};
  const statusCounts = summary.by_reconciliation_status || {};
  const actionCounts = summary.action_counts || {};
  updatedStatePanelEl.innerHTML =
    renderInterpretation(interpretation) +    '<div><strong>Repos total:</strong> ' + escapeHtml(String(summary.repos_total || 0)) + '</div>' +
    '<div><strong>What happened (completed):</strong> ' + escapeHtml(Array.isArray(summary.completed_repo_ids) && summary.completed_repo_ids.length > 0 ? summary.completed_repo_ids.join(', ') : 'none') + '</div>' +
    '<div><strong>What happened (blocked):</strong> ' + escapeHtml(Array.isArray(summary.blocked_repo_ids) && summary.blocked_repo_ids.length > 0 ? summary.blocked_repo_ids.join(', ') : 'none') + '</div>' +
    '<div><strong>What happened (stale/superseded):</strong> ' + escapeHtml(Array.isArray(summary.stale_or_superseded_repo_ids) && summary.stale_or_superseded_repo_ids.length > 0 ? summary.stale_or_superseded_repo_ids.join(', ') : 'none') + '</div>' +
    '<div><strong>Observed outcome counts:</strong> ' + escapeHtml(JSON.stringify(statusCounts)) + '</div>' +
    '<div><strong>Action counts:</strong> ' + escapeHtml(JSON.stringify(actionCounts)) + '</div>' +
    '<div><strong>Needs retry:</strong> ' + escapeHtml(Array.isArray(summary.repos_needing_retry) && summary.repos_needing_retry.length > 0 ? summary.repos_needing_retry.join(', ') : 'none') + '</div>' +
    '<div><strong>Needs replan:</strong> ' + escapeHtml(Array.isArray(summary.repos_needing_replan) && summary.repos_needing_replan.length > 0 ? summary.repos_needing_replan.join(', ') : 'none') + '</div>' +
    '<div><strong>Needs review:</strong> ' + escapeHtml(Array.isArray(summary.repos_needing_review) && summary.repos_needing_review.length > 0 ? summary.repos_needing_review.join(', ') : 'none') + '</div>';
};

const loadUpdatedState = async () => {
  const payload = await getJson('/api/readiness/updated-state');
  latestUpdatedStatePayload = payload;
  renderUpdatedStateSummary(payload.updated_state || null, payload.interpretation || null);
  renderControlLoopSummary();
};

const renderNextQueueSummary = (queue, interpretation) => {
  if (!queue || typeof queue !== 'object') {
    nextQueuePanelEl.innerHTML = '<div class="empty-state">Next queue unavailable.</div>';
    return;
  }

  const topActions = Array.isArray(queue.work_items) ? queue.work_items.slice(0, 5) : [];
  nextQueuePanelEl.innerHTML =
    renderInterpretation(interpretation) +    '<div><strong>Queue source:</strong> ' + escapeHtml(queue.queue_source || 'unknown') + '</div>' +
    '<div><strong>Next items:</strong> ' + escapeHtml(String(topActions.length ? (queue.work_items || []).length : 0)) + '</div>' +
    '<div><strong>Top actions</strong><ul>' + (topActions.length > 0 ? topActions.map((item) => '<li>' + escapeHtml(item.repo_id + ' • ' + (item.next_action || 'n/a') + ' • ' + item.recommended_command + ' • lineage ' + ((item.prompt_lineage || []).join(', ') || 'none')) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Wave breakdown</strong><ul>' + (Array.isArray(queue.waves) ? queue.waves.map((wave) => '<li>' + escapeHtml(wave.wave + ': ' + wave.action_count + ' actions') + '</li>').join('') : '<li>none</li>') + '</ul></div>';
};

const loadNextQueueSummary = async () => {
  const payload = await getJson('/api/readiness/next-queue');
  latestNextQueuePayload = payload;
  renderNextQueueSummary(payload.next_queue || null, payload.interpretation || null);
  renderControlLoopSummary();
};

const renderQueueSummary = (queue, interpretation) => {
  if (!queue || typeof queue !== 'object') {
    queueSummaryPanelEl.innerHTML = '<div class="empty-state">Work queue unavailable.</div>';
    return;
  }

  const waveRows = Array.isArray(queue.waves) ? queue.waves.map((wave) =>
    '<li>' + escapeHtml(wave.wave + ': ' + wave.action_count + ' actions') + '</li>'
  ).join('') : '';
  const laneRows = Array.isArray(queue.grouped_actions) ? queue.grouped_actions.slice(0, 5).map((lane) =>
    '<li>' + escapeHtml(lane.parallel_group + ' • ' + lane.command + ' (' + lane.repo_ids.length + ')') + '</li>'
  ).join('') : '';
  const blockedRows = Array.isArray(queue.blocked_items) ? queue.blocked_items.slice(0, 5).map((item) =>
    '<li>' + escapeHtml(item.repo_id + ' • ' + item.item_id + ' <= ' + item.unmet_dependencies.join(', ')) + '</li>'
  ).join('') : '';

  queueSummaryPanelEl.innerHTML =
    renderInterpretation(interpretation) +    '<div><strong>Total repos:</strong> ' + escapeHtml(String(queue.total_repos || 0)) + '</div>' +
    '<div><strong>Total work items:</strong> ' + escapeHtml(String((queue.work_items || []).length || 0)) + '</div>' +
    '<div><strong>Highest priority actions</strong><ul>' + (Array.isArray(queue.work_items) && queue.work_items.length > 0 ? queue.work_items.slice(0, 5).map((item) => '<li>' + escapeHtml(item.repo_id + ' • ' + item.recommended_command) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<div><strong>Wave breakdown</strong><ul>' + (waveRows || '<li>none</li>') + '</ul></div>' +
    '<div><strong>Grouped action lanes</strong><ul>' + (laneRows || '<li>none</li>') + '</ul></div>' +
    '<div><strong>Top blocked repos</strong><ul>' + (blockedRows || '<li>none</li>') + '</ul></div>';
};

const loadQueueSummary = async () => {
  const payload = await getJson('/api/readiness/queue');
  latestQueuePayload = payload;
  renderQueueSummary(payload.queue || null, payload.interpretation || null);
  renderControlLoopSummary();
};



const renderExecutionPlanSummary = (plan, interpretation) => {
  if (!plan || typeof plan !== 'object') {
    executionPlanPanelEl.innerHTML = '<div class="empty-state">Execution plan unavailable.</div>';
    return;
  }

  const wave1 = Array.isArray(plan.waves) ? plan.waves.find((wave) => wave.wave_id === 'wave_1') : null;
  const wave2 = Array.isArray(plan.waves) ? plan.waves.find((wave) => wave.wave_id === 'wave_2') : null;
  const laneRows = Array.isArray(plan.worker_lanes) ? plan.worker_lanes.slice(0, 6).map((lane) =>
    '<li>' + escapeHtml(lane.lane_id + ' • ' + lane.recommended_command_family + ' (' + (lane.repo_ids || []).length + ')') + '</li>'
  ).join('') : '';
  const promptRows = Array.isArray(plan.codex_prompts) ? plan.codex_prompts.slice(0, 4).map((prompt) =>
    '<li>' + escapeHtml(prompt.prompt_id + ' • ' + prompt.repo_id + ' • ' + prompt.lane_id) + '</li>'
  ).join('') : '';

  executionPlanPanelEl.innerHTML =
    renderInterpretation(interpretation) +    '<div><strong>Wave 1 repos:</strong> ' + escapeHtml(String((wave1 && wave1.repos && wave1.repos.length) || 0)) + '</div>' +
    '<div><strong>Wave 2 repos:</strong> ' + escapeHtml(String((wave2 && wave2.repos && wave2.repos.length) || 0)) + '</div>' +
    '<div><strong>Worker lanes</strong><ul>' + (laneRows || '<li>none</li>') + '</ul></div>' +
    '<div><strong>Top Codex prompts</strong><ul>' + (promptRows || '<li>none</li>') + '</ul></div>';
};

const loadExecutionPlanSummary = async () => {
  const payload = await getJson('/api/readiness/execute');
  latestExecutionPlanPayload = payload;
  renderExecutionPlanSummary(payload.execution_plan || null, payload.interpretation || null);
  renderControlLoopSummary();
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
  renderControlLoopSummary();
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

const renderCrossRepoGroup = (group) => {
  const patterns = toArray(group.patterns).slice(0, 4);
  const evidence = toArray(group.top_evidence).slice(0, 3);
  return '<div class="cross-repo-item">' +
    '<div class="summary-strip">' +
    renderSummaryMetric('Pattern kind', group.kind || 'unknown') +
    renderSummaryMetric('Candidates', String(group.candidate_count || 0)) +
    renderSummaryMetric('Affected repos', String(group.affected_repo_count || 0)) +
    '</div>' +
    '<div class="narrative-primary"><strong>Primary next action:</strong> ' + escapeHtml(group.primary_next_action || 'Inspect evidence and decide whether to promote a portable pattern.') + '</div>' +
    '<div class="meta"><strong>Repos:</strong> ' + escapeHtml(toArray(group.affected_repos).join(', ') || 'none') + '</div>' +
    '<div><strong>Top evidence</strong><ul>' + (evidence.length ? evidence.map((item) => '<li>' + escapeHtml(describeEvidence(item)) + '</li>').join('') : '<li>none</li>') + '</ul></div>' +
    '<details class="narrative-secondary"><summary>Pattern rows</summary><ul>' + (patterns.length ? patterns.map((pattern) => '<li>' + escapeHtml(pattern.id + ' • ' + pattern.title + ' • score ' + pattern.portability_score + ' • repos ' + toArray(pattern.supporting_repos).join(', ')) + '</li>').join('') : '<li>none</li>') + '</ul></details>' +
    '</div>';
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
  const candidateGroups = toArray(payload.candidate_groups || summary.candidate_groups);
  const deepDisclosure = payload.deep_disclosure || {};

  if (summary.candidate_count !== undefined) {
    crossRepoPanelEl.innerHTML = '<div class="cross-repo-list">' +
      '<div class="cross-repo-item"><div class="summary-strip">' +
      renderSummaryMetric('Source repos', String(toArray(summary.source_repos).length)) +
      renderSummaryMetric('Comparisons', String(summary.comparison_count || 0)) +
      renderSummaryMetric('Candidate patterns', String(summary.candidate_count || 0)) +
      '</div><div class="narrative-primary"><strong>Primary next action:</strong> ' + escapeHtml(summary.primary_next_action || 'Inspect the strongest portable pattern group.') + '</div><div class="meta"><strong>Repos:</strong> ' + escapeHtml(toArray(summary.source_repos).map((repo) => repo.repo_id || repo).join(', ')) + '</div></div>' +
      candidateGroups.map(renderCrossRepoGroup).join('') +
      '</div>';
    return;
  }

  const sections = [];
  if (candidateGroups.length > 0) {
    sections.push('<div class="cross-repo-item"><strong>Candidate portable patterns</strong><div class="meta">Signal-first grouped view; raw pairwise comparisons remain in deep disclosure.</div></div>');
    for (const group of candidateGroups) sections.push(renderCrossRepoGroup(group));
  }
  if (comparison) {
    sections.push('<details class="cross-repo-item raw-truth-note"><summary>Deep disclosure: pairwise repo delta</summary><div class="meta">' + escapeHtml((comparison.left_repo_id || '?') + ' vs ' + (comparison.right_repo_id || '?')) + '</div>' + format(repoDelta) + '</details>');
    const evidence = [];
    for (const item of repoDelta) {
      const leftEvidence = Array.isArray(item.left_evidence) ? item.left_evidence : [];
      for (const entry of leftEvidence) evidence.push(renderEvidenceRow(comparison.left_repo_id, entry));
      const rightEvidence = Array.isArray(item.right_evidence) ? item.right_evidence : [];
      for (const entry of rightEvidence) evidence.push(renderEvidenceRow(comparison.right_repo_id, entry));
    }
    if (evidence.length > 0) {
      sections.push('<details class="cross-repo-item raw-truth-note"><summary>Deep disclosure: evidence drilldown</summary><ul>' + evidence.join('') + '</ul></details>');
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
    sections.push('<details class="cross-repo-item raw-truth-note"><summary>Deep disclosure: raw candidate evidence rows</summary>' + (rows.length ? '<ul>' + rows.join('') + '</ul>' : '<div class="meta">No evidence rows available.</div>') + '</details>');
  }

  if (deepDisclosure.raw_artifact_path) {
    sections.push('<div class="meta">Raw cross-repo truth remains available at <code>' + escapeHtml(deepDisclosure.raw_artifact_path) + '</code>.</div>');
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
  renderCrossRepoEvidence({
    summary: summaryPayload.summary,
    candidate_groups: candidatePayload.candidate_groups,
    candidates: candidatePayload.candidates,
    deep_disclosure: candidatePayload.deep_disclosure
  });
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
    await loadFleetSummary();
    await loadQueueSummary();
    await loadExecutionReceipt();
    await loadPromotionSummary();
    await loadUpdatedState();
    await loadNextQueueSummary();
    await loadExecutionPlanSummary();
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
