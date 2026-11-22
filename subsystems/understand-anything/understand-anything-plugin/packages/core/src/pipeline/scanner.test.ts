import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ProjectScanner } from "./scanner.js";

describe("ProjectScanner", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-scanner-test-"));
    // Create test files
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "export const hello = 'world';\n");
    fs.writeFileSync(path.join(tmpDir, "src", "app.tsx"), "import React from 'react';\nexport const App = () => null;\n");
    fs.writeFileSync(path.join(tmpDir, "package.json"), '{\n  "name": "test-pkg"\n}\n');
    fs.writeFileSync(path.join(tmpDir, "docs", "README.md"), "# Project Docs\nDocumentation text\n");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should scan directory and classify files by category and language", () => {
    const scanner = new ProjectScanner(tmpDir);
    const result = scanner.scan();

    expect(result.totalFiles).toBe(4);
    expect(result.files.length).toBe(4);

    const codeFiles = result.files.filter((f) => f.fileCategory === "code");
    expect(codeFiles.length).toBe(2);

    const configFiles = result.files.filter((f) => f.fileCategory === "config");
    expect(configFiles.length).toBe(1);
    expect(configFiles[0].path).toBe("package.json");

    const docFiles = result.files.filter((f) => f.fileCategory === "docs");
    expect(docFiles.length).toBe(1);
    expect(docFiles[0].path).toBe("docs/README.md");
  });

  it("should respect exclude patterns", () => {
    const scanner = new ProjectScanner(tmpDir);
    const result = scanner.scan({ excludePatterns: ["docs/**"] });

    expect(result.totalFiles).toBe(3);
    expect(result.filteredByIgnore).toBeGreaterThanOrEqual(1);
    expect(result.files.some((f) => f.path.startsWith("docs/"))).toBe(false);
  });
});
