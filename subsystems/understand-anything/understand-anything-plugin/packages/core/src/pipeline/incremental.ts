import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadFingerprints, loadMeta, loadGraph } from "../persistence/index.js";
import {
  compareFingerprints,
  contentHash,
  type FingerprintStore,
  type FileChangeResult,
  type ChangeAnalysis,
} from "../fingerprint.js";
import { classifyUpdate, type UpdateDecision } from "../change-classifier.js";

export interface IncrementalPlan {
  action: "SKIP" | "PARTIAL_UPDATE" | "ARCHITECTURE_UPDATE" | "FULL_UPDATE";
  changedFiles: string[];
  deletedFiles: string[];
  filesToReanalyze: string[];
  rerunArchitecture: boolean;
  rerunTour: boolean;
  reason: string;
}

/**
 * Reconciles incremental codebase changes against the existing knowledge graph.
 * Detects modified/deleted files, compares structural AST fingerprints,
 * and classifies the minimum necessary update action.
 */
export class IncrementalReconciler {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Plans the incremental update.
   */
  plan(lastCommitHash?: string): IncrementalPlan {
    const meta = loadMeta(this.projectRoot);
    const existingGraph = loadGraph(this.projectRoot, { validate: false });
    const baseCommit = lastCommitHash || meta?.gitCommitHash;

    const totalFilesInGraph = existingGraph?.nodes?.filter((n) => n.type === "file").length || 0;

    if (!baseCommit || !existingGraph) {
      return {
        action: "FULL_UPDATE",
        changedFiles: [],
        deletedFiles: [],
        filesToReanalyze: [],
        rerunArchitecture: true,
        rerunTour: true,
        reason: "No base commit or existing graph found",
      };
    }

    const diffOutput = this.getGitDiff(baseCommit);
    if (!diffOutput) {
      return {
        action: "SKIP",
        changedFiles: [],
        deletedFiles: [],
        filesToReanalyze: [],
        rerunArchitecture: false,
        rerunTour: false,
        reason: "Clean working tree (no diff)",
      };
    }

    const { changed, deleted } = this.parseGitDiff(diffOutput);
    if (changed.length === 0 && deleted.length === 0) {
      return {
        action: "SKIP",
        changedFiles: [],
        deletedFiles: [],
        filesToReanalyze: [],
        rerunArchitecture: false,
        rerunTour: false,
        reason: "Zero changed or deleted files",
      };
    }

    const oldStore = loadFingerprints(this.projectRoot);
    const structurallyChangedFiles: string[] = [];
    const cosmeticOnlyFiles: string[] = [];
    const newFiles: string[] = [];
    const fileChanges: FileChangeResult[] = [];

    for (const file of changed) {
      const fullPath = path.join(this.projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      let content = "";
      try {
        content = fs.readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const hash = contentHash(content);
      const oldFingerprint = oldStore?.files[file];

      if (!oldFingerprint) {
        newFiles.push(file);
        structurallyChangedFiles.push(file);
        fileChanges.push({
          filePath: file,
          changeLevel: "STRUCTURAL",
          details: ["New file without existing fingerprint"],
        });
      } else if (oldFingerprint.contentHash === hash) {
        // Exact identical content
        fileChanges.push({
          filePath: file,
          changeLevel: "NONE",
          details: ["Identical content hash"],
        });
      } else {
        // Content changed: check if structural fingerprints exist
        const newDummyFingerprint = {
          filePath: file,
          contentHash: hash,
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          totalLines: content.split("\n").length,
          hasStructuralAnalysis: false,
        };

        const change = compareFingerprints(oldFingerprint, newDummyFingerprint);
        fileChanges.push(change);

        if (change.changeLevel === "STRUCTURAL") {
          structurallyChangedFiles.push(file);
        } else {
          cosmeticOnlyFiles.push(file);
        }
      }
    }

    const analysis: ChangeAnalysis = {
      fileChanges,
      newFiles,
      deletedFiles: deleted,
      structurallyChangedFiles,
      cosmeticOnlyFiles,
      unchangedFiles: [],
    };

    const previousFiles = Object.keys(oldStore?.files || {});
    const decision: UpdateDecision = classifyUpdate(
      analysis,
      totalFilesInGraph,
      previousFiles,
    );

    return {
      action: decision.action,
      changedFiles: changed,
      deletedFiles: deleted,
      filesToReanalyze: decision.filesToReanalyze,
      rerunArchitecture: decision.rerunArchitecture,
      rerunTour: decision.rerunTour,
      reason: decision.reason,
    };
  }

  private getGitDiff(baseCommit: string): string | null {
    const result = spawnSync(
      "git",
      ["diff", "--name-status", "-z", baseCommit, "HEAD"],
      { cwd: this.projectRoot, encoding: "utf-8" },
    );
    if (result.status !== 0 || !result.stdout) {
      return null;
    }
    return result.stdout;
  }

  private parseGitDiff(diffZ: string): { changed: string[]; deleted: string[] } {
    const tokens = diffZ.split("\0").filter(Boolean);
    const changed: string[] = [];
    const deleted: string[] = [];

    for (let i = 0; i < tokens.length; i += 2) {
      const status = tokens[i];
      const filePath = tokens[i + 1];
      if (!filePath) continue;

      if (status.startsWith("D")) {
        deleted.push(filePath);
      } else {
        changed.push(filePath);
      }
    }

    return { changed, deleted };
  }
}
