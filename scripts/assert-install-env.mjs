#!/usr/bin/env node
import { execSync } from 'node:child_process';

const npmRegistry = process.env.npm_config_registry ?? process.env.NPM_CONFIG_REGISTRY ?? getConfig('npm config get registry');
const pnpmRegistry = process.env.pnpm_config_registry ?? process.env.PNPM_CONFIG_REGISTRY ?? getConfig('pnpm config get registry');
const npmOptional = process.env.npm_config_optional ?? process.env.NPM_CONFIG_OPTIONAL ?? getConfig('npm config get optional');
const pnpmOptional = process.env.pnpm_config_optional ?? process.env.PNPM_CONFIG_OPTIONAL ?? getConfig('pnpm config get optional');

const allowCustomRegistry = process.env.PLAYBOOK_ALLOW_NON_NPM_REGISTRY === 'true';
const allowedRegistry = 'https://registry.npmjs.org/';

const errors = [];
if (!allowCustomRegistry) {
  if (!isNpmjsRegistry(npmRegistry)) {
    errors.push(`npm registry must be ${allowedRegistry} (found: ${npmRegistry || 'unset'})`);
  }
  if (!isNpmjsRegistry(pnpmRegistry)) {
    errors.push(`pnpm registry must be ${allowedRegistry} (found: ${pnpmRegistry || 'unset'})`);
  }
}

if (isExplicitFalse(npmOptional) || isExplicitFalse(pnpmOptional)) {
  errors.push('optionalDependencies are disabled (npm/pnpm optional flags resolve to false)');
}

if (errors.length > 0) {
  console.error('Playbook install environment check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error('Fix: set NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ and PNPM_CONFIG_REGISTRY=https://registry.npmjs.org/.');
  console.error('Fix: set NPM_CONFIG_OPTIONAL=true and PNPM_CONFIG_OPTIONAL=true.');
  console.error('If you intentionally use a custom private mirror, set PLAYBOOK_ALLOW_NON_NPM_REGISTRY=true.');
  process.exit(1);
}

console.log('Playbook install environment check passed.');

function getConfig(command) {
  try {
    return String(execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch {
    return '';
  }
}

function isNpmjsRegistry(value) {
  return typeof value === 'string' && value.trim().replace(/\/+$/, '/') === allowedRegistry;
}

function isExplicitFalse(value) {
  return String(value).trim().toLowerCase() === 'false';
}
