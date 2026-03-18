import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withTempDir, promoteStagedFiles } from './staged-artifact-workflow.mjs';

const repoRoot = process.cwd();

const main = async () => {
  await withTempDir('playbook-contract-snapshots-', async (stagingRoot) => {
    const stagedSnapshotDir = path.join(stagingRoot, 'tests', 'contracts');
    if (process.env.PLAYBOOK_SNAPSHOT_TEST_MODE === '1') {
      await fs.mkdir(stagedSnapshotDir, { recursive: true });
      await fs.writeFile(path.join(stagedSnapshotDir, 'ai-context.snapshot.json'), '{\"staged\":true}\n', 'utf8');
    } else {
      const result = spawnSync(
        'pnpm',
        ['exec', 'vitest', 'run', '--passWithNoTests', 'test/cliContracts.test.ts'],
        {
          stdio: 'inherit',
          shell: true,
          cwd: 'packages/cli',
          env: {
            ...process.env,
            UPDATE_CONTRACT_SNAPSHOTS: '1',
            PLAYBOOK_SNAPSHOT_OUTPUT_DIR: stagedSnapshotDir
          }
        }
      );

      if (result.status !== 0) {
        process.exit(result.status ?? 1);
      }
    }

    if (process.env.PLAYBOOK_FAIL_BEFORE_SNAPSHOT_PROMOTION === '1') {
      throw new Error('snapshot promotion intentionally aborted before promotion');
    }

    const entries = await fs.readdir(stagedSnapshotDir);
    const relativePaths = entries.filter((entry) => entry.endsWith('.json')).map((entry) => path.join('tests', 'contracts', entry));
    await promoteStagedFiles({ stageRoot: stagingRoot, relativePaths, destinationRoot: repoRoot });
  });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
