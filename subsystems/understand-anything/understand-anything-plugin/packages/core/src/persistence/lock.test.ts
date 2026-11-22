import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { GraphLockManager } from "./lock.js";

describe("GraphLockManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-lock-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should acquire and release lock cleanly", async () => {
    const lock = new GraphLockManager(tmpDir);
    const release = await lock.acquire();

    const lockFile = path.join(tmpDir, ".lock");
    expect(fs.existsSync(lockFile)).toBe(true);

    const data = JSON.parse(fs.readFileSync(lockFile, "utf-8"));
    expect(data.pid).toBe(process.pid);

    release();
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  it("should execute task inside withLock and release automatically", async () => {
    const lock = new GraphLockManager(tmpDir);
    const lockFile = path.join(tmpDir, ".lock");

    let ran = false;
    const result = await lock.withLock(() => {
      expect(fs.existsSync(lockFile)).toBe(true);
      ran = true;
      return 42;
    });

    expect(ran).toBe(true);
    expect(result).toBe(42);
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  it("should detect and break stale lock when PID is dead or expired", async () => {
    const lockFile = path.join(tmpDir, ".lock");
    // Write fake lock belonging to an impossible/dead PID
    fs.writeFileSync(
      lockFile,
      JSON.stringify({ pid: 99999999, createdAt: new Date(Date.now() - 300_000).toISOString() }),
      "utf-8",
    );

    const lock = new GraphLockManager(tmpDir);
    const release = await lock.acquire({ timeoutMs: 1000, staleAfterMs: 1000 });
    expect(fs.existsSync(lockFile)).toBe(true);

    const currentLock = JSON.parse(fs.readFileSync(lockFile, "utf-8"));
    expect(currentLock.pid).toBe(process.pid);

    release();
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  it("should timeout when lock cannot be acquired within timeout window", async () => {
    const lockFile = path.join(tmpDir, ".lock");
    // Write active lock belonging to current process
    fs.writeFileSync(
      lockFile,
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
      "utf-8",
    );

    const lock2 = new GraphLockManager(tmpDir);
    await expect(
      lock2.acquire({ timeoutMs: 300, retryIntervalMs: 50, staleAfterMs: 60000 }),
    ).rejects.toThrow(/GraphLockTimeout/);
  });
});
