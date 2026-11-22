import { useEffect, useRef } from "react";
import { useDashboardStore } from "../store";

export interface LiveSyncOptions {
  enabled?: boolean;
  accessToken: string;
  onGraphUpdated?: () => void;
  onFocusNode?: (nodeId: string) => void;
  onHighlightPath?: (nodeIds: string[]) => void;
}

/**
 * useLiveSync connects to the viewer's Server-Sent Events (SSE) endpoint
 * at /api/events and listens for live graph mutations and agent-driven navigation:
 *
 * - graph:updated: Reloads knowledge graph / staleness when an agent or pipeline updates it
 * - node:focus: Focuses or selects a specific node instructed by an agent
 * - path:highlight: Highlights a path or dependency trace
 */
export function useLiveSync({
  enabled = true,
  accessToken,
  onGraphUpdated,
  onFocusNode,
  onHighlightPath,
}: LiveSyncOptions): void {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken) return;

    const url = `/api/events?token=${encodeURIComponent(accessToken)}`;
    let es: EventSource;

    try {
      es = new EventSource(url);
      eventSourceRef.current = es;
    } catch (e) {
      console.warn("[LiveSync] Failed to initialize EventSource:", e);
      return;
    }

    es.addEventListener("graph:updated", (event) => {
      console.info("[LiveSync] Received graph:updated", event.data);
      if (onGraphUpdated) {
        onGraphUpdated();
      } else {
        window.dispatchEvent(new CustomEvent("ua:reload-graph"));
      }
    });

    es.addEventListener("node:focus", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const nodeId = payload?.nodeId;
        if (typeof nodeId === "string") {
          if (onFocusNode) {
            onFocusNode(nodeId);
          } else {
            const store = useDashboardStore.getState();
            store.selectNode(nodeId);
            store.setFocusNode(nodeId);
          }
        }
      } catch (err) {
        console.warn("[LiveSync] Failed to parse node:focus event:", err);
      }
    });

    es.addEventListener("path:highlight", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const nodeIds = payload?.nodeIds || payload?.path;
        if (Array.isArray(nodeIds)) {
          if (onHighlightPath) {
            onHighlightPath(nodeIds);
          } else if (nodeIds.length > 0) {
            useDashboardStore.getState().selectNode(nodeIds[0]);
          }
        }
      } catch (err) {
        console.warn("[LiveSync] Failed to parse path:highlight event:", err);
      }
    });

    es.onerror = (err) => {
      // EventSource handles reconnection automatically
      console.debug("[LiveSync] EventSource notice:", err);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [enabled, accessToken, onGraphUpdated, onFocusNode, onHighlightPath]);
}
