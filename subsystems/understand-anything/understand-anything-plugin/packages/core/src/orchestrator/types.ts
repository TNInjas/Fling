import type { KnowledgeGraph, GraphNode, GraphEdge, Layer, TourStep } from "../types.js";
import type { AnalysisBatch } from "../pipeline/batcher.js";
import type { ScanResult } from "../pipeline/scanner.js";
import type { BatchAnalysisOutput } from "../pipeline/merger.js";

export interface ProjectContext {
  projectName: string;
  projectRoot: string;
  languages: string[];
  frameworks: string[];
  description?: string;
  readmeContent?: string;
  manifestContent?: string;
  entryPoint?: string;
}

export interface GraphReviewResult {
  issues: string[];
  warnings: string[];
}

export type OrchestratorPhase =
  | "PREFLIGHT"
  | "SCAN"
  | "BATCH"
  | "ANALYZE"
  | "ARCHITECTURE"
  | "TOUR"
  | "REVIEW"
  | "SAVE";

export interface PhaseProgressEvent {
  phase: OrchestratorPhase;
  phaseIndex: number;
  totalPhases: number;
  message: string;
  completedBatches?: number;
  totalBatches?: number;
}

/**
 * Driver interface for host-specific sub-agent invocation (Antigravity, Claude Code, Codex, or Heuristic).
 * Sub-agents return structured analysis results to the driver; UA core centrally validates and saves.
 */
export interface IAnalysisDriver {
  readonly name: string;
  readonly concurrencyLimit?: number;

  /**
   * Invokes sub-agent to analyze a file batch, returning structured nodes and edges.
   */
  analyzeBatch(batch: AnalysisBatch, context: ProjectContext): Promise<BatchAnalysisOutput>;

  /**
   * Invokes sub-agent to detect architectural layers from the assembled nodes and edges.
   */
  detectLayers(nodes: GraphNode[], edges: GraphEdge[], context: ProjectContext): Promise<Layer[]>;

  /**
   * Invokes sub-agent to generate a learning tour across the codebase.
   */
  generateTour(nodes: GraphNode[], layers: Layer[], edges: GraphEdge[], context: ProjectContext): Promise<TourStep[]>;

  /**
   * Optional full graph review pass.
   */
  reviewGraph?(graph: KnowledgeGraph, context: ProjectContext): Promise<GraphReviewResult>;
}
