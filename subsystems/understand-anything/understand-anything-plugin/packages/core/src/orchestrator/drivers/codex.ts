import type {
  IAnalysisDriver,
  ProjectContext,
  GraphReviewResult,
} from "../types.js";
import type { AnalysisBatch } from "../../pipeline/batcher.js";
import type { BatchAnalysisOutput } from "../../pipeline/merger.js";
import type { GraphNode, GraphEdge, Layer, TourStep } from "../../types.js";
import { HeuristicDriver } from "./heuristic.js";

export type CodexInvoker = (command: string, args: Record<string, unknown>) => Promise<string>;

/**
 * OpenAI Codex Driver.
 * Dispatches subagent workflows through Codex runtime tools.
 */
export class CodexDriver implements IAnalysisDriver {
  readonly name = "codex";
  readonly concurrencyLimit = 4;
  private readonly invoker?: CodexInvoker;
  private readonly fallback = new HeuristicDriver();

  constructor(invoker?: CodexInvoker) {
    this.invoker = invoker;
  }

  async analyzeBatch(
    batch: AnalysisBatch,
    context: ProjectContext,
  ): Promise<BatchAnalysisOutput> {
    if (!this.invoker) {
      return this.fallback.analyzeBatch(batch, context);
    }

    try {
      const res = await this.invoker("analyze_batch", { batch, context });
      const parsed = JSON.parse(res);
      return { nodes: parsed.nodes || [], edges: parsed.edges || [] };
    } catch {
      return this.fallback.analyzeBatch(batch, context);
    }
  }

  async detectLayers(
    nodes: GraphNode[],
    edges: GraphEdge[],
    context: ProjectContext,
  ): Promise<Layer[]> {
    if (!this.invoker) {
      return this.fallback.detectLayers(nodes, edges, context);
    }

    try {
      const res = await this.invoker("detect_layers", { nodesCount: nodes.length, context });
      const parsed = JSON.parse(res);
      return Array.isArray(parsed) ? parsed : parsed.layers || [];
    } catch {
      return this.fallback.detectLayers(nodes, edges, context);
    }
  }

  async generateTour(
    nodes: GraphNode[],
    layers: Layer[],
    edges: GraphEdge[],
    context: ProjectContext,
  ): Promise<TourStep[]> {
    if (!this.invoker) {
      return this.fallback.generateTour(nodes, layers, edges, context);
    }

    try {
      const res = await this.invoker("generate_tour", { layers, context });
      const parsed = JSON.parse(res);
      return Array.isArray(parsed) ? parsed : parsed.tour || [];
    } catch {
      return this.fallback.generateTour(nodes, layers, edges, context);
    }
  }

  async reviewGraph(): Promise<GraphReviewResult> {
    return { issues: [], warnings: [] };
  }
}
