import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ContentCache } from "./content-cache.js";
import type { GraphNode, GraphEdge } from "../types.js";

describe("ContentCache", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-cache-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should cache and retrieve analysis result on matching content hash", () => {
    const cache = new ContentCache(tmpDir);
    const content = "export const answer = 42;\n";
    const nodes: GraphNode[] = [
      {
        id: "file:src/math.ts",
        type: "file",
        name: "math.ts",
        summary: "Returns 42",
        complexity: "simple",
        tags: [],
      },
    ];
    const edges: GraphEdge[] = [];

    // Initial query should be a miss
    const missed = cache.get("src/math.ts", content);
    expect(missed).toBeNull();

    // Cache the result and persist
    cache.set("src/math.ts", content, nodes, edges);
    cache.save();

    // Reload cache from disk
    const reloaded = new ContentCache(tmpDir);
    const hit = reloaded.get("src/math.ts", content);
    expect(hit).toBeDefined();
    expect(hit?.nodes[0].id).toBe("file:src/math.ts");

    // Altered content should result in a miss
    const modified = reloaded.get("src/math.ts", "export const answer = 43;\n");
    expect(modified).toBeNull();

    const stats = reloaded.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });
});
