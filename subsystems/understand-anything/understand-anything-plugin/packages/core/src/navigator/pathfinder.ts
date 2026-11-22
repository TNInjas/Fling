import type { KnowledgeGraph, GraphEdge, EdgeType } from "../types.js";
import { GraphNavigator } from "./graph-navigator.js";

export interface PathOptions {
  edgeTypes?: EdgeType[];
  direction?: "forward" | "reverse" | "both";
  maxDepth?: number;
}

export interface DependencyTrace {
  nodeId: string;
  depth: number;
  path: string[];
  edgeType: EdgeType;
}

/**
 * Advanced graph pathfinding and topological analysis engine.
 * Computes shortest paths, simple paths, dependency closures, and cycle detection.
 */
export class Pathfinder {
  private readonly navigator: GraphNavigator;

  constructor(graphOrNavigator: KnowledgeGraph | GraphNavigator) {
    this.navigator =
      graphOrNavigator instanceof GraphNavigator
        ? graphOrNavigator
        : new GraphNavigator(graphOrNavigator);
  }

  /**
   * Finds the shortest path between two nodes using Breadth-First Search (BFS).
   *
   * @param sourceId Starting node ID
   * @param targetId Target node ID
   * @param options Direction and edge type constraints
   * @returns Array of node IDs representing the path, or null if no path exists
   */
  findShortestPath(
    sourceId: string,
    targetId: string,
    options: PathOptions = {},
  ): string[] | null {
    if (sourceId === targetId) return [sourceId];
    if (!this.navigator.getNode(sourceId) || !this.navigator.getNode(targetId)) {
      return null;
    }

    const maxDepth = options.maxDepth ?? 50;
    const allowedTypes = options.edgeTypes ? new Set(options.edgeTypes) : null;
    const direction = options.direction ?? "forward";

    const queue: Array<{ curr: string; path: string[] }> = [{ curr: sourceId, path: [sourceId] }];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const { curr, path } = queue.shift()!;
      if (path.length - 1 >= maxDepth) continue;

      const edges: GraphEdge[] = [];
      if (direction !== "reverse") {
        edges.push(...this.navigator.getOutgoingEdges(curr));
      }
      if (direction !== "forward") {
        edges.push(...this.navigator.getIncomingEdges(curr));
      }

      for (const edge of edges) {
        if (allowedTypes && !allowedTypes.has(edge.type)) continue;

        const nextNode = edge.source === curr ? edge.target : edge.source;
        if (nextNode === targetId) {
          return [...path, targetId];
        }

        if (!visited.has(nextNode)) {
          visited.add(nextNode);
          queue.push({ curr: nextNode, path: [...path, nextNode] });
        }
      }
    }

    return null;
  }

  /**
   * Finds all simple paths between two nodes up to a maximum depth limit.
   */
  findAllPaths(
    sourceId: string,
    targetId: string,
    maxDepth: number = 6,
    options: PathOptions = {},
  ): string[][] {
    const results: string[][] = [];
    if (!this.navigator.getNode(sourceId) || !this.navigator.getNode(targetId)) {
      return results;
    }

    const allowedTypes = options.edgeTypes ? new Set(options.edgeTypes) : null;

    const dfs = (curr: string, visited: Set<string>, currentPath: string[]) => {
      if (currentPath.length - 1 > maxDepth) return;
      if (curr === targetId) {
        results.push([...currentPath]);
        return;
      }

      const outEdges = this.navigator.getOutgoingEdges(curr);
      for (const edge of outEdges) {
        if (allowedTypes && !allowedTypes.has(edge.type)) continue;
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          currentPath.push(edge.target);
          dfs(edge.target, visited, currentPath);
          currentPath.pop();
          visited.delete(edge.target);
        }
      }
    };

    const initialVisited = new Set<string>([sourceId]);
    dfs(sourceId, initialVisited, [sourceId]);
    return results;
  }

  /**
   * Traces upstream dependencies (incoming depends_on, imports, calls)
   * or downstream dependents (outgoing depends_on, imports, calls).
   *
   * @param nodeId Focal node
   * @param direction "upstream" (what this node depends on) or "downstream" (what depends on this node)
   */
  traceDependencies(
    nodeId: string,
    direction: "upstream" | "downstream" = "upstream",
    maxDepth: number = 10,
  ): DependencyTrace[] {
    const traces: DependencyTrace[] = [];
    const visited = new Set<string>([nodeId]);

    // Relevant dependency edge types
    const depTypes = new Set<EdgeType>([
      "depends_on",
      "imports",
      "calls",
      "subscribes",
      "reads_from",
      "writes_to",
      "requires",
    ] as EdgeType[]);

    const queue: Array<{ id: string; depth: number; path: string[]; lastEdge: EdgeType }> = [
      { id: nodeId, depth: 0, path: [nodeId], lastEdge: "depends_on" },
    ];

    while (queue.length > 0) {
      const { id, depth, path } = queue.shift()!;
      if (depth >= maxDepth) continue;

      // Upstream = who does `id` depend on? (outgoing imports/calls/depends_on)
      // Downstream = who depends on `id`? (incoming imports/calls/depends_on)
      const edges =
        direction === "upstream"
          ? this.navigator.getOutgoingEdges(id)
          : this.navigator.getIncomingEdges(id);

      for (const edge of edges) {
        if (!depTypes.has(edge.type)) continue;
        const neighbor = direction === "upstream" ? edge.target : edge.source;

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const newPath = [...path, neighbor];
          traces.push({
            nodeId: neighbor,
            depth: depth + 1,
            path: newPath,
            edgeType: edge.type,
          });
          queue.push({
            id: neighbor,
            depth: depth + 1,
            path: newPath,
            lastEdge: edge.type,
          });
        }
      }
    }

    return traces;
  }

  /**
   * Detects circular dependencies / cycles in the graph (e.g. A imports B, B imports A).
   *
   * @param edgeTypes Optional subset of edge types to check (defaults to imports, calls, depends_on)
   * @returns Array of cycle paths, e.g. [["A", "B", "A"], ...]
   */
  findCycles(edgeTypes?: EdgeType[]): string[][] {
    const types = edgeTypes || (["imports", "calls", "depends_on"] as EdgeType[]);
    const allowed = new Set(types);

    const visited = new Set<string>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];

    const dfs = (curr: string) => {
      visited.add(curr);
      onStack.add(curr);
      stack.push(curr);

      const outEdges = this.navigator.getOutgoingEdges(curr);
      for (const edge of outEdges) {
        if (!allowed.has(edge.type)) continue;
        const target = edge.target;

        if (!visited.has(target)) {
          dfs(target);
        } else if (onStack.has(target)) {
          // Cycle detected!
          const cycleStart = stack.indexOf(target);
          if (cycleStart !== -1) {
            const cyclePath = [...stack.slice(cycleStart), target];
            cycles.push(cyclePath);
          }
        }
      }

      stack.pop();
      onStack.delete(curr);
    };

    for (const node of this.navigator.getAllNodes()) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }
}
