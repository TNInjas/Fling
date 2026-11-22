import { describe, it, expect, beforeEach } from "vitest";
import { GraphNavigator } from "./graph-navigator.js";
import type { KnowledgeGraph } from "../types.js";

describe("GraphNavigator", () => {
  let sampleGraph: KnowledgeGraph;
  let navigator: GraphNavigator;

  beforeEach(() => {
    sampleGraph = {
      version: "1.0.0",
      project: {
        name: "NavigatorTest",
        languages: ["typescript"],
        frameworks: ["react"],
        description: "Test graph for navigation",
        analyzedAt: "2026-11-21T00:00:00Z",
        gitCommitHash: "hash123",
      },
      nodes: [
        {
          id: "file:src/index.ts",
          type: "file",
          name: "index.ts",
          filePath: "src/index.ts",
          summary: "Main entry point",
          complexity: "simple",
          tags: ["entry", "bootstrap"],
        },
        {
          id: "file:src/App.tsx",
          type: "file",
          name: "App.tsx",
          filePath: "src/App.tsx",
          summary: "Root React Component",
          complexity: "moderate",
          tags: ["ui", "react"],
        },
        {
          id: "file:src/auth.ts",
          type: "file",
          name: "auth.ts",
          filePath: "src/auth.ts",
          summary: "Authentication service",
          complexity: "complex",
          tags: ["security", "auth"],
        },
        {
          id: "file:src/utils.ts",
          type: "file",
          name: "utils.ts",
          filePath: "src/utils.ts",
          summary: "Shared helper functions",
          complexity: "simple",
          tags: ["helper"],
        },
        {
          id: "config:tsconfig.json",
          type: "config",
          name: "tsconfig.json",
          filePath: "tsconfig.json",
          summary: "TypeScript config",
          complexity: "simple",
          tags: ["build"],
        },
      ],
      edges: [
        { source: "file:src/index.ts", target: "file:src/App.tsx", type: "imports", direction: "forward", weight: 1 },
        { source: "file:src/App.tsx", target: "file:src/auth.ts", type: "calls", direction: "forward", weight: 0.8 },
        { source: "file:src/auth.ts", target: "file:src/utils.ts", type: "imports", direction: "forward", weight: 0.5 },
      ],
      layers: [
        {
          id: "layer:presentation",
          name: "Presentation",
          description: "UI Components",
          nodeIds: ["file:src/index.ts", "file:src/App.tsx"],
        },
        {
          id: "layer:services",
          name: "Services",
          description: "Business and Auth Services",
          nodeIds: ["file:src/auth.ts", "file:src/utils.ts"],
        },
      ],
      tour: [
        {
          order: 1,
          title: "Entry",
          description: "Start here",
          nodeIds: ["file:src/index.ts"],
        },
      ],
    };
    navigator = new GraphNavigator(sampleGraph);
  });

  it("should retrieve nodes and their edges accurately", () => {
    const node = navigator.getNode("file:src/App.tsx");
    expect(node).toBeDefined();
    expect(node?.name).toBe("App.tsx");

    const outgoing = navigator.getOutgoingEdges("file:src/App.tsx");
    expect(outgoing.length).toBe(1);
    expect(outgoing[0].target).toBe("file:src/auth.ts");

    const incoming = navigator.getIncomingEdges("file:src/App.tsx");
    expect(incoming.length).toBe(1);
    expect(incoming[0].source).toBe("file:src/index.ts");
  });

  it("should extract k-hop subgraph with referential integrity", () => {
    // 1-hop around App.tsx
    const sub1 = navigator.getSubgraph("file:src/App.tsx", { radius: 1 });
    const sub1Ids = sub1.nodes.map((n) => n.id);

    expect(sub1Ids).toContain("file:src/App.tsx");
    expect(sub1Ids).toContain("file:src/index.ts");
    expect(sub1Ids).toContain("file:src/auth.ts");
    expect(sub1Ids).not.toContain("file:src/utils.ts"); // utils is 2 hops away

    // All edges in subgraph must connect nodes present in subgraph
    for (const edge of sub1.edges) {
      expect(sub1Ids).toContain(edge.source);
      expect(sub1Ids).toContain(edge.target);
    }

    // 2-hop around App.tsx
    const sub2 = navigator.getSubgraph("file:src/App.tsx", { radius: 2 });
    const sub2Ids = sub2.nodes.map((n) => n.id);
    expect(sub2Ids).toContain("file:src/utils.ts");
  });

  it("should query nodes using compound filters", () => {
    // Query by complexity
    const complexNodes = navigator.queryNodes({ complexity: ["complex"] });
    expect(complexNodes.length).toBe(1);
    expect(complexNodes[0].id).toBe("file:src/auth.ts");

    // Query by type
    const configNodes = navigator.queryNodes({ types: ["config"] });
    expect(configNodes.length).toBe(1);
    expect(configNodes[0].id).toBe("config:tsconfig.json");

    // Query by layer
    const layerNodes = navigator.queryNodes({ layerId: "layer:services" });
    expect(layerNodes.length).toBe(2);

    // Query by regex filePath
    const srcNodes = navigator.queryNodes({ filePathPattern: /^src\// });
    expect(srcNodes.length).toBe(4);

    // Query by search keyword
    const searchResults = navigator.queryNodes({ search: "helper" });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].id).toBe("file:src/utils.ts");
  });

  it("should query edges using filters", () => {
    const importEdges = navigator.queryEdges({ types: ["imports"] });
    expect(importEdges.length).toBe(2);

    const authCalls = navigator.queryEdges({ source: "file:src/App.tsx", target: "file:src/auth.ts" });
    expect(authCalls.length).toBe(1);
    expect(authCalls[0].type).toBe("calls");
  });
});
