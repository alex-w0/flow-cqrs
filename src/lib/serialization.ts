import type { ReactFlowJsonObject, Viewport } from '@xyflow/react';
import type { BoardNode, BoardEdge } from '../types';
import { DEFAULT_COLUMNS, DEFAULT_LANES, isCqrsKind } from '../types';
import { sliceHeight, sliceWidth } from './grid';

export interface ParsedBoard {
  nodes: BoardNode[];
  edges: BoardEdge[];
  viewport: Viewport | null;
}

/** Serializes the full flow (nodes, edges, viewport) and triggers a browser download. */
export function downloadBoard(flow: ReactFlowJsonObject<BoardNode, BoardEdge>): void {
  const json = JSON.stringify(flow, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `event-model-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an exported board file. Throws with a human-readable
 * message on any structural problem so the caller can surface it.
 */
export function parseBoardFile(raw: string): ParsedBoard {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('The file does not contain a board object.');
  }

  const flow = parsed as Partial<ReactFlowJsonObject<BoardNode, BoardEdge>>;
  if (!Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    throw new Error('The file is missing the "nodes" or "edges" array.');
  }

  const nodes: BoardNode[] = [];
  for (const node of flow.nodes) {
    if (
      !node ||
      typeof node.id !== 'string' ||
      !node.position ||
      typeof node.position.x !== 'number' ||
      typeof node.position.y !== 'number'
    ) {
      throw new Error(`Node ${JSON.stringify(node?.id ?? '?')} is missing an id or position.`);
    }
    const label = typeof node.data?.label === 'string' ? node.data.label : '';

    if (node.type === 'slice') {
      // Normalize grid data (older exports may predate the grid) and derive
      // the rendered size from it so geometry always matches the data.
      const columns =
        typeof node.data?.columns === 'number' && node.data.columns >= 1
          ? Math.floor(node.data.columns)
          : DEFAULT_COLUMNS;
      const lanes =
        Array.isArray(node.data?.lanes) &&
        node.data.lanes.length > 0 &&
        node.data.lanes.every((lane) => typeof lane === 'string')
          ? node.data.lanes
          : [...DEFAULT_LANES];
      nodes.push({
        ...node,
        width: sliceWidth(columns),
        height: sliceHeight(lanes.length),
        data: { label, columns, lanes },
        dragHandle: '.slice-drag-handle',
      });
    } else if (isCqrsKind(node.type)) {
      const content = typeof node.data?.content === 'string' && node.data.content.trim() ? node.data.content : undefined;
      nodes.push({ ...node, data: { label, content } });
    } else {
      throw new Error(`Node "${node.id}" has unknown type "${node.type}".`);
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: BoardEdge[] = [];
  for (const edge of flow.edges) {
    if (!edge || typeof edge.id !== 'string' || typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      throw new Error('An edge is missing its id, source, or target.');
    }
    // Silently drop edges pointing at nodes that no longer exist rather than failing the import.
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      edges.push(edge);
    }
  }

  // Parents must precede children in the array for React Flow's subflow rendering.
  for (const node of nodes) {
    if (node.parentId && !nodeIds.has(node.parentId)) {
      throw new Error(`Node "${node.id}" references missing parent "${node.parentId}".`);
    }
  }
  const ordered = [...nodes.filter((n) => n.type === 'slice'), ...nodes.filter((n) => n.type !== 'slice')];

  const viewport =
    flow.viewport &&
    typeof flow.viewport.x === 'number' &&
    typeof flow.viewport.y === 'number' &&
    typeof flow.viewport.zoom === 'number'
      ? flow.viewport
      : null;

  return { nodes: ordered, edges, viewport };
}
