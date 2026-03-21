import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExitCode } from "../lib/cliContract.js";

const createFixtureRepo = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "playbook-docs-audit-"));
  fs.mkdirSync(path.join(root, "docs", "archive"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "stories"), { recursive: true });
  fs.mkdirSync(
    path.join(root, ".playbook", "orchestrator", "workers", "lane-1"),
    { recursive: true },
  );

  const files: Record<string, string> = {
    "README.md": "# README\nai-context ai-contract context verify plan apply\n",
    "AGENTS.md": "# AGENTS\n",
    "docs/index.md":
      "# Docs Index\nai-context ai-contract context verify plan apply\n",
    "docs/ARCHITECTURE.md": "# Architecture\n",
    "docs/commands/README.md":
      "# Commands\n\nLifecycle, role, and discoverability are documented here.\n",
    "docs/commands/docs.md": "# docs audit\n",
    "docs/PLAYBOOK_PRODUCT_ROADMAP.md":
      "# Strategic Roadmap\n\n## Pillars\n- Pillar A\n\n## Active Stories\n- Story A\n\nRoadmap entries describe implementation intent.\ndocs/commands/README.md is the source of truth for live command availability.\n",
    "docs/PLAYBOOK_BUSINESS_STRATEGY.md": "# Business\n",
    "docs/CONSUMER_INTEGRATION_CONTRACT.md": "# Contract\n",
    "docs/AI_AGENT_CONTEXT.md":
      "# AI Context\nai-context ai-contract context verify plan apply\n",
    "docs/ONBOARDING_DEMO.md":
      "# Demo\nai-context ai-contract context verify plan apply\n\nSupported question classes\nUnsupported question classes\nDeterministic fallback\n",
    "docs/REFERENCE/cli.md": "# CLI\n",
    "docs/FAQ.md": "# FAQ\nai-context ai-contract context verify plan apply\n",
    "docs/GITHUB_SETUP.md": "# Setup\n",
    "docs/roadmap/README.md": "# Roadmap\n",
    "docs/roadmap/ROADMAP.json": "{}\n",
    "docs/roadmap/IMPROVEMENTS_BACKLOG.md": "# Backlog\n",
    "docs/RELEASING.md": "# Releasing\n",
    "docs/archive/README.md": "# Archive\n",
    "docs/archive/PLAYBOOK_IMPROVEMENTS_2026.md": "# Archived Improvements\n",
    "docs/contracts/command-truth.json": JSON.stringify(
      {
        bootstrapLadder: ["ai-context", "ai-contract", "context"],
        remediationLoop: ["verify", "plan", "apply", "verify"],
        canonicalCommands: ["ai-context"],
        compatibilityCommands: ["analyze"],
        utilityCommands: ["demo"],
      },
      null,
      2,
    ),
    "packages/cli/README.md":
      "# Package\nai-context ai-contract context verify plan apply\n",
    ".playbook/orchestrator/orchestrator.json": JSON.stringify(
      {
        protectedSingletonDocs: [
          {
            targetDoc: "docs/CHANGELOG.md",
            consolidationStrategy: "deterministic-final-pass",
            rationale: "Canonical release/change narrative remains singleton.",
          },
        ],
      },
      null,
      2,
    ),
    ".playbook/orchestrator/workers/lane-1/worker-fragment.json":
      JSON.stringify(
        {
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
          artifact_path:
            ".playbook/orchestrator/workers/lane-1/worker-fragment.json",
          content: {
            format: "markdown",
            payload: "- Added docs consolidation seam.",
          },
        },
        null,
        2,
      ),
  };

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }

  return root;
};

