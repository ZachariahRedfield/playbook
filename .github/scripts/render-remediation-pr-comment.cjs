const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MARKER = '<!-- playbook:ci-remediation-comment -->';

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toBulletList(values, empty = '- (none)') {
  if (!Array.isArray(values) || values.length === 0) return [empty];
  return values.map((value) => `- ${value}`);
}

function formatArtifacts(paths) {
  const entries = Object.entries(paths)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return ['- (none)'];
  return entries.map(([key, value]) => `- \`${key}\`: \`${value}\``);
}

function summarizeConfidenceReasoning(values) {
  if (!Array.isArray(values) || values.length === 0) return '(none)';
  return values.slice(0, 3).join('; ');
}

function renderRemediationComment({ policy, autofix, remediationStatus, marker = DEFAULT_MARKER }) {
  const effectiveStatus = policy?.status === 'blocked_by_policy'
    ? 'blocked_by_policy'
    : autofix?.final_status ?? 'not_run';
  const retryDecision = autofix?.retry_policy_decision ?? remediationStatus?.latest_run?.retry_policy_decision ?? 'not_run';
  const preferredRepairClass = autofix?.preferred_repair_class ?? remediationStatus?.latest_run?.preferred_repair_class ?? null;
  const appliedTaskIds = Array.isArray(autofix?.applied_task_ids) ? autofix.applied_task_ids : [];
  const blockedFindings = remediationStatus?.blocked_signatures ?? [];
  const reviewRequiredFindings = remediationStatus?.review_required_signatures ?? [];
  const stopReasons = Array.isArray(autofix?.stop_reasons) ? autofix.stop_reasons : [];
  const policyReasons = Array.isArray(policy?.reasons) ? policy.reasons : [];
  const boundedActionSummary = autofix
    ? [
        `mode=${autofix.mode}`,
        `would_apply=${autofix.would_apply ? 'yes' : 'no'}`,
        `apply attempted=${autofix.apply_result?.attempted ? 'yes' : 'no'}`,
        `apply ok=${autofix.apply_result?.ok ? 'yes' : 'no'}`,
        `verification attempted=${autofix.verification_result?.attempted ? 'yes' : 'no'}`,
        `verification ok=${autofix.verification_result?.ok ? 'yes' : 'no'}`,
      ]
    : ['not_run'];

  const artifactPaths = {
    failure_log: policy?.artifact_paths?.failure_log_path,
    policy: policy?.artifact_paths?.policy_path,
    triage: autofix?.source_triage?.path ?? policy?.artifact_paths?.triage_path,
    fix_plan: autofix?.source_fix_plan?.path ?? policy?.artifact_paths?.fix_plan_path,
    apply: autofix?.source_apply?.path ?? policy?.artifact_paths?.apply_path,
    autofix_result: policy?.artifact_paths?.autofix_result_path ?? '.playbook/test-autofix.json',
    remediation_status: policy?.artifact_paths?.remediation_status_path ?? '.playbook/remediation-status.json',
    remediation_history: autofix?.remediation_history_path ?? policy?.artifact_paths?.remediation_history_path,
    remediation_comment: policy?.artifact_paths?.remediation_comment_path,
  };

  const attemptBudget = policy?.gating?.max_autofix_attempts_per_sha;
  const runAttempt = policy?.gating?.run_attempt;
  const retryOverrideSource = policy?.gating?.retry_override_source ?? 'none';
  const retryOverrideUsed = Boolean(policy?.gating?.retry_override_used);

  const lines = [
    marker,
    '## Playbook CI Remediation',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Final status | ${effectiveStatus} |`,
    `| Retry policy decision | ${retryDecision} |`,
    `| Preferred repair class | ${preferredRepairClass ?? '(none)'} |`,
    `| Mode | ${autofix?.mode ?? remediationStatus?.latest_run?.mode ?? 'not_run'} |`,
    `| Mutation gate | ${policy?.mutation_allowed ? 'allowed' : 'blocked'} |`,
    `| Retry override | ${retryOverrideUsed ? retryOverrideSource : 'not_used'} |`,
    `| Attempt budget | ${runAttempt != null && attemptBudget != null ? `${runAttempt}/${attemptBudget}` : '(not available)'} |`,
    `| Autofix confidence | ${typeof autofix?.autofix_confidence === 'number' ? autofix.autofix_confidence.toFixed(2) : '(not available)'} |`,
    `| Confidence threshold | ${typeof autofix?.confidence_threshold === 'number' ? autofix.confidence_threshold.toFixed(2) : '(not available)'} |`,
    `| Low-confidence skip | ${effectiveStatus === 'blocked_low_confidence' ? 'yes' : 'no'} |`,
    `| Confidence reasoning | ${summarizeConfidenceReasoning(autofix?.confidence_reasoning)} |`,
  ];

  lines.push('', '### Bounded action summary', ...toBulletList(boundedActionSummary));
  lines.push('', '### Applied task ids', ...toBulletList(appliedTaskIds));
  lines.push('', '### Blocked findings', ...toBulletList(blockedFindings));
  lines.push('', '### Review-required findings', ...toBulletList(reviewRequiredFindings));
  lines.push('', '### Stop / policy reasons', ...toBulletList([...stopReasons, ...policyReasons]));
  lines.push('', '### Artifact references', ...formatArtifacts(artifactPaths));

  return `${lines.join('\n').trimEnd()}\n`;
}

function parseArgs(argv) {
  const options = {
    marker: DEFAULT_MARKER,
    policy: '.playbook/ci-remediation-policy.json',
    autofix: '.playbook/test-autofix.json',
    remediationStatus: '.playbook/remediation-status.json',
    out: '.playbook/remediation-comment.md',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--marker' && next) {
      options.marker = next;
      index += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      index += 1;
    } else if (token === '--autofix' && next) {
      options.autofix = next;
      index += 1;
    } else if (token === '--remediation-status' && next) {
      options.remediationStatus = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    }
  }

  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const payload = {
    policy: readJsonIfExists(path.resolve(process.cwd(), options.policy)),
    autofix: readJsonIfExists(path.resolve(process.cwd(), options.autofix)),
    remediationStatus: readJsonIfExists(path.resolve(process.cwd(), options.remediationStatus)),
    marker: options.marker,
  };
  const body = renderRemediationComment(payload);
  const outPath = path.resolve(process.cwd(), options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, 'utf8');
  process.stdout.write(body);
}

module.exports = {
  DEFAULT_MARKER,
  renderRemediationComment,
  readJsonIfExists,
};
