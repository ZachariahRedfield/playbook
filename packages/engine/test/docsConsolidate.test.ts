import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compileDocsConsolidationPlan,
  runDocsConsolidation,
} from "../src/docs/consolidate.js";

const createFixtureRepo = (): string => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "playbook-docs-consolidate-"),
  );
  fs.mkdirSync(path.join(root, ".playbook", "orchestrator", "workers"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, ".playbook", "orchestrator", "orchestrator.json"),
    `${JSON.stringify(
      {
        protectedSingletonDocs: [
          {
            targetDoc: "docs/CHANGELOG.md",
            consolidationStrategy: "deterministic-final-pass",
            rationale: "Canonical release/change narrative remains singleton.",
          },
          {
            targetDoc: "docs/PLAYBOOK_PRODUCT_ROADMAP.md",
            consolidationStrategy: "deterministic-final-pass",
            rationale: "Roadmap rollups are protected singleton docs.",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return root;
};

const writeFragment = (
  root: string,
  laneId: string,
  fragment: Record<string, unknown>,
): void => {
  const laneDir = path.join(
    root,
    ".playbook",
    "orchestrator",
    "workers",
    laneId,
  );
  fs.mkdirSync(laneDir, { recursive: true });
  fs.writeFileSync(
    path.join(laneDir, "worker-fragment.json"),
    `${JSON.stringify(fragment, null, 2)}\n`,
    "utf8",
  );
};

const baseFragment = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  schemaVersion: "1.0",
  kind: "worker-fragment",
  lane_id: "lane-1",
  worker_id: "worker-1",
  fragment_id: "fragment-1",
  created_at: "2026-03-21T00:00:00.000Z",
  target_doc: "docs/CHANGELOG.md",
  section_key: "release-notes",
  conflict_key: "docs/CHANGELOG.md::release-notes",
  ordering_key: "0001:docs/CHANGELOG.md::release-notes::lane-1",
  status: "proposed",
  summary: "Add release note bullet for docs consolidation.",
  artifact_path: ".playbook/orchestrator/workers/lane-1/worker-fragment.json",
  content: {
    format: "markdown",
    payload: "- Added docs consolidation seam.",
  },
  metadata: {
    source_paths: ["docs/commands/docs.md"],
    notes: ["proposal-only"],
  },
  ...overrides,
});

describe("runDocsConsolidation", () => {
  it("writes a deterministic artifact for the same fragments", () => {
    const root = createFixtureRepo();
    writeFragment(
      root,
      "lane-b",
      baseFragment({
        lane_id: "lane-b",
        worker_id: "worker-b",
        fragment_id: "fragment-b",
        ordering_key: "0002:docs/PLAYBOOK_PRODUCT_ROADMAP.md::roadmap::lane-b",
        target_doc: "docs/PLAYBOOK_PRODUCT_ROADMAP.md",
        section_key: "roadmap",
        conflict_key: "docs/PLAYBOOK_PRODUCT_ROADMAP.md::roadmap",
        artifact_path:
          ".playbook/orchestrator/workers/lane-b/worker-fragment.json",
        summary: "Add roadmap note for consolidation seam.",
        content: { format: "markdown", payload: "- Added roadmap note." },
      }),
    );
    writeFragment(root, "lane-a", baseFragment());

    const first = runDocsConsolidation(root);
    const firstArtifactText = fs.readFileSync(
      path.join(root, ".playbook", "docs-consolidation.json"),
      "utf8",
    );
    const second = runDocsConsolidation(root);
    const secondArtifactText = fs.readFileSync(
      path.join(root, ".playbook", "docs-consolidation.json"),
      "utf8",
    );
    const firstLaneIds = first.artifact.fragments.map(
      (fragment) => fragment.lane_id,
    );
    const secondLaneIds = second.artifact.fragments.map(
      (fragment) => fragment.lane_id,
    );
    const firstOrderingKeys = first.artifact.fragments.map(
      (fragment) => fragment.ordering_key,
    );
    const secondOrderingKeys = second.artifact.fragments.map(
      (fragment) => fragment.ordering_key,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(firstArtifactText).toBe(secondArtifactText);
    expect(firstLaneIds).toEqual(["lane-1", "lane-b"]);
    expect(secondLaneIds).toEqual(firstLaneIds);
    expect(firstOrderingKeys).toEqual([
      "0001:docs/CHANGELOG.md::release-notes::lane-1",
      "0002:docs/PLAYBOOK_PRODUCT_ROADMAP.md::roadmap::lane-b",
    ]);
    expect(secondOrderingKeys).toEqual(firstOrderingKeys);
  });

  it("surfaces duplicate and conflicting fragments explicitly", () => {
    const root = createFixtureRepo();
    writeFragment(root, "lane-a", baseFragment());
    writeFragment(
      root,
      "lane-b",
      baseFragment({
        lane_id: "lane-b",
        worker_id: "worker-b",
        fragment_id: "fragment-b",
        ordering_key: "0002:docs/CHANGELOG.md::release-notes::lane-b",
        artifact_path:
          ".playbook/orchestrator/workers/lane-b/worker-fragment.json",
      }),
    );
    writeFragment(
      root,
      "lane-c",
      baseFragment({
        lane_id: "lane-c",
        worker_id: "worker-c",
        fragment_id: "fragment-c",
        ordering_key: "0003:docs/CHANGELOG.md::release-notes::lane-c",
        artifact_path:
          ".playbook/orchestrator/workers/lane-c/worker-fragment.json",
        content: { format: "markdown", payload: "- Conflicting release note." },
        summary: "Conflicting summary text.",
      }),
    );

    const result = runDocsConsolidation(root);

    expect(result.ok).toBe(false);
    expect(result.artifact.summary.issueCount).toBe(1);
    expect(result.artifact.summary.conflictCount).toBe(1);
    expect(result.artifact.issues).toEqual([
      expect.objectContaining({
        type: "conflict",
        conflictKey: "docs/CHANGELOG.md::release-notes",
        fragmentIds: ["fragment-1", "fragment-b", "fragment-c"],
      }),
    ]);
    expect(result.artifact.brief).toContain(
      "Blocking issues: 1 (0 duplicate, 1 conflict)",
    );
  });

  it("keeps the human-facing brief compact and proposal-only", () => {
    const root = createFixtureRepo();
    writeFragment(root, "lane-a", baseFragment());

    const result = runDocsConsolidation(root);
    const lines = result.artifact.brief.split("\n");

    expect(lines.length).toBeLessThanOrEqual(10);
    expect(result.artifact.brief).toContain("Lead-agent integration brief");
    expect(result.artifact.brief).toContain(
      "v1 does not auto-apply doc mutations",
    );
  });
});

it("compiles deterministic json fragments into an apply-compatible plan artifact", () => {
  const root = createFixtureRepo();
  fs.writeFileSync(
    path.join(root, "docs", "CHANGELOG.md"),
    [
      "# Changelog",
      "",
      "<!-- PB:CHANGELOG_START -->",
      "Old content",
      "<!-- PB:CHANGELOG_END -->",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFragment(
    root,
    "lane-a",
    baseFragment({
      content: {
        format: "json",
        payload: JSON.stringify({
          type: "replace-managed-block",
          startMarker: "<!-- PB:CHANGELOG_START -->",
          endMarker: "<!-- PB:CHANGELOG_END -->",
          content: "- Added docs consolidation seam.",
        }),
      },
    }),
  );
  runDocsConsolidation(root);
  const plan = compileDocsConsolidationPlan(root);
  expect(plan.kind).toBe("docs-consolidation-plan");
  expect(plan.tasks).toHaveLength(1);
  expect(plan.exclusions).toHaveLength(0);
  expect(plan.tasks[0]?.ruleId).toBe("DOCS_CONSOLIDATION_WRITE");
});

it("excludes missing anchors and conflicts from execution", () => {
  const root = createFixtureRepo();
  fs.writeFileSync(
    path.join(root, "docs", "CHANGELOG.md"),
    "# Changelog\n",
    "utf8",
  );
  writeFragment(
    root,
    "lane-a",
    baseFragment({
      content: {
        format: "json",
        payload: JSON.stringify({
          type: "insert-under-anchor",
          anchor: "## Missing Anchor",
          content: "- Added docs consolidation seam.",
        }),
      },
    }),
  );
  runDocsConsolidation(root);
  const plan = compileDocsConsolidationPlan(root);
  expect(plan.tasks).toHaveLength(0);
  expect(plan.exclusions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ reason: "missing_anchor" }),
    ]),
  );
});
