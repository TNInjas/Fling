import { describe, it, expect, beforeEach } from "vitest";
import { Pathfinder } from "./pathfinder.js";
import { GraphNavigator } from "./graph-navigator.js";
import type { KnowledgeGraph } from "../types.js";

describe("Pathfinder", () => {
  let sampleGraph: KnowledgeGraph;
  let pathfinder: Pathfinder;

  beforeEach(() => {
    sampleGraph = {
      version: "1.0.0",
      project: {
        name: "PathfinderTest",
        languages: ["ts"],
        frameworks: [],
        description: "Pathfinder test graph",
        analyzedAt: "2026-11-21T00:00:00Z",
        gitCommitHash: "hash123",
      },
      nodes: [
        { id: "A", type: "file", name: "A.ts", complexity: "simple", summary: "Node A", tags: [] },
        { id: "B", type: "file", name: "B.ts", complexity: "simple", summary: "Node B", tags: [] },
        { id: "C", type: "file", name: "C.ts", complexity: "simple", summary: "Node C", tags: [] },
        { id: "D", type: "file", name: "D.ts", complexity: "simple", summary: "Node D", tags: [] },
        { id: "E", type: "file", name: "E.ts", complexity: "simple", summary: "Node E", tags: [] },
      ],
      edges: [
        { source: "A", target: "B", type: "imports", direction: "forward", weight: 1 },
        { source: "B", target: "C", type: "calls", direction: "forward", weight: 1 },
        { source: "C", target: "D", type: "depends_on", direction: "forward", weight: 1 },
        { source: "A", target: "C", type: "imports", direction: "forward", weight: 1 }, // Shortcut A -> C
      ],
      layers: [],
      tour: [],
    };
    pathfinder = new Pathfinder(sampleGraph);
  });

  it("should find the shortest path between two nodes", () => {
    // Shortest path A -> D should be A -> C -> D (length 3 nodes) rather than A -> B -> C -> D (length 4)
    const path = pathfinder.findShortestPath("A", "D");
    expect(path).toEqual(["A", "C", "D"]);
  });

  it("should return null when no path exists", () => {
    const path = pathfinder.findShortestPath("D", "A");
    expect(path).toBeNull();

    const disconnectedPath = pathfinder.findShortestPath("A", "E");
    expect(disconnectedPath).toBeNull();
  });

  it("should find all simple paths between two nodes", () => {
    const allPaths = pathfinder.findAllPaths("A", "D", 5);
    expect(allPaths.length).toBe(2);
    expect(allPaths).toContainEqual(["A", "C", "D"]);
    expect(allPaths).toContainEqual(["A", "B", "C", "D"]);
  });

  it("should trace upstream dependencies and downstream dependents", () => {
    // Upstream of A: A depends on B, C, and D
    const upstream = pathfinder.traceDependencies("A", "upstream");
    const upstreamIds = upstream.map((u) => u.nodeId);
    expect(upstreamIds).toContain("B");
    expect(upstreamIds).toContain("C");
    expect(upstreamIds).toContain("D");

    // Downstream of D: D is depended on by C, B, A
    const downstream = pathfinder.traceDependencies("D", "downstream");
    const downstreamIds = downstream.map((d) => d.nodeId);
    expect(downstreamIds).toContain("C");
  });

  it("should detect circular dependencies / cycles in the graph", () => {
    // Add cycle: D -> A
    const cyclicGraph: KnowledgeGraph = {
      ...sampleGraph,
      edges: [
        ...sampleGraph.edges,
        { source: "D", target: "A", type: "imports", direction: "forward", weight: 1 },
      ],
    };

    const cyclicPathfinder = new Pathfinder(cyclicGraph);
    const cycles = cyclicPathfinder.findCycles();

    expect(cycles.length).toBeGreaterThan(0);
    // At least one cycle should contain A, C, D, A
    const cycleNodes = cycles.flat();
    expect(cycleNodes).toContain("A");
    expect(cycleNodes).toContain("D");
  });
});