describe("runDocs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("detects missing required anchors", { timeout: 15000 }, async () => {
    const repo = createFixtureRepo();
    fs.rmSync(path.join(repo, "docs", "roadmap", "IMPROVEMENTS_BACKLOG.md"));
    const { runDocs } = await import("./docs.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const exitCode = await runDocs(repo, ["audit"], {
      ci: false,
      format: "json",
      quiet: true,
    });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "docs.required-anchor.missing",
          path: "docs/roadmap/IMPROVEMENTS_BACKLOG.md",
          level: "error",
        }),
      ]),
    );
  });

  it("detects duplicate roadmap files", { timeout: 15000 }, async () => {
    const repo = createFixtureRepo();
    fs.writeFileSync(
      path.join(repo, "docs", "PRODUCT_ROADMAP.md"),
      "# old roadmap\n",
      "utf8",
    );
    const { runDocs } = await import("./docs.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runDocs(repo, ["audit"], { ci: false, format: "json", quiet: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "docs.single-roadmap.duplicate",
          path: "docs/PRODUCT_ROADMAP.md",
          level: "error",
        }),
      ]),
    );
  });

  it("detects idea leakage in non-planning docs", async () => {
    const repo = createFixtureRepo();
    fs.writeFileSync(
      path.join(repo, "docs", "AI_AGENT_CONTEXT.md"),
      "# AI Context\n\nUpcoming roadmap priorities for next features.\n",
      "utf8",
    );
    const { runDocs } = await import("./docs.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runDocs(repo, ["audit"], { ci: false, format: "json", quiet: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "docs.idea-leakage.detected",
          path: "docs/AI_AGENT_CONTEXT.md",
          level: "warning",
          suggestedDestination: "docs/roadmap/IMPROVEMENTS_BACKLOG.md",
        }),
      ]),
    );
  });

  it("emits stable JSON envelope", async () => {
    const repo = createFixtureRepo();
    const { runDocs } = await import("./docs.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runDocs(repo, ["audit"], { ci: false, format: "json", quiet: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.schemaVersion).toBe("1.0");
    expect(payload.command).toBe("docs audit");
    expect(payload.summary).toEqual(
      expect.objectContaining({
        errors: expect.any(Number),
        warnings: expect.any(Number),
        checksRun: expect.any(Number),
      }),
    );
    expect(payload.summary.checksRun).toBeGreaterThan(0);
    expect(Array.isArray(payload.findings)).toBe(true);
  });

  it("validates repo-scoped roadmap/story contracts when opted in", async () => {
    const repo = createFixtureRepo();
    fs.writeFileSync(
      path.join(repo, "docs", "ROADMAP.md"),
      [
        "# Product Roadmap",
        "",
        "## Pillars",
        "- UX",
        "",
        "## Active Stories",
        "- UI-001 – Screen normalization (in-progress)",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.mkdirSync(path.join(repo, "docs", "stories"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, "docs", "stories", "UI-001-screen-normalization.md"),
      [
        "# UI-001 – Screen normalization",
        "",
        "## Status",
        "in-progress",
        "",
        "## Pillar",
        "UI Normalization",
        "",
        "## Outcome",
        "Normalize screen layout.",
        "",
        "## Scope",
        "Included work.",
        "",
        "## Non-Goals",
        "Excluded work.",
        "",
        "## Surfaces",
        "Screen A",
        "",
        "## Dependencies",
        "None.",
        "",
        "## Done When",
        "Layout is consistent.",
        "",
        "## Evidence",
        "PR pending.",
        "",
      ].join("\n"),
      "utf8",
    );
    const { runDocs } = await import("./docs.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const exitCode = await runDocs(repo, ["audit"], {
      ci: false,
      format: "json",
      quiet: true,
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "docs.repo-roadmap.contract-missing-sections",
        }),
        expect.objectContaining({
          ruleId: "docs.story-contract.missing-sections",
        }),
      ]),
    );
  });

  it("fails when story docs miss required sections", async () => {
    const repo = createFixtureRepo();
    fs.writeFileSync(
      path.join(repo, "docs", "ROADMAP.md"),
      [
        "# Product Roadmap",
        "",
        "## Pillars",
        "- UX",
        "",
        "## Active Stories",
        "- UI-001 – Screen normalization (in-progress)",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.mkdirSync(path.join(repo, "docs", "stories"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, "docs", "stories", "UI-001-screen-normalization.md"),
      [
        "# UI-001 – Screen normalization",
        "",
        "## Status",
        "in-progress",
        "",
      ].join("\n"),
      "utf8",
    );
    const { runDocs } = await import("./docs.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const exitCode = await runDocs(repo, ["audit"], {
      ci: false,
      format: "json",
      quiet: true,
    });

    expect(exitCode).toBe(ExitCode.Failure);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "docs.story-contract.missing-sections",
          path: "docs/stories/UI-001-screen-normalization.md",
          level: "error",
        }),
      ]),
    );
  });

  it("writes docs consolidation artifact and returns compact brief output", async () => {
    const repo = createFixtureRepo();
    const { runDocs } = await import("./docs.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const exitCode = await runDocs(repo, ["consolidate"], {
      ci: false,
      format: "json",
      quiet: true,
    });

    expect(exitCode).toBe(ExitCode.Success);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.command).toBe("docs consolidate");
    expect(payload.artifact.summary.fragmentCount).toBe(1);
    expect(payload.artifact.brief).toContain("Lead-agent integration brief");
    expect(
      fs.existsSync(path.join(repo, ".playbook", "docs-consolidation.json")),
    ).toBe(true);
  });

  it("returns policy failure in ci mode when errors are present", async () => {
    const repo = createFixtureRepo();
    fs.rmSync(path.join(repo, "docs", "roadmap", "IMPROVEMENTS_BACKLOG.md"));
    const { runDocs } = await import("./docs.js");

    const exitCode = await runDocs(repo, ["audit"], {
      ci: true,
      format: "json",
      quiet: true,
    });
    expect(exitCode).toBe(ExitCode.PolicyFailure);
  });
});

it("writes docs consolidation plan artifact from consolidate output", async () => {
  const repo = createFixtureRepo();
  fs.writeFileSync(
    path.join(repo, "docs", "CHANGELOG.md"),
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
  fs.writeFileSync(
    path.join(
      repo,
      ".playbook",
      "orchestrator",
      "workers",
      "lane-1",
      "worker-fragment.json",
    ),
    JSON.stringify(
      {
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
        artifact_path:
          ".playbook/orchestrator/workers/lane-1/worker-fragment.json",
        content: {
          format: "json",
          payload: JSON.stringify({
            type: "replace-managed-block",
            startMarker: "<!-- PB:CHANGELOG_START -->",
            endMarker: "<!-- PB:CHANGELOG_END -->",
            content: "- Added docs consolidation seam.",
          }),
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  const { runDocs } = await import("./docs.js");
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

  await runDocs(repo, ["consolidate"], {
    ci: false,
    format: "json",
    quiet: true,
  });
  await runDocs(repo, ["consolidate-plan"], {
    ci: false,
    format: "json",
    quiet: true,
  });

  const payload = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
  expect(payload.command).toBe("docs consolidate-plan");
  expect(payload.artifact.tasks).toHaveLength(1);
  expect(
    fs.existsSync(path.join(repo, ".playbook", "docs-consolidation-plan.json")),
  ).toBe(true);
});
