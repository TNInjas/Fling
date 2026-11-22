import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VIEWER_BIN = join(
  REPO_ROOT,
  "understand-anything-plugin",
  "packages",
  "viewer",
  "bin",
  "viewer.mjs",
);

function fixtureGraph(gitCommitHash) {
  return {
    version: "1.0.0",
    project: {
      name: "fixture",
      languages: ["ts"],
      frameworks: [],
      description: "Live sync fixture",
      analyzedAt: "2026-07-17T00:00:00.000Z",
      gitCommitHash,
    },
    nodes: [
      {
        id: "file:src/index.ts",
        type: "file",
        name: "index.ts",
        filePath: "src/index.ts",
        summary: "main file",
        tags: [],
        complexity: "simple",
      },
      {
        id: "fn:main",
        type: "function",
        name: "main",
        filePath: "src/index.ts",
        summary: "entry function",
        tags: [],
        complexity: "simple",
      },
    ],
    edges: [
      {
        id: "edge:file:fn",
        source: "file:src/index.ts",
        target: "fn:main",
        category: "structural",
        type: "contains",
      },
    ],
    layers: [
      {
        id: "core",
        name: "Core",
        nodeIds: ["file:src/index.ts", "fn:main"],
      },
    ],
    tour: [],
  };
}

function git(projectRoot, ...args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
  }).trim();
}

function setupProject() {
  const root = mkdtempSync(join(tmpdir(), "ua-live-sync-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "index.ts"), "export function main() {}\n");
  git(root, "init");
  git(root, "config", "user.email", "live-sync@example.com");
  git(root, "config", "user.name", "Live Sync Tests");
  git(root, "add", "--all");
  git(root, "commit", "-m", "baseline");

  const dataDir = join(root, ".ua");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, "knowledge-graph.json"),
    JSON.stringify(fixtureGraph(git(root, "rev-parse", "HEAD"))),
  );
  return root;
}

function startViewer(projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn(
      process.execPath,
      [VIEWER_BIN, projectRoot, "--no-open", "--port", "0"],
      { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    const timer = setTimeout(() => {
      proc.kill();
      rejectPromise(new Error(`viewer did not start.\n${out}`));
    }, 10_000);
    const onData = (chunk) => {
      out += String(chunk);
      const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([a-f0-9]+)/);
      if (m) {
        clearTimeout(timer);
        resolvePromise({ proc, url: m[0], port: Number(m[1]), token: m[2] });
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (code) => {
      clearTimeout(timer);
      rejectPromise(new Error(`viewer exited with ${code}.\n${out}`));
    });
  });
}

function postJson(port, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: `${path}?token=${token}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(responseBody) });
          } catch {
            resolve({ statusCode: res.statusCode, raw: responseBody });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

describe("Dashboard Live Sync SSE Protocol", () => {
  let root;
  let viewer;

  beforeAll(async () => {
    root = setupProject();
    viewer = await startViewer(root);
  });

  afterAll(() => {
    if (viewer?.proc) viewer.proc.kill();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("rejects unauthorized SSE connection", async () => {
    const res = await new Promise((resolve) => {
      http.get(
        `http://127.0.0.1:${viewer.port}/api/events?token=invalid`,
        (res) => resolve(res),
      );
    });
    expect(res.statusCode).toBe(403);
  });

  it("connects to /api/events and receives broadcasted graph updates", async () => {
    const receivedEvents = [];

    const req = http.get(
      `http://127.0.0.1:${viewer.port}/api/events?token=${viewer.token}`,
      (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toBe("text/event-stream");

        res.on("data", (chunk) => {
          const text = chunk.toString();
          receivedEvents.push(text);
        });
      },
    );

    // Wait for connection to establish and initial handshake
    await new Promise((r) => setTimeout(r, 100));

    // Send notify-update
    const updateRes = await postJson(
      viewer.port,
      "/api/notify-update",
      { reason: "incremental_sync", changedFiles: ["src/index.ts"] },
      viewer.token,
    );
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.data.ok).toBe(true);

    // Send focus-node
    const focusRes = await postJson(
      viewer.port,
      "/api/focus-node",
      { nodeId: "fn:main" },
      viewer.token,
    );
    expect(focusRes.statusCode).toBe(200);
    expect(focusRes.data.ok).toBe(true);

    // Send highlight-path
    const pathRes = await postJson(
      viewer.port,
      "/api/highlight-path",
      { nodeIds: ["file:src/index.ts", "fn:main"] },
      viewer.token,
    );
    expect(pathRes.statusCode).toBe(200);
    expect(pathRes.data.ok).toBe(true);

    // Give time for events to arrive over SSE
    await new Promise((r) => setTimeout(r, 200));

    req.destroy();

    const allOutput = receivedEvents.join("");
    expect(allOutput).toContain("event: connected");
    expect(allOutput).toContain("event: graph:updated");
    expect(allOutput).toContain("incremental_sync");
    expect(allOutput).toContain("event: node:focus");
    expect(allOutput).toContain("fn:main");
    expect(allOutput).toContain("event: path:highlight");
  });
});
