import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { main: "src/main.ts" },
  format: ["esm"],
  bundle: true,
  noExternal: [/.*/],
  dts: true,
  target: "es2022",
  clean: true,
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias ?? {}),
      "@zachariahredfield/playbook-core": path.resolve(__dirname, "../core/src/index.ts"),
      "@zachariahredfield/playbook-engine": path.resolve(__dirname, "../engine/src/index.ts"),
      "@zachariahredfield/playbook-node": path.resolve(__dirname, "../node/src/index.ts"),
    };
  },
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".js" : ".cjs",
    };
  },
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
});
