import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveGraph } from "../../understand-anything-plugin/packages/core/dist/index.js";
import { registerExpandedTools } from "../../understand-anything-plugin/packages/mcp/lib/expanded-tools.mjs";

describe("Expanded MCP Tools", () => {
  let tmpDir;
  const registeredTools = new Map();

  const mockServer = {
    registerTool: (name, config, handler) => {
      registeredTools.set(name, { config, handler });
    },
  };

  const sampleGraph = {
    version: "1.0.0",
    project: {
      name: "McpTest",
      languages: ["typescript"],
      frameworks: [],
      description: "Testing expanded tools",
      analyzedAt: "2026-11-21T00:00:00Z",
      gitCommitHash: "commit123",
    },
    nodes: [
      {
        id: "file:src/index.ts",
        type: "file",
        name: "index.ts",
        filePath: "src/index.ts",
        summary: "Entry file",
        complexity: "simple",
        tags: ["core"],
      },
      {
        id: "file:src/api.ts",
        type: "file",
        name: "api.ts",
        filePath: "src/api.ts",
        summary: "API router",
        complexity: "moderate",
        tags: ["api"],
      },
    ],
    edges: [
      {
        source: "file:src/index.ts",
        target: "file:src/api.ts",
        type: "imports",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [],
    tour: [],
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-mcp-test-"));
    saveGraph(tmpDir, sampleGraph);

    const helpers = {
      resolveProjectRoot: (p) => p || tmpDir,
      requireGraph: (root) => ({ graph: sampleGraph }),
      textResult: (text) => ({ content: [{ type: "text", text }] }),
      errorResult: (text) => ({ isError: true, content: [{ type: "text", text }] }),
      projectPathParam: undefined,
    };

    registerExpandedTools(mockServer, helpers);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    registeredTools.clear();
  });

  it("should register all expanded tools with correct metadata", () => {
    expect(registeredTools.has("understand_query_graph")).toBe(true);
    expect(registeredTools.has("understand_get_subgraph")).toBe(true);
    expect(registeredTools.has("understand_find_path")).toBe(true);
    expect(registeredTools.has("understand_update_node")).toBe(true);
    expect(registeredTools.has("understand_sync_incremental")).toBe(true);
    expect(registeredTools.has("understand_build")).toBe(true);
  });

  it("should query graph using understand_query_graph tool", async () => {
    const tool = registeredTools.get("understand_query_graph");
    const result = await tool.handler({
      projectPath: tmpDir,
      search: "router",
      format: "json",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe("file:src/api.ts");
  });

  it("should extract subgraph using understand_get_subgraph tool", async () => {
    const tool = registeredTools.get("understand_get_subgraph");
    const result = await tool.handler({
      projectPath: tmpDir,
      centerNodeId: "file:src/index.ts",
      radius: 1,
      format: "json",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.nodes.length).toBe(2);
    expect(parsed.edges.length).toBe(1);
  });

  it("should find path between nodes using understand_find_path tool", async () => {
    const tool = registeredTools.get("understand_find_path");
    const result = await tool.handler({
      projectPath: tmpDir,
      sourceNodeId: "file:src/index.ts",
      targetNodeId: "file:src/api.ts",
      format: "json",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.path).toEqual(["file:src/index.ts", "file:src/api.ts"]);
    expect(parsed.hops).toBe(1);
  });
});
