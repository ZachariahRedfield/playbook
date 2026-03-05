import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readConfig } from '../lib/config.js';

export const runDoctor = (cwd: string): number => {
  const warnings: string[] = [];

  try {
    execFileSync('git', ['--version'], { encoding: 'utf8' });
    console.log('✔ git installed');
  } catch {
    console.log('✖ git is not installed');
    return 1;
  }

  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, encoding: 'utf8' });
    console.log('✔ git repository detected');
  } catch {
    warnings.push('Not inside a git repo.');
  }

  const { config, warning } = readConfig(cwd);
  if (warning) warnings.push(warning);

  for (const docPath of Object.values(config.docs) as string[]) {
    const abs = path.join(cwd, docPath);
    if (!fs.existsSync(abs)) warnings.push(`Missing doc path: ${docPath}`);
  }

  if (warnings.length) {
    console.log('Warnings:');
    warnings.forEach((w) => console.log(`- ${w}`));
    console.log('Next steps: run `playbook init` and commit governance docs.');
  } else {
    console.log('✔ configuration and docs look good');
  }

  return 0;
};
