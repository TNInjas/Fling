import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AnalysisOrchestrator } from "./orchestrator.js";
import { HeuristicDriver } from "./drivers/heuristic.js";
import { AntigravityDriver } from "./drivers/antigravity.js";
import { loadGraph } from "../persistence/index.js";
import type { PhaseProgressEvent } from "./types.js";

describe("AnalysisOrchestrator", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-orchestrator-test-"));
    // Setup sample files
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "src", "index.ts"),
      "export const start = () => console.log('hello');\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, "README.md"),
      "# Sample Repo\nDescription\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should execute full analysis end-to-end with HeuristicDriver", async () => {
    const progressEvents: PhaseProgressEvent[] = [];
    const orchestrator = new AnalysisOrchestrator(tmpDir, {
      driver: new HeuristicDriver(),
    });

    const graph = await orchestrator.runFullAnalysis({
      onProgress: (ev) => progressEvents.push(ev),
    });

    expect(graph).toBeDefined();
    expect(graph.version).toBe("1.0.0");
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.layers.length).toBeGreaterThan(0);
    expect(graph.tour.length).toBeGreaterThan(0);

    // Verify events were emitted across all phases
    const phases = progressEvents.map((e) => e.phase);
    expect(phases).toContain("PREFLIGHT");
    expect(phases).toContain("SCAN");
    expect(phases).toContain("BATCH");
    expect(phases).toContain("ANALYZE");
    expect(phases).toContain("ARCHITECTURE");
    expect(phases).toContain("TOUR");
    expect(phases).toContain("SAVE");

    // Verify graph was persisted to disk in .ua/
    const diskGraph = loadGraph(tmpDir);
    expect(diskGraph).toBeDefined();
    expect(diskGraph?.nodes.length).toBe(graph.nodes.length);
  });

  it("should integrate with AntigravityDriver returning structured subagent results", async () => {
    // Mock Antigravity subagent invoker
    const mockInvoker = async (role: string) => {
      if (role === "File Analyzer") {
        return {
          nodes: [
            {
              id: "file:src/index.ts",
              type: "file",
              name: "index.ts",
              filePath: "src/index.ts",
              summary: "Structured index file",
              complexity: "simple",
              tags: ["core"],
            },
          ],
          edges: [],
        };
      }
      if (role === "Architecture Analyzer") {
        return [
          {
            id: "layer:core",
            name: "Core Layer",
            description: "Core logic",
            nodeIds: ["file:src/index.ts"],
          },
        ];
      }
      if (role === "Tour Builder") {
        return [
          {
            order: 1,
            title: "Start",
            description: "Tour stop",
            nodeIds: ["file:src/index.ts"],
          },
        ];
      }
      return {};
    };

    const orchestrator = new AnalysisOrchestrator(tmpDir, {
      driver: new AntigravityDriver(mockInvoker),
    });

    const graph = await orchestrator.runFullAnalysis();
    expect(graph.nodes.find((n) => n.id === "file:src/index.ts")?.summary).toBe(
      "Structured index file",
    );
    expect(graph.layers[0].id).toBe("layer:core");
  });
});
