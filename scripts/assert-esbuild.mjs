#!/usr/bin/env node
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
try {
  ({ default: esbuild } = await import("esbuild"));
} catch (error) {
  fail("Unable to resolve the `esbuild` package from the current workspace.", error);
}

try {
  esbuild.transformSync("export const __playbookEsbuildProbe = 1;", { loader: "js" });
} catch (error) {
  fail("esbuild resolved but its platform binary is not executable in this environment.", error);
}

