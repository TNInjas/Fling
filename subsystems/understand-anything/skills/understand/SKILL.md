---
name: understand
description: Explores, analyzes, queries, and visualizes codebase knowledge graphs using Understand-Anything.
---

# Understand-Anything (UA) Skill

Use this skill when you need to understand project architecture, locate functions/modules, trace call graphs, analyze dependencies, or visualize the codebase structure.

## Capabilities

1. **Architecture Discovery**:
   - Query the knowledge graph for high-level layers, entry points, and domain boundaries.
   - Use `understand_query_graph` to find components matching specific types (`file`, `function`, `class`, `service`, `endpoint`).

2. **Dependency Tracing**:
   - Extract k-hop dependency neighborhoods with `understand_get_subgraph`.
   - Trace shortest call paths and identify circular dependencies with `understand_find_path`.

3. **Incremental Knowledge Updates**:
   - When modifying files during refactors or feature work, synchronize changes into the knowledge graph using `understand_sync_incremental`.
   - Update individual node summaries and complexity tags using `understand_update_node`.

4. **Visual Dashboard Coordination**:
   - Notify the interactive visual dashboard of updates via `/api/notify-update`.
   - Guide developer attention by focusing specific nodes via `/api/focus-node`.

## Guidelines

- Never bypass schema validation or atomic locks by manually editing `.ua/knowledge-graph.json` directly.
- Use the MCP server tools (`understand_query_graph`, `understand_get_subgraph`, `understand_find_path`) for fast indexed lookups before grepping large repos.
- When performing high-impact refactors, trace upstream dependencies first to prevent unintended breakages.
