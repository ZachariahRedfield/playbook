import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const withTempDir = async (prefix, callback) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await callback(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const withOverlayWorkspace = async ({ repoRoot, overrides, prefix = 'playbook-overlay-' }, callback) =>
  withTempDir(prefix, async (overlayRoot) => {
    const overridden = new Set(overrides.map((output) => output.relativePath));

    const materializeTree = async (relativePath = '') => {
      const sourceDir = path.join(repoRoot, relativePath);
      const destinationDir = path.join(overlayRoot, relativePath);
      await fs.mkdir(destinationDir, { recursive: true });
      const entries = await fs.readdir(sourceDir, { withFileTypes: true });

      for (const entry of entries) {
        const childRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        const sourcePath = path.join(repoRoot, childRelativePath);
        const destinationPath = path.join(overlayRoot, childRelativePath);
        const isExactOverride = overridden.has(childRelativePath);
        const containsOverride = [...overridden].some((target) => target.startsWith(`${childRelativePath}${path.sep}`));

        if (isExactOverride) continue;
        if (entry.isDirectory() && containsOverride) {
          await materializeTree(childRelativePath);
          continue;
        }

        await fs.symlink(sourcePath, destinationPath, entry.isDirectory() ? 'dir' : 'file');
      }
    };

    await materializeTree();

    for (const output of overrides) {
      const destination = path.join(overlayRoot, output.relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, output.next);
    }

    return callback(overlayRoot);
  });

export const promoteStagedFiles = async ({ stageRoot, relativePaths, destinationRoot }) => {
  for (const relativePath of relativePaths) {
    const stagedPath = path.join(stageRoot, relativePath);
    const destinationPath = path.join(destinationRoot, relativePath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(stagedPath, destinationPath);
  }
};

export const promoteStagedFile = async ({ stagedPath, destinationPath }) => {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(stagedPath, destinationPath);
};
