#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runAnalyze } from "./commands/analyze.js";
import { runVerify } from "./commands/verify.js";
import { runDoctor } from "./commands/doctor.js";
import { runDiagram } from "./commands/diagram.js";

const program = new Command();
program.showHelpAfterError();

program.name("playbook").description("Lightweight project governance CLI").version("0.1.0");

program
  .command("init")
  .description("Initialize playbook docs/config")
  .action(() => runInit(process.cwd()));

program
  .command("analyze")
  .option("--ci", "CI mode output")
  .option("--json", "Output JSON")
  .description("Analyze project stack")
  .action((opts) => process.exit(runAnalyze(process.cwd(), { ci: Boolean(opts.ci), json: Boolean(opts.json) })));

program
  .command("verify")
  .option("--ci", "CI mode output")
  .option("--json", "Output JSON")
  .description("Verify governance rules")
  .action((opts) => process.exit(runVerify(process.cwd(), { ci: Boolean(opts.ci), json: Boolean(opts.json) })));

program.command("doctor").description("Check local setup").action(() => process.exit(runDoctor(process.cwd())));

program
  .command("diagram")
  .description("Generate deterministic architecture Mermaid diagrams")
  .option("--repo <path>", "Repository to scan", ".")
  .option("--out <path>", "Output markdown file", "docs/ARCHITECTURE_DIAGRAMS.md")
  .option("--deps", "Generate dependency diagram")
  .option("--structure", "Generate structure diagram")
  .action((opts) =>
    process.exit(
      runDiagram(process.cwd(), {
        repo: String(opts.repo ?? '.'),
        out: String(opts.out ?? 'docs/ARCHITECTURE_DIAGRAMS.md'),
        deps: Boolean(opts.deps),
        structure: Boolean(opts.structure)
      })
    )
  );

program.on('command:*', () => {
  program.outputHelp();
  process.exit(1);
});

program.parse();
