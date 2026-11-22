import type { KnowledgeGraph, GraphNode, GraphEdge, NodeType, EdgeType } from "../types.js";

export interface SubgraphOptions {
  radius?: number;
  edgeTypes?: EdgeType[];
  direction?: "forward" | "reverse" | "both";
  maxNodes?: number;
}

export interface NodeQueryFilter {
  types?: NodeType[];
  tags?: string[];
  complexity?: GraphNode["complexity"][];
  layerId?: string;
  filePathPattern?: RegExp | string;
  search?: string;
  limit?: number;
}

export interface EdgeQueryFilter {
  types?: EdgeType[];
  source?: string;
  target?: string;
  minWeight?: number;
  limit?: number;
}

/**
 * High-performance indexed graph navigator.
 * Builds multi-attribute indices and dual-adjacency lists for fast traversal,
 * k-hop subgraph extraction, and compound multi-criteria querying.
 */
export class GraphNavigator {
  private readonly graph: KnowledgeGraph;
  private readonly nodeMap = new Map<string, GraphNode>();
  private readonly forwardEdges = new Map<string, GraphEdge[]>();
  private readonly reverseEdges = new Map<string, GraphEdge[]>();

  // Secondary indices
  private readonly byType = new Map<NodeType, Set<string>>();
  private readonly byFilePath = new Map<string, Set<string>>();
  private readonly byLayer = new Map<string, Set<string>>();
  private readonly byTag = new Map<string, Set<string>>();
  private readonly byComplexity = new Map<string, Set<string>>();

  constructor(graph: KnowledgeGraph) {
    this.graph = graph;
    this.buildIndices();
  }

  private buildIndices(): void {
    // 1. Index nodes
    for (const node of this.graph.nodes) {
      this.nodeMap.set(node.id, node);
      this.forwardEdges.set(node.id, []);
      this.reverseEdges.set(node.id, []);

      // Index by type
      if (!this.byType.has(node.type)) this.byType.set(node.type, new Set());
      this.byType.get(node.type)!.add(node.id);

      // Index by filePath
      if (node.filePath) {
        if (!this.byFilePath.has(node.filePath)) this.byFilePath.set(node.filePath, new Set());
        this.byFilePath.get(node.filePath)!.add(node.id);
      }

      // Index by complexity
      if (node.complexity) {
        if (!this.byComplexity.has(node.complexity)) this.byComplexity.set(node.complexity, new Set());
        this.byComplexity.get(node.complexity)!.add(node.id);
      }

      // Index by tags
      if (Array.isArray(node.tags)) {
        for (const tag of node.tags) {
          if (!this.byTag.has(tag)) this.byTag.set(tag, new Set());
          this.byTag.get(tag)!.add(node.id);
        }
      }
    }

    // 2. Index edges
    for (const edge of this.graph.edges) {
      if (this.forwardEdges.has(edge.source)) {
        this.forwardEdges.get(edge.source)!.push(edge);
      }
      if (this.reverseEdges.has(edge.target)) {
        this.reverseEdges.get(edge.target)!.push(edge);
      }
    }

    // 3. Index layers
    if (Array.isArray(this.graph.layers)) {
      for (const layer of this.graph.layers) {
        const nodeSet = new Set(layer.nodeIds || []);
        this.byLayer.set(layer.id, nodeSet);
      }
    }
  }

  /**
   * Retrieves a node by ID.
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodeMap.get(nodeId);
  }

  /**
   * Returns all nodes in the graph.
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodeMap.values());
  }

  /**
   * Returns all edges in the graph.
   */
  getAllEdges(): GraphEdge[] {
    return [...this.graph.edges];
  }

  /**
   * Retrieves outgoing edges from a node.
   */
  getOutgoingEdges(nodeId: string, edgeTypes?: EdgeType[]): GraphEdge[] {
    const edges = this.forwardEdges.get(nodeId) || [];
    if (!edgeTypes || edgeTypes.length === 0) return edges;
    const typeSet = new Set(edgeTypes);
    return edges.filter((e) => typeSet.has(e.type));
  }

  /**
   * Retrieves incoming edges to a node.
   */
  getIncomingEdges(nodeId: string, edgeTypes?: EdgeType[]): GraphEdge[] {
    const edges = this.reverseEdges.get(nodeId) || [];
    if (!edgeTypes || edgeTypes.length === 0) return edges;
    const typeSet = new Set(edgeTypes);
    return edges.filter((e) => typeSet.has(e.type));
  }

