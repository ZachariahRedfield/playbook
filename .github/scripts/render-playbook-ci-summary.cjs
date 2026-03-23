const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_COMMENT_MARKER = '<!-- playbook:ci-summary -->';
const PROTECTED_DOC_RULE_PREFIX = 'protected-doc.';

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim()))].sort((left, right) => left.localeCompare(right));
}

function toInlineList(values, fallback = '(none)') {
  return Array.isArray(values) && values.length > 0 ? values.join(', ') : fallback;
}

function truncate(values, limit) {
  return Array.isArray(values) ? values.slice(0, limit) : [];
}

function bumpVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) return String(version ?? '(unknown)');
  const major = Number.parseInt(match[1] ?? '0', 10);
  const minor = Number.parseInt(match[2] ?? '0', 10);
  const patch = Number.parseInt(match[3] ?? '0', 10);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  return String(version);
}

function formatAffectedRelease(plan, affectedPackages, affectedGroups) {
  if (affectedGroups.length > 0) {
    return affectedGroups.map((group) => `${group.name} (${group.packages.join(', ')})`);
  }
  return affectedPackages.map((pkg) => pkg.name);
}

function buildReleaseSummary(plan) {
  if (!plan || typeof plan !== 'object') return null;

  const packages = Array.isArray(plan.packages) ? plan.packages : [];
  const versionGroups = Array.isArray(plan.versionGroups) ? plan.versionGroups : [];
  const recommendedBump = plan.summary?.recommendedBump ?? 'none';
  const affectedPackages = packages.filter((pkg) => pkg?.recommendedBump && pkg.recommendedBump !== 'none');
  const affectedGroups = versionGroups.filter((group) => group?.recommendedBump && group.recommendedBump !== 'none');
  const currentVersionSource = affectedPackages.length > 0 ? affectedPackages : packages;
  const currentVersions = unique(currentVersionSource.map((pkg) => pkg?.currentVersion));
  const nextVersions = unique(affectedPackages.map((pkg) => bumpVersion(pkg.currentVersion, pkg.recommendedBump)));

  return {
    decision: recommendedBump === 'none' ? 'none' : 'plan_only',
    status: recommendedBump === 'none' ? 'no release-relevant diff' : 'release plan ready',
    currentVersion: toInlineList(currentVersions),
    recommendedBump,
    nextVersion: toInlineList(nextVersions),
    affected: toInlineList(formatAffectedRelease(plan, affectedPackages, affectedGroups)),
    nextAction: recommendedBump === 'none'
      ? 'No version mutation required in normal PR CI; keep `pnpm playbook verify --json` as the merge gate.'
      : 'Review `.playbook/release-plan.json`; apply only through `pnpm playbook apply --from-plan .playbook/release-plan.json` in a reviewed boundary.',
  };
}

function parseEvidenceString(evidence) {
  if (typeof evidence !== 'string' || evidence.trim().length === 0) return {};
  const result = {};
  const keys = ['decision', 'status', 'affected_surfaces', 'blockers', 'next_action'];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const nextKey = keys[index + 1];
    const pattern = new RegExp(`${key}=(.*?)(?:; ${nextKey}=|$)`);
    const match = evidence.match(pattern);
    if (match) result[key] = match[1].trim();
  }
  return result;
}

function parseList(value) {
  if (typeof value !== 'string' || value === 'none') return [];
  return unique(value.split(',').map((entry) => entry.trim()));
}

function buildMergeGuardSummary(verifyPayload) {
  const findings = Array.isArray(verifyPayload?.findings) ? verifyPayload.findings : [];
  const mergeGuardFindings = findings.filter((finding) => typeof finding?.id === 'string' && finding.id.startsWith(PROTECTED_DOC_RULE_PREFIX));
  if (mergeGuardFindings.length === 0) return null;

  const parsedEvidence = mergeGuardFindings.map((finding) => parseEvidenceString(finding.evidence));
  return {
    decision: toInlineList(unique(parsedEvidence.map((entry) => entry.decision).filter(Boolean)), verifyPayload?.ok ? 'pass' : 'fail_closed'),
    status: toInlineList(unique(parsedEvidence.map((entry) => entry.status).filter(Boolean)), verifyPayload?.ok ? 'clear' : 'merge guard blocked'),
    blockers: unique(parsedEvidence.flatMap((entry) => parseList(entry.blockers))),
    nextActions: unique(parsedEvidence.map((entry) => entry.next_action).filter(Boolean)),
  };
}

