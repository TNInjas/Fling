# Package architecture

The distribution separates always-on rules from detailed task procedures.

## 1. Global rules

`global/AGENTS.md` contains the concise, cross-project operating boundaries: role and authority, instruction precedence, trust boundaries, task triage, approval policy, resource efficiency, Git permissions, and delivery expectations.

It is intentionally kept short because global instructions may be loaded in every session.

## 2. Progressive-disclosure skill

`skills/universal-engineering/SKILL.md` contains the full workflow and specialized procedures. The skill is intended to be activated for substantive engineering and technical research work rather than adding overhead to every simple conversation.

## 3. Project-specific instructions

`templates/project-agent/AGENTS.md` is a starting point for repository-specific context: purpose, requirements, architecture, development commands, conventions, security, known issues, and delivery requirements.

It should be adapted to an existing repository, not copied blindly over existing project instructions.

## 4. Task artifacts

`templates/task-artifacts/` contains lightweight active-task and session-handover templates. These files are working state, not a required directory structure. Use them only when they add value and preserve the project's existing documentation conventions.

## 5. Optional integrations

EGM and CodeRabbit can provide specialized research, specification, and review capabilities when installed and authorized. The workflow must check actual availability and invocation details rather than assuming them.

## 6. Knowledge engine subsystem (`subsystems/understand-anything/`)

Understand-Anything (UA) serves as the persistent architectural memory and semantic code graph engine for UEW:

- **Operational Boundary:** UEW Core handles workflow governance, task triage, approval boundaries, agent authority, and delivery. UA handles structural/semantic analysis, AST extraction, indexed graph storage, k-hop dependency retrieval, change-impact analysis, and visual dashboard presentation.
- **Shared Core Implementation:** Both MCP tools and internal programmatic APIs execute against the single underlying `@understand-anything/core` engine.
- **Native Subagent Delegation:** UA's `AnalysisOrchestrator` generates modular analysis tasks for native CLI subagents (Antigravity, Claude Code, Codex, or Heuristic). The primary agent coordinates subagents; subagents return structured JSON; the orchestrator centrally validates schemas, redacts secrets, and persists changes under atomic PID locks.
- **Resilience & Snapshots:** Retains the last 5 successful graph snapshots (`.ua/snapshots/`), locks mutations atomically, and isolates invalid candidate payloads (`.ua/failed-update-...`) without corrupting the production graph.
- **Interactive Visual Dashboard:** A standalone HTTP viewer provides real-time graph visualization and Server-Sent Events (SSE) live updates on `/api/events`.

## Runtime flow

```text
User request
    |
    v
Global rules -> task triage -> understand context
    |                              |
    |                              v
    |                    Research / EGM when useful
    |                              |
    v                              v
Approval boundary <- task-specific plan
    |
    v
Incremental implementation -> continuous QA / review
    |
    v
Final verification -> delivery report and shipping status
```

The workflow is behavioural guidance. It is not a standalone orchestration engine, policy-enforcement layer, or plugin installer.
