import type { ReactFlowJsonObject, Viewport } from '@xyflow/react';
import type { BoardNode, BoardEdge, CqrsKind, GwtData, GwtItem, Wireframe, WireframeElement, WireframeStroke } from '../types';
import {
  DEFAULT_COLUMNS,
  DEFAULT_LANES,
  GWT_REF_KINDS,
  WIREFRAME_HEIGHT,
  WIREFRAME_WIDTH,
  buildGwtSections,
  isCqrsKind,
  isMeaningfulGwtItem,
} from '../types';
import { DEFAULT_CONTEXT, sanitizeBoardContexts } from './contexts';
import { sliceHeight, sliceWidth } from './grid';

const WIREFRAME_KINDS = new Set(['button', 'input', 'image', 'checkbox', 'heading', 'text', 'rect']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validates an imported wireframe, dropping malformed entries; undefined if nothing valid remains. */
function sanitizeWireframe(value: unknown): Wireframe | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Partial<Wireframe>;

  const elements: WireframeElement[] = [];
  if (Array.isArray(raw.elements)) {
    for (const el of raw.elements as Partial<WireframeElement>[]) {
      if (
        el &&
        typeof el.id === 'string' &&
        typeof el.kind === 'string' &&
        WIREFRAME_KINDS.has(el.kind) &&
        isFiniteNumber(el.x) &&
        isFiniteNumber(el.y) &&
        isFiniteNumber(el.w) &&
        isFiniteNumber(el.h) &&
        (el.text === undefined || typeof el.text === 'string')
      ) {
        elements.push({ id: el.id, kind: el.kind, x: el.x, y: el.y, w: el.w, h: el.h, text: el.text });
      }
    }
  }

  const strokes: WireframeStroke[] = [];
  if (Array.isArray(raw.strokes)) {
    for (const stroke of raw.strokes as Partial<WireframeStroke>[]) {
      if (
        stroke &&
        typeof stroke.id === 'string' &&
        Array.isArray(stroke.points) &&
        stroke.points.length >= 4 &&
        stroke.points.length % 2 === 0 &&
        stroke.points.every(isFiniteNumber)
      ) {
        strokes.push({ id: stroke.id, points: [...stroke.points] });
      }
    }
  }

  if (elements.length === 0 && strokes.length === 0) return undefined;
  return {
    width: isFiniteNumber(raw.width) && raw.width > 0 ? raw.width : WIREFRAME_WIDTH,
    height: isFiniteNumber(raw.height) && raw.height > 0 ? raw.height : WIREFRAME_HEIGHT,
    elements,
    strokes,
  };
}

/** Validates an imported GWT scenario, dropping malformed rows; undefined if nothing valid remains. */
function sanitizeGwt(value: unknown): GwtData | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const section = (input: unknown): GwtItem[] => {
    if (!Array.isArray(input)) return [];
    const items: GwtItem[] = [];
    for (const entry of input) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      let candidate: GwtItem | null = null;
      if (item.kind === 'ref' && typeof item.ref === 'string') {
        const refItem: GwtItem = { kind: 'ref', ref: item.ref };
        if (typeof item.label === 'string' && item.label) refItem.label = item.label;
        if (typeof item.type === 'string' && isCqrsKind(item.type)) refItem.type = item.type;
        candidate = refItem;
      } else if (item.kind === 'text' && typeof item.text === 'string') {
        candidate = { kind: 'text', text: item.text };
      } else if (item.kind === 'exception' && typeof item.text === 'string') {
        candidate = { kind: 'exception', text: item.text };
      }
      // Same blank-row policy as the editor's cleanGwt, via the shared predicate.
      if (candidate && isMeaningfulGwtItem(candidate)) items.push(candidate);
    }
    return items;
  };
  const result = buildGwtSections((key) => section(raw[key]));
  if (!result.given.length && !result.when.length && !result.then.length) return undefined;
  return result;
}

export interface ParsedBoard {
  nodes: BoardNode[];
  edges: BoardEdge[];
  viewport: Viewport | null;
  /** Board-level DCB context list; always non-empty with the default context first. */
  contexts: string[];
}

/** Serializes the full flow (nodes, edges, viewport, contexts) and triggers a browser download. */
export function downloadBoard(flow: ReactFlowJsonObject<BoardNode, BoardEdge>, contexts: string[]): void {
  const json = JSON.stringify({ ...flow, contexts }, null, 2);
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

  // Pre-feature exports have no contexts key — they sanitize to just the default.
  const contexts = sanitizeBoardContexts((parsed as Record<string, unknown>).contexts);
  const contextSet = new Set(contexts);

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
        zIndex: -1,
      });
    } else if (isCqrsKind(node.type)) {
      const content = typeof node.data?.content === 'string' && node.data.content.trim() ? node.data.content : undefined;
      const wireframe = node.type === 'screen' ? sanitizeWireframe(node.data?.wireframe) : undefined;
      const gwt = node.type === 'gwt' ? sanitizeGwt(node.data?.gwt) : undefined;
      // Events keep only context references that exist in the board list. A
      // missing field (pre-feature exports) gets the default context if the
      // board has one; an explicit (even empty) list is respected as-is.
      // Other kinds never carry the field.
      let nodeContexts: string[] | undefined;
      if (node.type === 'event') {
        nodeContexts = Array.isArray(node.data?.contexts)
          ? node.data.contexts.filter((c): c is string => typeof c === 'string' && contextSet.has(c))
          : contextSet.has(DEFAULT_CONTEXT)
            ? [DEFAULT_CONTEXT]
            : [];
      }
      // Strip extent (elements move freely in and out of slices) and any stale
      // zIndex — layering is fixed board-wide (slices < edges < elements).
      nodes.push({
        ...node,
        extent: undefined,
        zIndex: undefined,
        data: { label, content, wireframe, contexts: nodeContexts, gwt },
      });
    } else {
      throw new Error(`Node "${node.id}" has unknown type "${node.type}".`);
    }
  }

  const nodeKindById = new Map(nodes.map((n) => [n.id, n.type]));
  const nodeIds = new Set(nodeKindById.keys());

  // Reconcile each scenario reference with what survived the import:
  //  - a live target must be a referenceable kind (command/event/read model);
  //    a reference to a surviving screen/processor is dropped, matching what
  //    the editor allows, so the card and editor can't disagree.
  //  - a missing target is kept only if it carries a snapshot label, so the
  //    user still sees what was referenced (rendered as a deleted element).
  for (const node of nodes) {
    const gwt = node.type === 'gwt' ? node.data.gwt : undefined;
    if (!gwt) continue;
    const keep = (items: GwtItem[]) =>
      items.filter((item) => {
        if (item.kind !== 'ref') return true;
        const liveKind = nodeKindById.get(item.ref);
        if (liveKind !== undefined) return GWT_REF_KINDS.includes(liveKind as CqrsKind);
        return Boolean(item.label);
      });
    node.data.gwt = buildGwtSections((key) => keep(gwt[key]));
  }

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

  return { nodes: ordered, edges, viewport, contexts };
}
