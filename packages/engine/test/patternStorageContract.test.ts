import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listKnowledge } from "@zachariahredfield/playbook-core";
import {
  createDefaultGlobalPatternsArtifact,
  readGlobalPatternsArtifact,
  resolvePatternKnowledgeStore,
} from "../src/index.js";

const writeJson = (filePath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("pattern storage contract", () => {
  it("keeps promote and knowledge surfaces aligned on canonical global storage with deterministic compat reads", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "playbook-pattern-storage-"),
    );
    const repoRoot = path.join(root, "repo");
    const playbookHome = path.join(root, "playbook-home");
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.mkdirSync(playbookHome, { recursive: true });
    writeJson(path.join(repoRoot, "package.json"), {
      name: "pattern-storage-repo",
    });
    writeJson(path.join(playbookHome, "patterns.json"), {
      ...createDefaultGlobalPatternsArtifact(),
      patterns: [
        {
          id: "pattern.global.compat",
          title: "Compat global pattern",
          when: "when teams review storage scopes",
          then: "they resolve one shared contract",
          because: "scope-first resolution beats path inference",
          normalizationKey: "global-storage-contract",
          sourceRefs: [
            {
              repoId: "repo-a",
              artifactPath: ".playbook/story-candidates.json",
              entryId: "candidate-a",
              fingerprint: "fp-a",
            },
          ],
          status: "active",
          promotedAt: "2026-03-20T00:00:00.000Z",
          provenance: {
            sourceRefs: [
              {
                repoId: "repo-a",
                artifactPath: ".playbook/story-candidates.json",
                entryId: "candidate-a",
                fingerprint: "fp-a",
              },
            ],
          },
          supersededBy: null,
          supersedes: [],
          retiredAt: null,
          retirementReason: null,
          demotedAt: null,
          demotionReason: null,
          recalledAt: null,
          recallReason: null,
        },
      ],
    });

    try {
      const store = resolvePatternKnowledgeStore(
        "global_reusable_pattern_memory",
        { playbookHome },
      );
      expect(store.canonicalRelativePath).toBe(".playbook/patterns.json");
      expect(store.compatibilityRelativePaths).toEqual(["patterns.json"]);
      expect(store.resolvedFrom).toBe("compatibility");
      expect(
        path.relative(playbookHome, store.resolvedPath).replaceAll("\\", "/"),
      ).toBe("patterns.json");

      const promoted = readGlobalPatternsArtifact(playbookHome);
      expect(promoted.patterns.map((pattern) => pattern.id)).toEqual([
        "pattern.global.compat",
      ]);

      const knowledge = listKnowledge(repoRoot, {
        lifecycle: "active",
      });
      const globalPattern = knowledge.find(
        (record) => record.id === "pattern.global.compat",
      );
      expect(globalPattern?.source.kind).toBe("global-pattern-memory");
      expect(globalPattern?.source.path).toBe(
        path.relative(repoRoot, store.resolvedPath).replaceAll("\\", "/"),
      );
      expect(globalPattern?.provenance.repo).toBe(
        "global_reusable_pattern_memory",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
