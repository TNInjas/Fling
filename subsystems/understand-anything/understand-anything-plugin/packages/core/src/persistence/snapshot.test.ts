import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SnapshotManager } from "./snapshot.js";
import { saveGraph } from "./index.js";
import type { KnowledgeGraph } from "../types.js";

describe("SnapshotManager", () => {
  let tmpDir: string;

  const sampleGraph: KnowledgeGraph = {
    version: "1.0.0",
    project: {
      name: "SnapshotTest",
      languages: ["ts"],
      frameworks: [],
      description: "Testing snapshots",
      analyzedAt: "2026-11-21T00:00:00Z",
      gitCommitHash: "commit_abc",
    },
    nodes: [
      { id: "file:src/index.ts", type: "file", name: "index.ts", summary: "Entrypoint", tags: [], complexity: "simple" },
    ],
    edges: [],
    layers: [],
    tour: [],
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-snapshot-test-"));
    saveGraph(tmpDir, sampleGraph);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create snapshots and rotate beyond retention limit", async () => {
    const manager = new SnapshotManager(tmpDir, { maxRetention: 3 });

    const s1 = await manager.createSnapshot("initial_build");
    expect(s1).toBeDefined();

    // Small delay to ensure timestamp sorting
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await manager.createSnapshot("edit_1");
    await new Promise((r) => setTimeout(r, 10));
    const s3 = await manager.createSnapshot("edit_2");
    await new Promise((r) => setTimeout(r, 10));
    const s4 = await manager.createSnapshot("edit_3");

    const snapshots = manager.listSnapshots();
    expect(snapshots.length).toBe(3); // strictly capped at 3
    expect(snapshots[0].reason).toBe("edit_3"); // newest first
  });

  it("should rollback to previous valid snapshot successfully", async () => {
    const manager = new SnapshotManager(tmpDir, { maxRetention: 5 });
    await manager.createSnapshot("good_state");

    // Mutate graph to a bad state
    const badGraph: KnowledgeGraph = {
      ...sampleGraph,
      nodes: [],
    };
    saveGraph(tmpDir, badGraph);

    // Rollback
    const success = manager.rollback();
    expect(success).toBe(true);

    const restored = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".ua", "knowledge-graph.json"), "utf-8"),
    );
    expect(restored.nodes.length).toBe(1);
    expect(restored.nodes[0].id).toBe("file:src/index.ts");
  });

  it("should preserve failed update without modifying main graph", () => {
    const manager = new SnapshotManager(tmpDir);
    const corruptedCandidate = { invalid: true };
    const savedPath = manager.preserveFailedUpdate(corruptedCandidate, "ZodValidationFailed");

    expect(fs.existsSync(savedPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(savedPath, "utf-8"));
    expect(content.errorReason).toBe("ZodValidationFailed");
    expect(content.candidate).toEqual(corruptedCandidate);

    // Main graph remains intact
    const mainGraph = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".ua", "knowledge-graph.json"), "utf-8"),
    );
    expect(mainGraph.nodes.length).toBe(1);
  });
});
