import { describe, it, expect } from "vitest";
import { PromptCompressor } from "./prompt-compressor.js";

describe("PromptCompressor", () => {
  it("should leave short files untouched", () => {
    const shortCode = "function add(a: number, b: number): number {\n  return a + b;\n}\n";
    const compressed = PromptCompressor.compress(shortCode, 50);
    expect(compressed).toBe(shortCode);
  });

  it("should compress large files exceeding maxLines and truncate excess", () => {
    const lines: string[] = [];
    for (let i = 0; i < 200; i++) {
      lines.push(`const line${i} = ${i};`);
    }
    const longCode = lines.join("\n");
    const compressed = PromptCompressor.compress(longCode, 50);

    const compressedLines = compressed.split("\n");
    expect(compressedLines.length).toBeLessThanOrEqual(52);
    expect(compressed).toContain("Truncated");
  });
});
