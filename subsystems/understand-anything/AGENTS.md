# AGENTS.md — Agent Interface & Operating Guidelines for Understand-Anything

This document outlines how autonomous AI agents—specifically **Antigravity**, **Claude Code**, and **Codex**—interface with Understand-Anything (UA) as an architectural knowledge engine and analysis system.

---

## 1. Role and Core Principles

Understand-Anything functions as a **centralized knowledge engine** that models the codebase as an indexed knowledge graph (`.ua/knowledge-graph.json`).

### Key Rules for Autonomous Agents:
1. **No Direct External LLM Fallback**:
   The engine does not execute out-of-band direct API calls (e.g., Anthropic/OpenAI API keys). Instead, the host agentic CLI (Antigravity, Claude Code, or Codex) invokes specialized sub-agents with dedicated role prompts (located in `understand-anything-plugin/agents/`).
2. **Centralized Validation & Persistence**:
   Sub-agents must never write directly to `.ua/knowledge-graph.json`. Sub-agents return structured JSON analysis to the `AnalysisOrchestrator`, which centrally validates schemas, enforces referential integrity, redacts sensitive tokens, and executes atomic writes under PID-based locks.
3. **Safe Navigation Before Modification**:
   Before modifying unfamiliar code, agents should query the knowledge graph to understand architectural layers, upstream callers, downstream dependencies, and potential cycles.
4. **Live Dashboard Synchronization**:
   When mutations or incremental syncs are performed, notify connected dashboard instances via Server-Sent Events (SSE) so developers see live graph updates.

---

## 2. MCP Tools Reference

When running in an MCP-enabled environment, agents have access to the expanded Understand-Anything MCP server:

| Tool | Purpose | Key Parameters |
|---|---|---|
| `understand_query_graph` | Fast indexed search for nodes by name, file path, layer, type, or complexity | `name`, `filePath`, `layer`, `type`, `complexity`, `tags`, `limit` |
| `understand_get_subgraph` | Extract k-hop dependency neighborhoods or cluster views | `rootNodeId`, `maxHops` (default: 1), `direction` (`"both" \| "upstream" \| "downstream"`) |
| `understand_find_path` | Trace call/dependency paths between nodes or detect circular dependencies | `sourceId`, `targetId`, `maxDepth`, `findCycles` (boolean) |
| `understand_update_node` | Safely update node metadata with atomic locking and schema checks | `nodeId`, `patch` (`{ summary, tags, complexity }`) |
| `understand_sync_incremental` | Reconcile uncommitted or recent git changes into the graph | `changedFiles` (optional explicit list) |
| `understand_build` | Execute full codebase scan and graph construction | `projectPath`, `driver` (`"antigravity" \| "claude-code" \| "codex" \| "heuristic"`) |

---

## 3. Analysis Orchestrator & Drivers

Programmatic analysis is managed by `@understand-anything/core/orchestrator`:

```typescript
import { AnalysisOrchestrator } from "@understand-anything/core/orchestrator";
import { AntigravityDriver } from "@understand-anything/core/orchestrator/drivers/antigravity";

const driver = new AntigravityDriver();
const orchestrator = new AnalysisOrchestrator({
  projectRoot: process.cwd(),
  driver,
  onPhaseChange: (phase, detail) => {
    console.log(`[Phase: ${phase}] ${detail.message}`);
  },
});

const graph = await orchestrator.executePipeline();
```

### Supported Drivers:
- **`AntigravityDriver`**: Orchestrates Antigravity subagent workers conforming to task definitions.
- **`ClaudeCodeDriver`**: Bridges Claude Code subagents with `understand-anything-plugin/agents/` prompt templates.
- **`CodexDriver`**: Integrates with Codex toolchains and CLI contexts.
- **`HeuristicDriver`**: Ultra-fast deterministic static analyzer (zero LLM calls) for syntax, exports, imports, and scaffolding.

---

## 4. Snapshot Retention & Failure Recovery

- **Snapshots**: Up to 5 historical recovery snapshots are automatically preserved in `.ua/snapshots/` before major modifications, schema migrations, or rebuilds.
- **Rollback**: If an update or migration produces an invalid graph, the previous valid graph is preserved unchanged, and diagnostic invalid payloads are isolated to `.ua/failed-update-<timestamp>.json`.
- **Locking**: Graph mutations acquire `.ua/knowledge-graph.lock` with PID tracking and stale-lock timeout prevention (30 seconds).

---

## 5. Visual Dashboard & Live Sync

The standalone viewer (`understand-anything-viewer`) serves the visual dashboard at `http://127.0.0.1:5173/?token=<ACCESS_TOKEN>`.

### Interacting with the Live Dashboard:
- **Notify Graph Updated**:
  ```http
  POST /api/notify-update?token=<TOKEN>
  Content-Type: application/json
  { "reason": "code_refactor", "changedFiles": ["src/app.ts"] }
  ```
- **Focus Node in UI**:
  ```http
  POST /api/focus-node?token=<TOKEN>
  Content-Type: application/json
  { "nodeId": "fn:processPayment" }
  ```
- **Highlight Dependency Path**:
  ```http
  POST /api/highlight-path?token=<TOKEN>
  Content-Type: application/json
  { "nodeIds": ["file:src/routes.ts", "fn:processPayment", "table:transactions"] }
  ```

---

## 6. Security Boundaries

- **Path Traversal Guard**: All input paths are verified by `PathValidator` to prevent escaping the project root.
- **Secret Redactor**: File contents and node descriptions are sanitized via `SecretRedactor` to strip credentials, API keys, private keys, and tokens prior to graph ingestion.
