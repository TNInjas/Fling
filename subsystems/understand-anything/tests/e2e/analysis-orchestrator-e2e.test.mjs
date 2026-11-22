import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import {
  AnalysisOrchestrator,
  HeuristicDriver,
  GraphNavigator,
  Pathfinder,
  SnapshotManager,
} from "../../understand-anything-plugin/packages/core/dist/index.js";

function git(projectRoot, ...args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
  }).trim();
}

describe("End-to-End Analysis Orchestrator & Knowledge Engine", () => {
  let root;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "ua-e2e-"));
    mkdirSync(join(root, "src"), { recursive: true });

    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "e2e-demo", version: "1.0.0", main: "src/index.ts" }, null, 2),
    );

    writeFileSync(
      join(root, "src", "index.ts"),
      `import { helper } from "./helper.js";
export function run() {
  return helper();
}
run();
`,
    );

    writeFileSync(
      join(root, "src", "helper.ts"),
      `export function helper() {
  return "hello world";
}
`,
    );

    git(root, "init");
    git(root, "config", "user.email", "e2e@example.com");
    git(root, "config", "user.name", "E2E Tester");
    git(root, "add", "--all");
    git(root, "commit", "-m", "initial commit");
  });

  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("orchestrates full project scan, graph generation, snapshot, and navigation", async () => {
    const phases = [];
    const driver = new HeuristicDriver();
    const orchestrator = new AnalysisOrchestrator(root, {
      driver,
      onProgress: (event) => {
        phases.push(event);
      },
    });

    const graph = await orchestrator.runFullAnalysis();

    // 1. Verify Pipeline Phases
    expect(phases.length).toBeGreaterThan(0);
    const phaseNames = phases.map((p) => p.phase);
    expect(phaseNames).toContain("PREFLIGHT");
    expect(phaseNames).toContain("SCAN");
    expect(phaseNames).toContain("BATCH");
    expect(phaseNames).toContain("ANALYZE");
    expect(phaseNames).toContain("ARCHITECTURE");
    expect(phaseNames).toContain("TOUR");
    expect(phaseNames).toContain("REVIEW");
    expect(phaseNames).toContain("SAVE");

    // 2. Verify Generated Graph Structure
    expect(graph).toBeDefined();
    expect(graph.project.name).toBe(basename(root));
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.layers.length).toBeGreaterThan(0);

    const fileNodes = graph.nodes.filter((n) => n.type === "file");
    expect(fileNodes.length).toBe(2);

    // 3. Verify Persistence on disk
    const diskPath = join(root, ".ua", "knowledge-graph.json");
    expect(existsSync(diskPath)).toBe(true);

    // 4. Verify Snapshot Ring Buffer
    const snapshotMgr = new SnapshotManager(root, { maxRetention: 5 });
    const snapshots = snapshotMgr.listSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);

    // 5. Verify Navigator Queries
    const navigator = new GraphNavigator(graph);
    const helperNodes = navigator.queryNodes({ filePathPattern: "helper.ts" });
    expect(helperNodes.length).toBe(1);
    expect(helperNodes[0].filePath).toBe("src/helper.ts");

    const indexNodes = navigator.queryNodes({ filePathPattern: "index.ts" });
    expect(indexNodes.length).toBe(1);

    // 6. Verify Subgraph Extraction
    const subgraph = navigator.getSubgraph(indexNodes[0].id, { radius: 1 });
    expect(subgraph.nodes.length).toBeGreaterThan(0);

    // 7. Verify Pathfinder
    const pathfinder = new Pathfinder(graph);
    const trace = pathfinder.traceDependencies(indexNodes[0].id, "downstream", 5);
    expect(trace).toBeDefined();
  });
});
