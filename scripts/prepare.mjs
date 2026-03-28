import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function hasPnpm() {
  try {
    execSync("pnpm -v", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasGitRepo() {
  return fs.existsSync(path.resolve(process.cwd(), ".git"));
}

function installGitHooks() {
  if (!hasGitRepo()) {
    console.log("[prepare] No git repository detected; skipping hooks setup.");
    return;
  }

  try {
    execSync("git config core.hooksPath .husky", { stdio: "inherit" });
    console.log("[prepare] Configured git hooks path: .husky");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[prepare] Failed to configure git hooks path: ${message}`);
  }
}

if (!hasPnpm()) {
  console.log("[prepare] pnpm not found; skipping lifecycle tasks.");
  process.exit(0);
}

installGitHooks();

if (process.env.PLAYBOOK_PREPARE_BUILD !== "1") {
  console.log(
    "[prepare] Skipping lifecycle build. Set PLAYBOOK_PREPARE_BUILD=1 to enable.",
  );
  process.exit(0);
}

const cmd = "pnpm -C packages/cli build";
console.log(`[prepare] ${cmd}`);
execSync(cmd, { stdio: "inherit" });
