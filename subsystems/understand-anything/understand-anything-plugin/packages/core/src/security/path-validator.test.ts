import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PathValidator } from "./path-validator.js";

describe("PathValidator", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-path-validator-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should validate and normalize relative path within project root", () => {
    const validator = new PathValidator(tmpDir);
    const result = validator.assertInsideRoot("src/index.ts");
    expect(result).toBe("src/index.ts");
  });

  it("should validate and normalize absolute path within project root", () => {
    const validator = new PathValidator(tmpDir);
    const absPath = path.join(tmpDir, "src", "components", "App.tsx");
    const result = validator.assertInsideRoot(absPath);
    expect(result).toBe("src/components/App.tsx");
  });

  it("should reject path traversal using ../ escaping project root", () => {
    const validator = new PathValidator(tmpDir);
    expect(() => {
      validator.assertInsideRoot("../outside.txt");
    }).toThrow(/Security Violation.*resolves outside project boundary/);
  });

  it("should reject absolute paths pointing outside project root", () => {
    const validator = new PathValidator(tmpDir);
    expect(() => {
      validator.assertInsideRoot("/etc/passwd");
    }).toThrow(/Security Violation.*resolves outside project boundary/);
  });

  it("should reject paths containing null bytes", () => {
    const validator = new PathValidator(tmpDir);
    expect(() => {
      validator.assertInsideRoot("src/test.ts\0.exe");
    }).toThrow(/null bytes/);
  });

  it("should safely sanitize escaping paths to basename", () => {
    const validator = new PathValidator(tmpDir);
    const sanitized = validator.sanitizePath("../../secret/passwords.txt");
    expect(sanitized).toBe("passwords.txt");
  });

  it("should accurately return boolean from isInsideRoot", () => {
    const validator = new PathValidator(tmpDir);
    expect(validator.isInsideRoot("src/main.ts")).toBe(true);
    expect(validator.isInsideRoot("../../etc/shadow")).toBe(false);
  });
});
