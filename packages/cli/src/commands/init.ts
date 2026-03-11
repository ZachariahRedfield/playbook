import fs from 'node:fs';
import path from 'node:path';
import { emitResult, ExitCode } from '../lib/cliContract.js';

type InitOptions = {
  format: 'text' | 'json';
  quiet: boolean;
  ci: boolean;
  force: boolean;
  help: boolean;
};

type ScaffoldFile = {
  relativePath: string;
  content: string;
};

const INIT_FILES: ScaffoldFile[] = [
  {
    relativePath: path.join('docs', 'ARCHITECTURE.md'),
    content: '# Architecture\n\nDescribe your system architecture and major components.\n'
  },
  {
    relativePath: path.join('docs', 'CHANGELOG.md'),
    content: '# Changelog\n\nDocument notable changes to this repository here.\n'
  },
  {
    relativePath: path.join('docs', 'PLAYBOOK_CHECKLIST.md'),
    content: '# Playbook Checklist\n\nTrack implementation and governance checklist items.\n'
  },
  {
    relativePath: path.join('docs', 'PLAYBOOK_NOTES.md'),
    content: '# Playbook Notes\n\nCapture release notes, decisions, and implementation context.\n'
  },
  {
    relativePath: path.join('.playbook', 'config.json'),
    content: '{\n  "version": 1\n}\n'
  }
];

const normalizeForOutput = (relativePath: string): string => relativePath.split(path.sep).join('/');

const showInitHelp = (): void => {
  console.log(`Usage: playbook init [options]

Scaffold the minimal Playbook docs and config into the current repository.

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

  for (const file of INIT_FILES) {
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
