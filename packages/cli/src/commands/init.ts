import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitResult, ExitCode } from '../lib/cliContract.js';
import { buildVersionPolicy, versionPolicyRelativePath } from '../lib/versionPolicy.js';

type InitOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  ci: boolean;
  force: boolean;
  help: boolean;
};

type TemplateFile = {
  relativePath: string;
  content: string;
};

const resolveTemplateRoot = (): string => {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const candidates = [
    path.resolve(currentDir, '../../templates/repo'),
    path.resolve(currentDir, '../templates/repo'),
    path.resolve(currentDir, '../../../templates/repo')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw new Error(`Playbook init templates are missing. Checked: ${candidates.join(', ')}`);
};

const readTemplateFiles = (repoRoot: string, templateRoot: string, currentDir = templateRoot, files: TemplateFile[] = []): TemplateFile[] => {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      readTemplateFiles(repoRoot, templateRoot, absolutePath, files);
      continue;
    }

    const relativePath = path.relative(templateRoot, absolutePath);
    const content =
      relativePath === versionPolicyRelativePath
        ? `${JSON.stringify(buildVersionPolicy(repoRoot), null, 2)}\n`
        : fs.readFileSync(absolutePath, 'utf8');
    files.push({ relativePath, content });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};


const normalizeForOutput = (relativePath: string): string => relativePath.split(path.sep).join('/');

const showInitHelp = (): void => {
  console.log(`Usage: playbook init [options]

Scaffold the installable Playbook templates and default governance into the current repository.

Options:
  --force                     Overwrite existing files
  --help                      Show help`);
};

export const runInit = (cwd: string, options: InitOptions): number => {
  if (options.help) {
    showInitHelp();
    return ExitCode.Success;
  }

  const created: string[] = [];
  const overwritten: string[] = [];
  const skipped: string[] = [];
  const templateRoot = resolveTemplateRoot();
  const templateFiles = readTemplateFiles(cwd, templateRoot);

  for (const file of templateFiles) {
    const destination = path.join(cwd, file.relativePath);
    const outputPath = normalizeForOutput(file.relativePath);
    const alreadyExists = fs.existsSync(destination);

    fs.mkdirSync(path.dirname(destination), { recursive: true });

    if (alreadyExists && !options.force) {
      skipped.push(outputPath);
      continue;
    }

    fs.writeFileSync(destination, file.content, 'utf8');

    if (alreadyExists) {
      overwritten.push(outputPath);
    } else {
      created.push(outputPath);
    }
  }

  const findings = [
    ...created.map((entry) => ({
      id: `init.created.${entry.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      level: 'info' as const,
      message: entry
    })),
    ...overwritten.map((entry) => ({
      id: `init.overwritten.${entry.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      level: 'info' as const,
      message: `${entry} (overwritten)`
    })),
    ...skipped.map((entry) => ({
      id: `init.skipped.${entry.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      level: 'info' as const,
      message: `${entry} (exists, use --force to overwrite)`
    }))
  ];

  const nextActions = ['pnpm playbook status', 'pnpm playbook fix', 'pnpm playbook verify'];

  if (options.format === 'json') {
    emitResult({
      format: options.format,
      quiet: options.quiet || options.ci,
      command: 'init',
      ok: true,
      exitCode: ExitCode.Success,
      summary: 'Playbook initialized.',
      findings,
      nextActions
    });

    return ExitCode.Success;
  }

  if (!(options.quiet || options.ci)) {
    console.log('Playbook initialized.');
    console.log('');
    console.log('Created:');

    for (const entry of created) {
      console.log(`- ${entry}`);
    }

    for (const entry of overwritten) {
      console.log(`- ${entry} (overwritten)`);
    }

    if (skipped.length > 0) {
      console.log('');
      console.log('Skipped:');
      for (const entry of skipped) {
        console.log(`- ${entry}`);
      }
    }

    console.log('');
    console.log('Next steps:');
    console.log('');
    for (const [index, step] of nextActions.entries()) {
      console.log(`${index + 1}. ${step}`);
    }
  }

  return ExitCode.Success;
};
