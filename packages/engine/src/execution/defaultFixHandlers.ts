import fs from "node:fs/promises";
import path from "node:path";
import {
  applySafePlaybookIgnoreRecommendations,
  getDefaultPlaybookIgnoreSuggestions,
} from "../indexer/playbookIgnore.js";
import type { FixHandler } from "./types.js";

const PLAYBOOK_NOTES_STARTER = `# Playbook Notes

## YYYY-MM-DD

- WHAT changed:
- WHY it changed:
`;

const notesPath = (repoRoot: string): string =>
  path.join(repoRoot, "docs", "PLAYBOOK_NOTES.md");

const upsertLineEntries = async (
  filePath: string,
  entries: string[],
  dryRun: boolean,
): Promise<boolean> => {
  let current = "";
  try {
    current = await fs.readFile(filePath, "utf8");
  } catch {
    current = "";
  }

  const existing = new Set(
    current
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
  const missing = entries.filter((entry) => !existing.has(entry));

  if (missing.length === 0) {
    return false;
  }

  if (!dryRun) {
    const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    const payload = `${current}${separator}${missing.join("\n")}\n`;
    await fs.writeFile(filePath, payload, "utf8");
  }

  return true;
};

const fixNotesMissing: FixHandler = async ({ repoRoot, dryRun }) => {
  const targetPath = notesPath(repoRoot);

  if (!dryRun) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, PLAYBOOK_NOTES_STARTER, "utf8");
  }

  return {
    status: "applied",
    filesChanged: ["docs/PLAYBOOK_NOTES.md"],
    summary: "Created docs/PLAYBOOK_NOTES.md with a minimal starter template.",
  };
};

const fixNotesEmpty: FixHandler = async ({ repoRoot, dryRun }) => {
  const targetPath = notesPath(repoRoot);

  if (!dryRun) {
    await fs.writeFile(targetPath, PLAYBOOK_NOTES_STARTER, "utf8");
  }

  return {
    status: "applied",
    filesChanged: ["docs/PLAYBOOK_NOTES.md"],
    summary: "Wrote a minimal starter template to docs/PLAYBOOK_NOTES.md.",
  };
};

const fixPb012PlaybookIgnore: FixHandler = async ({ repoRoot, dryRun }) => {
  if (dryRun) {
    return {
      status: "applied",
      filesChanged: [".playbookignore"],
      summary:
        "Would apply safe-default ranked ignore recommendations to .playbookignore.",
    };
  }

  try {
    const result = applySafePlaybookIgnoreRecommendations(repoRoot);

    return {
      status: result.changed ? "applied" : "skipped",
      filesChanged: result.changed ? [".playbookignore"] : [],
      summary: result.changed
        ? "Applied safe-default ranked ignore recommendations to .playbookignore."
        : ".playbookignore already matched safe-default ranked ignore recommendations.",
    };
  } catch {
    const targetPath = path.join(repoRoot, ".playbookignore");
    const fallbackEntries = getDefaultPlaybookIgnoreSuggestions().filter(
      (entry) =>
        [".git", ".next/cache", "node_modules", "playwright-report"].includes(
          entry,
        ),
    );
    const changed = await upsertLineEntries(targetPath, fallbackEntries, false);

    return {
      status: changed ? "applied" : "skipped",
      filesChanged: changed ? [".playbookignore"] : [],
      summary: changed
        ? "Applied fallback safe-default .playbookignore entries because ranked recommendations were unavailable."
        : ".playbookignore already contained fallback safe-default entries.",
    };
  }
};

const fixPb013GitIgnore: FixHandler = async ({ repoRoot, dryRun }) => {
  const entries = [
    ".playbook/repo-index.json",
    ".playbook/plan.json",
    ".playbook/verify.json",
  ];
  const targetPath = path.join(repoRoot, ".gitignore");
  const changed = await upsertLineEntries(targetPath, entries, dryRun);

  return {
    status: changed ? "applied" : "skipped",
    filesChanged: changed ? [".gitignore"] : [],
    summary: changed
      ? "Updated .gitignore with runtime artifact entries."
      : ".gitignore already contained runtime artifact entries.",
  };
};

const ensureTrailingNewline = (value: string): string =>
  value.endsWith("\n") ? value : `${value}\n`;

