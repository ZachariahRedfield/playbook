import { execFileSync } from "node:child_process";

const EXPECTED_REGISTRY = "https://registry.npmjs.org/";

function runConfig(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return "<unavailable>";
  }
}

function hasCommand(command) {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasPnpm = hasCommand("pnpm");

const diagnostics = {
  nodeVersion: process.version,
  npmRegistry: runConfig("npm", ["config", "get", "registry"]),
  pnpmRegistry: hasPnpm ? runConfig("pnpm", ["config", "get", "registry"]) : "<unavailable>",
  npmOptional: runConfig("npm", ["config", "get", "optional"]),
  pnpmOptional: hasPnpm ? runConfig("pnpm", ["config", "get", "optional"]) : "<unavailable>",
  env: {
    NPM_CONFIG_REGISTRY: process.env.NPM_CONFIG_REGISTRY,
    npm_config_registry: process.env.npm_config_registry,
    PNPM_REGISTRY: process.env.PNPM_REGISTRY,
    pnpm_registry: process.env.pnpm_registry,
    NPM_CONFIG_OPTIONAL: process.env.NPM_CONFIG_OPTIONAL,
    npm_config_optional: process.env.npm_config_optional,
    PNPM_CONFIG_OPTIONAL: process.env.PNPM_CONFIG_OPTIONAL,
    pnpm_config_optional: process.env.pnpm_config_optional
  }
};

function normalizeRegistry(value) {
  if (!value || value === "null" || value === "undefined" || value === "<unavailable>") {
    return null;
  }
  return value.endsWith("/") ? value : `${value}/`;
}

function isFalseLike(value) {
  if (value == null) {
    return false;
  }
  return String(value).trim().toLowerCase() === "false";
}

const registryIssues = [];
const optionalIssues = [];

for (const [key, value] of [
  ["npm config registry", diagnostics.npmRegistry],
  ["pnpm config registry", diagnostics.pnpmRegistry],
  ["env NPM_CONFIG_REGISTRY", diagnostics.env.NPM_CONFIG_REGISTRY],
  ["env npm_config_registry", diagnostics.env.npm_config_registry],
  ["env PNPM_REGISTRY", diagnostics.env.PNPM_REGISTRY],
  ["env pnpm_registry", diagnostics.env.pnpm_registry]
]) {
  const normalized = normalizeRegistry(value);
  if (normalized && normalized !== EXPECTED_REGISTRY) {
    registryIssues.push(`${key}=${value}`);
  }
}

for (const [key, value] of [
  ["npm config optional", diagnostics.npmOptional],
  ["pnpm config optional", diagnostics.pnpmOptional],
  ["env NPM_CONFIG_OPTIONAL", diagnostics.env.NPM_CONFIG_OPTIONAL],
  ["env npm_config_optional", diagnostics.env.npm_config_optional],
  ["env PNPM_CONFIG_OPTIONAL", diagnostics.env.PNPM_CONFIG_OPTIONAL],
  ["env pnpm_config_optional", diagnostics.env.pnpm_config_optional]
]) {
  if (value !== "<unavailable>" && isFalseLike(value)) {
    optionalIssues.push(`${key}=${value}`);
  }
}

if (registryIssues.length === 0 && optionalIssues.length === 0) {
  process.exit(0);
}

const npmUserConfig = runConfig("npm", ["config", "get", "userconfig"]);
const npmGlobalConfig = runConfig("npm", ["config", "get", "globalconfig"]);

console.error("[assert-install-env] Install environment validation failed.");
console.error(`node version: ${diagnostics.nodeVersion}`);
console.error(`npm config get registry: ${diagnostics.npmRegistry}`);
console.error(`pnpm config get registry: ${diagnostics.pnpmRegistry}`);
console.error(`npm config get optional: ${diagnostics.npmOptional}`);
console.error(`pnpm config get optional: ${diagnostics.pnpmOptional}`);

for (const [key, value] of Object.entries(diagnostics.env)) {
  console.error(`${key}: ${value ?? "<unset>"}`);
}

if (registryIssues.length > 0) {
  console.error("Registry drift detected. Expected https://registry.npmjs.org/ for all effective registry values.");
  for (const issue of registryIssues) {
    console.error(` - ${issue}`);
  }
}

if (optionalIssues.length > 0) {
  console.error("Optional dependency drift detected. Optional dependencies must remain enabled.");
  for (const issue of optionalIssues) {
    console.error(` - ${issue}`);
  }
}

console.error(`npm config get userconfig: ${npmUserConfig}`);
console.error(`npm config get globalconfig: ${npmGlobalConfig}`);

process.exit(1);
