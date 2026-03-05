import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runAnalyze } from "./commands/analyze.js";
import { runVerify } from "./commands/verify.js";
import { runDoctor } from "./commands/doctor.js";

const program = new Command();

program.name("playbook").description("Lightweight project governance CLI").version("0.1.0");

program
  .command("init")
  .description("Initialize playbook docs/config")
  .action(() => runInit(process.cwd()));

program
  .command("analyze")
  .option("--json", "Output JSON")
  .description("Analyze project stack")
  .action((opts) => process.exit(runAnalyze(process.cwd(), Boolean(opts.json))));

program
  .command("verify")
  .option("--ci", "CI mode output")
  .option("--json", "Output JSON")
  .description("Verify governance rules")
  .action((opts) => process.exit(runVerify(process.cwd(), { ci: Boolean(opts.ci), json: Boolean(opts.json) })));

program.command("doctor").description("Check local setup").action(() => process.exit(runDoctor(process.cwd())));

program.parse();
