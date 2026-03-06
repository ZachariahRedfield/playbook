import fs from "node:fs";
import path from "node:path";

export type NotesFileFailure = { id: string; message: string; path?: string; hint?: string; fix?: string };

export function requireNotesFileWhenGovernanceExists(repoRoot: string): NotesFileFailure[] {
  const governancePath = path.join(repoRoot, "docs", "PROJECT_GOVERNANCE.md");
  if (!fs.existsSync(governancePath)) return [];

  const notesPath = path.join(repoRoot, "docs", "PLAYBOOK_NOTES.md");
  if (!fs.existsSync(notesPath)) {
    return [
      {
        id: "notes.missing",
        path: "docs/PLAYBOOK_NOTES.md",
        message: "docs/PLAYBOOK_NOTES.md is required when docs/PROJECT_GOVERNANCE.md exists.",
        hint: "Create docs/PLAYBOOK_NOTES.md and add at least one entry describing the change.",
        fix: "create playbook notes file"
      }
    ];
  }

  const content = fs.readFileSync(notesPath, "utf8").trim();
  if (!content) {
    return [
      {
        id: "notes.empty",
        path: "docs/PLAYBOOK_NOTES.md",
        message: "docs/PLAYBOOK_NOTES.md exists but is empty.",
        hint: "Add at least one entry (e.g., a '## YYYY-MM-DD — Summary' section).",
        fix: "write starter notes template"
      }
    ];
  }

  return [];
}
