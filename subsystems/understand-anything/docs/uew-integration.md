# UEW Subsystem Integration Guide

This document details the architecture, operational boundaries, and upstream synchronization procedures for **Understand-Anything (UA)** as an embedded subsystem within the **Universal Engineering Workflow (UEW)** ecosystem.

---

## 1. Architectural Philosophy

Understand-Anything provides a persistent, deterministic knowledge engine for complex codebases. Within UEW, UA serves as the primary **Architectural Memory and Semantic Graph Subsystem**:

```
+-------------------------------------------------------------+
|               Host Agent Environments                       |
|        (Antigravity CLI / Claude Code / Codex)             |
+-------------------------------------------------------------+
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       [MCP Server]                 [Analysis Drivers]
  (understand_query_graph,     (Antigravity, Claude Code,
   understand_get_subgraph,     Codex, Heuristic Drivers)
   understand_find_path, etc.)               │
               │                             │
               └──────────────┬──────────────┘
                              ▼
+-------------------------------------------------------------+
|               UA Core Engine (@understand-anything/core)    |
|                                                             |
|  - Graph Navigator (dual adjacency + secondary indexes)     |
|  - Pathfinder (shortest paths, k-hop cycles, upstream/down) |
|  - Pipeline & Batch Coordinator (scanners + assemblers)     |
|  - Lifecycle & Freshness Manager (git diff reconciliation)  |
|  - Content Addressable Cache & Token Compressor             |
|  - Security & Validation (PathValidator, SecretRedactor)    |
|  - Persistence & Snapshot Ring Buffer (5-slot recovery)     |
+-------------------------------------------------------------+
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
     [.ua/ Data Directory]         [Interactive Dashboard]
  (knowledge-graph.json,        (Viewer HTTP Server +
   snapshots/, locks)            SSE Live-Sync on /api/events)
```

### Key Integrations:
- **No Direct LLM Fallback**: Rather than making uncontrolled cloud API calls, UA analysis is orchestrated via the host agentic CLI's native sub-agents.
- **Centralized Validation & Persistence**: Sub-agents analyze modular files and produce structured JSON payloads. UA core engine validates schema conformance and persists changes with PID locking.
- **Bi-directional Coordination**: Agents trigger graph mutations, while the interactive viewer reflects updates via Server-Sent Events (SSE).

---

## 2. Directory and Package Layout

UA preserves its clean monorepo architecture under `understand-anything-plugin/`:

| Directory | Package | Responsibility |
|---|---|---|
| `packages/core/` | `@understand-anything/core` | Domain model, validation, navigation, pathfinding, lifecycle, security, and snapshot persistence |
| `packages/mcp/` | `@understand-anything/mcp` | Model Context Protocol server exposing read, query, pathfinding, and mutation tools |
| `packages/viewer/` | `understand-anything-viewer` | Standalone zero-dependency HTTP server with SSE live sync |
| `packages/dashboard/` | `@understand-anything/dashboard` | React + Vite interactive graph visualization UI |
| `packages/skill/` | `@understand-anything/skill` | Legacy skill adapters for Claude Code |
| `agents/` | Prompts / Specs | Analysis agent definitions (`architecture-analyzer.md`, `file-analyzer.md`, etc.) |

---

## 3. Upstream Maintenance & Sync Runbook

The repository is configured to track the upstream open-source project while preserving all UEW customizations:

- **Local Remote**: `origin` (`https://github.com/Egonex-AI/Understand-Anything`)
- **Upstream Remote**: `upstream` (`https://github.com/Egonex-AI/Understand-Anything.git`)

### Step-by-Step Upstream Sync Procedure:

1. **Fetch Upstream Changes**:
   ```bash
   git fetch upstream main
   ```

2. **Inspect Upstream Diff**:
   ```bash
   git log --oneline HEAD..upstream/main
   git diff --stat HEAD..upstream/main
   ```

3. **Rebase or Merge with Customization Protection**:
   Our customizations reside in cleanly modularized packages:
   - `packages/core/src/security/` (`path-validator.ts`, `secret-redactor.ts`)
   - `packages/core/src/persistence/` (`lock.ts`, `snapshot.ts`)
   - `packages/core/src/navigator/` (`graph-navigator.ts`, `pathfinder.ts`)
   - `packages/core/src/pipeline/` (`scanner.ts`, `batcher.ts`, `merger.ts`, `incremental.ts`)
   - `packages/core/src/orchestrator/` (`orchestrator.ts`, drivers)
   - `packages/core/src/cache/` (`content-cache.ts`)
   - `packages/core/src/analyzer/prompt-compressor.ts`
   - `packages/core/src/lifecycle/` (`manager.ts`)
   - `packages/mcp/lib/expanded-tools.mjs`
   - `packages/viewer/bin/viewer.mjs` (SSE endpoints)
   - `packages/dashboard/src/hooks/useLiveSync.ts`

   Execute rebase:
   ```bash
   git rebase upstream/main
   ```

4. **Verify Build and Test Suite**:
   ```bash
   pnpm --filter @understand-anything/core build
   pnpm --filter @understand-anything/dashboard build
   node understand-anything-plugin/packages/viewer/build.mjs
   pnpm test
   ```

5. **Run End-to-End Regression Tests**:
   ```bash
   pnpm vitest run tests/mcp/ tests/viewer/
   ```

---

## 4. Disaster Recovery & Snapshot Management

1. **Snapshot Buffer**:
   Before full rebuilds or migrations, `SnapshotManager` saves the current valid graph into `.ua/snapshots/snapshot-<timestamp>.json`.
2. **Ring Buffer Pruning**:
   The engine retains exactly the last 5 snapshots (configurable via `snapshotRetentionLimit`).
3. **Rollback**:
   If a corrupt graph is detected, `SnapshotManager.rollback()` restores the latest valid snapshot.
4. **Failure Preservation**:
   Any unparsable or invalid payload candidate is written to `.ua/failed-update-<timestamp>.json` without overwriting the production `knowledge-graph.json`.
