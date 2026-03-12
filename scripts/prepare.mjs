import { execSync } from "node:child_process";

function hasPnpm() {
  try {
    execSync("pnpm -v", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (process.env.PLAYBOOK_PREPARE_BUILD !== "1") {
  console.log(
    "[prepare] Skipping lifecycle build. Set PLAYBOOK_PREPARE_BUILD=1 to enable.",
  );
  process.exit(0);
}

if (!hasPnpm()) {
  console.log("[prepare] pnpm not found; skipping lifecycle build.");
  process.exit(0);
}

const cmd = "pnpm -C packages/cli build";
console.log(`[prepare] ${cmd}`);
execSync(cmd, { stdio: "inherit" });
