import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, listFilesRecursive } from "../lib/fs.js";
import { info } from "../lib/output.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveRepoTemplateRoot = (): string | undefined => {
  let current = __dirname;

  while (true) {
    const candidate = path.resolve(current, "templates/repo");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
};

const resolveTemplateRoot = (): string => {
  const envTemplateRoot = process.env.PLAYBOOK_TEMPLATES_DIR;
  if (envTemplateRoot) {
    return envTemplateRoot;
  }

  const distTemplateRoot = path.resolve(__dirname, "../templates/repo");
  if (fs.existsSync(distTemplateRoot)) {
    return distTemplateRoot;
  }

  const repoTemplateRoot = resolveRepoTemplateRoot();
  if (repoTemplateRoot) {
    return repoTemplateRoot;
  }

  return distTemplateRoot;
};

const templateRoot = resolveTemplateRoot();

export const runInit = (cwd: string): void => {
  if (!fs.existsSync(templateRoot)) {
    throw new Error(
      `Templates directory not found: ${templateRoot}\n` +
        `Set PLAYBOOK_TEMPLATES_DIR to a valid templates/repo directory.`
    );
  }

  const files = listFilesRecursive(templateRoot);
  for (const srcFile of files) {
    const rel = path.relative(templateRoot, srcFile);
    const dest = path.join(cwd, rel);
    ensureDir(path.dirname(dest));

    if (fs.existsSync(dest)) {
      info(`skipped ${rel}`);
      continue;
    }

    fs.copyFileSync(srcFile, dest);
    info(`created ${rel}`);
  }
};
