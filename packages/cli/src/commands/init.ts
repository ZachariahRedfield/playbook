import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, listFilesRecursive } from "../lib/fs.js";
import { emitResult, ExitCode } from "../lib/cliContract.js";

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

type InitOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  ci: boolean;
};

export const runInit = (cwd: string, options: InitOptions): number => {
  if (!fs.existsSync(templateRoot)) {
    emitResult({
      format: options.format,
      quiet: options.quiet,
      command: 'init',
      ok: false,
      exitCode: ExitCode.EnvironmentPrereq,
      summary: `Templates directory not found: ${templateRoot}`,
      findings: [
        {
          id: 'init.templates.missing',
          level: 'error',
          message: 'Templates directory not found.'
        }
      ],
      nextActions: ['Set PLAYBOOK_TEMPLATES_DIR to a valid templates/repo directory.']
    });
    return ExitCode.EnvironmentPrereq;
  }

  const files = listFilesRecursive(templateRoot);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const srcFile of files) {
    const rel = path.relative(templateRoot, srcFile);
    const dest = path.join(cwd, rel);
    ensureDir(path.dirname(dest));

    if (fs.existsSync(dest)) {
      skipped.push(rel);
      continue;
    }

    fs.copyFileSync(srcFile, dest);
    created.push(rel);
  }

  const findings = [
    ...created.map((entry) => ({ id: `init.created.${entry.replace(/[^a-zA-Z0-9]+/g, '-')}`, level: 'info' as const, message: `created ${entry}` })),
    ...skipped.map((entry) => ({ id: `init.skipped.${entry.replace(/[^a-zA-Z0-9]+/g, '-')}`, level: 'info' as const, message: `skipped ${entry}` }))
  ];

  emitResult({
    format: options.format,
    quiet: options.quiet || options.ci,
    command: 'init',
    ok: true,
    exitCode: ExitCode.Success,
    summary: `Initialized playbook templates: ${created.length} created, ${skipped.length} skipped.`,
    findings,
    nextActions: []
  });

  return ExitCode.Success;
};
