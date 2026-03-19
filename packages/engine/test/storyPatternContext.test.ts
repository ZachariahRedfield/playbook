import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildStoryPatternContext } from "../src/story/patternContext.js";
import type { StoryRecord } from "../src/story/stories.js";

const tempDirs: string[] = [];
const mkd = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

const baseStory = (overrides: Partial<StoryRecord> = {}): StoryRecord => ({
  id: "story.docs",
  repo: "repo-a",
  title: "Adopt pattern.docs and routing discipline",
  type: "governance",
  source: "manual",
  severity: "medium",
  priority: "high",
  confidence: "high",
  status: "ready",
  evidence: ["pattern.docs"],
  rationale: "Need stable docs workflow.",
  acceptance_criteria: ["Reference pattern.docs in planning."],
  dependencies: [],
  execution_lane: null,
  suggested_route: "docs_only",
  ...overrides,
});

afterEach(() => {
  while (tempDirs.length > 0)
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("buildStoryPatternContext", () => {
  it("matches promoted patterns deterministically and keeps stable ordering", () => {
    const home = mkd("playbook-pattern-context-");
    fs.writeFileSync(
      path.join(home, "patterns.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          kind: "patterns",
          patterns: [
            {
              id: "pattern.zeta",
              title: "Zeta",
              when: "when",
              then: "then",
              because: "because",
              normalizationKey: "docs-only",
              sourceRefs: [
                {
                  repoId: "global",
                  artifactPath: "patterns.json",
                  entryId: "cand-z",
                  fingerprint: "fp-z",
                },
              ],
              status: "promoted",
              promotedAt: "2026-03-19T00:00:00.000Z",
              provenance: {
                sourceRefs: [
                  {
                    repoId: "global",
                    artifactPath: "patterns.json",
                    entryId: "cand-z",
                    fingerprint: "fp-z",
                  },
                ],
              },
            },
            {
              id: "pattern.docs",
              title: "Docs",
              when: "when",
              then: "then",
              because: "because",
              normalizationKey: "pattern-docs",
              sourceRefs: [
                {
                  repoId: "global",
                  artifactPath: "patterns.json",
                  entryId: "cand-a",
                  fingerprint: "fp-a",
                },
              ],
              status: "active",
              promotedAt: "2026-03-18T00:00:00.000Z",
              provenance: {
                sourceRefs: [
                  {
                    repoId: "global",
                    artifactPath: "patterns.json",
                    entryId: "cand-a",
                    fingerprint: "fp-a",
                  },
                ],
              },
            },
          ],
        },
        null,
        2,
      ),
    );

    const context = buildStoryPatternContext(baseStory(), {
      playbookHome: home,
    });
    expect(context.patterns.map((entry) => entry.pattern_id)).toEqual([
      "pattern.docs",
      "pattern.zeta",
    ]);
    expect(context.patterns[0]).toMatchObject({
      why_matched: "explicit_pattern_reference",
    });
    expect(context.patterns[1]).toMatchObject({
      why_matched: "normalization_key_match",
    });
  });

  it("excludes non-active patterns from default advisory pattern context", () => {
    const home = mkd("playbook-pattern-context-filtered-");
    fs.mkdirSync(path.join(home, ".playbook"), { recursive: true });
    fs.writeFileSync(
      path.join(home, ".playbook", "patterns.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          kind: "patterns",
          patterns: [
            {
              id: "pattern.active",
              title: "Active",
              when: "when",
              then: "then",
              because: "because",
              normalizationKey: "pattern-active",
              sourceRefs: [],
              status: "active",
              promotedAt: "2026-03-19T00:00:00.000Z",
              provenance: { sourceRefs: [] },
            },
            {
              id: "pattern.retired",
              title: "Retired",
              when: "when",
              then: "then",
              because: "because",
              normalizationKey: "pattern-retired",
              sourceRefs: [],
              status: "retired",
              promotedAt: "2026-03-19T00:00:00.000Z",
              provenance: { sourceRefs: [] },
            },
            {
              id: "pattern.superseded",
              title: "Superseded",
              when: "when",
              then: "then",
              because: "because",
              normalizationKey: "pattern-superseded",
              sourceRefs: [],
              status: "superseded",
              promotedAt: "2026-03-19T00:00:00.000Z",
              provenance: { sourceRefs: [] },
            },
          ],
        },
        null,
        2,
      ),
    );

    const context = buildStoryPatternContext(
      baseStory({
        title: "Use pattern.active pattern.retired pattern.superseded",
        evidence: ["pattern.active", "pattern.retired", "pattern.superseded"],
      }),
      { playbookHome: home },
    );

    expect(context.patterns.map((entry) => entry.pattern_id)).toEqual([
      "pattern.active",
    ]);
  });

  it("degrades gracefully when no patterns match", () => {
    const home = mkd("playbook-pattern-context-empty-");
    fs.mkdirSync(path.join(home, ".playbook"), { recursive: true });
    fs.writeFileSync(
      path.join(home, ".playbook", "patterns.json"),
      JSON.stringify(
        { schemaVersion: "1.0", kind: "patterns", patterns: [] },
        null,
        2,
      ),
    );
    const context = buildStoryPatternContext(
      baseStory({
        title: "Unrelated work",
        evidence: [],
        acceptance_criteria: ["No pattern reference"],
      }),
      { playbookHome: home },
    );
    // No-match responses still report store resolution metadata so callers can distinguish
    // canonical `.playbook/patterns.json` resolution from future compatibility-path reads.
    expect(context.patterns).toEqual([]);
    expect(context.pattern_store).toEqual({
      scope: "global_reusable_pattern_memory",
      artifact_path: ".playbook/patterns.json",
      canonical_artifact_path: ".playbook/patterns.json",
      compat_artifact_paths: ["patterns.json"],
      resolution: "canonical",
    });
  });
});