function buildVerifySummary(verifyPayload) {
  if (!verifyPayload || typeof verifyPayload !== 'object') return null;
  const findings = Array.isArray(verifyPayload.findings) ? verifyPayload.findings : [];
  const blockers = truncate(findings.filter((finding) => ['error', 'failure'].includes(finding?.level)).map((finding) => {
    const id = typeof finding?.id === 'string' ? finding.id : 'verify.finding';
    const message = typeof finding?.message === 'string' && finding.message.trim().length > 0 ? finding.message.trim() : 'verify finding requires review';
    return `${id}: ${message}`;
  }), 5);
  const nextActions = truncate(Array.isArray(verifyPayload.nextActions) ? verifyPayload.nextActions : [], 3);

  return {
    decision: verifyPayload.ok ? 'pass' : 'fail_closed',
    status: verifyPayload.ok ? 'verify passed' : 'verify blockers present',
    blockers,
    nextAction: nextActions[0] ?? (verifyPayload.ok ? 'No action required.' : 'Inspect `.playbook/verify.json` and address blocking findings before merge.'),
    remainingActions: nextActions.slice(1),
  };
}

function buildRemediationSummary({ failureSummary, remediationPolicy, remediationStatus }) {
  if (!failureSummary || typeof failureSummary !== 'object') return null;

  const recommendedChecks = truncate(Array.isArray(failureSummary.recommendedNextChecks) ? failureSummary.recommendedNextChecks : [], 3);
  const blockedSignatures = truncate(Array.isArray(remediationStatus?.blocked_signatures) ? remediationStatus.blocked_signatures : [], 3);
  const reviewRequiredSignatures = truncate(Array.isArray(remediationStatus?.review_required_signatures) ? remediationStatus.review_required_signatures : [], 3);
  const latestRun = remediationStatus?.latest_run && typeof remediationStatus.latest_run === 'object' ? remediationStatus.latest_run : null;

  let decision = remediationPolicy?.status ?? 'test_failed';
  let status = latestRun?.final_status ?? failureSummary.status ?? 'failed';
  if (remediationPolicy?.status === 'blocked_by_policy') {
    status = 'remediation blocked by policy';
  } else if (latestRun?.final_status) {
    status = latestRun.final_status;
  }

  const nextAction = latestRun?.next_action
    ?? (Array.isArray(remediationStatus?.next_actions) && remediationStatus.next_actions[0])
    ?? recommendedChecks[0]
    ?? 'Inspect `.playbook/failure-summary.json` and `.playbook/ci-remediation-policy.json` before retrying.';

  return {
    decision,
    status,
    failureClass: failureSummary.primaryFailureClass ?? '(unknown)',
    summary: failureSummary.summary ?? '(summary unavailable)',
    mode: latestRun?.mode ?? remediationPolicy?.mode ?? 'not_run',
    retryDecision: latestRun?.retry_policy_decision ?? 'not_run',
    blockedSignatures,
    reviewRequiredSignatures,
    nextAction,
  };
}

function buildOverallSummary({ verifySummary, releaseSummary, remediationSummary, mergeGuardSummary }) {
  if (remediationSummary) {
    if (remediationSummary.decision === 'blocked_by_policy') {
      return { decision: 'fail', status: 'tests failed; remediation blocked by policy' };
    }
    return { decision: 'fail', status: `tests failed; remediation ${remediationSummary.status}` };
  }
  if (verifySummary && verifySummary.decision !== 'pass') {
    return { decision: 'fail', status: verifySummary.status };
  }
  if (mergeGuardSummary && mergeGuardSummary.decision !== 'pass') {
    return { decision: 'fail', status: mergeGuardSummary.status };
  }
  if (releaseSummary && releaseSummary.decision !== 'none') {
    return { decision: 'pass_with_release_plan', status: releaseSummary.status };
  }
  return { decision: 'pass', status: 'verify passed' };
}

function buildCiSummary(artifacts) {
  const verifySummary = buildVerifySummary(artifacts.verify);
  const releaseSummary = buildReleaseSummary(artifacts.releasePlan);
  const mergeGuardSummary = buildMergeGuardSummary(artifacts.verify);
  const remediationSummary = buildRemediationSummary({
    failureSummary: artifacts.failureSummary,
    remediationPolicy: artifacts.remediationPolicy,
    remediationStatus: artifacts.remediationStatus,
  });
  const overall = buildOverallSummary({ verifySummary, releaseSummary, remediationSummary, mergeGuardSummary });

  return {
    overall,
    verify: verifySummary,
    mergeGuard: mergeGuardSummary,
    release: releaseSummary,
    remediation: remediationSummary,
    artifacts: {
      verify: '.playbook/verify.json',
      releasePlan: '.playbook/release-plan.json',
      remediationPolicy: '.playbook/ci-remediation-policy.json',
      failureSummary: '.playbook/failure-summary.json',
      remediationStatus: '.playbook/remediation-status.json',
    },
  };
}

function pushSection(lines, title, rows, artifactPath) {
  lines.push(`### ${title}`, '', '| Field | Value |', '| --- | --- |');
  for (const [field, value] of rows) {
    lines.push(`| ${field} | ${value} |`);
  }
  if (artifactPath) lines.push('', `Artifact: \`${artifactPath}\`.`);
  lines.push('');
}

