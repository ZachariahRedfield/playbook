import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcRoot = path.resolve(__dirname, '../templates/repo');
const destRoot = path.resolve(__dirname, '../packages/cli/dist/templates/repo');
const observerAppSrc = path.resolve(__dirname, '../packages/cli/src/commands/observer/dashboard-app.js');
const observerAppDest = path.resolve(__dirname, '../packages/cli/dist/commands/observer/dashboard-app.js');

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
  await mkdir(path.dirname(observerAppDest), { recursive: true });
  await cp(observerAppSrc, observerAppDest);
  console.log(`Copied templates: ${srcRoot} -> ${destRoot}`);
  console.log(`Copied observer UI app: ${observerAppSrc} -> ${observerAppDest}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
