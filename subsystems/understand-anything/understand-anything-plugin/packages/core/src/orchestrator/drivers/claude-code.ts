import type {
  IAnalysisDriver,
  ProjectContext,
  GraphReviewResult,
} from "../types.js";
import type { AnalysisBatch } from "../../pipeline/batcher.js";
import type { BatchAnalysisOutput } from "../../pipeline/merger.js";
import type { GraphNode, GraphEdge, Layer, TourStep } from "../../types.js";
import { HeuristicDriver } from "./heuristic.js";

export type ClaudeCodeDispatcher = (agentName: string, prompt: string) => Promise<string>;

/**
 * Claude Code Driver.
 * Dispatches subagents defined in `agents/*.md` and captures structured responses.
 */
export class ClaudeCodeDriver implements IAnalysisDriver {
  readonly name = "claude-code";
  readonly concurrencyLimit = 5;
  private readonly dispatcher?: ClaudeCodeDispatcher;
  private readonly fallback = new HeuristicDriver();

  constructor(dispatcher?: ClaudeCodeDispatcher) {
    this.dispatcher = dispatcher;
  }

  async analyzeBatch(
    batch: AnalysisBatch,
    context: ProjectContext,
  ): Promise<BatchAnalysisOutput> {
    if (!this.dispatcher) {
      return this.fallback.analyzeBatch(batch, context);
    }

    try {
      const prompt = `Analyze batch ${batch.batchIndex}/${batch.totalBatches} for ${context.projectName}: ${JSON.stringify(batch.files)}`;
      const result = await this.dispatcher("file-analyzer", prompt);
      const parsed = JSON.parse(result);
      return {
        nodes: parsed.nodes || [],
        edges: parsed.edges || [],
      };
    } catch {
      return this.fallback.analyzeBatch(batch, context);
    }
  }

  async detectLayers(
    nodes: GraphNode[],
    edges: GraphEdge[],
    context: ProjectContext,
  ): Promise<Layer[]> {
    if (!this.dispatcher) {
      return this.fallback.detectLayers(nodes, edges, context);
    }

    try {
      const result = await this.dispatcher("architecture-analyzer", `Detect layers for ${context.projectName}`);
      const parsed = JSON.parse(result);
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
    if (!this.dispatcher) {
      return this.fallback.generateTour(nodes, layers, edges, context);
    }

    try {
      const result = await this.dispatcher("tour-builder", `Build tour for ${context.projectName}`);
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : parsed.tour || [];
    } catch {
      return this.fallback.generateTour(nodes, layers, edges, context);
    }
  }

  async reviewGraph(): Promise<GraphReviewResult> {
    return { issues: [], warnings: [] };
  }
}
