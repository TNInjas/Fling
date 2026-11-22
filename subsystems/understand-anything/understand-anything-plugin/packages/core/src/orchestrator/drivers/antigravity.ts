import type {
  IAnalysisDriver,
  ProjectContext,
  GraphReviewResult,
} from "../types.js";
import type { AnalysisBatch } from "../../pipeline/batcher.js";
import type { BatchAnalysisOutput } from "../../pipeline/merger.js";
import type { GraphNode, GraphEdge, Layer, TourStep } from "../../types.js";
import { HeuristicDriver } from "./heuristic.js";

export type AntigravitySubagentInvoker = (
  role: string,
  prompt: string,
) => Promise<string | Record<string, unknown> | unknown[]>;

/**
 * Antigravity CLI Driver.
 * Dispatches subagents through Antigravity's agentic execution protocol
 * and parses returned structured JSON results for central UA validation.
 */
export class AntigravityDriver implements IAnalysisDriver {
  readonly name = "antigravity";
  readonly concurrencyLimit = 5;
  private readonly invoker?: AntigravitySubagentInvoker;
  private readonly fallback = new HeuristicDriver();

  constructor(invoker?: AntigravitySubagentInvoker) {
    this.invoker = invoker;
  }

  async analyzeBatch(
    batch: AnalysisBatch,
    context: ProjectContext,
  ): Promise<BatchAnalysisOutput> {
    if (!this.invoker) {
      return this.fallback.analyzeBatch(batch, context);
    }

    const prompt = [
      `Analyze the following files in ${context.projectName} and return a JSON object with { "nodes": GraphNode[], "edges": GraphEdge[] }:`,
      JSON.stringify(batch.files, null, 2),
    ].join("\n");

    try {
      const response = await this.invoker("File Analyzer", prompt);
      const parsed = typeof response === "string" ? JSON.parse(response) : response;
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
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
    if (!this.invoker) {
      return this.fallback.detectLayers(nodes, edges, context);
    }

    const prompt = [
      `Identify architectural layers for ${context.projectName} from these nodes and edges. Return JSON array of Layer objects with { id, name, description, nodeIds }:`,
      JSON.stringify({ nodeCount: nodes.length, fileNodes: nodes.map((n) => n.id) }),
    ].join("\n");

    try {
      const response = await this.invoker("Architecture Analyzer", prompt);
      const parsed = typeof response === "string" ? JSON.parse(response) : response;
      return Array.isArray(parsed) ? parsed : Array.isArray(parsed.layers) ? parsed.layers : [];
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

    const prompt = [
      `Generate a guided tour for ${context.projectName}. Return JSON array of TourStep objects with { order, title, description, nodeIds }:`,
      JSON.stringify({ layers: layers.map((l) => ({ id: l.id, name: l.name })) }),
    ].join("\n");

    try {
      const response = await this.invoker("Tour Builder", prompt);
      const parsed = typeof response === "string" ? JSON.parse(response) : response;
      return Array.isArray(parsed) ? parsed : Array.isArray(parsed.tour) ? parsed.tour : [];
    } catch {
      return this.fallback.generateTour(nodes, layers, edges, context);
    }
  }

  async reviewGraph(): Promise<GraphReviewResult> {
    return { issues: [], warnings: [] };
  }
}
