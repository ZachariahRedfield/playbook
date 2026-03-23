const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_COMMENT_MARKER = '<!-- playbook:ci-summary -->';
const PROTECTED_DOC_RULE_PREFIX = 'protected-doc.';

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function unique(values) {
  return [...new Set(values
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim()))].sort((left, right) => left.localeCompare(right));
}

function parseList(value) {
  if (typeof value !== 'string' || value.trim() === '' || value === 'none') return [];
  return unique(value.split(',').map((entry) => entry.trim()));
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

function toInlineList(values, fallback = '(none)') {
  return Array.isArray(values) && values.length > 0 ? values.join(', ') : fallback;
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

function buildVerifySummary(verifyPayload) {
  if (!verifyPayload || typeof verifyPayload !== 'object') return null;
  const findings = Array.isArray(verifyPayload.findings) ? verifyPayload.findings : [];
  const blockers = findings
    .filter((finding) => finding?.level === 'error')
    .slice(0, 5)
    .map((finding) => `${finding.id}: ${finding.message}`);
  const nextActions = Array.isArray(verifyPayload.nextActions) ? verifyPayload.nextActions.slice(0, 3) : [];
  return {
    status: verifyPayload.ok ? 'PASS' : 'FAIL',
    blockers,
    nextAction: nextActions[0] ?? (verifyPayload.ok ? 'No verify follow-up required.' : 'Review `.playbook/verify.json` and address the blocking findings.'),
  };
}

function buildMergeGuardSummary(verifyPayload) {
  const findings = Array.isArray(verifyPayload?.findings) ? verifyPayload.findings : [];
  const mergeGuardFindings = findings.filter((finding) => typeof finding?.id === 'string' && finding.id.startsWith(PROTECTED_DOC_RULE_PREFIX));
  if (mergeGuardFindings.length === 0) return null;
  const parsedEvidence = mergeGuardFindings.map((finding) => parseEvidenceString(finding.evidence));
  const decisions = unique(parsedEvidence.map((entry) => entry.decision).filter(Boolean));
  const statuses = unique(parsedEvidence.map((entry) => entry.status).filter(Boolean));
  const blockers = unique(parsedEvidence.flatMap((entry) => parseList(entry.blockers)));
  const nextActions = unique(parsedEvidence.map((entry) => entry.next_action).filter(Boolean));
  return {
    decision: decisions.join(' · ') || (verifyPayload?.ok ? 'pass' : 'fail_closed'),
    status: statuses.join(' · ') || (verifyPayload?.ok ? 'clear' : 'merge guard blocked'),
    blockers,
    nextAction: nextActions[0] ?? 'Review `.playbook/verify.json` merge-guard findings.',
  };
}

function formatAffected(plan, affectedPackages, affectedGroups) {
  if (affectedGroups.length > 0) return affectedGroups.map((group) => `${group.name} (${group.packages.join(', ')})`);
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
    status: recommendedBump === 'none' ? 'no release-relevant diff' : 'release plan ready',
    recommendedBump,
    currentVersion: toInlineList(currentVersions),
    nextVersion: toInlineList(nextVersions),
    affected: toInlineList(formatAffected(plan, affectedPackages, affectedGroups)),
  };
}

function buildRemediationSummary(policy, failureSummary, remediationStatus) {
  if (!failureSummary) return null;
  const latestRun = remediationStatus?.latest_run ?? {};
  const recentStatus = latestRun.final_status ?? latestRun.status ?? policy?.status ?? 'not_run';
  const retryDecision = latestRun.retry_policy_decision ?? 'not_run';
  const preferredRepairClass = latestRun.preferred_repair_class ?? '(none)';
  const primaryFailure = failureSummary.primaryFailureClass ?? failureSummary.summary?.primaryFailureClass ?? '(unknown)';
  const failureCount = failureSummary.summary?.totalFailures
    ?? failureSummary.summary?.total
    ?? (Array.isArray(failureSummary.failures) ? failureSummary.failures.length : 0);
  return {
    status: recentStatus,
    failureClass: primaryFailure,
    failureCount,
    retryDecision,
    preferredRepairClass,
    nextAction: Array.isArray(policy?.reasons) && policy.reasons.length > 0
      ? policy.reasons[0]
      : (latestRun.next_action ?? 'Review `.playbook/failure-summary.json` and `.playbook/remediation-status.json` for deterministic remediation guidance.'),
  };
}

function buildSummary({ verify, verifyArtifactPath, releasePlan, releaseArtifactPath, remediationPolicy, remediationPolicyArtifactPath, failureSummary, failureSummaryArtifactPath, remediationStatus, remediationStatusArtifactPath }) {
  const verifySummary = buildVerifySummary(verify);
  if (!verifySummary) return null;
  const mergeGuardSummary = buildMergeGuardSummary(verify);
  const releaseSummary = buildReleaseSummary(releasePlan);
  const remediationSummary = buildRemediationSummary(remediationPolicy, failureSummary, remediationStatus);

  let overallStatus = verifySummary.status === 'FAIL' ? 'blocked' : 'clear';
  if (remediationSummary) overallStatus = remediationSummary.status === 'allowed' ? overallStatus : `${overallStatus} · test failure`; // retains compact context
  const overallDecision = verify?.ok ? 'merge-ready pending policy context' : 'verify blocked';

  const artifacts = [verifyArtifactPath, releaseSummary ? releaseArtifactPath : null, remediationSummary ? remediationPolicyArtifactPath : null, remediationSummary ? failureSummaryArtifactPath : null, remediationSummary ? remediationStatusArtifactPath : null]
    .filter((value) => typeof value === 'string' && value.trim().length > 0);

  return {
    overall: {
      decision: overallDecision,
      status: overallStatus,
    },
    verify: verifySummary,
    mergeGuard: mergeGuardSummary,
    release: releaseSummary,
    remediation: remediationSummary,
    artifacts,
  };
}

function renderMarkdown(summary, { marker, title }) {
  const lines = [];
  if (marker) lines.push(marker);
  lines.push(`## ${title}`, '', '| Section | Value |', '| --- | --- |');
  lines.push(`| Overall decision / status | ${summary.overall.decision} / ${summary.overall.status} |`);
  lines.push(`| Verify | ${summary.verify.status} |`);
  lines.push(`| Verify blockers | ${toInlineList(summary.verify.blockers)} |`);
  lines.push(`| Verify next action | ${summary.verify.nextAction} |`);

  if (summary.mergeGuard) {
    lines.push(`| Merge guard | ${summary.mergeGuard.decision} / ${summary.mergeGuard.status} |`);
    lines.push(`| Merge guard blockers | ${toInlineList(summary.mergeGuard.blockers)} |`);
    lines.push(`| Merge guard next action | ${summary.mergeGuard.nextAction} |`);
  }

  if (summary.release) {
    lines.push(`| Release bump | ${summary.release.recommendedBump} / ${summary.release.status} |`);
    lines.push(`| Release versions | ${summary.release.currentVersion} → ${summary.release.nextVersion} |`);
    lines.push(`| Release affected | ${summary.release.affected} |`);
  }

  if (summary.remediation) {
    lines.push(`| Remediation | ${summary.remediation.status} |`);
    lines.push(`| Test failure summary | class=${summary.remediation.failureClass}; failures=${summary.remediation.failureCount} |`);
    lines.push(`| Retry / repair | ${summary.remediation.retryDecision}; ${summary.remediation.preferredRepairClass} |`);
    lines.push(`| Remediation next action | ${summary.remediation.nextAction} |`);
  }

  lines.push('', `Artifacts: ${summary.artifacts.map((artifact) => `\`${artifact}\``).join(', ')}.`);
  return `${lines.join('\n').trimEnd()}\n`;
}

function parseArgs(argv) {
  const options = {
    verify: '.playbook/verify.json',
    verifyPreflight: '.playbook/verify-preflight.json',
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
      options.verify = next; index += 1;
    } else if (token === '--verify-preflight' && next) {
      options.verifyPreflight = next; index += 1;
    } else if (token === '--release-plan' && next) {
      options.releasePlan = next; index += 1;
    } else if (token === '--remediation-policy' && next) {
      options.remediationPolicy = next; index += 1;
    } else if (token === '--failure-summary' && next) {
      options.failureSummary = next; index += 1;
    } else if (token === '--remediation-status' && next) {
      options.remediationStatus = next; index += 1;
    } else if (token === '--out' && next) {
      options.out = next; index += 1;
    } else if (token === '--comment-out' && next) {
      options.commentOut = next; index += 1;
    } else if (token === '--marker' && next) {
      options.marker = next; index += 1;
    } else if (token === '--title' && next) {
      options.title = next; index += 1;
    } else if (token === '--step-summary' && next) {
      options.stepSummary = next; index += 1;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const verify = readJsonIfExists(path.resolve(process.cwd(), options.verify))
    ?? readJsonIfExists(path.resolve(process.cwd(), options.verifyPreflight));
  const verifyArtifactPath = fs.existsSync(path.resolve(process.cwd(), options.verify)) ? options.verify : (fs.existsSync(path.resolve(process.cwd(), options.verifyPreflight)) ? options.verifyPreflight : options.verify);
  const payload = {
    verify,
    verifyArtifactPath,
    releasePlan: readJsonIfExists(path.resolve(process.cwd(), options.releasePlan)),
    releaseArtifactPath: options.releasePlan,
    remediationPolicy: readJsonIfExists(path.resolve(process.cwd(), options.remediationPolicy)),
    remediationPolicyArtifactPath: options.remediationPolicy,
    failureSummary: readJsonIfExists(path.resolve(process.cwd(), options.failureSummary)),
    failureSummaryArtifactPath: options.failureSummary,
    remediationStatus: readJsonIfExists(path.resolve(process.cwd(), options.remediationStatus)),
    remediationStatusArtifactPath: options.remediationStatus,
  };
  const summary = buildSummary(payload);
  const outPath = path.resolve(process.cwd(), options.out);
  const commentOutPath = path.resolve(process.cwd(), options.commentOut);

  if (!summary) {
    if (fs.existsSync(outPath)) fs.rmSync(outPath);
    if (fs.existsSync(commentOutPath)) fs.rmSync(commentOutPath);
    process.exit(0);
  }

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
  buildSummary,
  buildVerifySummary,
  buildMergeGuardSummary,
  buildReleaseSummary,
  buildRemediationSummary,
  renderMarkdown,
  readJsonIfExists,
};
