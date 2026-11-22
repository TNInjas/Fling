# Source-to-Package Traceability (Fling v2.0.0)

- **Workflow Specification:** Version 2.0 (Agent-agnostic, user-led, AI-assisted)
- **Authoritative Specification Document:** `AGENTS.md` (Universal Engineering Workflow v2.0 Manual)
- **Reference Specification PDF:** `docs/Universal Engineering Workflow for Antigravity CLI.pdf` (Version 1.1 foundational reference)
- **Distribution Package Version:** 2.0.0

This repository translates the Universal Engineering Workflow specification into production configurations, project instructions, progressive-disclosure skills, and integrated subsystems.

---

## Architecture Component Mapping

| Subsystem / Layer | Component Function | Package & File Location | Upstream Traceability & Origin |
|---|---|---|---|
| **UEW Core (v2.0)** | Master Operating Manual | `AGENTS.md` | Fling UEW v2.0 Specification |
| **UEW Core (v2.0)** | Global Machine-Level Rules | `global/AGENTS.md` | Derived from `AGENTS.md` Section 10 |
| **UEW Core (v2.0)** | Progressive Workflow Skill | `skills/universal-engineering/SKILL.md` | Fling UEW Core |
| **UEW Core (v2.0)** | Standalone Distribution Scripts | `install.sh`, `uninstall.sh`, `tests/test-install.sh` | Fling Core distribution |
| **UEW Core (v2.0)** | Project & Task Templates | `templates/project-agent/AGENTS.md`, `templates/task-artifacts/` | Fling Core templates |
| **Understand-Anything** | Knowledge Engine Monorepo | `subsystems/understand-anything/` | Upstream: Egonex-AI/Understand-Anything (`bb70fdb`, v2.9.8) |
| **Understand-Anything** | Core Analysis Engine | `subsystems/understand-anything/packages/core/` | Customized (Targets 2, 4, 5, 6, 7, 8) |
| **Understand-Anything** | Expanded MCP Server | `subsystems/understand-anything/packages/mcp/` | Customized (Target 1: programmatic graph & build tools) |
| **Understand-Anything** | Standalone Viewer & SSE Server | `subsystems/understand-anything/packages/viewer/` | Customized (Target 9: `/api/events` live-sync) |
| **Understand-Anything** | Interactive Graph Dashboard | `subsystems/understand-anything/packages/dashboard/` | Customized (Target 9: React + Vite + useLiveSync) |
| **Understand-Anything** | Subsystem Operating Rules | `subsystems/understand-anything/AGENTS.md` | Target 10: Subsystem boundary governance |
| **Ponytail** | Implementation Methodology | `subsystems/ponytail/upstream/` | Upstream: DietrichGebert/ponytail (`96608e0`, v5.3.3) |
| **Ponytail** | Integration Metadata | `subsystems/ponytail/UPSTREAM.md` | Fling integration documentation |
| **Ponytail** | Project-Level Always-On Rules | `.agents/rules/ponytail.md` | Antigravity `.agents/rules/` discovery |
| **Workspace Orchestration** | Monorepo Configuration | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Fling Workspace integration |
| **Third-Party Compliance** | Licensing & Attribution | `LICENSE`, `THIRD-PARTY-NOTICES.md` | MIT License compliance across all components |

---

## Customization Delta (Understand-Anything)

The Understand-Anything subsystem includes 10 target improvements implemented in commit `2b23877` (54 files, 5,315 insertions):
1. **Target 1:** Expanded Model Context Protocol (MCP) server (`packages/mcp/lib/expanded-tools.mjs`).
2. **Target 2:** Decoupled analysis pipeline (`ProjectScanner`, `BatchCoordinator`, `GraphAssembler`, `IncrementalReconciler`).
3. **Target 3:** Unified `AnalysisOrchestrator` with Antigravity native subagent delegation and Heuristic fallback.
4. **Target 4:** High-performance `GraphNavigator` and `Pathfinder` with bidirectional BFS and cycle detection.
5. **Target 5:** Git diff reconciliation and uncommitted change tracking (`LifecycleManager`).
6. **Target 6:** Atomic PID locking (`GraphLockManager`), 5-slot snapshot ring buffer (`SnapshotManager`), and invalid candidate quarantine.
7. **Target 7:** Content-addressable SHA-256 cache (`ContentCache`) and prompt compression (`PromptCompressor`).
8. **Target 8:** Path traversal sanitization (`PathValidator`) and credential redacting (`SecretRedactor`).
9. **Target 9:** Standalone HTTP viewer with Server-Sent Events (SSE) `/api/events` live synchronization.
10. **Target 10:** Dedicated subsystem operating instructions (`AGENTS.md`) and runbook (`docs/uew-integration.md`).
