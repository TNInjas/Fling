import type { KnowledgeGraph, GraphNode, GraphEdge, Layer, TourStep } from "../types.js";
import { normalizeNodeId, normalizeComplexity } from "../analyzer/normalize-graph.js";

export interface BatchAnalysisOutput {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

export interface AssembleOptions {
  projectName: string;
  languages: string[];
  frameworks?: string[];
  gitCommitHash?: string;
  description?: string;
  layers?: Layer[];
  tour?: TourStep[];
}

/**
 * Central Graph Assembler and Normalizer.
 * Ingests structured batch results returned by sub-agents, normalizes node IDs,
 * resolves complexity aliases, establishes tested_by test linkages, deduplicates,
 * and eliminates dangling references to ensure 100% referential integrity.
 */
export class GraphAssembler {
  private readonly nodesMap = new Map<string, GraphNode>();
  private readonly rawEdges: GraphEdge[] = [];
  private readonly idRewriteMap = new Map<string, string>();

  /**
   * Ingests a structured batch analysis result from a subagent.
   */
  ingestBatch(batchOutput: BatchAnalysisOutput): void {
    if (Array.isArray(batchOutput.nodes)) {
      for (const node of batchOutput.nodes) {
        if (!node.id || !node.type) continue;
        const normalizedId = normalizeNodeId(node.id, node);
        if (node.id !== normalizedId) {
          this.idRewriteMap.set(node.id, normalizedId);
        }

        const normalizedNode: GraphNode = {
          ...node,
          id: normalizedId,
          complexity: normalizeComplexity(node.complexity) as any,
          tags: Array.isArray(node.tags) ? [...new Set(node.tags)] : [],
        };

        // Deduplicate nodes by ID (last occurrence wins)
        this.nodesMap.set(normalizedId, normalizedNode);
      }
    }

    if (Array.isArray(batchOutput.edges)) {
      for (const edge of batchOutput.edges) {
        if (!edge.source || !edge.target || !edge.type) continue;
        this.rawEdges.push(edge);
      }
    }
  }

  /**
   * Assembles the finalized KnowledgeGraph.
   */
  assemble(options: AssembleOptions): KnowledgeGraph {
    const validNodeIds = new Set(this.nodesMap.keys());
    const finalizedEdges: GraphEdge[] = [];
    const seenEdges = new Set<string>();

    for (const rawEdge of this.rawEdges) {
      const src = this.idRewriteMap.get(rawEdge.source) || rawEdge.source;
      const tgt = this.idRewriteMap.get(rawEdge.target) || rawEdge.target;

      // Referential integrity: drop edge if endpoints do not exist
      if (!validNodeIds.has(src) || !validNodeIds.has(tgt)) {
        continue;
      }

      const edgeKey = `${src}->${rawEdge.type}->${tgt}`;
      if (seenEdges.has(edgeKey)) {
        continue;
      }
      seenEdges.add(edgeKey);

      finalizedEdges.push({
        source: src,
        target: tgt,
        type: rawEdge.type,
        direction: rawEdge.direction || "forward",
        weight: typeof rawEdge.weight === "number" ? rawEdge.weight : 0.5,
      });
    }

    // tested_by Linker pass: connect production files to test files
    this.linkTestEdges(finalizedEdges);

    const nodes = Array.from(this.nodesMap.values());

    return {
      version: "1.0.0",
      project: {
        name: options.projectName,
        languages: options.languages,
        frameworks: options.frameworks || [],
        description: options.description || "",
        analyzedAt: new Date().toISOString(),
        gitCommitHash: options.gitCommitHash || "HEAD",
      },
      nodes,
      edges: finalizedEdges,
      layers: options.layers || [],
      tour: options.tour || [],
    };
  }

  /**
   * Links test files to production code with tested_by edges.
   */
  private linkTestEdges(edges: GraphEdge[]): void {
    const existingEdgeKeys = new Set(edges.map((e) => `${e.source}->${e.target}`));
    const nodes = Array.from(this.nodesMap.values());

    const testFileNodes = nodes.filter(
      (n) => n.filePath && (n.filePath.includes(".test.") || n.filePath.includes(".spec.")),
    );

    for (const testNode of testFileNodes) {
      if (!testNode.filePath) continue;
      // Infer production file path: e.g. foo.test.ts -> foo.ts
      const prodPath = testNode.filePath
        .replace(".test.", ".")
        .replace(".spec.", ".")
        .replace("__tests__/", "");

      const prodNode = nodes.find((n) => n.filePath === prodPath);
      if (prodNode) {
        const key = `${prodNode.id}->${testNode.id}`;
        if (!existingEdgeKeys.has(key)) {
          existingEdgeKeys.add(key);
          edges.push({
            source: prodNode.id,
            target: testNode.id,
            type: "tested_by",
            direction: "forward",
            weight: 0.9,
          });
          // Tag production node as tested
          if (!prodNode.tags.includes("tested")) {
            prodNode.tags.push("tested");
          }
        }
      }
    }
  }
}
