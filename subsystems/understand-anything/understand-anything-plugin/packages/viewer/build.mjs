#!/usr/bin/env node
/**
 * Build the standalone viewer: build the dashboard (and its core dependency),
 * then embed the compiled frontend under this package's dist/ so the packed
 * tarball is fully self-contained (no runtime dependencies).
 *
 * Run from anywhere inside the monorepo:
 *     pnpm --filter understand-anything-viewer build
 */
import { execSync } from "node:child_process";
import { cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dashboardDist = join(here, "..", "dashboard", "dist");
const coreStaleness = join(here, "..", "core", "dist", "staleness.js");
const viewerDist = join(here, "dist");
const viewerServerDist = join(here, "bin", "dist");

const coreDir = join(here, "..", "core");
const dashboardDir = join(here, "..", "dashboard");

if (!existsSync(coreStaleness)) {
  execSync("npx tsc", { stdio: "inherit", cwd: coreDir, env: { ...process.env, CI: "true" } });
}
if (!existsSync(dashboardDist)) {
  execSync("npx tsc -b && npx vite build", { stdio: "inherit", cwd: dashboardDir, env: { ...process.env, CI: "true" } });
}

if (!existsSync(dashboardDist)) {
  console.error(`Error: dashboard build output not found at ${dashboardDist}`);
  process.exit(1);
}

rmSync(viewerDist, { recursive: true, force: true });
cpSync(dashboardDist, viewerDist, { recursive: true });
rmSync(viewerServerDist, { recursive: true, force: true });
mkdirSync(viewerServerDist, { recursive: true });
cpSync(coreStaleness, join(viewerServerDist, "staleness.js"));
console.log(`Embedded dashboard build into ${viewerDist}`);
