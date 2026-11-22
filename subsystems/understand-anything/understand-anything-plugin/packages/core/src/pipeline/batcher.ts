import type { ScannedFileInfo } from "./scanner.js";

export interface AnalysisBatch {
  batchIndex: number;
  totalBatches: number;
  files: ScannedFileInfo[];
  totalLines: number;
  neighborMap?: Record<string, string[]>;
  batchImportData?: Record<string, string[]>;
}

export interface BatchOptions {
  maxBatchSize?: number;
  maxBatchLines?: number;
}

const DEFAULT_MAX_BATCH_SIZE = 12;
const DEFAULT_MAX_BATCH_LINES = 2000;

/**
 * Groups scanned project files into balanced semantic batches for subagent analysis.
 * Implements token-aware bin packing and groups topologically close files together.
 */
export class BatchCoordinator {
  /**
   * Partitions files into balanced batches.
   */
  static computeBatches(
    files: ScannedFileInfo[],
    options: BatchOptions = {},
  ): AnalysisBatch[] {
    const maxFiles = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    const maxLines = options.maxBatchLines ?? DEFAULT_MAX_BATCH_LINES;

    // Filter to code, config, docs, infra files needing analysis
    const analyzableFiles = files.filter(
      (f) => f.fileCategory === "code" || f.fileCategory === "config" || f.fileCategory === "infra",
    );

    if (analyzableFiles.length === 0) {
      return [];
    }

    // Sort files by directory path to preserve locality
    const sorted = [...analyzableFiles].sort((a, b) => (a.path < b.path ? -1 : 1));

    const batches: AnalysisBatch[] = [];
    let currentBatchFiles: ScannedFileInfo[] = [];
    let currentLines = 0;

    for (const file of sorted) {
      const willExceedLines = currentLines + file.sizeLines > maxLines && currentBatchFiles.length > 0;
      const willExceedCount = currentBatchFiles.length >= maxFiles;

      if (willExceedLines || willExceedCount) {
        batches.push({
          batchIndex: batches.length + 1,
          totalBatches: 0, // Filled after loop
          files: currentBatchFiles,
          totalLines: currentLines,
        });
        currentBatchFiles = [];
        currentLines = 0;
      }

      currentBatchFiles.push(file);
      currentLines += file.sizeLines;
    }

    if (currentBatchFiles.length > 0) {
      batches.push({
        batchIndex: batches.length + 1,
        totalBatches: 0,
        files: currentBatchFiles,
        totalLines: currentLines,
      });
    }

    const total = batches.length;
    for (const b of batches) {
      b.totalBatches = total;
    }

    return batches;
  }
}
