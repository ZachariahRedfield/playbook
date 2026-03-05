import { execSync } from "node:child_process";

function hasPnpm() {
  try {
    execSync("pnpm -v", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (process.env.CI === "true") {
  console.log("[prepare] CI detected; skipping lifecycle build.");
  process.exit(0);
}

if (!hasPnpm()) {
  console.log("[prepare] pnpm not found; skipping lifecycle build.");
  process.exit(0);
}

const cmd = "pnpm --filter @fawxzzy/playbook run build";
console.log(`[prepare] ${cmd}`);
execSync(cmd, { stdio: "inherit" });
