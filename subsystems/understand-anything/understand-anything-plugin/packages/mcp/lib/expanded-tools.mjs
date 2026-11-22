import { z } from "zod";
import {
  GraphNavigator,
  Pathfinder,
  GraphLockManager,
  SnapshotManager,
  GraphLifecycleManager,
  AnalysisOrchestrator,
  saveGraph,
  validateGraph,
  resolveUaDir,
} from "@understand-anything/core";

export function registerExpandedTools(server, helpers) {
  const { resolveProjectRoot, requireGraph, textResult, errorResult, projectPathParam } = helpers;

  // 1. understand_query_graph
  server.registerTool(
    "understand_query_graph",
    {
      title: "Understand Anything: query graph",
      description:
        "Perform compound queries against the knowledge graph filtering by node types, complexity, " +
        "layers, tags, and regex filepath patterns.",
      inputSchema: {
        projectPath: projectPathParam,
        types: z.array(z.string()).optional().describe("Allowed node types (e.g. ['file', 'config'])"),
        layerId: z.string().optional().describe("Filter to nodes within a specific architectural layer"),
        complexity: z.array(z.enum(["simple", "moderate", "complex"])).optional().describe("Filter by complexity"),
        tags: z.array(z.string()).optional().describe("Filter by tags (node must have all tags)"),
        search: z.string().optional().describe("Search term for name/summary"),
        limit: z.number().int().positive().default(20).describe("Maximum number of nodes to return"),
        format: z.enum(["markdown", "json"]).default("markdown").describe("Output format"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectPath, types, layerId, complexity, tags, search, limit, format }) => {
      try {
        const root = resolveProjectRoot(projectPath);
        const { graph, error } = requireGraph(root);
        if (error) return error;

        const nav = new GraphNavigator(graph);
        const results = nav.queryNodes({
          types,
          layerId,
          complexity,
          tags,
          search,
          limit,
        });

        if (format === "json") {
          return textResult(JSON.stringify(results, null, 2));
        }

        const lines = [
          `### Graph Query Results (${results.length} nodes found)`,
          "",
          ...results.map(
            (n) => `- **\`${n.id}\`** (${n.type}, ${n.complexity ?? "simple"}): ${n.summary}`,
          ),
        ];
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err.message);
      }
    },
  );

  // 2. understand_get_subgraph
  server.registerTool(
    "understand_get_subgraph",
    {
      title: "Understand Anything: get subgraph",
      description:
        "Extract a localized, referentially intact subgraph centered on a focal node with depth radius.",
      inputSchema: {
        projectPath: projectPathParam,
        centerNodeId: z.string().describe("Center node ID (e.g. 'file:src/index.ts')"),
        radius: z.number().int().min(1).max(5).default(1).describe("Traversal radius depth"),
        direction: z.enum(["forward", "reverse", "both"]).default("both").describe("Edge traversal direction"),
        format: z.enum(["markdown", "json"]).default("markdown").describe("Output format"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectPath, centerNodeId, radius, direction, format }) => {
      try {
        const root = resolveProjectRoot(projectPath);
        const { graph, error } = requireGraph(root);
        if (error) return error;

        const nav = new GraphNavigator(graph);
        const sub = nav.getSubgraph(centerNodeId, { radius, direction });

        if (format === "json") {
          return textResult(JSON.stringify(sub, null, 2));
        }

        const md = [
          `### Subgraph around \`${centerNodeId}\` (Radius: ${radius})`,
          "",
          `**Nodes (${sub.nodes.length}):**`,
          ...sub.nodes.map((n) => `- \`${n.id}\` (${n.type}): ${n.summary}`),
          "",
          `**Relationships (${sub.edges.length}):**`,
          ...sub.edges.map((e) => `- \`${e.source}\` --[${e.type}]--> \`${e.target}\``),
        ].join("\n");

        return textResult(md);
      } catch (err) {
        return errorResult(err.message);
      }
    },
  );

  // 3. understand_find_path
  server.registerTool(
    "understand_find_path",
    {
      title: "Understand Anything: find path",
      description:
        "Find shortest path or trace dependencies between two nodes in the knowledge graph.",
      inputSchema: {
        projectPath: projectPathParam,
        sourceNodeId: z.string().describe("Starting node ID"),
        targetNodeId: z.string().describe("Destination node ID"),
        format: z.enum(["markdown", "json"]).default("markdown").describe("Output format"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectPath, sourceNodeId, targetNodeId, format }) => {
      try {
        const root = resolveProjectRoot(projectPath);
        const { graph, error } = requireGraph(root);
        if (error) return error;

        const pathfinder = new Pathfinder(graph);
        const shortest = pathfinder.findShortestPath(sourceNodeId, targetNodeId);

        if (!shortest) {
          return textResult(`No dependency path found between \`${sourceNodeId}\` and \`${targetNodeId}\`.`);
        }

        if (format === "json") {
          return textResult(JSON.stringify({ path: shortest, hops: shortest.length - 1 }, null, 2));
        }

        return textResult(
          `### Dependency Path (${shortest.length - 1} hops)\n\n` +
            shortest.map((id, idx) => `${idx + 1}. \`${id}\``).join(" ➔ "),
        );
      } catch (err) {
        return errorResult(err.message);
      }
    },
  );

  // 4. understand_update_node
  server.registerTool(
    "understand_update_node",
    {
      title: "Understand Anything: update node",
      description:
        "Update metadata (summary, tags, complexity) for an existing node in the graph.",
      inputSchema: {
        projectPath: projectPathParam,
        nodeId: z.string().describe("ID of the node to update"),
        summary: z.string().optional().describe("Updated summary description"),
        tags: z.array(z.string()).optional().describe("Updated tags"),
        complexity: z.enum(["simple", "moderate", "complex"]).optional().describe("Updated complexity"),
      },
    },
    async ({ projectPath, nodeId, summary, tags, complexity }) => {
      try {
        const root = resolveProjectRoot(projectPath);
        const lock = new GraphLockManager(resolveUaDir(root));

        return await lock.withLock(async () => {
          const { graph, error } = requireGraph(root);
          if (error) return error;

          const node = graph.nodes.find((n) => n.id === nodeId);
          if (!node) {
            return errorResult(`Node not found: '${nodeId}'`);
          }

          // Create snapshot before modifying
          const snap = new SnapshotManager(root);
          await snap.createSnapshot(`update_node_${nodeId}`);

          if (summary !== undefined) node.summary = summary;
          if (tags !== undefined) node.tags = tags;
          if (complexity !== undefined) node.complexity = complexity;

          saveGraph(root, graph);

          return textResult(`Successfully updated node '${nodeId}'.`);
        });
      } catch (err) {
        return errorResult(err.message);
      }
    },
  );

  // 5. understand_sync_incremental
  server.registerTool(
    "understand_sync_incremental",
    {
      title: "Understand Anything: sync incremental",
      description:
        "Synchronize the knowledge graph against current git HEAD, detecting stale or modified files.",
      inputSchema: {
        projectPath: projectPathParam,
      },
    },
    async ({ projectPath }) => {
      try {
        const root = resolveProjectRoot(projectPath);
        const lifecycle = new GraphLifecycleManager(root);
        const res = await lifecycle.syncIncremental();

        return textResult(
          `Incremental sync complete. Status: ${res.status}. Action: ${res.plan?.action || "none"}.`,
        );
      } catch (err) {
        return errorResult(err.message);
      }
    },
  );

  // 6. understand_build
  server.registerTool(
    "understand_build",
    {
      title: "Understand Anything: build",
      description:
        "Trigger a full codebase analysis and knowledge graph build centrally.",
      inputSchema: {
        projectPath: projectPathParam,
      },
    },
    async ({ projectPath }) => {
      try {
        const root = resolveProjectRoot(projectPath);
        const orchestrator = new AnalysisOrchestrator(root);
        const graph = await orchestrator.runFullAnalysis();

        return textResult(
          `Analysis complete. Successfully built knowledge graph for '${graph.project.name}' ` +
            `with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`,
        );
      } catch (err) {
        return errorResult(err.message);
      }
    },
  );
}