  /**
   * Extracts a self-contained, referentially valid Subgraph centered around a node.
   *
   * @param centerNodeId Central focal node
   * @param options Radius depth, direction, edge types, maxNodes
   */
  getSubgraph(centerNodeId: string, options: SubgraphOptions = {}): KnowledgeGraph {
    if (!this.nodeMap.has(centerNodeId)) {
      throw new Error(`Node not found in graph: '${centerNodeId}'`);
    }

    const radius = options.radius ?? 1;
    const direction = options.direction ?? "both";
    const maxNodes = options.maxNodes ?? 200;
    const allowedTypes = options.edgeTypes ? new Set(options.edgeTypes) : null;

    const visitedNodes = new Set<string>([centerNodeId]);
    const collectedEdges = new Map<string, GraphEdge>(); // key: `${source}->${type}->${target}`

    let currentFrontier = [centerNodeId];

    for (let step = 0; step < radius; step++) {
      if (visitedNodes.size >= maxNodes) break;
      const nextFrontier: string[] = [];

      for (const curr of currentFrontier) {
        const outEdges = direction !== "reverse" ? this.forwardEdges.get(curr) || [] : [];
        const inEdges = direction !== "forward" ? this.reverseEdges.get(curr) || [] : [];

        for (const edge of outEdges) {
          if (allowedTypes && !allowedTypes.has(edge.type)) continue;
          const edgeKey = `${edge.source}->${edge.type}->${edge.target}`;
          collectedEdges.set(edgeKey, edge);

          if (!visitedNodes.has(edge.target) && visitedNodes.size < maxNodes) {
            visitedNodes.add(edge.target);
            nextFrontier.push(edge.target);
          }
        }

        for (const edge of inEdges) {
          if (allowedTypes && !allowedTypes.has(edge.type)) continue;
          const edgeKey = `${edge.source}->${edge.type}->${edge.target}`;
          collectedEdges.set(edgeKey, edge);

          if (!visitedNodes.has(edge.source) && visitedNodes.size < maxNodes) {
            visitedNodes.add(edge.source);
            nextFrontier.push(edge.source);
          }
        }
      }

      currentFrontier = nextFrontier;
      if (currentFrontier.length === 0) break;
    }

    // Keep only edges where BOTH source and target are in visitedNodes to maintain referential integrity
    const validEdges = Array.from(collectedEdges.values()).filter(
      (e) => visitedNodes.has(e.source) && visitedNodes.has(e.target),
    );

    const subNodes = Array.from(visitedNodes)
      .map((id) => this.nodeMap.get(id)!)
      .filter(Boolean);

    // Filter relevant layers that contain any of the visited nodes
    const subLayers = (this.graph.layers || [])
      .map((layer) => ({
        ...layer,
        nodeIds: layer.nodeIds.filter((id) => visitedNodes.has(id)),
      }))
      .filter((l) => l.nodeIds.length > 0);

    // Filter tour steps relevant to visited nodes
    const subTour = (this.graph.tour || [])
      .map((step) => ({
        ...step,
        nodeIds: step.nodeIds.filter((id) => visitedNodes.has(id)),
      }))
      .filter((s) => s.nodeIds.length > 0);

    return {
      version: this.graph.version,
      project: this.graph.project,
      nodes: subNodes,
      edges: validEdges,
      layers: subLayers,
      tour: subTour,
    };
  }

  /**
   * Queries nodes using compound criteria (types, tags, complexity, layer, filePathPattern).
   */
  queryNodes(filter: NodeQueryFilter): GraphNode[] {
    let candidateIds: Set<string> | null = null;

    // Filter by type
    if (filter.types && filter.types.length > 0) {
      const typeSet = new Set<string>();
      for (const t of filter.types) {
        const ids = this.byType.get(t);
        if (ids) ids.forEach((id) => typeSet.add(id));
      }
      candidateIds = typeSet;
    }

    // Filter by layer
    if (filter.layerId) {
      const layerIds = this.byLayer.get(filter.layerId) || new Set();
      candidateIds = candidateIds
        ? new Set(Array.from(candidateIds).filter((id) => layerIds.has(id)))
        : new Set(layerIds);
    }

    // Filter by complexity
    if (filter.complexity && filter.complexity.length > 0) {
      const compSet = new Set<string>();
      for (const c of filter.complexity) {
        const ids = this.byComplexity.get(c);
        if (ids) ids.forEach((id) => compSet.add(id));
      }
      candidateIds = candidateIds
        ? new Set(Array.from(candidateIds).filter((id) => compSet.has(id)))
        : compSet;
    }

    // Filter by tags (must have all specified tags)
    if (filter.tags && filter.tags.length > 0) {
      for (const tag of filter.tags) {
        const tagIds = this.byTag.get(tag) || new Set();
        candidateIds = candidateIds
          ? new Set(Array.from(candidateIds).filter((id) => tagIds.has(id)))
          : new Set(tagIds);
      }
    }

    const nodesToScan = candidateIds
      ? Array.from(candidateIds).map((id) => this.nodeMap.get(id)!).filter(Boolean)
      : Array.from(this.nodeMap.values());

    let results = nodesToScan;

    // Filter by filePathPattern
    if (filter.filePathPattern) {
      const regex =
        typeof filter.filePathPattern === "string"
          ? new RegExp(filter.filePathPattern, "i")
          : filter.filePathPattern;
      results = results.filter((n) => n.filePath && regex.test(n.filePath));
    }

    // Filter by search text
    if (filter.search) {
      const term = filter.search.toLowerCase();
      results = results.filter(
        (n) =>
          n.name.toLowerCase().includes(term) ||
          n.summary.toLowerCase().includes(term) ||
          (n.tags && n.tags.some((t) => t.toLowerCase().includes(term))),
      );
    }

    if (filter.limit && filter.limit > 0) {
      return results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Queries edges using criteria.
   */
  queryEdges(filter: EdgeQueryFilter): GraphEdge[] {
    let edges = this.graph.edges;

    if (filter.types && filter.types.length > 0) {
      const typeSet = new Set(filter.types);
      edges = edges.filter((e) => typeSet.has(e.type));
    }

    if (filter.source) {
      edges = edges.filter((e) => e.source === filter.source);
    }

    if (filter.target) {
      edges = edges.filter((e) => e.target === filter.target);
    }

    if (filter.minWeight !== undefined) {
      edges = edges.filter((e) => (e.weight ?? 0.5) >= filter.minWeight!);
    }

    if (filter.limit && filter.limit > 0) {
      return edges.slice(0, filter.limit);
    }

    return edges;
  }
}
