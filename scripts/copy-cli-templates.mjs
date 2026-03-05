import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcRoot = path.resolve(__dirname, '../templates/repo');
const destRoot = path.resolve(__dirname, '../packages/cli/dist/templates/repo');

const main = async () => {
  try {
    const srcStats = await stat(srcRoot);
    if (!srcStats.isDirectory()) {
      throw new Error(`Templates source is not a directory: ${srcRoot}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Templates source directory not found: ${srcRoot}\n${message}`);
  }

  await mkdir(destRoot, { recursive: true });
  await cp(srcRoot, destRoot, { recursive: true });
  console.log(`Copied templates: ${srcRoot} -> ${destRoot}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
