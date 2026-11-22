import path from "node:path";
import type {
  IAnalysisDriver,
  ProjectContext,
  GraphReviewResult,
} from "../types.js";
import type { AnalysisBatch } from "../../pipeline/batcher.js";
import type { BatchAnalysisOutput } from "../../pipeline/merger.js";
import type { GraphNode, GraphEdge, Layer, TourStep } from "../../types.js";

/**
 * Deterministic / Heuristic Analysis Driver.
 * Requires zero LLM calls or tokens. Extracts structural AST nodes, generates layers
 * from top-level directory structure, and builds a basic tour from entrypoints.
 * Ideal for testing, offline environments, CI pipelines, and fast baseline generation.
 */
export class HeuristicDriver implements IAnalysisDriver {
  readonly name = "heuristic";
  readonly concurrencyLimit = 8;

  async analyzeBatch(
    batch: AnalysisBatch,
    _context: ProjectContext,
  ): Promise<BatchAnalysisOutput> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const file of batch.files) {
      const fileId = `file:${file.path}`;
      const name = path.basename(file.path);

      nodes.push({
        id: fileId,
        type: file.fileCategory === "code" ? "file" : (file.fileCategory as any),
        name,
        filePath: file.path,
        summary: `${file.language} ${file.fileCategory} file (${file.sizeLines} lines)`,
        complexity: file.sizeLines > 500 ? "complex" : file.sizeLines > 150 ? "moderate" : "simple",
        tags: [file.language, file.fileCategory],
      });
    }

    return { nodes, edges };
  }

  async detectLayers(
    nodes: GraphNode[],
    _edges: GraphEdge[],
    _context: ProjectContext,
  ): Promise<Layer[]> {
    const directoryBuckets = new Map<string, string[]>();

    for (const node of nodes) {
      if (!node.filePath) continue;
      const parts = node.filePath.split("/");
      const topDir = parts.length > 1 ? parts[0] : "root";
      if (!directoryBuckets.has(topDir)) {
        directoryBuckets.set(topDir, []);
      }
      directoryBuckets.get(topDir)!.push(node.id);
    }

    const layers: Layer[] = [];
    for (const [dir, nodeIds] of directoryBuckets.entries()) {
      layers.push({
        id: `layer:${dir}`,
        name: dir.charAt(0).toUpperCase() + dir.slice(1),
        description: `Components and files located in ${dir}/`,
        nodeIds,
      });
    }

    return layers;
  }

  async generateTour(
    nodes: GraphNode[],
    _layers: Layer[],
    _edges: GraphEdge[],
    context: ProjectContext,
  ): Promise<TourStep[]> {
    const tour: TourStep[] = [];
    let order = 1;

    // Step 1: Overview
    const readmeNode = nodes.find((n) => n.filePath?.toLowerCase().includes("readme"));
    if (readmeNode) {
      tour.push({
        order: order++,
        title: "Project Overview",
        description: "Start with documentation to understand the project architecture and setup.",
        nodeIds: [readmeNode.id],
      });
    }

    // Step 2: Entry point
    if (context.entryPoint) {
      const entryNode = nodes.find((n) => n.filePath === context.entryPoint);
      if (entryNode && !tour.some((t) => t.nodeIds.includes(entryNode.id))) {
        tour.push({
          order: order++,
          title: "Application Entry Point",
          description: "Main bootstrap entry point for the application.",
          nodeIds: [entryNode.id],
        });
      }
    }

    // Fallback if tour is empty
    if (tour.length === 0 && nodes.length > 0) {
      tour.push({
        order: 1,
        title: "Initial Tour Stop",
        description: "Primary project file.",
        nodeIds: [nodes[0].id],
      });
    }

    return tour;
  }

  async reviewGraph(): Promise<GraphReviewResult> {
    return { issues: [], warnings: [] };
  }
}
