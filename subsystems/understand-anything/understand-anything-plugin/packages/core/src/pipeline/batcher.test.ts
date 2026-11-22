import { describe, it, expect } from "vitest";
import { BatchCoordinator } from "./batcher.js";
import type { ScannedFileInfo } from "./scanner.js";

describe("BatchCoordinator", () => {
  it("should partition files into batches respecting maxBatchSize and maxBatchLines", () => {
    const mockFiles: ScannedFileInfo[] = [
      { path: "src/a.ts", language: "typescript", sizeLines: 500, fileCategory: "code" },
      { path: "src/b.ts", language: "typescript", sizeLines: 800, fileCategory: "code" },
      { path: "src/c.ts", language: "typescript", sizeLines: 900, fileCategory: "code" }, // triggers line limit
      { path: "src/d.ts", language: "typescript", sizeLines: 200, fileCategory: "code" },
    ];

    const batches = BatchCoordinator.computeBatches(mockFiles, {
      maxBatchSize: 2,
      maxBatchLines: 1500,
    });

    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch.files.length).toBeLessThanOrEqual(2);
      expect(batch.totalBatches).toBe(batches.length);
    }
  });

  it("should return empty array when no analyzable files exist", () => {
    const mockFiles: ScannedFileInfo[] = [
      { path: "README.md", language: "markdown", sizeLines: 10, fileCategory: "docs" },
    ];

    const batches = BatchCoordinator.computeBatches(mockFiles);
    expect(batches).toEqual([]);
  });
});
