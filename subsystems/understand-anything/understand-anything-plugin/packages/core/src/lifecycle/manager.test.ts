import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GraphLifecycleManager } from "./manager.js";

describe("GraphLifecycleManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-lifecycle-test-"));
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "export const a = 1;\n");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should report uninitialized status on fresh project and initialize cleanly", async () => {
    const lifecycle = new GraphLifecycleManager(tmpDir);

    const initialStatus = await lifecycle.getStatus();
    expect(initialStatus.state).toBe("uninitialized");
    expect(initialStatus.nodeCount).toBe(0);

    // Auto-initialize
    const graph = await lifecycle.autoInitialize();
    expect(graph).toBeDefined();
    expect(graph.nodes.length).toBeGreaterThan(0);

    const postStatus = await lifecycle.getStatus();
    expect(postStatus.state).not.toBe("uninitialized");
    expect(postStatus.nodeCount).toBe(graph.nodes.length);
  });

  it("should perform maintenance by removing stale lock files and scratch files", async () => {
    const lifecycle = new GraphLifecycleManager(tmpDir);
    const uaDir = path.join(tmpDir, ".ua");
    const intermediateDir = path.join(uaDir, "intermediate");
    fs.mkdirSync(intermediateDir, { recursive: true });

    // Create dead lockfile
    fs.writeFileSync(
      path.join(uaDir, ".lock"),
      JSON.stringify({ pid: 99999999, createdAt: new Date().toISOString() }),
      "utf-8",
    );

    // Create scratch temp file
    fs.writeFileSync(path.join(intermediateDir, "scratch-batch-1.tmp"), "test data");

    const report = await lifecycle.maintain();
    expect(report.staleLocksRemoved).toBe(true);
    expect(report.cleanedScratchFiles).toBe(1);

    expect(fs.existsSync(path.join(uaDir, ".lock"))).toBe(false);
    expect(fs.existsSync(path.join(intermediateDir, "scratch-batch-1.tmp"))).toBe(false);
  });
});
