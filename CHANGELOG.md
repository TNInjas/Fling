# Changelog

Notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-11-22

Major architectural release transforming Fling into a complete, tripartite open-source engineering framework integrating **UEW Core v2.0**, the **Understand-Anything** codebase knowledge engine, and the **Ponytail** implementation methodology.

### Added

#### Universal Engineering Workflow (UEW) Core v2.0
- **Authoritative v2.0 Operating Manual (`AGENTS.md`):** Complete 660-line operating specification integrating governance, specialized workflows (Research, Features, Debugging, Refactoring, Security Reviews, Maintenance, Performance Optimization, GitHub Contributions), and the Master Instruction Document.
- **Master Operating Instructions (`global/AGENTS.md`):** Refreshed global rules derived directly from Section 10 of the v2.0 specification, packaged cleanly by `./install.sh`.
- **Fling Project Instructions:** Integrated Section 13 inline in `AGENTS.md` detailing repository architecture, monorepo workspace scripts, and verified verification commands.
- **Third-Party Compliance & Traceability:** Added comprehensive `THIRD-PARTY-NOTICES.md` and updated `SOURCE-TRACEABILITY.md` detailing all vendored and customized components.

#### Understand-Anything (UA) Knowledge Engine Subsystem (`subsystems/understand-anything/`)
- **Decoupled Pipeline:** Modular `ProjectScanner`, `BatchCoordinator`, `GraphAssembler`, and `IncrementalReconciler` for efficient repository analysis.
- **Expanded Model Context Protocol (MCP) Server (`packages/mcp/`):** Exposes programmatic tools: `understand_query_graph`, `understand_get_subgraph`, `understand_find_path`, `understand_update_node`, `understand_sync_incremental`, and `understand_build`.
- **Native Subagent Coordination (`packages/core/src/orchestrator/`):** Antigravity CLI subagent driver allowing the primary coding agent to spawn bounded subagents for file and architecture analysis; results are validated, merged, and snapshotted centrally without direct LLM API calls.
- **Graph Resilience & Recovery (`packages/core/src/persistence/`):** 5-slot snapshot ring buffer (`SnapshotManager`), atomic file persistence (`atomicWriteFileSync`), PID process locking (`GraphLockManager`), and quarantine for corrupted candidate payloads (`failed-update-...json`).
- **Graph Traversal & Analysis (`packages/core/src/navigator/`):** Dual-adjacency graph navigation with secondary indexes, cycle detection, shortest-path BFS, and dependency tracing (`Pathfinder`).
- **Interactive Visualization & Live Sync (`packages/viewer/`, `packages/dashboard/`):** Standalone HTTP viewer and React + Vite dashboard with Server-Sent Events (SSE) live updates on `/api/events` (`useLiveSync`).
- **Security & Boundaries (`packages/core/src/security/`):** Path traversal prevention (`PathValidator`) and credential sanitization (`SecretRedactor`).

#### Ponytail Implementation Methodology (`subsystems/ponytail/`)
- **Vendored Upstream Subsystem:** Complete Ponytail methodology vendored at release `v5.3.3` (commit `96608e0`) under `subsystems/ponytail/upstream/` with MIT License attribution.
- **Project-Level Always-On Rules:** Deployed to `.agents/rules/ponytail.md` for native Antigravity workspace awareness.
- **CLI Skills & Slash Commands:** 6 active skills available via Antigravity plugin: `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`.

#### Monorepo Workspace Tooling
- **Pnpm Workspace Configuration:** Configured `pnpm-workspace.yaml` and root `package.json` with unified test orchestration (`pnpm test`, `npm run test:uew`, `npm run test:ua:core`, `npm run test:ua:dashboard`).

### Changed
- **Root Repository Instructions:** Replaced legacy root configuration with the authoritative UEW v2.0 manual while folding Fling-specific project instructions inline.
- **Skill Progressive Disclosure:** Updated `skills/universal-engineering/SKILL.md` to progressively leverage the knowledge engine and Ponytail ladder with safe fallbacks when tools are unavailable.
- **Architecture Documentation:** Updated `docs/ARCHITECTURE.md` to define the tripartite architectural boundary between UEW Core, Understand-Anything, and Ponytail.

### Deprecated / Superseded
- **Legacy Skill Delegation Requirement:** Removed the v1.1 directive requiring manual invocation of the `universal-engineering` skill; v2.0 workflows are self-contained in the authoritative manual.

### Migration Considerations
- Projects migrating from v1.1 should update their global rules via `./install.sh` and ensure their repository root includes an `AGENTS.md` following the v2.0 schema.
- Existing shell installer (`./install.sh` / `./uninstall.sh`) remains 100% decoupled from Node.js dependencies, ensuring lightweight distribution on systems without a JavaScript runtime.

---

## [1.1.0] - 2026-11-15

First public distribution package for the Version 1.1 workflow specification.

- Preserved the Version 1.1 global instructions, skill, templates, and original 20-page PDF.
- Added public project documentation, compatibility notes, contribution guidance, security policy, and MIT license.
- Added safer install and uninstall scripts with dry-run support and configurable destination.
- Added automated smoke tests for installation, overwrite protection, and safe removal.
- Added source traceability and documented integration capability boundaries.
