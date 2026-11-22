import { describe, it, expect } from "vitest";
import { GraphAssembler } from "./merger.js";

describe("GraphAssembler", () => {
  it("should normalize IDs, deduplicate nodes, and drop dangling edges", () => {
    const assembler = new GraphAssembler();

    assembler.ingestBatch({
      nodes: [
        {
          id: "file:file:src/index.ts", // Double prefix
          type: "file",
          name: "index.ts",
          filePath: "src/index.ts",
          complexity: "low" as any, // Alias to simple
          summary: "Entry file",
          tags: ["app", "app"], // Needs deduplication
        },
        {
          id: "src/utils.ts", // Missing prefix
          type: "file",
          name: "utils.ts",
          filePath: "src/utils.ts",
          complexity: "hard" as any, // Alias to complex
          summary: "Utils file",
          tags: ["helper"],
        },
      ],
      edges: [
        {
          source: "file:file:src/index.ts",
          target: "src/utils.ts",
          type: "imports",
          direction: "forward",
          weight: 1,
        },
        {
          source: "file:src/index.ts",
          target: "file:nonexistent.ts", // Dangling edge
          type: "imports",
          direction: "forward",
          weight: 1,
        },
      ],
    });

    const graph = assembler.assemble({
      projectName: "AssemblerTest",
      languages: ["typescript"],
    });

    expect(graph.nodes.length).toBe(2);
    expect(graph.nodes[0].id).toBe("file:src/index.ts");
    expect(graph.nodes[0].complexity).toBe("simple");
    expect(graph.nodes[0].tags).toEqual(["app"]);

    expect(graph.nodes[1].id).toBe("file:src/utils.ts");
    expect(graph.nodes[1].complexity).toBe("complex");

    // Only 1 edge should survive, dangling edge should be dropped
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].source).toBe("file:src/index.ts");
    expect(graph.edges[0].target).toBe("file:src/utils.ts");
  });

  it("should link test files to production files with tested_by edges", () => {
    const assembler = new GraphAssembler();

    assembler.ingestBatch({
      nodes: [
        {
          id: "file:src/math.ts",
          type: "file",
          name: "math.ts",
          filePath: "src/math.ts",
          complexity: "simple",
          summary: "Math functions",
          tags: [],
        },
        {
          id: "file:src/math.test.ts",
          type: "file",
          name: "math.test.ts",
          filePath: "src/math.test.ts",
          complexity: "simple",
          summary: "Math tests",
          tags: [],
        },
      ],
      edges: [],
    });

    const graph = assembler.assemble({
      projectName: "TestLinker",
      languages: ["typescript"],
    });

    const testEdge = graph.edges.find((e) => e.type === "tested_by");
    expect(testEdge).toBeDefined();
    expect(testEdge?.source).toBe("file:src/math.ts");
    expect(testEdge?.target).toBe("file:src/math.test.ts");

    const prodNode = graph.nodes.find((n) => n.id === "file:src/math.ts");
    expect(prodNode?.tags).toContain("tested");
  });
});
