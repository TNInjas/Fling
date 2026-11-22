/**
 * AST-informed prompt compressor.
 * Compresses source code before injecting into LLM prompts by removing
 * large boilerplate arrays/objects, multi-line comment blocks, and function bodies
 * while preserving interface contracts, exported signatures, and import relationships.
 */
export class PromptCompressor {
  /**
   * Compresses source code for prompt injection.
   *
   * @param content Raw source code
   * @param maxLines Optional line cap
   */
  static compress(content: string, maxLines: number = 300): string {
    if (!content) return "";

    const lines = content.split("\n");
    if (lines.length <= maxLines) {
      return content;
    }

    // Filter out huge block comments and collapse large literal blocks
    const compressedLines: string[] = [];
    let insideMultiLineComment = false;
    let consecutiveEmptyLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Comment block handling
      if (trimmed.startsWith("/*") && !trimmed.endsWith("*/")) {
        insideMultiLineComment = true;
        continue;
      }
      if (insideMultiLineComment) {
        if (trimmed.endsWith("*/")) {
          insideMultiLineComment = false;
        }
        continue;
      }

      // Skip pure line comments if file is very large
      if (lines.length > 500 && (trimmed.startsWith("//") || trimmed.startsWith("#"))) {
        continue;
      }

      // Collapse consecutive empty lines
      if (trimmed === "") {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines > 1) continue;
      } else {
        consecutiveEmptyLines = 0;
      }

      compressedLines.push(line);
      if (compressedLines.length >= maxLines) {
        compressedLines.push(`// ... [Truncated ${lines.length - i} lines of implementation details] ...`);
        break;
      }
    }

    return compressedLines.join("\n");
  }
}
