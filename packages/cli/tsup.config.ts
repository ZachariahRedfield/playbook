import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/main.ts" },
  format: ["esm"],
  dts: true,
  target: "es2022",
  clean: true,
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".js" : ".cjs",
    };
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