function renderMarkdown(summary, { marker, title }) {
  const lines = [];
  if (marker) lines.push(marker);
  lines.push(`## ${title}`, '');

  pushSection(lines, 'Overall', [
    ['Decision / status', `${summary.overall.decision} / ${summary.overall.status}`],
  ]);

  if (summary.verify) {
    pushSection(lines, 'Verify', [
      ['Decision / status', `${summary.verify.decision} / ${summary.verify.status}`],
      ['Blockers', toInlineList(summary.verify.blockers)],
      ['Next action', summary.verify.nextAction],
    ], summary.artifacts.verify);
  }

  if (summary.mergeGuard) {
    pushSection(lines, 'Merge guard', [
      ['Decision / status', `${summary.mergeGuard.decision} / ${summary.mergeGuard.status}`],
      ['Blockers', toInlineList(summary.mergeGuard.blockers)],
      ['Next action', toInlineList(summary.mergeGuard.nextActions)],
    ], summary.artifacts.verify);
  }

  if (summary.release) {
    pushSection(lines, 'Release bump', [
      ['Decision / status', `${summary.release.decision} / ${summary.release.status}`],
      ['Recommended bump', summary.release.recommendedBump],
      ['Next version', summary.release.nextVersion],
      ['Affected packages / version group', summary.release.affected],
      ['Next action', summary.release.nextAction],
    ], summary.artifacts.releasePlan);
  }

  if (summary.remediation) {
    pushSection(lines, 'Remediation', [
      ['Decision / status', `${summary.remediation.decision} / ${summary.remediation.status}`],
      ['Primary failure class', summary.remediation.failureClass],
      ['Summary', summary.remediation.summary],
      ['Mode / retry policy', `${summary.remediation.mode} / ${summary.remediation.retryDecision}`],
      ['Blocked signatures', toInlineList(summary.remediation.blockedSignatures)],
      ['Review-required signatures', toInlineList(summary.remediation.reviewRequiredSignatures)],
      ['Next action', summary.remediation.nextAction],
    ], summary.artifacts.failureSummary);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function parseArgs(argv) {
  const options = {
    verify: '.playbook/verify.json',
    releasePlan: '.playbook/release-plan.json',
    remediationPolicy: '.playbook/ci-remediation-policy.json',
    failureSummary: '.playbook/failure-summary.json',
    remediationStatus: '.playbook/remediation-status.json',
    out: '.playbook/ci-summary.md',
    commentOut: '.playbook/ci-summary-comment.md',
    marker: DEFAULT_COMMENT_MARKER,
    title: 'Playbook CI Summary',
    stepSummary: process.env.GITHUB_STEP_SUMMARY || null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--verify' && next) {
      options.verify = next;
      index += 1;
    } else if (token === '--release-plan' && next) {
      options.releasePlan = next;
      index += 1;
    } else if (token === '--remediation-policy' && next) {
      options.remediationPolicy = next;
      index += 1;
    } else if (token === '--failure-summary' && next) {
      options.failureSummary = next;
      index += 1;
    } else if (token === '--remediation-status' && next) {
      options.remediationStatus = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--comment-out' && next) {
      options.commentOut = next;
      index += 1;
    } else if (token === '--marker' && next) {
      options.marker = next;
      index += 1;
    } else if (token === '--title' && next) {
      options.title = next;
      index += 1;
    } else if (token === '--step-summary' && next) {
      options.stepSummary = next;
      index += 1;
    }
  }

  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const artifacts = {
    verify: readJsonIfExists(path.resolve(process.cwd(), options.verify)),
    releasePlan: readJsonIfExists(path.resolve(process.cwd(), options.releasePlan)),
    remediationPolicy: readJsonIfExists(path.resolve(process.cwd(), options.remediationPolicy)),
    failureSummary: readJsonIfExists(path.resolve(process.cwd(), options.failureSummary)),
    remediationStatus: readJsonIfExists(path.resolve(process.cwd(), options.remediationStatus)),
  };
  const summary = buildCiSummary(artifacts);
  const outPath = path.resolve(process.cwd(), options.out);
  const commentOutPath = path.resolve(process.cwd(), options.commentOut);
  const summaryBody = renderMarkdown(summary, { marker: null, title: options.title });
  const commentBody = renderMarkdown(summary, { marker: options.marker, title: options.title });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, summaryBody, 'utf8');
  fs.mkdirSync(path.dirname(commentOutPath), { recursive: true });
  fs.writeFileSync(commentOutPath, commentBody, 'utf8');
  if (options.stepSummary) {
    fs.mkdirSync(path.dirname(path.resolve(options.stepSummary)), { recursive: true });
    fs.appendFileSync(path.resolve(options.stepSummary), `${summaryBody}\n`, 'utf8');
  }
  process.stdout.write(summaryBody);
}

module.exports = {
  DEFAULT_COMMENT_MARKER,
  buildCiSummary,
  buildMergeGuardSummary,
  buildReleaseSummary,
  buildRemediationSummary,
  buildVerifySummary,
  parseEvidenceString,
  readJsonIfExists,
  renderMarkdown,
};
