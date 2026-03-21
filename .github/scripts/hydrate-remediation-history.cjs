#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DEFAULT_HISTORY_PATH = '.playbook/test-autofix-history.json';

function parseArgs(argv) {
  const args = {
    cwd: process.cwd(),
    repo: process.env.GITHUB_REPOSITORY || '',
    token: process.env.GITHUB_TOKEN || '',
    artifactName: process.env.PLAYBOOK_REMEDIATION_ARTIFACT_NAME || 'playbook-remediation-artifacts-ci',
    currentRunId: String(process.env.GITHUB_RUN_ID || ''),
    limit: Number(process.env.PLAYBOOK_REMEDIATION_HISTORY_LOOKBACK || '5'),
    outFile: DEFAULT_HISTORY_PATH,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--cwd' && next) { args.cwd = next; i += 1; }
    else if (arg === '--repo' && next) { args.repo = next; i += 1; }
    else if (arg === '--token' && next) { args.token = next; i += 1; }
    else if (arg === '--artifact-name' && next) { args.artifactName = next; i += 1; }
    else if (arg === '--current-run-id' && next) { args.currentRunId = next; i += 1; }
    else if (arg === '--limit' && next) { args.limit = Number(next); i += 1; }
    else if (arg === '--out' && next) { args.outFile = next; i += 1; }
  }
  return args;
}

function readWrappedJson(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return parsed && typeof parsed === 'object' && parsed.data ? parsed.data : parsed;
}

async function listArtifacts({ repo, token, artifactName, currentRunId, limit }) {
  const [owner, name] = repo.split('/');
  if (!owner || !name || !token) return [];
  const url = new URL(`https://api.github.com/repos/${owner}/${name}/actions/artifacts`);
  url.searchParams.set('per_page', String(Math.max(limit * 4, 20)));
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'playbook-ci-remediation-history-hydrator'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed listing artifacts: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return (Array.isArray(payload.artifacts) ? payload.artifacts : [])
    .filter((artifact) => artifact && artifact.name === artifactName && !artifact.expired && String(artifact.workflow_run?.id || '') !== currentRunId)
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
    .slice(0, limit);
}

function extractHistoryFromZip(zipPath, outputDir) {
  const extractionScript = [
    'import pathlib, sys, zipfile',
    'zip_path = pathlib.Path(sys.argv[1])',
    'output_dir = pathlib.Path(sys.argv[2])',
    'output_dir.mkdir(parents=True, exist_ok=True)',
    'with zipfile.ZipFile(zip_path) as archive:',
    '    matches = [name for name in archive.namelist() if name.endswith("test-autofix-history.json")]',
    '    if not matches:',
    '        sys.exit(2)',
    '    target = output_dir / pathlib.Path(matches[0]).name',
    '    with archive.open(matches[0]) as src, target.open("wb") as dst:',
    '        dst.write(src.read())',
    '    print(target)',
  ].join('\n');
  return execFileSync('python3', ['-c', extractionScript, zipPath, outputDir], { encoding: 'utf8' }).trim();
}

async function downloadArtifactZip(url, token, destination) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'playbook-ci-remediation-history-hydrator'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed downloading artifact archive: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(args.cwd);
  const historyOutPath = path.join(repoRoot, args.outFile);
  const { mergeRemediationHistoryArtifacts, normalizeRemediationHistoryArtifact } = require(path.join(repoRoot, 'packages/engine/dist/index.js'));

  const sources = [];
  if (fs.existsSync(historyOutPath)) {
    sources.push({
      sourceId: 'runtime:existing-local-history',
      artifactPath: args.outFile,
      artifact: normalizeRemediationHistoryArtifact(readWrappedJson(historyOutPath))
    });
  }

  const artifacts = await listArtifacts(args);
  if (artifacts.length === 0 && sources.length === 0) {
    console.log('playbook-remediation-history-hydration=no-op');
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-remediation-history-'));
  try {
    for (const artifact of artifacts) {
      const zipPath = path.join(tempDir, `${artifact.id}.zip`);
      const extractDir = path.join(tempDir, String(artifact.id));
      await downloadArtifactZip(artifact.archive_download_url, args.token, zipPath);
      try {
        const historyPath = extractHistoryFromZip(zipPath, extractDir);
        sources.push({
          sourceId: `github-actions:${artifact.workflow_run?.id || 'unknown-run'}:${artifact.id}`,
          artifactPath: `github-actions-artifact://${artifact.name}/${artifact.id}/test-autofix-history.json`,
          artifact: normalizeRemediationHistoryArtifact(readWrappedJson(historyPath))
        });
      } catch (error) {
        if (!(error instanceof Error) || !String(error.message).includes('exit status 2')) {
          throw error;
        }
      }
    }

    if (sources.length === 0) {
      console.log('playbook-remediation-history-hydration=no-op');
      return;
    }

    const merged = mergeRemediationHistoryArtifacts(sources);
    fs.mkdirSync(path.dirname(historyOutPath), { recursive: true });
    fs.writeFileSync(historyOutPath, JSON.stringify({ data: merged }, null, 2) + '\n', 'utf8');
    console.log(`playbook-remediation-history-hydration=merged:${merged.runs.length}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
