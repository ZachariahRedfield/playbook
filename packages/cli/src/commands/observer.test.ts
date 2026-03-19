import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExitCode } from "../lib/cliContract.js";
import {
  createObserverServer,
  runObserver,
  OBSERVER_REPO_REGISTRY_RELATIVE_PATH,
} from "./observer/index.js";

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "playbook-observer-"));

const writeArtifact = (
  repoRoot: string,
  relativePath: string,
  payload: Record<string, unknown>,
): void => {
  const targetPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));
};

const parseJsonCall = (
  spy: ReturnType<typeof vi.spyOn>,
): Record<string, unknown> =>
  JSON.parse(String(spy.mock.calls.at(-1)?.[0] ?? "{}"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runObserver", () => {
  it("adds, lists, and removes repos deterministically", async () => {
    const cwd = makeTempDir();
    const repoA = path.join(cwd, "z-repo");
    const repoB = path.join(cwd, "a-repo");
    fs.mkdirSync(path.join(repoA, ".playbook"), { recursive: true });
    fs.mkdirSync(path.join(repoB, ".playbook"), { recursive: true });

    expect(
      await runObserver(
        cwd,
        ["repo", "add", repoA, "--id", "z-id", "--tag", "primary"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);
    expect(
      await runObserver(
        cwd,
        ["repo", "add", repoB, "--id", "a-id", "--tag", "self-host"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);

    const registryPath = path.join(cwd, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);
    expect(fs.existsSync(registryPath)).toBe(true);

    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8")) as {
      repos: Array<{ id: string }>;
    };
    expect(registry.repos.map((repo) => repo.id)).toEqual(["a-id", "z-id"]);

    const listSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    expect(
      await runObserver(cwd, ["repo", "list"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);
    const listPayload = parseJsonCall(listSpy);
    expect(
      (listPayload.registry as { repos: Array<{ id: string }> }).repos.map(
        (repo) => repo.id,
      ),
    ).toEqual(["a-id", "z-id"]);

    expect(
      await runObserver(cwd, ["repo", "remove", "a-id"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);
    const updated = JSON.parse(fs.readFileSync(registryPath, "utf8")) as {
      repos: Array<{ id: string }>;
    };
    expect(updated.repos.map((repo) => repo.id)).toEqual(["z-id"]);
  });

  it("rejects duplicate ids and duplicate roots", async () => {
    const cwd = makeTempDir();
    const repoA = path.join(cwd, "repo-a");
    const repoB = path.join(cwd, "repo-b");
    fs.mkdirSync(path.join(repoA, ".playbook"), { recursive: true });
    fs.mkdirSync(path.join(repoB, ".playbook"), { recursive: true });

    expect(
      await runObserver(cwd, ["repo", "add", repoA, "--id", "repo-main"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);

    const dupIdSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    expect(
      await runObserver(cwd, ["repo", "add", repoB, "--id", "repo-main"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Failure);
    expect(String(parseJsonCall(dupIdSpy).error)).toContain("duplicate id");

    const dupRootSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    expect(
      await runObserver(cwd, ["repo", "add", repoA, "--id", "repo-alt"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Failure);
    expect(String(parseJsonCall(dupRootSpy).error)).toContain("duplicate root");
  });

  it("uses deterministic observer root across nested cwd invocations", async () => {
    const homeRoot = makeTempDir();
    fs.writeFileSync(
      path.join(homeRoot, "package.json"),
      JSON.stringify({ name: "playbook-e2e" }, null, 2),
    );
    const nestedCwd = path.join(homeRoot, "apps", "nested");
    fs.mkdirSync(nestedCwd, { recursive: true });
    const repo = path.join(homeRoot, "repo-a");
    fs.mkdirSync(path.join(repo, ".playbook"), { recursive: true });

    expect(
      await runObserver(
        homeRoot,
        ["repo", "add", "./repo-a", "--id", "repo-a"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);

    const listSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    expect(
      await runObserver(nestedCwd, ["repo", "list"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);
    const listPayload = parseJsonCall(listSpy) as {
      observer_root: string;
      registry_path: string;
      repo_count: number;
      registry: { repos: Array<{ id: string }> };
    };
    expect(listPayload.observer_root).toBe(homeRoot);
    expect(listPayload.registry_path).toBe(
      path.join(homeRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH),
    );
    expect(listPayload.repo_count).toBe(1);
    expect(listPayload.registry.repos.map((entry) => entry.id)).toEqual([
      "repo-a",
    ]);
  });

  it("persists registry across add/list/serve invocations from different cwd values", async () => {
    const homeRoot = makeTempDir();
    fs.writeFileSync(
      path.join(homeRoot, "package.json"),
      JSON.stringify({ name: "playbook-observer-fixture" }, null, 2),
    );

    const repo = path.join(homeRoot, "repo-persisted");
    fs.mkdirSync(path.join(repo, ".playbook"), { recursive: true });

    const addCwd = path.join(homeRoot, "apps", "add");
    const listCwd = path.join(homeRoot, "apps", "list");
    const serveCwd = path.join(homeRoot, "apps", "serve");
    fs.mkdirSync(addCwd, { recursive: true });
    fs.mkdirSync(listCwd, { recursive: true });
    fs.mkdirSync(serveCwd, { recursive: true });

    expect(
      await runObserver(
        addCwd,
        ["repo", "add", repo, "--id", "repo-persisted"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);

    const listSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    expect(
      await runObserver(listCwd, ["repo", "list"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);
    const listPayload = parseJsonCall(listSpy) as {
      observer_root: string;
      registry_path: string;
      repo_count: number;
      registry: { repos: Array<{ id: string }> };
    };
    expect(listPayload.observer_root).toBe(homeRoot);
    expect(listPayload.registry_path).toBe(
      path.join(homeRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH),
    );
    expect(listPayload.repo_count).toBe(1);
    expect(listPayload.registry.repos.map((entry) => entry.id)).toEqual([
      "repo-persisted",
    ]);

    const server = createObserverServer(homeRoot, serveCwd);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );

    try {
      const address = server.address();
      expect(address).toBeTypeOf("object");
      const port = typeof address === "object" && address ? address.port : 0;
      const repos = await fetch(`http://127.0.0.1:${port}/repos`);
      const reposPayload = (await repos.json()) as {
        observer_root: string;
        registry_path: string;
        repo_count: number;
        repos: Array<{ id: string }>;
      };
      expect(reposPayload.observer_root).toBe(homeRoot);
      expect(reposPayload.registry_path).toBe(
        path.join(homeRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH),
      );
      expect(reposPayload.repo_count).toBe(1);
      expect(reposPayload.repos.map((entry) => entry.id)).toEqual([
        "repo-persisted",
      ]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("supports explicit --root override for repo commands", async () => {
    const outerCwd = makeTempDir();
    const observerRoot = path.join(outerCwd, "observer-root");
    const repo = path.join(observerRoot, "repo-b");
    fs.mkdirSync(path.join(repo, ".playbook"), { recursive: true });

    expect(
      await runObserver(
        outerCwd,
        ["repo", "add", "./repo-b", "--id", "repo-b", "--root", observerRoot],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);

    const listSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    expect(
      await runObserver(outerCwd, ["repo", "list", "--root", observerRoot], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);
    const listPayload = parseJsonCall(listSpy) as {
      observer_root: string;
      registry_path: string;
      registry: { repos: Array<{ id: string }> };
    };
    expect(listPayload.observer_root).toBe(path.resolve(observerRoot));
    expect(listPayload.registry_path).toBe(
      path.join(
        path.resolve(observerRoot),
        OBSERVER_REPO_REGISTRY_RELATIVE_PATH,
      ),
    );
    expect(listPayload.registry.repos[0]?.id).toBe("repo-b");
    expect(
      fs.existsSync(
        path.join(observerRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH),
      ),
    ).toBe(true);
  });

  it("writes stable artifacts for equivalent list operations", async () => {
    const cwd = makeTempDir();
    const repoA = path.join(cwd, "repo-a");
    fs.mkdirSync(path.join(repoA, ".playbook"), { recursive: true });

    expect(
      await runObserver(cwd, ["repo", "add", repoA, "--id", "repo-a"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);

    const registryPath = path.join(cwd, OBSERVER_REPO_REGISTRY_RELATIVE_PATH);
    const first = fs.readFileSync(registryPath, "utf8");

    expect(
      await runObserver(cwd, ["repo", "list"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);
    const second = fs.readFileSync(registryPath, "utf8");

    expect(second).toBe(first);
  });

  it("emits observer root metadata in serve json payload", async () => {
    const cwd = makeTempDir();
    const serveRoot = path.join(cwd, "observer-home");
    fs.mkdirSync(serveRoot, { recursive: true });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exitCodePromise = runObserver(
      cwd,
      ["serve", "--port", "0", "--root", serveRoot],
      { format: "json", quiet: false },
    );

    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalled();
      const payload = parseJsonCall(logSpy) as {
        command: string;
        observer_root: string;
        registry_path: string;
        repo_count: number;
      };
      expect(payload.command).toBe("observer-serve");
      expect(payload.observer_root).toBe(path.resolve(serveRoot));
      expect(payload.registry_path).toBe(
        path.join(
          path.resolve(serveRoot),
          OBSERVER_REPO_REGISTRY_RELATIVE_PATH,
        ),
      );
      expect(payload.repo_count).toBe(0);
    });

    process.kill(process.pid, "SIGTERM");
    await expect(exitCodePromise).resolves.toBe(ExitCode.Success);
  });
});

describe("observer server", () => {
  it("loads repos from observer home root when server starts in nested cwd", async () => {
    const homeRoot = makeTempDir();
    fs.writeFileSync(
      path.join(homeRoot, "package.json"),
      JSON.stringify({ name: "playbook-home" }, null, 2),
    );
    const nested = path.join(homeRoot, "tools", "observer");
    fs.mkdirSync(nested, { recursive: true });

    const repo = path.join(homeRoot, "repo-nested");
    fs.mkdirSync(path.join(repo, ".playbook"), { recursive: true });
    writeArtifact(repo, ".playbook/session.json", {
      schemaVersion: "1.0",
      kind: "session",
    });

    expect(
      await runObserver(
        homeRoot,
        ["repo", "add", "./repo-nested", "--id", "repo-nested"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);

    const server = createObserverServer(homeRoot, nested);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    expect(address).toBeTypeOf("object");
    const port = typeof address === "object" && address ? address.port : 0;

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    const reposJson = (await repos.json()) as {
      observer_root: string;
      registry_path: string;
      repo_count: number;
      repos: Array<{ id: string }>;
    };
    expect(reposJson.observer_root).toBe(homeRoot);
    expect(reposJson.registry_path).toBe(
      path.join(homeRoot, OBSERVER_REPO_REGISTRY_RELATIVE_PATH),
    );
    expect(reposJson.repo_count).toBe(1);
    expect(reposJson.repos.map((entry) => entry.id)).toEqual(["repo-nested"]);

    const uiResponse = await fetch(`http://127.0.0.1:${port}/`);
    const uiHtml = await uiResponse.text();
    expect(uiHtml).toContain("Backlog Summary");
    expect(uiHtml).toContain("Backlog List");
    expect(uiHtml).toContain("Story Detail");
    expect(uiHtml).toContain("Global Pattern Lineage");

    const uiScript = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    const uiScriptText = await uiScript.text();
    expect(uiScriptText).toContain("No repos connected in");
    expect(uiScriptText).toContain("const refreshAll = async () =>");
    expect(uiScriptText).toContain("refreshAll();");
    expect(uiScriptText).toContain("setInterval(refreshAll, 5000);");
    expect(uiScriptText).toContain("selectedRepoId = repos[0].id");
    expect(uiScriptText).toContain("await loadRepoDetail();");
    expect(uiScriptText).not.toContain(": any");
    expect(uiScriptText).not.toContain(" as any");

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("emits observer dashboard script as plain browser JavaScript without TypeScript syntax leakage", async () => {
    const cwd = makeTempDir();
    const repo = path.join(cwd, "repo-ui-script");
    fs.mkdirSync(path.join(repo, ".playbook"), { recursive: true });
    writeArtifact(repo, ".playbook/session.json", {
      schemaVersion: "1.0",
      kind: "session",
    });

    expect(
      await runObserver(cwd, ["repo", "add", repo, "--id", "repo-ui-script"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    expect(address).toBeTypeOf("object");
    const port = typeof address === "object" && address ? address.port : 0;

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    const reposJson = (await repos.json()) as { repos: Array<{ id: string }> };
    expect(reposJson.repos.length).toBeGreaterThan(0);

    const uiResponse = await fetch(`http://127.0.0.1:${port}/`);
    const uiHtml = await uiResponse.text();
    expect(uiHtml).toContain("Backlog Summary");
    expect(uiHtml).toContain("Backlog List");
    expect(uiHtml).toContain("Story Detail");

    const uiScript = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    const uiScriptText = await uiScript.text();

    expect(uiScriptText).toContain("const refreshAll = async () =>");
    expect(uiScriptText).toContain("renderRepos()");
    expect(uiScriptText).toContain("selectedRepoId = repos[0].id");
    expect(uiScriptText).toContain("await loadRepoDetail();");
    expect(uiScriptText).toContain("renderSelfObservation");
    expect(uiScriptText).toContain("const selfPayload = await getJson");
    expect(uiScriptText).toContain("const loadPromotionSummary = async () =>");
    expect(uiScriptText).toContain(
      "const loadGlobalPatternDetail = async () =>",
    );
    expect(uiScriptText).toContain("/api/cross-repo/global-patterns");
    expect(uiScriptText).toContain("await loadRepoDetail();");
    expect(uiScriptText).toContain("const refreshAll = async () =>");
    expect(uiScriptText).toContain("setInterval(refreshAll, 5000);");
    expect(uiScriptText).toContain("showObserverBootstrapError");
    expect(uiScriptText).toContain("Observer UI bootstrap failed.");

    expect(/\b:\s*any\b/.test(uiScriptText)).toBe(false);
    expect(/\bas\s+any\b/.test(uiScriptText)).toBe(false);
    expect(/=\s*<[A-Za-z_$][\w$]*>\s*\(/.test(uiScriptText)).toBe(false);
    expect(
      /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$][\w$<>,\s\[\]\|&]*\s*(?:=|;)/.test(
        uiScriptText,
      ),
    ).toBe(false);
    expect(
      /\bas\s+(?:const|unknown|never|[A-Z][\w$]*(?:<[^>]+>)?)\b/.test(
        uiScriptText,
      ),
    ).toBe(false);

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("serves health, repos, snapshot, repo and artifact endpoints deterministically", async () => {
    const cwd = makeTempDir();
    const repo = path.join(cwd, "repo-a");
    fs.mkdirSync(path.join(repo, ".playbook"), { recursive: true });
    fs.mkdirSync(path.join(cwd, ".playbook"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, ".playbook", "session.json"),
      JSON.stringify(
        { schemaVersion: "1.0", kind: "session", id: "session-a" },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(repo, ".playbook", "system-map.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          kind: "system-map",
          layers: [],
          nodes: [],
          edges: [],
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(repo, ".playbook", "promotion-receipts.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          kind: "promotion-receipt-log",
          receipts: [
            {
              schemaVersion: "1.0",
              kind: "promotion-receipt",
              receipt_id: "promotion-receipt:0001",
              promotion_kind: "story",
              workflow_kind: "promote-story",
              generated_at: "2026-01-03T00:00:00.000Z",
              source_ref: "global/patterns/pattern-promoted-global",
              source_fingerprint: "src-fp",
              target_artifact_path: ".playbook/stories.json",
              target_id: "story-pattern-adoption",
              before_fingerprint: null,
              after_fingerprint: "after-fp",
              outcome: "promoted",
              committed: true,
              committed_state_preserved: false,
              summary:
                "Promoted global/patterns/pattern-promoted-global to story story-pattern-adoption",
              conflict_reason: null,
            },
          ],
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(repo, ".playbook", "pattern-candidates.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          kind: "pattern-candidates",
          generatedAt: "2026-01-01T00:00:00.000Z",
          candidates: [
            {
              id: "pattern-candidate-repo",
              title: "Repo candidate",
              normalizationKey: "observer-layer",
              sourceRefs: [".playbook/stories.json"],
              status: "observed",
              pattern_family: "observer",
              description: "repo",
              source_artifact: ".playbook/stories.json",
              signals: ["join"],
              confidence: 0.8,
              evidence_refs: [".playbook/stories.json"],
            },
          ],
        },
        null,
        2,
      ),
    );
    // Repo promotion-layer joins are repo-scoped and read promoted memory from
    // `.playbook/memory/knowledge/patterns.json`, distinct from global lineage views.
    writeArtifact(repo, ".playbook/memory/knowledge/patterns.json", {
      schemaVersion: "1.0",
      command: "pattern-compaction",
      patterns: [
        {
          id: "pattern-promoted-repo",
          title: "Repo promoted",
          normalizationKey: "observer-layer",
          promotedFrom: "story-ready",
          sourceRefs: [".playbook/stories.json"],
        },
      ],
    });
    fs.writeFileSync(
      path.join(cwd, ".playbook", "pattern-candidates.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          kind: "pattern-candidates",
          generatedAt: "2026-01-01T00:00:00.000Z",
          candidates: [
            {
              id: "pattern-candidate-global",
              title: "Global candidate",
              normalizationKey: "observer-layer",
              sourceRefs: [".playbook/stories.json"],
              status: "observed",
              pattern_family: "observer",
              description: "global",
              source_artifact: ".playbook/stories.json",
              signals: ["join"],
              confidence: 0.9,
              evidence_refs: [".playbook/stories.json"],
            },
          ],
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(cwd, ".playbook", "patterns.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          command: "pattern-compaction",
          patterns: [
            {
              id: "pattern-promoted-global",
              title: "Global promoted",
              normalizationKey: "observer-layer",
              promotedFrom: "pattern-candidate-global",
              sourceRefs: [".playbook/stories.json"],
              provenance: {
                source_ref:
                  "global/pattern-candidates/pattern-candidate-global",
                candidate_id: "pattern-candidate-global",
                promoted_at: "2026-01-01T00:00:00.000Z",
              },
            },
          ],
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(repo, ".playbook", "stories.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          repo: "repo-a",
          stories: [
            {
              id: "story-ready",
              repo: "repo-a",
              title: "Render backlog summary",
              type: "feature",
              source: "manual",
              severity: "high",
              priority: "urgent",
              confidence: "high",
              status: "ready",
              evidence: ["session.json", "cycle-history.json"],
              rationale: "Observer should reflect canonical story state.",
              acceptance_criteria: ["Show summary", "Link evidence"],
              dependencies: [],
              execution_lane: "safe_single_pr",
              suggested_route: 'playbook route "render backlog summary" --json',
            },
            {
              id: "story-blocked",
              repo: "repo-a",
              title: "Blocked story",
              type: "governance",
              source: "manual",
              severity: "medium",
              priority: "high",
              confidence: "medium",
              status: "blocked",
              evidence: ["policy-evaluation.json"],
              rationale: "Blocked until evidence is available.",
              acceptance_criteria: ["Unblock later"],
              dependencies: ["story-ready"],
              execution_lane: null,
              suggested_route: null,
            },
            {
              id: "story-pattern-adoption",
              repo: "repo-a",
              title: "Adopt global pattern",
              type: "feature",
              source: "global-pattern-candidate",
              severity: "medium",
              priority: "medium",
              confidence: "high",
              status: "proposed",
              evidence: [".playbook/pattern-candidates.json"],
              rationale: "Derived from promoted pattern candidate.",
              acceptance_criteria: ["Adopt the global pattern"],
              dependencies: [],
              execution_lane: "safe_single_pr",
              suggested_route: "pattern_learning",
              provenance: {
                source_ref:
                  "global/pattern-candidates/pattern-candidate-global",
                promoted_from: "pattern-candidate",
                candidate_id: "pattern-candidate-global",
                candidate_fingerprint: "fp-pattern-candidate-global",
                source_artifact: ".playbook/pattern-candidates.json",
                promoted_at: "2026-01-02T00:00:00.000Z",
              },
            },
          ],
        },
        null,
        2,
      ),
    );

    expect(
      await runObserver(cwd, ["repo", "add", repo, "--id", "repo-a"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    expect(address).toBeTypeOf("object");
    const port = typeof address === "object" && address ? address.port : 0;

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    const healthJson = (await health.json()) as {
      status: string;
      readOnly: boolean;
      localOnly: boolean;
    };
    expect(healthJson).toMatchObject({
      status: "ok",
      readOnly: true,
      localOnly: true,
    });

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    expect(repos.status).toBe(200);
    const reposJson = (await repos.json()) as {
      home_repo_id: string | null;
      repos: Array<{
        id: string;
        readiness: { readiness_state: string; session_present: boolean };
      }>;
    };
    expect(reposJson.home_repo_id).toBeNull();
    expect(reposJson.repos.map((entry) => entry.id)).toEqual(["repo-a"]);
    expect(reposJson.repos[0]?.readiness.readiness_state).toBe(
      "partially_observable",
    );
    expect(reposJson.repos[0]?.readiness.session_present).toBe(true);

    const snapshot = await fetch(`http://127.0.0.1:${port}/snapshot`);
    expect(snapshot.status).toBe(200);
    const snapshotJson = (await snapshot.json()) as {
      home_repo_id: string | null;
      snapshot: { kind: string; repos: Array<{ id: string }> };
      readiness: Array<{ id: string; readiness: { readiness_state: string } }>;
      fleet: { total_repos: number };
    };
    expect(snapshotJson.home_repo_id).toBeNull();
    expect(snapshotJson.snapshot.kind).toBe("observer-snapshot");
    expect(snapshotJson.snapshot.repos.map((entry) => entry.id)).toEqual([
      "repo-a",
    ]);
    const systemMapInSnapshot = (
      snapshotJson.snapshot as {
        repos: Array<{ artifacts?: Array<{ kind: string; value: unknown }> }>;
      }
    ).repos[0]?.artifacts?.find((artifact) => artifact.kind === "system-map");
    expect(systemMapInSnapshot).toBeDefined();
    expect(snapshotJson.readiness[0]?.id).toBe("repo-a");
    expect(snapshotJson.readiness[0]?.readiness.readiness_state).toBe(
      "partially_observable",
    );
    expect(snapshotJson.fleet.total_repos).toBe(1);

    const receiptResponse = await fetch(
      `http://127.0.0.1:${port}/api/readiness/receipt`,
    );
    expect(receiptResponse.status).toBe(200);
    const receiptJson = (await receiptResponse.json()) as {
      kind: string;
      promotion: {
        workflow_kind: string;
        promotion_status: string;
        committed_target_path: string;
      };
      receipt: {
        kind: string;
        workflow_promotion: { workflow_kind: string; promotion_status: string };
        verification_summary: { prompts_total: number };
      };
    };
    expect(receiptJson.kind).toBe("observer-fleet-adoption-execution-receipt");
    expect(receiptJson.receipt.kind).toBe("fleet-adoption-execution-receipt");
    expect(receiptJson.receipt.workflow_promotion.workflow_kind).toBe(
      "status-updated",
    );
    expect(receiptJson.promotion.committed_target_path).toBe(
      ".playbook/execution-updated-state.json",
    );

    const promotionResponse = await fetch(
      `http://127.0.0.1:${port}/api/readiness/promotion`,
    );
    expect(promotionResponse.status).toBe(200);
    const promotionJson = (await promotionResponse.json()) as {
      kind: string;
      promotion: {
        workflow_kind: string;
        staged_generation: boolean;
        promotion_status: string;
        committed_state_preserved: boolean;
      };
      updated_state: { kind: string };
      receipt: { kind: string };
    };
    expect(promotionJson.kind).toBe("observer-fleet-adoption-promotion-state");
    expect(promotionJson.promotion).toMatchObject({
      workflow_kind: "status-updated",
      staged_generation: true,
      committed_state_preserved: true,
    });
    expect(promotionJson.updated_state.kind).toBe(
      "fleet-adoption-updated-state",
    );
    expect(promotionJson.receipt.kind).toBe("fleet-adoption-execution-receipt");

    const fleetReadiness = await fetch(
      `http://127.0.0.1:${port}/api/readiness/fleet`,
    );
    expect(fleetReadiness.status).toBe(200);
    const fleetReadinessJson = (await fleetReadiness.json()) as {
      kind: string;
      fleet: {
        total_repos: number;
        repos_by_priority: Array<{ repo_id: string }>;
      };
    };
    expect(fleetReadinessJson.kind).toBe("observer-fleet-readiness-summary");
    expect(fleetReadinessJson.fleet.total_repos).toBe(1);
    expect(fleetReadinessJson.fleet.repos_by_priority[0]?.repo_id).toBe(
      "repo-a",
    );

    const repoResponse = await fetch(`http://127.0.0.1:${port}/repos/repo-a`);
    expect(repoResponse.status).toBe(200);
    const repoJson = (await repoResponse.json()) as {
      repo: { id: string };
      readiness: { readiness_state: string };
      backlog: {
        summary: {
          highest_priority_ready_story: { id: string } | null;
          blocked_stories: Array<{ id: string }>;
          primary_next_action: string | null;
        };
      };
      promotion_layer: {
        joins: { linked_story_ids: string[]; linked_pattern_ids: string[] };
      };
    };
    expect(repoJson.repo.id).toBe("repo-a");
    expect(repoJson.readiness.readiness_state).toBe("partially_observable");
    expect(repoJson.backlog.summary.highest_priority_ready_story?.id).toBe(
      "story-ready",
    );
    expect(
      repoJson.backlog.summary.blocked_stories.map((story) => story.id),
    ).toEqual(["story-blocked"]);
    expect(repoJson.backlog.summary.primary_next_action).toContain(
      "story-ready",
    );
    expect(repoJson.promotion_layer.joins.linked_story_ids).toEqual([
      "story-ready",
    ]);
    expect(repoJson.promotion_layer.joins.linked_pattern_ids).toEqual([
      "pattern-promoted-repo",
    ]);

    const backlogResponse = await fetch(
      `http://127.0.0.1:${port}/repos/repo-a/backlog`,
    );
    expect(backlogResponse.status).toBe(200);
    const backlogJson = (await backlogResponse.json()) as {
      backlog: { artifact_path: string; stories: Array<{ id: string }> };
    };
    expect(backlogJson.backlog.artifact_path).toBe(".playbook/stories.json");
    expect(backlogJson.backlog.stories.map((story) => story.id)).toEqual([
      "story-ready",
      "story-blocked",
      "story-pattern-adoption",
    ]);

    const storyDetailResponse = await fetch(
      `http://127.0.0.1:${port}/repos/repo-a/backlog/stories/story-ready`,
    );
    expect(storyDetailResponse.status).toBe(200);
    const storyDetailJson = (await storyDetailResponse.json()) as {
      detail: {
        story: { id: string; suggested_route: string | null };
        linked_evidence: Array<{ artifact_path: string }>;
        linked_status: { readiness_state: string };
        raw_artifact_path: string;
        related: Array<{ id: string }>;
      };
    };
    expect(storyDetailJson.detail.story.id).toBe("story-ready");
    expect(storyDetailJson.detail.linked_status.readiness_state).toBe(
      "partially_observable",
    );
    expect(
      storyDetailJson.detail.linked_evidence.map(
        (entry) => entry.artifact_path,
      ),
    ).toContain(".playbook/session.json");
    expect(storyDetailJson.detail.raw_artifact_path).toBe(
      ".playbook/stories.json",
    );
    expect(storyDetailJson.detail.related.map((entry) => entry.id)).toContain(
      "pattern-promoted-repo",
    );

    const crossRepoPromotionResponse = await fetch(
      `http://127.0.0.1:${port}/api/cross-repo/promotion-layer`,
    );
    expect(crossRepoPromotionResponse.status).toBe(200);
    const crossRepoPromotionJson =
      (await crossRepoPromotionResponse.json()) as {
        promotion_layer: {
          derived_candidates: {
            raw_artifact_path: string;
            patterns: Array<{ id: string }>;
          };
          promoted_knowledge: {
            raw_artifact_path: string;
            patterns: Array<{ id: string }>;
          };
        };
      };
    expect(
      crossRepoPromotionJson.promotion_layer.derived_candidates
        .raw_artifact_path,
    ).toBe(".playbook/pattern-candidates.json");
    expect(
      crossRepoPromotionJson.promotion_layer.derived_candidates.patterns.map(
        (entry) => entry.id,
      ),
    ).toEqual(["pattern-candidate-global"]);
    expect(
      crossRepoPromotionJson.promotion_layer.promoted_knowledge.patterns.map(
        (entry) => entry.id,
      ),
    ).toEqual(["pattern-promoted-global"]);

    const globalPatternListResponse = await fetch(
      `http://127.0.0.1:${port}/api/cross-repo/global-patterns`,
    );
    expect(globalPatternListResponse.status).toBe(200);
    const globalPatternListJson = (await globalPatternListResponse.json()) as {
      patterns: Array<{
        id: string;
        candidate_id: string | null;
        linked_story_count: number;
        source_refs: string[];
        linked_repo_ids: string[];
      }>;
    };
    expect(globalPatternListJson.patterns).toEqual([
      expect.objectContaining({
        id: "pattern-promoted-global",
        candidate_id: "pattern-candidate-global",
        linked_story_count: 1,
        linked_repo_ids: ["repo-a"],
        source_refs: expect.arrayContaining([".playbook/stories.json"]),
      }),
    ]);

    const globalPatternDetailResponse = await fetch(
      `http://127.0.0.1:${port}/api/cross-repo/global-patterns/pattern-promoted-global`,
    );
    expect(globalPatternDetailResponse.status).toBe(200);
    const globalPatternDetailJson =
      (await globalPatternDetailResponse.json()) as {
        detail: {
          summary: {
            id: string;
            candidate_id: string | null;
            linked_story_count: number;
            source_refs: string[];
          };
          linked_stories: Array<{
            repo_id: string;
            story_id: string;
            provenance: { source_ref: string | null };
          }>;
          raw_artifact_path: string;
        };
      };
    expect(globalPatternDetailJson.detail.summary.id).toBe(
      "pattern-promoted-global",
    );
    expect(globalPatternDetailJson.detail.summary.candidate_id).toBe(
      "pattern-candidate-global",
    );
    expect(globalPatternDetailJson.detail.summary.linked_story_count).toBe(1);
    expect(globalPatternDetailJson.detail.summary.source_refs).toContain(
      ".playbook/stories.json",
    );
    expect(globalPatternDetailJson.detail.linked_stories).toEqual([
      expect.objectContaining({
        repo_id: "repo-a",
        story_id: "story-pattern-adoption",
        provenance: expect.objectContaining({
          source_ref: "global/pattern-candidates/pattern-candidate-global",
        }),
      }),
    ]);
    expect(globalPatternDetailJson.detail.raw_artifact_path).toBe(
      ".playbook/patterns.json",
    );

    const artifactResponse = await fetch(
      `http://127.0.0.1:${port}/repos/repo-a/artifacts/session`,
    );
    expect(artifactResponse.status).toBe(200);
    const artifactJson = (await artifactResponse.json()) as {
      artifact: { kind: string; value: { kind: string } };
    };
    expect(artifactJson.artifact.kind).toBe("session");
    expect(artifactJson.artifact.value.kind).toBe("session");

    const systemMapArtifactResponse = await fetch(
      `http://127.0.0.1:${port}/repos/repo-a/artifacts/system-map`,
    );
    expect(systemMapArtifactResponse.status).toBe(200);
    const systemMapArtifactJson = (await systemMapArtifactResponse.json()) as {
      artifact: { kind: string; value: { kind: string } };
    };
    expect(systemMapArtifactJson.artifact.kind).toBe("system-map");
    expect(systemMapArtifactJson.artifact.value.kind).toBe("system-map");

    const receiptArtifactResponse = await fetch(
      `http://127.0.0.1:${port}/repos/repo-a/artifacts/promotion-receipts`,
    );
    expect(receiptArtifactResponse.status).toBe(200);
    const receiptArtifactJson = (await receiptArtifactResponse.json()) as {
      artifact: {
        kind: string;
        value: { kind: string; receipts: Array<{ outcome: string }> };
      };
    };
    expect(receiptArtifactJson.artifact.kind).toBe("promotion-receipts");
    expect(receiptArtifactJson.artifact.value.kind).toBe(
      "promotion-receipt-log",
    );
    expect(
      receiptArtifactJson.artifact.value.receipts.map((entry) => entry.outcome),
    ).toEqual(["promoted"]);

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("computes deterministic readiness and lifecycle stages across fixture tiers", async () => {
    const cwd = makeTempDir();
    const connectedOnly = path.join(cwd, "repo-connected-only");
    const partiallyObservable = path.join(cwd, "repo-partially-observable");
    const indexedPlanPending = path.join(cwd, "repo-indexed-plan-pending");
    const proofCapable = path.join(cwd, "repo-proof-capable");
    const ready = path.join(cwd, "repo-ready");

    fs.mkdirSync(connectedOnly, { recursive: true });
    fs.mkdirSync(path.join(partiallyObservable, ".playbook"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(indexedPlanPending, ".playbook"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(proofCapable, ".playbook"), { recursive: true });
    fs.mkdirSync(path.join(ready, ".playbook"), { recursive: true });

    writeArtifact(partiallyObservable, ".playbook/session.json", {
      schemaVersion: "1.0",
      kind: "session",
    });

    writeArtifact(indexedPlanPending, ".playbook/repo-index.json", {
      framework: "node",
    });
    writeArtifact(indexedPlanPending, ".playbook/session.json", {
      schemaVersion: "1.0",
      kind: "session",
    });

    writeArtifact(proofCapable, ".playbook/repo-index.json", {
      framework: "node",
    });
    writeArtifact(proofCapable, ".playbook/repo-graph.json", { edges: [] });
    writeArtifact(proofCapable, ".playbook/plan.json", { command: "plan" });
    writeArtifact(proofCapable, ".playbook/session.json", {
      schemaVersion: "1.0",
      kind: "session",
    });

    writeArtifact(ready, ".playbook/repo-index.json", { framework: "node" });
    writeArtifact(ready, ".playbook/repo-graph.json", { edges: [] });
    writeArtifact(ready, ".playbook/plan.json", { command: "plan" });
    writeArtifact(ready, ".playbook/cycle-state.json", {
      schemaVersion: "1.0",
      kind: "cycle-state",
    });
    writeArtifact(ready, ".playbook/cycle-history.json", {
      schemaVersion: "1.0",
      kind: "cycle-history",
    });
    writeArtifact(ready, ".playbook/policy-evaluation.json", {
      schemaVersion: "1.0",
      kind: "policy-evaluation",
    });
    writeArtifact(ready, ".playbook/policy-apply-result.json", {
      schemaVersion: "1.0",
      kind: "policy-apply-result",
    });
    writeArtifact(ready, ".playbook/pr-review.json", {
      schemaVersion: "1.0",
      kind: "pr-review",
    });
    writeArtifact(ready, ".playbook/session.json", {
      schemaVersion: "1.0",
      kind: "session",
    });

    expect(
      await runObserver(
        cwd,
        ["repo", "add", connectedOnly, "--id", "connected-only"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);
    expect(
      await runObserver(
        cwd,
        ["repo", "add", partiallyObservable, "--id", "partial"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);
    expect(
      await runObserver(
        cwd,
        ["repo", "add", indexedPlanPending, "--id", "indexed-plan-pending"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);
    expect(
      await runObserver(
        cwd,
        ["repo", "add", proofCapable, "--id", "proof-capable"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);
    expect(
      await runObserver(cwd, ["repo", "add", ready, "--id", "ready"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    expect(address).toBeTypeOf("object");
    const port = typeof address === "object" && address ? address.port : 0;

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    expect(repos.status).toBe(200);
    const reposJson = (await repos.json()) as {
      repos: Array<{
        id: string;
        readiness: {
          readiness_state: string;
          lifecycle_stage: string;
          fallback_proof_ready: boolean;
          cross_repo_eligible: boolean;
          recommended_next_steps: string[];
          missing_artifacts: string[];
          last_artifact_update_time: string | null;
        };
      }>;
    };

    const states = Object.fromEntries(
      reposJson.repos.map((repo) => [repo.id, repo.readiness.readiness_state]),
    );
    expect(states).toEqual({
      "connected-only": "connected_only",
      partial: "partially_observable",
      "indexed-plan-pending": "partially_observable",
      "proof-capable": "partially_observable",
      ready: "observable",
    });

    const byId = Object.fromEntries(
      reposJson.repos.map((repo) => [repo.id, repo.readiness]),
    );

    expect(byId["connected-only"]?.lifecycle_stage).toBe(
      "playbook_not_detected",
    );
    expect(byId["connected-only"]?.recommended_next_steps[0]).toBe(
      "pnpm playbook init",
    );

    expect(byId.partial?.lifecycle_stage).toBe(
      "playbook_detected_index_pending",
    );
    expect(byId.partial?.cross_repo_eligible).toBe(false);

    expect(byId["indexed-plan-pending"]?.lifecycle_stage).toBe(
      "indexed_plan_pending",
    );
    expect(byId["indexed-plan-pending"]?.cross_repo_eligible).toBe(true);
    expect(byId["indexed-plan-pending"]?.fallback_proof_ready).toBe(false);

    expect(byId["proof-capable"]?.lifecycle_stage).toBe(
      "planned_apply_pending",
    );
    expect(byId["proof-capable"]?.fallback_proof_ready).toBe(true);
    expect(byId["proof-capable"]?.cross_repo_eligible).toBe(true);

    expect(byId.ready?.missing_artifacts).toEqual([]);
    expect(byId.ready?.lifecycle_stage).toBe("ready");
    expect(byId.ready?.fallback_proof_ready).toBe(true);
    expect(byId.ready?.cross_repo_eligible).toBe(true);
    expect(typeof byId.ready?.last_artifact_update_time).toBe("string");

    const uiResponse = await fetch(`http://127.0.0.1:${port}/`);
    const uiHtml = await uiResponse.text();
    expect(uiHtml).toContain("Backlog Summary");
    expect(uiHtml).toContain("Backlog List");
    expect(uiHtml).toContain("Story Detail");
    expect(uiHtml).toContain("Promotion Layer");
    expect(uiHtml).toContain("Global Promotion Layer");

    const uiScript = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    const uiScriptText = await uiScript.text();
    expect(uiScriptText).toContain("readiness: ");
    expect(uiScriptText).toContain("Missing artifacts:");
    expect(uiScriptText).toContain("Last artifact update:");
    expect(uiScriptText).toContain("renderSelfObservation");
    expect(uiScriptText).toContain("deriveNodeState");
    expect(uiScriptText).toContain("node-state-");
    expect(uiScriptText).toContain(
      "document.getElementById('controlLoopSummaryPanel')",
    );
    expect(uiScriptText).toContain("renderControlLoopSummary");
    expect(uiScriptText).toContain(
      "document.getElementById('backlogSummaryPanel')",
    );
    expect(uiScriptText).toContain(
      "document.getElementById('backlogListPanel')",
    );
    expect(uiScriptText).toContain(
      "document.getElementById('storyDetailPanel')",
    );
    expect(uiScriptText).toContain(
      "document.getElementById('promotionLayerPanel')",
    );
    expect(uiScriptText).toContain(
      "document.getElementById('crossRepoPromotionPanel')",
    );
    expect(uiScriptText).toContain("const loadBacklog = async () =>");
    expect(uiScriptText).toContain("const loadStoryDetail = async () =>");
    expect(uiScriptText).toContain("const renderPromotionLayer = (payload) =>");
    expect(uiScriptText).toContain(
      "const renderCrossRepoPromotionLayer = (payload) =>",
    );
    expect(uiScriptText).toContain("/backlog");
    expect(uiScriptText).toContain("/backlog/stories/");
    expect(uiScriptText).toContain("/api/cross-repo/promotion-layer");
    expect(uiScriptText).toContain(".playbook/stories.json");
    expect(uiScriptText).toContain(".playbook/pattern-candidates.json");
    expect(uiScriptText).toContain(".playbook/patterns.json");
    expect(uiScriptText).toContain("promotion-receipts");
    expect(uiScriptText).toContain("summary-strip");
    expect(uiScriptText).toContain("summary-pill");
    expect(uiScriptText).toContain("narrative-secondary");
    expect(uiScriptText).toContain("raw-truth-note");
    expect(uiScriptText).toContain("Control-plane artifacts present:</strong>");
    expect(uiScriptText).toContain("Runtime loop available:</strong>");
    expect(uiScriptText).toContain("Lifecycle stage:");
    expect(uiScriptText).toContain("Next command:");
    expect(uiScriptText).toContain("Reconciled updated state unavailable");
    expect(uiScriptText).toContain("Observed outcome counts:");
    expect(uiScriptText).toContain("Needs replan:");
    expect(uiScriptText).toContain("Needs review:");

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("selects playbook repo as self/home and reports blueprint missing guidance deterministically", async () => {
    const cwd = makeTempDir();
    const playbookRepo = path.join(cwd, "playbook");
    fs.mkdirSync(path.join(playbookRepo, ".playbook"), { recursive: true });

    writeArtifact(playbookRepo, ".playbook/repo-index.json", {
      framework: "node",
    });
    writeArtifact(playbookRepo, ".playbook/cycle-state.json", {
      schemaVersion: "1.0",
      kind: "cycle-state",
    });
    writeArtifact(playbookRepo, ".playbook/cycle-history.json", {
      schemaVersion: "1.0",
      kind: "cycle-history",
    });
    writeArtifact(playbookRepo, ".playbook/policy-evaluation.json", {
      schemaVersion: "1.0",
      kind: "policy-evaluation",
    });
    writeArtifact(playbookRepo, ".playbook/policy-apply-result.json", {
      schemaVersion: "1.0",
      kind: "policy-apply-result",
    });
    writeArtifact(playbookRepo, ".playbook/pr-review.json", {
      schemaVersion: "1.0",
      kind: "pr-review",
    });
    writeArtifact(playbookRepo, ".playbook/session.json", {
      schemaVersion: "1.0",
      kind: "session",
    });

    expect(
      await runObserver(
        cwd,
        ["repo", "add", playbookRepo, "--id", "playbook"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    expect(address).toBeTypeOf("object");
    const port = typeof address === "object" && address ? address.port : 0;

    const repos = await fetch(`http://127.0.0.1:${port}/repos`);
    const reposJson = (await repos.json()) as { home_repo_id: string | null };
    expect(reposJson.home_repo_id).toBe("playbook");

    const uiResponse = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    const uiScriptText = await uiResponse.text();
    expect(uiScriptText).toContain("Blueprint missing. Run");
    expect(uiScriptText).toContain(".playbook/system-map.json");
    expect(uiScriptText).toContain("renderSelfObservation");

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("serves cross-repo compare and candidates as read-only and evidence-backed payloads", async () => {
    const cwd = makeTempDir();
    const repoA = path.join(cwd, "repo-a");
    const repoB = path.join(cwd, "repo-b");
    fs.mkdirSync(path.join(repoA, ".playbook"), { recursive: true });
    fs.mkdirSync(path.join(repoB, ".playbook"), { recursive: true });

    writeArtifact(cwd, ".playbook/cross-repo-patterns.json", {
      schemaVersion: "1.0",
      kind: "cross-repo-patterns",
      source_repos: ["repo-a", "repo-b"],
      comparisons: [
        {
          left_repo_id: "repo-a",
          right_repo_id: "repo-b",
          repo_deltas: [
            {
              kind: "missing-artifact",
              left_evidence: [
                {
                  artifact_kind: "session",
                  artifact_path: ".playbook/session.json",
                  pointer: "/kind",
                  excerpt: "session",
                },
              ],
              right_evidence: [
                {
                  artifact_kind: "policy-evaluation",
                  artifact_path: ".playbook/policy-evaluation.json",
                  pointer: "/kind",
                  excerpt: "policy",
                },
              ],
            },
          ],
        },
      ],
      candidate_patterns: [
        {
          id: "portable-1",
          title: "Portable session evidence",
          classification: "artifact-pattern",
          supporting_repos: ["repo-a", "repo-b"],
          source_repo_ids: ["repo-a", "repo-b"],
          evidence: [
            {
              repo_id: "repo-a",
              artifact_kind: "session",
              artifact_path: ".playbook/session.json",
              pointer: "/id",
              excerpt: "evidence",
            },
          ],
        },
        {
          id: "portable-2",
          title: "Partial candidate fixture",
          classification: "artifact-pattern",
          evidence: [
            {
              repo_id: "repo-b",
              artifact_kind: "policy-evaluation",
              artifact_path: ".playbook/policy-evaluation.json",
              pointer: "/kind",
              excerpt: "policy",
            },
          ],
        },
      ],
    });

    expect(
      await runObserver(cwd, ["repo", "add", repoA, "--id", "repo-a"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);
    expect(
      await runObserver(cwd, ["repo", "add", repoB, "--id", "repo-b"], {
        format: "json",
        quiet: false,
      }),
    ).toBe(ExitCode.Success);

    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    expect(address).toBeTypeOf("object");
    const port = typeof address === "object" && address ? address.port : 0;

    const summary = await fetch(
      `http://127.0.0.1:${port}/api/cross-repo/summary`,
    );
    expect(summary.status).toBe(200);
    const summaryJson = (await summary.json()) as {
      readOnly: boolean;
      summary: {
        candidate_count: number;
        candidate_groups: Array<{ kind: string; affected_repo_count: number }>;
        primary_next_action: string;
      };
    };
    expect(summaryJson.readOnly).toBe(true);
    expect(summaryJson.summary.candidate_count).toBe(2);
    expect(summaryJson.summary.candidate_groups[0]?.kind).toBe(
      "artifact-pattern",
    );
    expect(summaryJson.summary.candidate_groups[0]?.affected_repo_count).toBe(
      2,
    );
    expect(summaryJson.summary.primary_next_action).toContain(
      "portable pattern",
    );

    const compare = await fetch(
      `http://127.0.0.1:${port}/api/cross-repo/compare?left=repo-a&right=repo-b`,
    );
    expect(compare.status).toBe(200);
    const compareJson = (await compare.json()) as {
      comparison: {
        left_repo_id: string;
        repo_deltas: Array<{ left_evidence: unknown[] }>;
      };
      deep_disclosure: { raw_artifact_path: string };
    };
    expect(compareJson.comparison.left_repo_id).toBe("repo-a");
    expect(
      compareJson.comparison.repo_deltas[0]?.left_evidence.length,
    ).toBeGreaterThan(0);
    expect(compareJson.deep_disclosure.raw_artifact_path).toBe(
      ".playbook/cross-repo-patterns.json",
    );

    const candidates = await fetch(
      `http://127.0.0.1:${port}/api/cross-repo/candidates`,
    );
    expect(candidates.status).toBe(200);
    const candidatesJson = (await candidates.json()) as {
      candidates: Array<{ id: string; supporting_repos?: string[] }>;
      candidate_groups: Array<{
        primary_next_action: string;
        patterns: Array<{ id: string; supporting_repos: string[] }>;
      }>;
      deep_disclosure: { raw_artifact_path: string };
    };
    expect(candidatesJson.candidates[0]?.id).toBe("portable-1");
    expect(candidatesJson.candidate_groups[0]?.primary_next_action).toContain(
      "portable pattern",
    );
    expect(
      Array.isArray(
        candidatesJson.candidate_groups[0]?.patterns[0]?.supporting_repos,
      ),
    ).toBe(true);
    expect(
      candidatesJson.candidate_groups[0]?.patterns.find(
        (pattern) => pattern.id === "portable-2",
      )?.supporting_repos,
    ).toEqual([]);
    expect(candidatesJson.deep_disclosure.raw_artifact_path).toBe(
      ".playbook/cross-repo-patterns.json",
    );

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("serves UI shell, supports repo add/remove mutations, and still rejects unsupported methods", async () => {
    const cwd = makeTempDir();
    const server = createObserverServer(cwd);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    expect(address).toBeTypeOf("object");
    const port = typeof address === "object" && address ? address.port : 0;

    const missingRepo = await fetch(`http://127.0.0.1:${port}/repos/unknown`);
    expect(missingRepo.status).toBe(404);
    const missingRepoJson = (await missingRepo.json()) as { error: string };
    expect(missingRepoJson.error).toBe("repo-not-found");

    const uiResponse = await fetch(`http://127.0.0.1:${port}/`);
    expect(uiResponse.status).toBe(200);
    const uiHtml = await uiResponse.text();
    expect(uiHtml).toContain("Observer Dashboard");
    expect(uiHtml).toContain('id="controlLoopSummaryPanel"');
    expect(uiHtml).toContain("System Blueprint");
    expect(uiHtml).toContain('details id="selfPanel"');
    expect(uiHtml).toContain("Selected Blueprint Node");
    expect(uiHtml).toContain("Repo View");
    expect(uiHtml).toContain("Cross-Repo View");

    const uiScript = await fetch(`http://127.0.0.1:${port}/ui/app.js`);
    expect(uiScript.status).toBe(200);
    const uiScriptText = await uiScript.text();
    expect(uiScriptText).toContain("setInterval(refreshAll, 5000)");
    expect(uiScriptText).toContain("'system-map'");
    expect(uiScriptText).toContain("renderSystemBlueprint");
    expect(uiScriptText).toContain("setActiveView('repo')");
    expect(uiScriptText).toContain(
      "Connect at least 2 repos to compare governed artifacts.",
    );
    expect(uiScriptText).toContain(
      "No canonical stories found in .playbook/stories.json. Generate or promote candidate stories",
    );
    expect(uiScriptText).toContain(
      "Signal-first grouped view; raw pairwise comparisons remain in deep disclosure.",
    );
    expect(uiScriptText).toContain("describeBlocker");
    expect(uiScriptText).toContain(
      "if ((!selectedRepoId || !repos.find((repo) => repo.id === selectedRepoId)) && repos.length > 0)",
    );

    const repoPath = path.join(cwd, "repo-http");
    fs.mkdirSync(repoPath, { recursive: true });
    const postAttempt = await fetch(`http://127.0.0.1:${port}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: repoPath, id: "repo-http" }),
    });
    expect(postAttempt.status).toBe(200);
    const postJson = (await postAttempt.json()) as {
      kind: string;
      repo: { id: string };
    };
    expect(postJson.kind).toBe("observer-server-repo-add");
    expect(postJson.repo.id).toBe("repo-http");

    const deleteAttempt = await fetch(
      `http://127.0.0.1:${port}/repos/repo-http`,
      { method: "DELETE" },
    );
    expect(deleteAttempt.status).toBe(200);
    const deleteJson = (await deleteAttempt.json()) as {
      kind: string;
      removedId: string;
    };
    expect(deleteJson.kind).toBe("observer-server-repo-remove");
    expect(deleteJson.removedId).toBe("repo-http");

    const patchAttempt = await fetch(`http://127.0.0.1:${port}/repos`, {
      method: "PATCH",
    });
    expect(patchAttempt.status).toBe(405);
    const patchJson = (await patchAttempt.json()) as { error: string };
    expect(patchJson.error).toBe("method-not-allowed");

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
});

describe("observer pattern context surfaces", () => {
  it("surfaces advisory pattern context on story detail and execution-plan detail without queue mutation", async () => {
    const homeRoot = makeTempDir();
    const repo = path.join(homeRoot, "repo-pattern-context");
    fs.mkdirSync(path.join(repo, ".playbook"), { recursive: true });
    fs.writeFileSync(
      path.join(homeRoot, "patterns.json"),
      JSON.stringify(
        {
          schemaVersion: "1.0",
          kind: "patterns",
          patterns: [
            {
              id: "pattern.docs",
              title: "Docs planning",
              when: "when",
              then: "then",
              because: "because",
              normalizationKey: "docs-only",
              sourceRefs: [
                {
                  repoId: "global",
                  artifactPath: "patterns.json",
                  entryId: "cand-docs",
                  fingerprint: "fp-docs",
                },
              ],
              status: "active",
              promotedAt: "2026-03-19T00:00:00.000Z",
              supersededBy: null,
              supersedes: [],
              retiredAt: null,
              retirementReason: null,
              demotedAt: null,
              demotionReason: null,
              recalledAt: null,
              recallReason: null,
              provenance: {
                sourceRefs: [
                  {
                    repoId: "global",
                    artifactPath: "patterns.json",
                    entryId: "cand-docs",
                    fingerprint: "fp-docs",
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
    writeArtifact(repo, ".playbook/stories.json", {
      schemaVersion: "1.0",
      repo: "repo-pattern-context",
      stories: [
        {
          id: "story.docs",
          repo: "repo-pattern-context",
          title: "Adopt pattern.docs",
          type: "governance",
          source: "manual",
          severity: "medium",
          priority: "high",
          confidence: "high",
          status: "ready",
          evidence: ["pattern.docs"],
          rationale: "Need docs discipline",
          acceptance_criteria: ["Reference pattern.docs in route"],
          dependencies: [],
          execution_lane: null,
          suggested_route: "docs_only",
        },
      ],
    });
    writeArtifact(repo, ".playbook/execution-plan.json", {
      schemaVersion: "1.0",
      kind: "execution-plan",
      generatedAt: "2026-03-19T00:00:00.000Z",
      proposalOnly: true,
      task_family: "docs_only",
      route_id: "deterministic_local:docs_only",
      rule_packs: [],
      required_validations: [],
      optional_validations: [],
      parallel_lanes: [],
      mutation_allowed: false,
      missing_prerequisites: [],
      sourceArtifacts: {
        taskExecutionProfile: {
          available: false,
          artifactPath: ".playbook/task-execution-profile.json",
        },
        learningState: {
          available: false,
          artifactPath: ".playbook/learning-state.json",
        },
      },
      learning_state_available: false,
      route_confidence: 0.6,
      expected_surfaces: [],
      likely_conflict_surfaces: [],
      dependency_level: "low",
      recommended_pr_size: "small",
      worker_ready: true,
      open_questions: [],
      warnings: [],
      story_reference: {
        story_reference: "story:story.docs",
        id: "story.docs",
        title: "Adopt pattern.docs",
        status: "ready",
        artifact_path: ".playbook/stories.json",
        suggested_route: "docs_only",
        execution_lane: null,
      },
    });

    process.env.PLAYBOOK_HOME = homeRoot;
    expect(
      await runObserver(
        homeRoot,
        ["repo", "add", repo, "--id", "repo-pattern-context"],
        { format: "json", quiet: false },
      ),
    ).toBe(ExitCode.Success);
    const server = createObserverServer(homeRoot, homeRoot);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const storyResponse = await fetch(
        `http://127.0.0.1:${port}/repos/repo-pattern-context/backlog/stories/story.docs`,
      );
      const storyPayload = (await storyResponse.json()) as {
        detail: {
          pattern_context: { patterns: Array<{ pattern_id: string }> };
        };
      };
      expect(
        storyPayload.detail.pattern_context.patterns.map(
          (entry) => entry.pattern_id,
        ),
      ).toEqual(["pattern.docs"]);

      const planResponse = await fetch(
        `http://127.0.0.1:${port}/repos/repo-pattern-context/artifacts/execution-plan`,
      );
      const planPayload = (await planResponse.json()) as {
        plan_detail: {
          pattern_context: { patterns: Array<{ pattern_id: string }> };
          lifecycle_warnings: string[];
        };
      };
      expect(
        planPayload.plan_detail.pattern_context.patterns.map(
          (entry) => entry.pattern_id,
        ),
      ).toEqual(["pattern.docs"]);
      expect(planPayload.plan_detail.lifecycle_warnings[0]).toContain("demoted");

      const storiesArtifact = JSON.parse(
        fs.readFileSync(path.join(repo, ".playbook/stories.json"), "utf8"),
      ) as { stories: Array<{ id: string }> };
      expect(storiesArtifact.stories.map((entry) => entry.id)).toEqual([
        "story.docs",
      ]);
    } finally {
      delete process.env.PLAYBOOK_HOME;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
