# Understand-Anything Knowledge Engine Subsystem

## Overview

Understand-Anything (UA) is embedded as a dedicated subsystem within Fling (`subsystems/understand-anything/`). It functions as UEW's **Architectural Memory and Semantic Graph Subsystem**, modeling codebases as queryable knowledge graphs stored deterministically in `.ua/knowledge-graph.json`.

---

## 1. Architectural Boundaries

- **UEW Core:** Governs task classification, approval boundaries, human-in-the-loop decisions, planning, step-by-step implementation, testing, independent review, and delivery.
- **Understand-Anything Subsystem:** Provides static analysis, AST extraction, semantic graph generation, fast indexed search, dependency pathfinding, change-impact tracing, incremental git reconciliation, snapshot recovery, and the live dashboard.

---

## 2. Model Context Protocol (MCP) Tools

When running with an MCP-enabled agent host, Understand-Anything exposes the following tools:

| Tool | Purpose | Parameters |
|---|---|---|
| `understand_query_graph` | Search indexed graph nodes by name, file path, layer, type, complexity, tags | `name`, `filePath`, `layer`, `type`, `complexity`, `tags`, `limit` |
| `understand_get_subgraph` | Extract k-hop dependency neighborhoods | `rootNodeId`, `maxHops`, `direction` (`"both" \| "upstream" \| "downstream"`) |
| `understand_find_path` | Trace call/dependency paths or detect circular dependency cycles | `sourceId`, `targetId`, `maxDepth`, `findCycles` (boolean) |
| `understand_update_node` | Safely update node metadata with atomic locking and schema checks | `nodeId`, `patch` (`{ summary, tags, complexity }`) |
| `understand_sync_incremental` | Reconcile recent or uncommitted git changes into the graph | `changedFiles` (optional explicit list) |
| `understand_build` | Execute full codebase scan and graph construction | `projectPath`, `driver` (`"antigravity" \| "claude-code" \| "codex" \| "heuristic"`) |

---

## 3. Native Subagent Delegation Protocol

Understand-Anything eliminates direct, uncontrolled third-party LLM API calls. Instead, analysis is executed via native subagents of the host platform:

1. **Task Preparation:** The primary agent or tool calls UA's `AnalysisOrchestrator`, which decomposes the codebase or changed files into modular batches using `ProjectScanner` and `BatchCoordinator`.
2. **Subagent Spawning:** The primary agent spawns native subagents via the host CLI (Antigravity, Claude Code, Codex) using prompt templates defined in `subsystems/understand-anything/understand-anything-plugin/agents/`.
3. **Structured Results:** Subagents investigate bounded files and return structured JSON schemas (nodes, edges, layers, complexity).
4. **Validation & Atomic Commit:** UA core engine centrally validates schema conformance, sanitizes secrets with `SecretRedactor`, enforces path boundaries with `PathValidator`, and commits atomic graph updates under `.ua/knowledge-graph.lock`.

---

## 4. Disaster Recovery & Snapshot Management

- **5-Slot Snapshot Ring Buffer:** Historical snapshots are saved to `.ua/snapshots/snapshot-<timestamp>.json` before major mutations, migrations, or full rebuilds. Exactly the last 5 snapshots are retained.
- **Atomic Locking:** Mutations acquire `.ua/knowledge-graph.lock` with PID tracking and a 30-second stale lock timeout.
- **Corrupted Update Protection:** If an update fails validation, the existing valid graph remains completely untouched, and candidate payloads are quarantined to `.ua/failed-update-<timestamp>.json`.

---

## 5. Visual Dashboard & SSE Live Sync

The standalone viewer serves an interactive React visualization UI:
```bash
node subsystems/understand-anything/understand-anything-plugin/packages/viewer/bin/viewer.mjs .
```
- Listens on `http://127.0.0.1:<port>/?token=<ACCESS_TOKEN>`.
- Provides Server-Sent Events (SSE) live updates on `/api/events`. When graph mutations or incremental updates occur, the viewer automatically broadcasts events to keep connected developer browsers in sync.
