#!/usr/bin/env node
const args = process.argv.slice(2);

const showHelp = () => {
  console.log(`Usage: playbook <command> [options]

Lightweight project governance CLI

Commands:
  init                        Initialize playbook docs/config
  analyze [--ci] [--json]     Analyze project stack
  verify [--ci] [--json]      Verify governance rules
  doctor                      Check local setup
  diagram [options]           Generate deterministic architecture Mermaid diagrams

Options:
  --help                      Show help
  --version                   Show version`);
};

const parseFlag = (flag: string) => args.includes(flag);
const parseOptionValue = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? String(args[index + 1]) : fallback;
};

if (args.length === 0 || parseFlag("--help") || parseFlag("-h")) {
  showHelp();
  process.exit(0);
}

if (parseFlag("--version") || parseFlag("-V")) {
  console.log("0.1.0");
  process.exit(0);
}

const command = args[0];

const run = async () => {
  switch (command) {
    case "init": {
      const { runInit } = await import("./commands/init.js");
      runInit(process.cwd());
      return;
    }
    case "analyze": {
      const { runAnalyze } = await import("./commands/analyze.js");
      process.exit(runAnalyze(process.cwd(), { ci: parseFlag("--ci"), json: parseFlag("--json") }));
      return;
    }
    case "verify": {
      const { runVerify } = await import("./commands/verify.js");
      process.exit(runVerify(process.cwd(), { ci: parseFlag("--ci"), json: parseFlag("--json") }));
      return;
    }
    case "doctor": {
      const { runDoctor } = await import("./commands/doctor.js");
      process.exit(runDoctor(process.cwd()));
      return;
    }
    case "diagram": {
      const { runDiagram } = await import("./commands/diagram.js");
      process.exit(
        runDiagram(process.cwd(), {
          repo: parseOptionValue("--repo", "."),
          out: parseOptionValue("--out", "docs/ARCHITECTURE_DIAGRAMS.md"),
          deps: parseFlag("--deps"),
          structure: parseFlag("--structure")
        })
      );
      return;
    }
    default:
      showHelp();
      process.exit(1);
  }
};

void run();
