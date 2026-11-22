import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveUaDir } from "../persistence/index.js";
import type { GraphNode, GraphEdge } from "../types.js";

export interface CachedFileAnalysis {
  filePath: string;
  contentHash: string;
  cachedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CacheStore {
  version: "1.0.0";
  entries: Record<string, CachedFileAnalysis>; // Keyed by filePath
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalEntries: number;
}

/**
 * Content-Addressable Cache for file analysis results.
 * Avoids redundant LLM subagent calls for unchanged files across repeated
 * analyses, branch switching, or incremental runs.
 */
export class ContentCache {
  private readonly cacheFile: string;
  private readonly entries = new Map<string, CachedFileAnalysis>();
  private hits = 0;
  private misses = 0;

  constructor(projectRoot: string) {
    const uaDir = resolveUaDir(projectRoot);
    const cacheDir = path.join(uaDir, "cache");
    this.cacheFile = path.join(cacheDir, "analysis-cache.json");
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.cacheFile)) return;
    try {
      const data: CacheStore = JSON.parse(fs.readFileSync(this.cacheFile, "utf-8"));
      if (data && data.entries) {
        for (const [key, val] of Object.entries(data.entries)) {
          this.entries.set(key, val);
        }
      }
    } catch {
      // Ignore corrupted cache file
    }
  }

  /**
   * Computes SHA-256 hash of content.
   */
  static hash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Retrieves cached analysis for a file if content matches exactly.
   */
  get(filePath: string, currentContent: string): CachedFileAnalysis | null {
    const entry = this.entries.get(filePath);
    if (!entry) {
      this.misses++;
      return null;
    }

    const currentHash = ContentCache.hash(currentContent);
    if (entry.contentHash === currentHash) {
      this.hits++;
      return entry;
    }

    this.misses++;
    return null;
  }

  /**
   * Stores analysis result in cache.
   */
  set(filePath: string, content: string, nodes: GraphNode[], edges: GraphEdge[]): void {
    const contentHash = ContentCache.hash(content);
    this.entries.set(filePath, {
      filePath,
      contentHash,
      cachedAt: new Date().toISOString(),
      nodes,
      edges,
    });
  }

  /**
   * Flushes cache entries to disk atomically.
   */
  save(): void {
    const dir = path.dirname(this.cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const store: CacheStore = {
      version: "1.0.0",
      entries: Object.fromEntries(this.entries.entries()),
    };

    const tmpFile = `${this.cacheFile}.tmp.${process.pid}`;
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmpFile, this.cacheFile);
  }

  /**
   * Returns cache metrics.
   */
  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      totalEntries: this.entries.size,
    };
  }

  /**
   * Clears the cache.
   */
  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
    if (fs.existsSync(this.cacheFile)) {
      try {
        fs.unlinkSync(this.cacheFile);
      } catch {
        // ignore
      }
    }
  }
}