const applyDocsConsolidationOperation = (
  current: string,
  task: Readonly<import("./types.js").PlanTask>,
): string => {
  const execution = task.execution;
  if (!execution || execution.kind !== "docs-consolidation") {
    throw new Error("Docs consolidation task is missing execution metadata.");
  }

  const normalized = current.replace(/\r\n/g, "\n");
  const operation = execution.operation;

  if (operation.type === "replace-managed-block") {
    const startIndex = normalized.indexOf(operation.startMarker);
    const endIndex = normalized.indexOf(
      operation.endMarker,
      startIndex + operation.startMarker.length,
    );
    if (startIndex < 0 || endIndex < 0) {
      throw new Error(`Managed block markers not found for ${task.file}.`);
    }
    const replacement = `${operation.startMarker}\n${operation.content}\n${operation.endMarker}`;
    return ensureTrailingNewline(
      `${normalized.slice(0, startIndex)}${replacement}${normalized.slice(endIndex + operation.endMarker.length)}`.replace(
        /\n{3,}/g,
        "\n\n",
      ),
    );
  }

  if (operation.type === "append-managed-block") {
    if (
      normalized.includes(operation.startMarker) ||
      normalized.includes(operation.endMarker)
    ) {
      throw new Error(
        `Managed block already exists in ${task.file}; append operation refused.`,
      );
    }
    const block = `${operation.startMarker}\n${operation.content}\n${operation.endMarker}`;
    return ensureTrailingNewline(
      normalized.replace(/\s*$/u, "") + `\n\n${block}`,
    );
  }

  const anchorIndex = normalized.indexOf(operation.anchor);
  if (anchorIndex < 0) {
    throw new Error(`Anchor "${operation.anchor}" not found in ${task.file}.`);
  }
  const insertAt = normalized.indexOf(
    "\n",
    anchorIndex + operation.anchor.length,
  );
  const position = insertAt >= 0 ? insertAt + 1 : normalized.length;
  return ensureTrailingNewline(
    `${normalized.slice(0, position)}${operation.content}\n${normalized.slice(position)}`.replace(
      /\n{3,}/g,
      "\n\n",
    ),
  );
};

const fixPb014MoveArtifacts: FixHandler = async ({ repoRoot, dryRun }) => {
  const candidates = ["repo-index.json", "plan.json", "verify.json"];
  const changes: string[] = [];

  for (const file of candidates) {
    const source = path.join(repoRoot, file);
    const destination = path.join(repoRoot, ".playbook", file);
    try {
      await fs.access(source);
    } catch {
      continue;
    }

    try {
      await fs.access(destination);
      continue;
    } catch {
      // destination missing: move candidate
    }

    if (!dryRun) {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
    }

    changes.push(file);
  }

  return {
    status: changes.length > 0 ? "applied" : "skipped",
    filesChanged: changes.map((entry) => entry),
    summary:
      changes.length > 0
        ? `Moved runtime artifacts into .playbook/: ${changes.join(", ")}`
        : "No movable runtime artifacts found at repository root.",
  };
};

const fixDocsConsolidationWrite: FixHandler = async ({
  repoRoot,
  dryRun,
  task,
}) => {
  if (!task.file) {
    throw new Error("Docs consolidation task must target exactly one file.");
  }

  const targetPath = path.join(repoRoot, task.file);
  const current = await fs.readFile(targetPath, "utf8");
  const next = applyDocsConsolidationOperation(current, task);
  const changed = next !== current;

  if (!dryRun && changed) {
    await fs.writeFile(targetPath, next, "utf8");
  }

  return changed
    ? {
        status: "applied",
        filesChanged: [task.file],
        summary: `Applied docs consolidation operation for ${task.execution?.sectionKey ?? "protected doc section"}.`,
      }
    : {
        status: "skipped",
        message:
          "Docs consolidation task already matches the target protected section.",
      };
};

export const defaultFixHandlers: Record<string, FixHandler> = {
  "notes.missing": fixNotesMissing,
  "notes.empty": fixNotesEmpty,
  PB012: fixPb012PlaybookIgnore,
  PB013: fixPb013GitIgnore,
  PB014: fixPb014MoveArtifacts,
  DOCS_CONSOLIDATION_WRITE: fixDocsConsolidationWrite,
};
