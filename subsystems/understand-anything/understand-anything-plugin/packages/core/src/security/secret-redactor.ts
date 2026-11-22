import type { KnowledgeGraph, GraphNode } from "../types.js";

/**
 * High-speed secret & credential redactor.
 * Scans text, node summaries, and language notes for sensitive patterns
 * (API keys, private keys, passwords, bearer tokens) and replaces them with [REDACTED_SECRET].
 */
export class SecretRedactor {
  private static readonly SECRET_PATTERNS: RegExp[] = [
    // Bearer tokens and generic API key assignments
    /(?:bearer\s+|api[_-]?key\s*[:=]\s*['"]?)([a-z0-9_\-\.]{16,})['"]?/gi,
    // GitHub Personal Access Tokens and Fine-Grained Tokens
    /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g,
    // OpenAI API Keys
    /sk-[a-zA-Z0-9_\-]{20,}/g,
    // Google Cloud / Firebase API Keys
    /AIza[0-9A-Za-z-_]{35}/g,
    // AWS Access Key ID
    /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
    // RSA / EC / DSA / OpenSSH Private Keys
    /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g,
    // Slack tokens
    /xox[baprs]-[0-9]{10,}-[a-zA-Z0-9]+/g,
    // Password assignments in configs/env (e.g. password=..., secret=...)
    /(?:password|passwd|secret|token)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi,
  ];

  /**
   * Redacts sensitive patterns in a single text string.
   */
  static redactText(text: string): string {
    if (!text || typeof text !== "string") return text;
    let result = text;
    for (const pattern of this.SECRET_PATTERNS) {
      result = result.replace(pattern, (match) => {
        // If match starts with a key prefix like "api_key = ", preserve the prefix and redact only the secret value
        const prefixMatch = match.match(/^(?:bearer\s+|api[_-]?key\s*[:=]\s*['"]?|password\s*[:=]\s*['"]?|passwd\s*[:=]\s*['"]?|secret\s*[:=]\s*['"]?|token\s*[:=]\s*['"]?)/i);
        if (prefixMatch) {
          return `${prefixMatch[0]}[REDACTED_SECRET]`;
        }
        return "[REDACTED_SECRET]";
      });
    }
    return result;
  }

  /**
   * Sanitizes all nodes within a KnowledgeGraph, redacting secrets from summaries,
   * languageNotes, tags, and custom metadata.
   */
  static redactGraph(graph: KnowledgeGraph): KnowledgeGraph {
    const sanitizedNodes: GraphNode[] = graph.nodes.map((node) => {
      const updated: GraphNode = { ...node };
      if (typeof updated.summary === "string") {
        updated.summary = this.redactText(updated.summary);
      }
      if (typeof updated.languageNotes === "string") {
        updated.languageNotes = this.redactText(updated.languageNotes);
      }
      if (Array.isArray(updated.tags)) {
        updated.tags = updated.tags.map((t) => this.redactText(t));
      }
      return updated;
    });

    return {
      ...graph,
      nodes: sanitizedNodes,
    };
  }
}
