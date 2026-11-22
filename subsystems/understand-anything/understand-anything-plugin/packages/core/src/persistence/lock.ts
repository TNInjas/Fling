import fs from "node:fs";
import path from "node:path";

export interface LockOptions {
  timeoutMs?: number;
  retryIntervalMs?: number;
  staleAfterMs?: number;
}

interface LockPayload {
  pid: number;
  createdAt: string;
  host?: string;
}

/**
 * Cross-process advisory file lock for the knowledge graph data directory.
 * Prevents race conditions and corruption when multiple agent sub-tasks
 * or background processes attempt simultaneous graph writes.
 */
export class GraphLockManager {
  private readonly lockFilePath: string;
  private isHeld = false;

  constructor(uaDir: string) {
    this.lockFilePath = path.join(uaDir, ".lock");
  }

  /**
   * Acquires the lock, waiting up to timeoutMs if currently held.
   * Resolves to a release callback function.
   */
  async acquire(options: LockOptions = {}): Promise<() => void> {
    const timeout = options.timeoutMs ?? 10_000;
    const interval = options.retryIntervalMs ?? 100;
    const staleAfter = options.staleAfterMs ?? 120_000; // 2 minutes default stale window
    const startTime = Date.now();

    const parentDir = path.dirname(this.lockFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    while (Date.now() - startTime < timeout) {
      try {
        const payload: LockPayload = {
          pid: process.pid,
          createdAt: new Date().toISOString(),
        };
        // 'wx' flag opens for writing, failing if path already exists
        fs.writeFileSync(this.lockFilePath, JSON.stringify(payload, null, 2), {
          flag: "wx",
          encoding: "utf-8",
        });
        this.isHeld = true;
        return () => this.release();
      } catch (err: any) {
        if (err.code === "EEXIST") {
          if (this.isLockStale(staleAfter)) {
            this.forceRelease();
            continue;
          }
          await new Promise((resolve) => setTimeout(resolve, interval));
        } else {
          throw err;
        }
      }
    }

    throw new Error(
      `GraphLockTimeout: Failed to acquire lock at '${this.lockFilePath}' within ${timeout}ms.`,
    );
  }

  /**
   * Determines if the current lock is stale (holding process died or timestamp exceeded stale window).
   */
  private isLockStale(staleAfterMs: number): boolean {
    try {
      if (!fs.existsSync(this.lockFilePath)) return true;
      const content = fs.readFileSync(this.lockFilePath, "utf-8");
      const data: LockPayload = JSON.parse(content);

      if (!data.pid || !data.createdAt) return true;

      const ageMs = Date.now() - new Date(data.createdAt).getTime();
      if (ageMs > staleAfterMs) {
        return true;
      }

      // Check if process is still alive on this machine
      try {
        process.kill(data.pid, 0);
        return false; // Process exists and is alive
      } catch (err: any) {
        // ESRCH = No such process; EPERM = Process exists but belongs to different user (still alive)
        return err.code === "ESRCH";
      }
    } catch {
      return true;
    }
  }

  /**
   * Releases the lock safely.
   */
  release(): void {
    if (!this.isHeld && !fs.existsSync(this.lockFilePath)) {
      return;
    }
    try {
      if (fs.existsSync(this.lockFilePath)) {
        // Only unlink if the lock belongs to this process
        try {
          const content = fs.readFileSync(this.lockFilePath, "utf-8");
          const data: LockPayload = JSON.parse(content);
          if (data.pid === process.pid) {
            fs.unlinkSync(this.lockFilePath);
          }
        } catch {
          fs.unlinkSync(this.lockFilePath);
        }
      }
    } catch {
      // Ignore cleanup error if already removed
    } finally {
      this.isHeld = false;
    }
  }

  /**
   * Forcibly removes the lock file if identified as stale.
   */
  private forceRelease(): void {
    try {
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Executes a callback within the acquired lock, ensuring release upon completion or error.
   */
  async withLock<T>(fn: () => Promise<T> | T, options?: LockOptions): Promise<T> {
    const release = await this.acquire(options);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
