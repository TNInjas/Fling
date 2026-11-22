# Third-Party Notices and Open Source Attribution

This repository incorporates open-source software and methodologies authored by third parties. This document lists the external projects, their source repositories, upstream versions, licensing terms, and integration locations within Fling.

---

## 1. Understand-Anything (UA)

- **Project:** Understand-Anything
- **Upstream Repository:** [https://github.com/Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
- **Upstream Version / Tag:** `v2.9.8`
- **Upstream Base Commit:** `bb70fdb`
- **Original License:** MIT License
- **Copyright:** (c) 2026 Egonex AI and Understand-Anything Contributors
- **Location in Fling:** `subsystems/understand-anything/`
- **License File:** `subsystems/understand-anything/LICENSE`
- **Nature of Modifications:**
  Fling integrates a customized implementation of Understand-Anything incorporating 10 specific targets (commit `2b23877`):
  1. Expanded Model Context Protocol (MCP) server with programmatic query, subgraph, pathfinding, update, and build tools.
  2. Decoupled analysis pipeline (`ProjectScanner`, `BatchCoordinator`, `GraphAssembler`, `IncrementalReconciler`).
  3. Multi-driver `AnalysisOrchestrator` supporting Antigravity native subagent delegation, Claude Code, Codex, and deterministic Heuristic fallback.
  4. Dual-adjacency `GraphNavigator` with secondary indexing, cycle detection, shortest path BFS, and dependency tracing (`Pathfinder`).
  5. Git diff reconciliation and uncommitted change tracking (`LifecycleManager`).
  6. Atomic PID lock management (`GraphLockManager`), 5-slot snapshot ring buffer (`SnapshotManager`), and invalid candidate isolation (`failed-update-...`).
  7. Content-addressable SHA-256 cache (`ContentCache`) and prompt compression (`PromptCompressor`).
  8. Path traversal sanitization (`PathValidator`) and credential redacting (`SecretRedactor`).
  9. Standalone HTTP viewer (`viewer.mjs`) with Server-Sent Events (SSE) live synchronization (`/api/events`) and interactive dashboard (`useLiveSync`).
  10. Dedicated subsystem operating rules (`subsystems/understand-anything/AGENTS.md`) and runbook (`docs/uew-integration.md`).

### MIT License Text (Understand-Anything)
```text
MIT License

Copyright (c) 2026 Egonex AI and Understand-Anything Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. Ponytail

- **Project:** Ponytail
- **Upstream Repository:** [https://github.com/DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)
- **Upstream Version / Tag:** `v5.3.3-1-g96608e0` (Release `v5.3.3`)
- **Git Commit:** `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`
- **Original License:** MIT License
- **Copyright:** (c) 2026 Dietrich Gebert (`dietrich.gebert@gmail.com`)
- **Location in Fling:**
  - Vendored upstream source: `subsystems/ponytail/upstream/`
  - Integration traceability: `subsystems/ponytail/UPSTREAM.md`
  - Project-level ruleset: `.agents/rules/ponytail.md`
  - License File: `subsystems/ponytail/upstream/LICENSE`
- **Nature of Modifications:**
  None. The upstream source code, documentation, and MIT license are vendored without modification to preserve full source fidelity. The ruleset is integrated into Antigravity via standard `.agents/rules/` discovery.

### MIT License Text (Ponytail)
```text
MIT License

Copyright (c) 2026 Dietrich Gebert

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. Tree-Sitter WASM Grammars

- **Components:** `tree-sitter-dart-wasm`, `tree-sitter-swift-wasm`
- **Upstream Projects:** Tree-sitter parsers for Dart and Swift
- **License:** MIT License / Apache License 2.0
- **Location in Fling:** `subsystems/understand-anything/understand-anything-plugin/packages/tree-sitter-*-wasm/`
- **Usage:** Precompiled WebAssembly syntax grammars used by TreeSitterPlugin for AST tokenization.
