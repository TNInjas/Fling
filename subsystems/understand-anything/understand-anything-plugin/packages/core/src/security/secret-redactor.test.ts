import { describe, it, expect } from "vitest";
import { SecretRedactor } from "./secret-redactor.js";
import type { KnowledgeGraph } from "../types.js";

describe("SecretRedactor", () => {
  it("should redact Bearer tokens and API keys in text", () => {
    const text = "Connect with Authorization: Bearer abcdef1234567890abcdef1234567890 and api_key=xyz1234567890123456";
    const redacted = SecretRedactor.redactText(text);
    expect(redacted).not.toContain("abcdef1234567890abcdef1234567890");
    expect(redacted).not.toContain("xyz1234567890123456");
    expect(redacted).toContain("[REDACTED_SECRET]");
  });

  it("should redact GitHub Personal Access Tokens", () => {
    const text = "GitHub token ghp_1234567890abcdefghijklmnopqrstuvwxyz12 is exposed";
    const redacted = SecretRedactor.redactText(text);
    expect(redacted).toBe("GitHub token [REDACTED_SECRET] is exposed");
  });

  it("should redact OpenAI and Google API keys", () => {
    const openAI = "Key sk-1234567890abcdefghijklmnopqrstuvwxyz";
    const google = "Key AIzaSyD1234567890abcdefghijklmnopqrstuv";
    expect(SecretRedactor.redactText(openAI)).toContain("[REDACTED_SECRET]");
    expect(SecretRedactor.redactText(google)).toContain("[REDACTED_SECRET]");
  });

  it("should redact private keys", () => {
    const rsaKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----";
    const redacted = SecretRedactor.redactText(rsaKey);
    expect(redacted).toBe("[REDACTED_SECRET]");
  });

  it("should redact secrets across all nodes in a KnowledgeGraph", () => {
    const graph: KnowledgeGraph = {
      version: "1.0.0",
      project: {
        name: "TestProject",
        languages: ["ts"],
        frameworks: [],
        description: "Test description",
        analyzedAt: "2026-11-21T00:00:00Z",
        gitCommitHash: "abcdef",
      },
      nodes: [
        {
          id: "file:src/auth.ts",
          type: "file",
          name: "auth.ts",
          summary: "Uses secret token sk-abcdef12345678901234567890 to authenticate",
          languageNotes: "Configured with password: my_super_secret_password_123",
          tags: ["auth", "token=ghp_1234567890abcdefghijklmnopqrstuvwxyz12"],
          complexity: "moderate",
        },
      ],
      edges: [],
      layers: [],
      tour: [],
    };

    const redactedGraph = SecretRedactor.redactGraph(graph);
    const node = redactedGraph.nodes[0];

    expect(node.summary).not.toContain("sk-abcdef");
    expect(node.summary).toContain("[REDACTED_SECRET]");
    expect(node.languageNotes).not.toContain("my_super_secret_password_123");
    expect(node.languageNotes).toContain("[REDACTED_SECRET]");
    expect(node.tags[1]).toContain("[REDACTED_SECRET]");
  });
});
