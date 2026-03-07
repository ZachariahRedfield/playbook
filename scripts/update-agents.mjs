#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const agentsPath = path.join(repoRoot, 'AGENTS.md');

const COMMANDS_START = '<!-- PLAYBOOK:COMMANDS_START -->';
const COMMANDS_END = '<!-- PLAYBOOK:COMMANDS_END -->';
const EXAMPLES_START = '<!-- PLAYBOOK:EXAMPLES_START -->';
const EXAMPLES_END = '<!-- PLAYBOOK:EXAMPLES_END -->';

const categories = ['Core', 'Repository tools', 'Repository intelligence', 'Utility'];

const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');

const getManagedRange = (content, startMarker, endMarker) => {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Missing or invalid managed markers: ${startMarker} ... ${endMarker}`);
  }

  return {
    start: startIndex + startMarker.length,
    end: endIndex
  };
};

const code = (value) => '`' + value + '`';

const renderManagedCommands = (commands) => {
  const lines = [''];

  for (const category of categories) {
    const categoryCommands = commands.filter((command) => command.category === category);
    if (categoryCommands.length === 0) {
      continue;
    }

    lines.push(`### ${category}`);
    lines.push('');

    const productFacing = categoryCommands.filter((command) => command.productFacing);
    const utility = categoryCommands.filter((command) => !command.productFacing);

    if (productFacing.length > 0) {
      for (const command of productFacing) {
        lines.push(`- ${code(command.name)}: ${command.description}`);
        lines.push(`  - Example: ${code(command.example)}`);
      }
      lines.push('');
    }

    if (utility.length > 0) {
      for (const command of utility) {
        lines.push(`- ${code(command.name)}: ${command.description}`);
      }
      lines.push('');
    }
  }

  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
};

const renderManagedExamples = (commands) => {
  const lines = [''];
  const productFacing = commands.filter((command) => command.productFacing);

  lines.push('| Command | Example |');
  lines.push('| --- | --- |');
  for (const command of productFacing) {
    lines.push(`| ${code(command.name)} | ${code(command.example)} |`);
  }

  return lines.join('\n');
};

const replaceManagedBlock = (content, startMarker, endMarker, replacement) => {
  const range = getManagedRange(content, startMarker, endMarker);
  return `${content.slice(0, range.start)}\n${replacement}\n${content.slice(range.end)}`;
};

const loadCommandMetadata = async () => {
  const modulePath = path.join(repoRoot, 'packages/cli/dist/lib/commandMetadata.js');

  try {
    const metadataModule = await import(pathToFileURL(modulePath).href);
    return metadataModule.commandMetadata;
  } catch (error) {
    throw new Error(
      `Unable to load command metadata from ${modulePath}. Run "pnpm -r build" before running this script.\n${String(error)}`
    );
  }
};

const run = async () => {
  const commands = await loadCommandMetadata();
  const agents = await fs.readFile(agentsPath, 'utf8');

  let next = replaceManagedBlock(agents, COMMANDS_START, COMMANDS_END, renderManagedCommands(commands));
  next = replaceManagedBlock(next, EXAMPLES_START, EXAMPLES_END, renderManagedExamples(commands));

  if (next === agents) {
    console.log(checkMode ? 'AGENTS.md is up to date.' : 'AGENTS.md already up to date.');
    return;
  }

  if (checkMode) {
    console.error('AGENTS.md is stale. Run "pnpm agents:update".');
    process.exitCode = 1;
    return;
  }

  await fs.writeFile(agentsPath, next);
  console.log('Updated AGENTS.md managed sections.');
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
