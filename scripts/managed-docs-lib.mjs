import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(process.env.PLAYBOOK_MANAGED_DOCS_REPO_ROOT ?? path.resolve(__dirname, '..'));

const COMMANDS_START = '<!-- PLAYBOOK:COMMANDS_START -->';
const COMMANDS_END = '<!-- PLAYBOOK:COMMANDS_END -->';
const EXAMPLES_START = '<!-- PLAYBOOK:EXAMPLES_START -->';
const EXAMPLES_END = '<!-- PLAYBOOK:EXAMPLES_END -->';
const DOCS_COMMANDS_START = '<!-- PLAYBOOK:DOCS_COMMAND_STATUS_START -->';
const DOCS_COMMANDS_END = '<!-- PLAYBOOK:DOCS_COMMAND_STATUS_END -->';
const DOCS_UTILITIES_START = '<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_START -->';
const DOCS_UTILITIES_END = '<!-- PLAYBOOK:DOCS_UTILITY_COMMANDS_END -->';

const categories = ['Core', 'Repository tools', 'Repository intelligence', 'Utility'];

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

const replaceManagedBlock = (content, startMarker, endMarker, replacement) => {
  const range = getManagedRange(content, startMarker, endMarker);
  return `${content.slice(0, range.start)}\n${replacement}\n${content.slice(range.end)}`;
};

export const loadCommandMetadata = async () => {
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

export const assertUniqueCommandNames = (commands) => {
  const seen = new Set();
  const duplicates = new Set();

  for (const command of commands) {
    if (seen.has(command.name)) {
      duplicates.add(command.name);
      continue;
    }

    seen.add(command.name);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate command metadata entries detected: ${[...duplicates].sort().join(', ')}`);
  }
};

export const toCommandTruth = (commands) => {
  const canonicalCommands = commands
    .filter((command) => command.lifecycle === 'canonical')
    .map((command) => command.name)
    .sort();
  const compatibilityCommands = commands
    .filter((command) => command.lifecycle === 'compatibility')
    .map((command) => command.name)
    .sort();
  const utilityCommands = commands
    .filter((command) => command.lifecycle === 'utility')
    .map((command) => command.name)
    .sort();
  const bootstrapLadder = commands
    .filter((command) => typeof command.canonicalSequence === 'number' && command.role === 'bootstrap')
    .sort((left, right) => left.canonicalSequence - right.canonicalSequence)
    .map((command) => command.name);
  const remediationLoop = ['verify', 'plan', 'apply', 'verify'];

  return {
    schemaVersion: '1.0',
    generatedFrom: 'packages/cli/src/lib/commandMetadata.ts',
    generatedBy: 'scripts/update-managed-docs.mjs',
    commandTruth: commands
      .map((command) => ({
        name: command.name,
        category: command.category,
        role: command.role,
        lifecycle: command.lifecycle,
        discoverability: command.discoverability,
        onboardingPriority: command.onboardingPriority,
        canonicalSequence: command.canonicalSequence,
        productFacing: command.productFacing,
        machineReadable: command.machineReadable,
        example: `pnpm playbook ${command.exampleArgs}`
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    canonicalCommands,
    compatibilityCommands,
    utilityCommands,
    bootstrapLadder,
    remediationLoop
  };
};

export const generateCommandTruthArtifact = async () => {
  const commands = await loadCommandMetadata();
  assertUniqueCommandNames(commands);
  return JSON.stringify(toCommandTruth(commands), null, 2) + '\n';
};

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
        lines.push(`  - Example: ${code(`pnpm playbook ${command.exampleArgs}`)}`);
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

  if (lines.at(-1) === '') {
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
    lines.push(`| ${code(command.name)} | ${code(`pnpm playbook ${command.exampleArgs}`)} |`);
  }

  return lines.join('\n');
};

const renderDocsProductCommands = (commands) => {
  const lines = [''];
  lines.push('| Command / Artifact | Purpose | Lifecycle | Role | Discoverability | Onboarding | Status | Example |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

  const productFacing = commands.filter((command) => command.productFacing);
  for (const command of productFacing) {
    const onboarding = command.onboardingPriority === null ? 'Later' : `P${command.onboardingPriority}`;
    lines.push(
      `| ${code(command.name)} | ${command.description} | ${command.lifecycle} | ${command.role} | ${command.discoverability} | ${onboarding} | Current (implemented) | ${code(`pnpm playbook ${command.exampleArgs}`)} |`
    );
  }

  return lines.join('\n');
};

const renderDocsUtilityCommands = (commands) => {
  const utilityCommands = commands.filter((command) => !command.productFacing);
  const lines = [''];

  for (const command of utilityCommands) {
    lines.push(`- ${code(command.name)}`);
  }

  return lines.join('\n');
};

const updateFile = (current, updates) => {
  let next = current;
  for (const update of updates) {
    next = replaceManagedBlock(next, update.start, update.end, update.content);
  }
  return next;
};

export const generateManagedDocsArtifacts = async () => {
  const commands = await loadCommandMetadata();
  assertUniqueCommandNames(commands);
  const commandTruth = toCommandTruth(commands);
  const targets = [
    {
      relativePath: 'AGENTS.md',
      updates: [
        { start: COMMANDS_START, end: COMMANDS_END, content: renderManagedCommands(commands) },
        { start: EXAMPLES_START, end: EXAMPLES_END, content: renderManagedExamples(commands) }
      ]
    },
    {
      relativePath: 'docs/commands/README.md',
      updates: [
        { start: DOCS_COMMANDS_START, end: DOCS_COMMANDS_END, content: renderDocsProductCommands(commands) },
        { start: DOCS_UTILITIES_START, end: DOCS_UTILITIES_END, content: renderDocsUtilityCommands(commands) }
      ]
    }
  ];

  const outputs = [];
  for (const target of targets) {
    const filePath = path.join(repoRoot, target.relativePath);
    const current = await fs.readFile(filePath, 'utf8');
    const next = updateFile(current, target.updates);
    outputs.push({ relativePath: target.relativePath, current, next });
  }

  const truthPath = 'docs/contracts/command-truth.json';
  let truthCurrent = null;
  try {
    truthCurrent = await fs.readFile(path.join(repoRoot, truthPath), 'utf8');
  } catch {
    truthCurrent = null;
  }
  outputs.push({
    relativePath: truthPath,
    current: truthCurrent,
    next: JSON.stringify(commandTruth, null, 2) + '\n'
  });

  return outputs;
};

export const writeCommandTruthContract = async (rootDir = repoRoot) => {
  const truthPath = path.join(rootDir, 'docs/contracts/command-truth.json');
  await fs.mkdir(path.dirname(truthPath), { recursive: true });
  await fs.writeFile(truthPath, await generateCommandTruthArtifact());
  return truthPath;
};

export const writeManagedDocsArtifacts = async (outputs, rootDir = repoRoot) => {
  for (const output of outputs) {
    await fs.mkdir(path.dirname(path.join(rootDir, output.relativePath)), { recursive: true });
    await fs.writeFile(path.join(rootDir, output.relativePath), output.next);
  }
};

export const countChangedManagedDocsArtifacts = (outputs) => outputs.filter((output) => output.current !== output.next).length;
