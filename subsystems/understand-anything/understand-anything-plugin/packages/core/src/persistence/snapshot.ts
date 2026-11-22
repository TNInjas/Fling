import fs from "node:fs";
import path from "node:path";
import { resolveUaDir } from "./index.js";

export interface SnapshotMetadata {
  id: string;
  createdAt: string;
  reason: string;
  gitCommitHash?: string;
  nodeCount: number;
  edgeCount: number;
}

export interface SnapshotConfig {
  maxRetention?: number;
}

const DEFAULT_MAX_RETENTION = 5;

/**
 * Manages versioned graph snapshots in .ua/snapshots/
 * Enables pre-update checkpoints, configurable ring-buffer retention (default 5),
 * rollback capability, and preservation of valid state on failed operations.
 */
export class SnapshotManager {
  private readonly snapshotsDir: string;
  private readonly projectRoot: string;
  private readonly maxRetention: number;

  constructor(projectRoot: string, config?: SnapshotConfig) {
    this.projectRoot = projectRoot;
    const uaDir = resolveUaDir(projectRoot);
    this.snapshotsDir = path.join(uaDir, "snapshots");
    this.maxRetention = config?.maxRetention ?? DEFAULT_MAX_RETENTION;
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  /**
   * Creates a pre-modification snapshot of the current knowledge graph and metadata.
   * Automatically rotates snapshots exceeding the retention limit.
   */
  async createSnapshot(reason: string): Promise<string | null> {
    const uaDir = resolveUaDir(this.projectRoot);
    const graphFile = path.join(uaDir, "knowledge-graph.json");
    if (!fs.existsSync(graphFile)) {
      return null;
    }

    this.ensureDir();

    let graphData: any;
    try {
      graphData = JSON.parse(fs.readFileSync(graphFile, "utf-8"));
    } catch {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedReason = reason.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 30);
    const snapshotId = `snapshot_${timestamp}_${sanitizedReason}`;
    const targetFile = path.join(this.snapshotsDir, `${snapshotId}.json`);

    const snapshotPayload = {
      snapshotId,
      createdAt: new Date().toISOString(),
      reason,
      gitCommitHash: graphData.project?.gitCommitHash,
      nodeCount: Array.isArray(graphData.nodes) ? graphData.nodes.length : 0,
      edgeCount: Array.isArray(graphData.edges) ? graphData.edges.length : 0,
      graph: graphData,
    };

    // Atomic write of snapshot file
    const tmpTarget = `${targetFile}.tmp.${process.pid}`;
    fs.writeFileSync(tmpTarget, JSON.stringify(snapshotPayload, null, 2), "utf-8");
    fs.renameSync(tmpTarget, targetFile);

    // Enforce retention limit (oldest snapshots purged first)
    this.rotateSnapshots();

    return snapshotId;
  }

  /**
   * Lists all existing snapshots, ordered from newest to oldest.
   */
  listSnapshots(): SnapshotMetadata[] {
    if (!fs.existsSync(this.snapshotsDir)) return [];

    const files = fs
      .readdirSync(this.snapshotsDir)
      .filter((f) => f.startsWith("snapshot_") && f.endsWith(".json"))
      .sort()
      .reverse();

    const results: SnapshotMetadata[] = [];
    for (const file of files) {
      try {
        const fullPath = path.join(this.snapshotsDir, file);
        const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        results.push({
          id: data.snapshotId ?? path.basename(file, ".json"),
          createdAt: data.createdAt ?? "",
          reason: data.reason ?? "unknown",
          gitCommitHash: data.gitCommitHash,
          nodeCount: data.nodeCount ?? 0,
          edgeCount: data.edgeCount ?? 0,
        });
      } catch {
        // Skip unparseable snapshot files
      }
    }
    return results;
  }

  /**
   * Enforces the retention limit, keeping only the most recent N snapshots.
   */
  private rotateSnapshots(): void {
    if (!fs.existsSync(this.snapshotsDir)) return;

    const files = fs
      .readdirSync(this.snapshotsDir)
      .filter((f) => f.startsWith("snapshot_") && f.endsWith(".json"))
      .sort(); // Oldest first

    if (files.length > this.maxRetention) {
      const toDelete = files.slice(0, files.length - this.maxRetention);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(path.join(this.snapshotsDir, file));
        } catch {
          // Ignore deletion error
        }
      }
    }
  }

  /**
   * Preserves a failed update candidate to .ua/failed-update-<timestamp>.json
   * without overwriting the master graph.
   */
  preserveFailedUpdate(candidateGraph: unknown, errorReason: string): string {
    const uaDir = resolveUaDir(this.projectRoot);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const failedFilePath = path.join(uaDir, `failed-update-${timestamp}.json`);

    const payload = {
      failedAt: new Date().toISOString(),
      errorReason,
      candidate: candidateGraph,
    };

    fs.writeFileSync(failedFilePath, JSON.stringify(payload, null, 2), "utf-8");
    return failedFilePath;
  }

  /**
   * Restores the knowledge graph from a specified snapshot, or the latest available one.
   */
  rollback(snapshotId?: string): boolean {
    const snapshots = this.listSnapshots();
    if (snapshots.length === 0) return false;

    const targetId = snapshotId ?? snapshots[0].id;
    const snapshotFile = path.join(this.snapshotsDir, `${targetId}.json`);
    if (!fs.existsSync(snapshotFile)) return false;

    try {
      const data = JSON.parse(fs.readFileSync(snapshotFile, "utf-8"));
      if (!data.graph) return false;

      const uaDir = resolveUaDir(this.projectRoot);
      const graphFile = path.join(uaDir, "knowledge-graph.json");
      const tmpFile = `${graphFile}.tmp.${process.pid}`;

      fs.writeFileSync(tmpFile, JSON.stringify(data.graph, null, 2), "utf-8");
      fs.renameSync(tmpFile, graphFile);
      return true;
    } catch {
      return false;
    }
  }
}
