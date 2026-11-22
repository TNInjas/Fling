import path from "node:path";
import fs from "node:fs";
import type { KnowledgeGraph } from "../types.js";
import { ProjectScanner, type ScannerOptions } from "../pipeline/scanner.js";
import { BatchCoordinator, type BatchOptions } from "../pipeline/batcher.js";
import { GraphAssembler } from "../pipeline/merger.js";
import { SnapshotManager } from "../persistence/snapshot.js";
import { saveGraph, saveMeta, loadConfig } from "../persistence/index.js";
import { validateGraph } from "../schema.js";
import { HeuristicDriver } from "./drivers/heuristic.js";
import type {
  IAnalysisDriver,
  ProjectContext,
  PhaseProgressEvent,
} from "./types.js";

export interface OrchestratorOptions {
  driver?: IAnalysisDriver;
  scannerOptions?: ScannerOptions;
  batchOptions?: BatchOptions;
  onProgress?: (event: PhaseProgressEvent) => void;
  review?: boolean;
}

/**
 * Universal Analysis Orchestrator.
 * Coordinates the full analysis pipeline across all phases (Scan -> Batch -> Analyze -> Architecture -> Tour -> Validate -> Save).
 * Relies on the supplied IAnalysisDriver to invoke subagents and centrally ingests
 * structured results, validates referential integrity, and persists snapshots and final graphs.
 */
export class AnalysisOrchestrator {
  private readonly projectRoot: string;
  private readonly driver: IAnalysisDriver;
  private readonly snapshotManager: SnapshotManager;
  private readonly defaultOptions: OrchestratorOptions;

  constructor(projectRoot: string, options: OrchestratorOptions = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.defaultOptions = options;
    this.driver = options.driver ?? new HeuristicDriver();

    const config = loadConfig(this.projectRoot);
    this.snapshotManager = new SnapshotManager(this.projectRoot, {
      maxRetention: config.snapshotRetentionLimit,
    });
  }

  /**
   * Executes the full codebase analysis pipeline.
   */
  async runFullAnalysis(options: OrchestratorOptions = {}): Promise<KnowledgeGraph> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const onProgress = mergedOptions.onProgress ?? (() => {});

    // Phase 0: Pre-flight snapshot if graph already exists
    onProgress({
      phase: "PREFLIGHT",
      phaseIndex: 0,
      totalPhases: 7,
      message: "Pre-flight checks and snapshot creation...",
    });
    await this.snapshotManager.createSnapshot("pre_full_analysis");

    // Phase 1: SCAN
    onProgress({
      phase: "SCAN",
      phaseIndex: 1,
      totalPhases: 7,
      message: "Scanning project files...",
    });
    const scanner = new ProjectScanner(this.projectRoot);
    const scanResult = scanner.scan(options.scannerOptions);

    const context: ProjectContext = {
      projectName: scanResult.projectName,
      projectRoot: this.projectRoot,
      languages: scanResult.languages,
      frameworks: scanResult.frameworks,
    };

    // Phase 1.5: BATCH
    onProgress({
      phase: "BATCH",
      phaseIndex: 2,
      totalPhases: 7,
      message: "Computing semantic batches...",
    });
    const batches = BatchCoordinator.computeBatches(scanResult.files, options.batchOptions);

    // Phase 2: ANALYZE (Parallel batch execution through driver)
    onProgress({
      phase: "ANALYZE",
      phaseIndex: 3,
      totalPhases: 7,
      message: `Analyzing ${scanResult.totalFiles} files in ${batches.length} batches...`,
      completedBatches: 0,
      totalBatches: batches.length,
    });

    const assembler = new GraphAssembler();
    let completedBatches = 0;

    // Run batches through driver with concurrency limit
    const concurrency = this.driver.concurrencyLimit || 5;
    for (let i = 0; i < batches.length; i += concurrency) {
      const slice = batches.slice(i, i + concurrency);
      const batchPromises = slice.map(async (batch) => {
        const batchOutput = await this.driver.analyzeBatch(batch, context);
        assembler.ingestBatch(batchOutput);
        completedBatches++;
        onProgress({
          phase: "ANALYZE",
          phaseIndex: 3,
          totalPhases: 7,
          message: `Analyzed batch ${completedBatches}/${batches.length}`,
          completedBatches,
          totalBatches: batches.length,
        });
      });
      await Promise.all(batchPromises);
    }

    // Intermediate assembled graph for layer & tour analysis
    const intermediateGraph = assembler.assemble({
      projectName: context.projectName,
      languages: context.languages,
      frameworks: context.frameworks,
    });

    // Phase 4: ARCHITECTURE (Layer detection)
    onProgress({
      phase: "ARCHITECTURE",
      phaseIndex: 4,
      totalPhases: 7,
      message: "Detecting architectural layers...",
    });
    const layers = await this.driver.detectLayers(
      intermediateGraph.nodes,
      intermediateGraph.edges,
      context,
    );

    // Phase 5: TOUR (Learning tour generation)
    onProgress({
      phase: "TOUR",
      phaseIndex: 5,
      totalPhases: 7,
      message: "Building guided tour...",
    });
    const tour = await this.driver.generateTour(
      intermediateGraph.nodes,
      layers,
      intermediateGraph.edges,
      context,
    );

    // Re-assemble final graph with layers and tour
    const finalGraph = assembler.assemble({
      projectName: context.projectName,
      languages: context.languages,
      frameworks: context.frameworks,
      layers,
      tour,
    });

    // Phase 6: REVIEW & Central Validation
    onProgress({
      phase: "REVIEW",
      phaseIndex: 6,
      totalPhases: 7,
      message: "Central referential validation and graph review...",
    });

    const validation = validateGraph(finalGraph);
    if (!validation.success) {
      // Preservation on failure: preserve candidate and do not overwrite master graph
      this.snapshotManager.preserveFailedUpdate(
        finalGraph,
        `Validation Failed: ${validation.fatal || "Referential integrity error"}`,
      );
      throw new Error(
        `AnalysisOrchestrator: Graph validation failed: ${validation.fatal}`,
      );
    }

    // Phase 7: SAVE
    onProgress({
      phase: "SAVE",
      phaseIndex: 7,
      totalPhases: 7,
      message: "Saving knowledge graph and metadata...",
    });

    saveGraph(this.projectRoot, finalGraph);
    saveMeta(this.projectRoot, {
      lastAnalyzedAt: finalGraph.project.analyzedAt,
      gitCommitHash: finalGraph.project.gitCommitHash,
      version: finalGraph.version,
      analyzedFiles: finalGraph.nodes.filter((n) => n.type === "file").length,
    });

    // Create post-save recovery snapshot
    await this.snapshotManager.createSnapshot("post_full_analysis");

    return finalGraph;
  }
}
