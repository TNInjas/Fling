import fs from "node:fs";
import path from "node:path";
import { resolveUaDir, loadGraph, loadMeta, loadConfig, saveConfig } from "../persistence/index.js";
import { getGraphFreshness, type GraphFreshnessResult } from "../staleness.js";
import { generateStarterIgnoreFile } from "../ignore-generator.js";
import { AnalysisOrchestrator } from "../orchestrator/orchestrator.js";
import { IncrementalReconciler, type IncrementalPlan } from "../pipeline/incremental.js";
import type { KnowledgeGraph } from "../types.js";

export interface LifecycleStatus {
  state: "uninitialized" | "fresh" | "dirty" | "stale" | "unknown";
  nodeCount: number;
  edgeCount: number;
  lastAnalyzedAt?: string;
  gitCommitHash?: string;
  freshnessDetails?: GraphFreshnessResult;
}

export interface MaintenanceReport {
  purgedTrashDirs: number;
  cleanedScratchFiles: number;
  staleLocksRemoved: boolean;
}

/**
 * Manages the complete lifecycle of a project's knowledge graph:
 * intelligent bootstrap initialization, active freshness tracking,
 * automated incremental synchronization, and session housekeeping.
 */
export class GraphLifecycleManager {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Retrieves the current lifecycle and freshness status of the graph.
   */
  async getStatus(): Promise<LifecycleStatus> {
    const graph = loadGraph(this.projectRoot, { validate: false });
    const meta = loadMeta(this.projectRoot);

    if (!graph || !meta) {
      return {
        state: "uninitialized",
        nodeCount: 0,
        edgeCount: 0,
      };
    }

    try {
      const freshness = await getGraphFreshness(this.projectRoot, {
        graphCommitHash: meta.gitCommitHash,
        lastAnalyzedAt: meta.lastAnalyzedAt,
      });

      return {
        state: freshness.status,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        lastAnalyzedAt: meta.lastAnalyzedAt,
        gitCommitHash: meta.gitCommitHash,
        freshnessDetails: freshness,
      };
    } catch {
      return {
        state: "fresh",
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        lastAnalyzedAt: meta.lastAnalyzedAt,
        gitCommitHash: meta.gitCommitHash,
      };
    }
  }

  /**
   * Automatically initializes a new repository:
   * 1. Creates .understandignore if missing.
   * 2. Initializes .ua/config.json.
   * 3. Runs fast baseline analysis so an initial graph is immediately available.
   */
  async autoInitialize(): Promise<KnowledgeGraph> {
    const uaDir = resolveUaDir(this.projectRoot);
    if (!fs.existsSync(uaDir)) {
      fs.mkdirSync(uaDir, { recursive: true });
    }

    // 1. Generate starter ignore file if not present
    const ignorePath = path.join(uaDir, ".understandignore");
    if (!fs.existsSync(ignorePath)) {
      try {
        const ignoreContent = generateStarterIgnoreFile(this.projectRoot);
        fs.writeFileSync(ignorePath, ignoreContent, "utf-8");
      } catch {
        // Fallback default
        fs.writeFileSync(ignorePath, "node_modules/\ndist/\n", "utf-8");
      }
    }

    // 2. Ensure config exists
    const config = loadConfig(this.projectRoot);
    saveConfig(this.projectRoot, config);

    // 3. Run baseline analysis
    const orchestrator = new AnalysisOrchestrator(this.projectRoot);
    return await orchestrator.runFullAnalysis();
  }

  /**
   * Synchronizes changes incrementally.
   */
  async syncIncremental(): Promise<{ status: "up-to-date" | "updated"; plan?: IncrementalPlan }> {
    const status = await this.getStatus();
    if (status.state === "uninitialized") {
      await this.autoInitialize();
      return { status: "updated" };
    }

    if (status.state === "fresh") {
      return { status: "up-to-date" };
    }

    const reconciler = new IncrementalReconciler(this.projectRoot);
    const plan = reconciler.plan(status.gitCommitHash);

    if (plan.action === "SKIP") {
      return { status: "up-to-date", plan };
    }

    // Run update via orchestrator
    const orchestrator = new AnalysisOrchestrator(this.projectRoot);
    await orchestrator.runFullAnalysis();

    return { status: "updated", plan };
  }

  /**
   * Session housekeeping: purges stale trash directories, cleans intermediate scratch files,
   * and removes dead lockfiles.
   */
  async maintain(): Promise<MaintenanceReport> {
    const uaDir = resolveUaDir(this.projectRoot);
    let purgedTrashDirs = 0;
    let cleanedScratchFiles = 0;
    let staleLocksRemoved = false;

    if (!fs.existsSync(uaDir)) {
      return { purgedTrashDirs, cleanedScratchFiles, staleLocksRemoved };
    }

    // 1. Purge .trash-* dirs older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const entries = fs.readdirSync(uaDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(".trash-")) {
        const fullPath = path.join(uaDir, entry.name);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.mtimeMs < sevenDaysAgo) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            purgedTrashDirs++;
          }
        } catch {
          // ignore
        }
      }
    }

    // 2. Clean scratch files in intermediate/
    const intermediateDir = path.join(uaDir, "intermediate");
    if (fs.existsSync(intermediateDir)) {
      try {
        const scratchFiles = fs.readdirSync(intermediateDir);
        for (const f of scratchFiles) {
          if (f.endsWith(".tmp") || f.includes(".retry.") || f.startsWith("scratch-")) {
            fs.unlinkSync(path.join(intermediateDir, f));
            cleanedScratchFiles++;
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Clean stale lockfile if process is dead
    const lockFile = path.join(uaDir, ".lock");
    if (fs.existsSync(lockFile)) {
      try {
        const content = fs.readFileSync(lockFile, "utf-8");
        const data = JSON.parse(content);
        if (data.pid) {
          try {
            process.kill(data.pid, 0);
          } catch {
            fs.unlinkSync(lockFile);
            staleLocksRemoved = true;
          }
        }
      } catch {
        fs.unlinkSync(lockFile);
        staleLocksRemoved = true;
      }
    }

    return { purgedTrashDirs, cleanedScratchFiles, staleLocksRemoved };
  }
}
