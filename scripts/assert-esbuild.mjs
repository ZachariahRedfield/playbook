#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const fail = (message, error) => {
  console.error("[assert-esbuild] esbuild preflight failed.");
  console.error(message);
  if (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  }
  console.error(
    "Install dependencies with optional packages enabled (for CI, prefer `pnpm install --config.optional=true`)."
  );
  process.exit(1);
};

let esbuild;
const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const declaredEsbuild =
  packageJson?.dependencies?.esbuild ??
  packageJson?.devDependencies?.esbuild ??
  packageJson?.optionalDependencies?.esbuild;

if (!declaredEsbuild) {
  fail(
    "Playbook test bootstrap requires `esbuild` to be explicitly declared in the repository root package.json (recommended: devDependencies.esbuild)."
  );
}

try {
  ({ default: esbuild } = await import("esbuild"));
} catch (error) {
  fail(
    "Unable to resolve declared `esbuild` from the current workspace. Run `pnpm install` with optional dependencies enabled.",
    error
  );
}

try {
  esbuild.transformSync("export const __playbookEsbuildProbe = 1;", { loader: "js" });
} catch (error) {
  fail("esbuild resolved but its platform binary is not executable in this environment.", error);
}
