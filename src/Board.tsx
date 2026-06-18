import { useCallback, useEffect, useMemo, useRef, type ChangeEvent, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type DefaultEdgeOptions,
  type EdgeMarker,
  type OnNodeDrag,
  type OnNodesDelete,
  type XYPosition,
} from '@xyflow/react';
import Palette from './components/Palette';
import Toolbar from './components/Toolbar';
import { useBoardContexts } from './components/ContextsContext';
import { useDnD } from './components/DnDContext';
import { useDialog } from './components/Dialog';
import { useSetDropHighlight, type CellHighlight } from './components/DropHighlightContext';
import { TracedNodesProvider, useFlowTrace } from './components/FlowTraceContext';
import { HighlightDimProvider } from './components/HighlightDimContext';
import { nodeTypes } from './nodes';
import { DEFAULT_CONTEXT } from './lib/contexts';
import { downloadBoard, parseBoardFile } from './lib/serialization';
import { clearBoard, loadBoard, saveBoard } from './lib/persistence';
import { computeDimmedIds, computeDownstream } from './lib/highlight';
import { nextId } from './lib/id';
import {
  cellAt,
  cellOfRelativePosition,
  cellSlotPosition,
  findFreeCell,
  findSliceAt,
  isCellOccupied,
  sliceHeight,
  sliceWidth,
  type Cell,
} from './lib/grid';
import {
  DEFAULT_COLUMNS,
  DEFAULT_LANES,
  EDGE_NEUTRAL,
  ELEMENT_STYLES,
  NODE_HEIGHT,
  NODE_WIDTH,
  GWT_SECTIONS,
  SLICE_ACCENT,
  buildGwtSections,
  emptyGwt,
  isCqrsKind,
  type BoardEdge,
  type BoardNode,
  type CqrsKind,
  type PaletteKind,
} from './types';
import { initialEdges, initialNodes } from './initialBoard';

function edgeMarker(color: string): EdgeMarker {
  return { type: MarkerType.ArrowClosed, width: 16, height: 16, color };
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Returns a referentially-stable Set: the previous instance is kept whenever
 * the new one holds the same ids. Dragging a node rebuilds the `nodes` array
 * every frame, which makes the dimming/trace memos recompute equal-but-new
 * Sets each frame; without this, those new references would re-render every
 * card and edge on every drag tick (the providers and edge styling key off
 * them). Stabilizing identity lets a position-only change skip all that.
 */
function useStableIds(ids: ReadonlySet<string>): ReadonlySet<string> {
  const ref = useRef(ids);
  if (ref.current !== ids && !sameIds(ref.current, ids)) ref.current = ids;
  return ref.current;
}

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: edgeMarker(EDGE_NEUTRAL),
  style: { stroke: EDGE_NEUTRAL },
};

const MINIMAP_COLORS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ELEMENT_STYLES).map(([kind, s]) => [kind, s.accent])),
  slice: '#1e293b',
};

/** Keeps every slice before every element so parents always precede children. */
function slicesFirst(nodes: BoardNode[]): BoardNode[] {
  return [...nodes.filter((n) => n.type === 'slice'), ...nodes.filter((n) => n.type !== 'slice')];
}

export default function Board() {
  // Rehydrate the autosaved board (if any) before the flow state initializes,
  // so a refresh restores work with no flash of the empty board. Contexts are
  // restored separately, in ContextsProvider, from the same storage entry.
  const persisted = useMemo(loadBoard, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(persisted?.nodes ?? initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>(persisted?.edges ?? initialEdges);
  const { screenToFlowPosition, getNodes, getInternalNode, setViewport, toObject } = useReactFlow<
    BoardNode,
    BoardEdge
  >();
  const [dragKind, setDragKind] = useDnD();
  const { contexts, activeContexts, replaceContexts } = useBoardContexts();
  const setDropHighlight = useSetDropHighlight();
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clickAddCount = useRef(0);
  /** Positions at drag start, so a drop on an occupied cell can revert. */
  const dragOrigins = useRef(new Map<string, XYPosition>());

  // Flow trace (play button): the origin plus everything downstream pulses,
  // traced arrows animate, and the rest of the board is spotlight-dimmed.
  // Clears itself if the origin gets deleted.
  const { originId, stopTrace } = useFlowTrace();
  // Nodes dimmed by the active context highlighting (empty when none active).
  // A flow trace is constrained to these: it never revives or flows through a
  // node the active contexts have dimmed.
  const contextDimmedIds = useStableIds(
    useMemo(() => computeDimmedIds(nodes, edges, activeContexts), [nodes, edges, activeContexts]),
  );
  const tracedIds = useStableIds(
    useMemo(
      () => (originId !== null ? computeDownstream(edges, originId, contextDimmedIds) : new Set<string>()),
      [edges, originId, contextDimmedIds],
    ),
  );
  useEffect(() => {
    if (originId !== null && !nodes.some((node) => node.id === originId)) stopTrace();
  }, [originId, nodes, stopTrace]);

  // Autosave to localStorage on every board change so the work survives a
  // refresh. Debounced because node dragging fires changes continuously and
  // each save serializes the whole board. The viewport is snapshotted from
  // React Flow at save time so pan/zoom is restored too.
  useEffect(() => {
    const handle = setTimeout(() => {
      saveBoard({ nodes, edges, contexts, viewport: toObject().viewport });
    }, 300);
    return () => clearTimeout(handle);
  }, [nodes, edges, contexts, toObject]);

  // Dimming: an active flow trace spotlights its nodes — and since the trace
  // excludes context-dimmed nodes, those stay dimmed too; otherwise dim
  // inactive events plus every element whose flow is only reachable through
  // them. Arrows fade with dimmed endpoints. Selected edges swap to a white
  // arrowhead to match their white stroke (set in index.css) — CSS can't
  // recolor SVG marker definitions.
  const dimmedIds = useStableIds(
    useMemo(
      () =>
        originId !== null
          ? new Set(nodes.filter((node) => node.type !== 'slice' && !tracedIds.has(node.id)).map((node) => node.id))
          : contextDimmedIds,
      [originId, tracedIds, nodes, contextDimmedIds],
    ),
  );
  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const traced = originId !== null && tracedIds.has(edge.source) && tracedIds.has(edge.target);
        const dim = !traced && (dimmedIds.has(edge.source) || dimmedIds.has(edge.target));
        if (!traced && !dim && !edge.selected) return edge;
        return {
          ...edge,
          ...(traced ? { animated: true, className: 'trace-edge' } : {}),
          ...(dim ? { className: 'dimmed-edge' } : {}),
          ...(edge.selected ? { markerEnd: edgeMarker('#f8fafc') } : {}),
        };
      }),
    [edges, dimmedIds, tracedIds, originId],
  );

  /** The cell (if any) under a drag at `center`, flagged invalid when already occupied. */
  const highlightAt = useCallback(
    (center: XYPosition, excludeIds: Set<string>): CellHighlight | null => {
      const all = getNodes();
      const slice = findSliceAt(all, center.x, center.y);
      if (!slice) return null;
      const cell = cellAt(slice, center.x, center.y);
      return {
        sliceId: slice.id,
        col: cell.col,
        row: cell.row,
        valid: !isCellOccupied(all, slice.id, cell, excludeIds),
      };
    },
    [getNodes],
  );

  /** Edges inherit the accent color of their source element for readable flows. */
  const accentOf = useCallback(
    (sourceId: string | null): string => {
      const source = getNodes().find((node) => node.id === sourceId);
      return source && isCqrsKind(source.type) ? ELEMENT_STYLES[source.type].accent : EDGE_NEUTRAL;
    },
    [getNodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const accent = accentOf(connection.source);
      setEdges((eds) =>
        addEdge({ ...connection, style: { stroke: accent }, markerEnd: edgeMarker(accent) }, eds),
      );
    },
    [accentOf, setEdges],
  );

  /** Dragging an existing edge endpoint onto another node re-points the arrow. */
  const onReconnect = useCallback(
    (oldEdge: BoardEdge, connection: Connection) => {
      const accent = accentOf(connection.source);
      setEdges((eds) =>
        reconnectEdge({ ...oldEdge, style: { stroke: accent }, markerEnd: edgeMarker(accent) }, connection, eds),
      );
    },
    [accentOf, setEdges],
  );

  /** Adds a palette element centered on a flow-space point; on a slice it snaps into a free cell. */
  const addElement = useCallback(
    (kind: PaletteKind, center: XYPosition) => {
      if (kind === 'slice') {
        const slice: BoardNode = {
          id: nextId('slice'),
          type: 'slice',
          position: {
            x: center.x - sliceWidth(DEFAULT_COLUMNS) / 2,
            y: center.y - sliceHeight(DEFAULT_LANES.length) / 2,
          },
          width: sliceWidth(DEFAULT_COLUMNS),
          height: sliceHeight(DEFAULT_LANES.length),
          data: { label: 'New Slice', columns: DEFAULT_COLUMNS, lanes: [...DEFAULT_LANES] },
          dragHandle: '.slice-drag-handle',
          zIndex: -1,
        };
        // Prepend: a new slice has no children yet, and slices must stay before elements.
        setNodes((nds) => [slice, ...nds]);
        return;
      }

      const all = getNodes();
      const style = ELEMENT_STYLES[kind];
      const node: BoardNode = {
        id: nextId(kind),
        type: kind,
        position: { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 },
        data: {
          label: style.defaultLabel,
          // New events start in the default context — if it still exists on this board.
          ...(kind === 'event' && contexts.includes(DEFAULT_CONTEXT) ? { contexts: [DEFAULT_CONTEXT] } : {}),
          // New scenarios start with three empty sections ready to fill in.
          ...(kind === 'gwt' ? { gwt: emptyGwt() } : {}),
        },
      };

      const slice = findSliceAt(all, center.x, center.y);
      if (slice) {
        const cell = findFreeCell(all, slice, cellAt(slice, center.x, center.y), new Set());
        if (!cell) {
          void dialog.alert({
            title: 'Slice is full',
            message: 'Every cell in this slice is occupied. Add a column or swimlane first.',
          });
          return;
        }
        node.parentId = slice.id;
        node.position = cellSlotPosition(cell);
      }
      setNodes((nds) => [...nds, node]);
    },
    [getNodes, setNodes, dialog, contexts],
  );

  // --- Palette interactions ---------------------------------------------------

  const onPaletteAdd = useCallback(
    (kind: PaletteKind) => {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      // Cascade repeated click-adds so cards don't stack invisibly.
      const offset = (clickAddCount.current++ % 6) * 28;
      addElement(kind, { x: center.x + offset, y: center.y + offset });
    },
    [screenToFlowPosition, addElement],
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragKind && dragKind !== 'slice') {
        const center = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        setDropHighlight(highlightAt(center, new Set()));
      }
    },
    [dragKind, screenToFlowPosition, setDropHighlight, highlightAt],
  );

  const onDragLeave = useCallback(() => {
    setDropHighlight(null);
  }, [setDropHighlight]);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropHighlight(null);
      if (!dragKind) return;
      const center = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addElement(dragKind, center);
      setDragKind(null);
    },
    [dragKind, screenToFlowPosition, addElement, setDragKind, setDropHighlight],
  );

  // --- Slice membership: snap dragged elements into grid cells -----------------

  const onNodeDragStart = useCallback<OnNodeDrag<BoardNode>>((_event, _node, draggedNodes) => {
    dragOrigins.current = new Map(draggedNodes.map((node) => [node.id, { ...node.position }]));
  }, []);

  const onNodeDrag = useCallback<OnNodeDrag<BoardNode>>(
    (_event, node, draggedNodes) => {
      if (node.type === 'slice') return;
      const internal = getInternalNode(node.id);
      if (!internal) return;
      const absolute = internal.internals.positionAbsolute;
      const width = node.measured?.width ?? NODE_WIDTH;
      const height = node.measured?.height ?? NODE_HEIGHT;
      setDropHighlight(
        highlightAt(
          { x: absolute.x + width / 2, y: absolute.y + height / 2 },
          new Set(draggedNodes.map((dragged) => dragged.id)),
        ),
      );
    },
    [getInternalNode, setDropHighlight, highlightAt],
  );

  const onNodeDragStop = useCallback<OnNodeDrag<BoardNode>>(
    (_event, _node, draggedNodes) => {
      setDropHighlight(null);
      const all = getNodes();
      const draggedIds = new Set(draggedNodes.map((node) => node.id));
      /** Cells claimed by this drop, so two multi-selected nodes can't share one. */
      const claimed = new Set<string>();
      const updates = new Map<string, { parentId: string | undefined; position: XYPosition }>();

      for (const dragged of draggedNodes) {
        if (dragged.type === 'slice') continue;
        const internal = getInternalNode(dragged.id);
        if (!internal) continue;
        const absolute = internal.internals.positionAbsolute;
        const width = dragged.measured?.width ?? NODE_WIDTH;
        const height = dragged.measured?.height ?? NODE_HEIGHT;
        const centerX = absolute.x + width / 2;
        const centerY = absolute.y + height / 2;

        const slice = findSliceAt(all, centerX, centerY);
        if (!slice) {
          // Dropped on open canvas: detach from any slice and keep the spot.
          if (dragged.parentId) {
            updates.set(dragged.id, { parentId: undefined, position: absolute });
          }
          continue;
        }

        const cell = cellAt(slice, centerX, centerY);
        const key = cellKeyOf(slice.id, cell);
        const taken = claimed.has(key) || isCellOccupied(all, slice.id, cell, draggedIds);
        const origin = dragOrigins.current.get(dragged.id);

        if (taken) {
          // Occupied cell: snap back to where the drag started.
          if (origin) {
            updates.set(dragged.id, { parentId: dragged.parentId, position: origin });
            if (dragged.parentId === slice.id) claimed.add(cellKeyOf(slice.id, cellOfRelativePosition(origin)));
          }
          continue;
        }

        claimed.add(key);
        const slot = cellSlotPosition(cell);
        if (dragged.parentId === slice.id && dragged.position.x === slot.x && dragged.position.y === slot.y) {
          continue; // already snapped to this cell
        }
        updates.set(dragged.id, { parentId: slice.id, position: slot });
      }

      if (updates.size === 0) return;

      setNodes((nds) =>
        slicesFirst(
          nds.map((node) => {
            const update = updates.get(node.id);
            if (!update) return node;
            return { ...node, parentId: update.parentId, extent: undefined, position: update.position };
          }),
        ),
      );
    },
    [getNodes, getInternalNode, setNodes, setDropHighlight],
  );

  // When a referenced element is deleted, stamp its current label/type into the
  // scenarios that point at it, so a dangling reference still shows what it was
  // rather than collapsing to an anonymous placeholder.
  const onNodesDelete = useCallback<OnNodesDelete<BoardNode>>(
    (deleted) => {
      const meta = new Map<string, { label: string; type: CqrsKind }>();
      for (const node of deleted) {
        if (isCqrsKind(node.type)) meta.set(node.id, { label: node.data.label, type: node.type });
      }
      if (meta.size === 0) return;
      setNodes((nds) =>
        nds.map((node) => {
          const gwt = node.type === 'gwt' ? node.data.gwt : undefined;
          if (!gwt) return node;
          const touches = GWT_SECTIONS.some(({ key }) =>
            gwt[key].some((item) => item.kind === 'ref' && meta.has(item.ref)),
          );
          if (!touches) return node;
          const stamped = buildGwtSections((key) =>
            gwt[key].map((item) => {
              const snapshot = item.kind === 'ref' ? meta.get(item.ref) : undefined;
              return snapshot ? { ...item, label: snapshot.label, type: snapshot.type } : item;
            }),
          );
          return { ...node, data: { ...node.data, gwt: stamped } };
        }),
      );
    },
    [setNodes],
  );

  // --- JSON import / export -----------------------------------------------------

  const onExport = useCallback(() => {
    downloadBoard(toObject(), contexts);
  }, [toObject, contexts]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImportFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // allow re-importing the same file
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const {
            nodes: importedNodes,
            edges: importedEdges,
            viewport,
            contexts: importedContexts,
          } = parseBoardFile(String(reader.result));
          // Drop the autosave first so a partially-applied import can't leave
          // stale data behind; the autosave effect re-persists the imported
          // board on the next change cycle.
          clearBoard();
          setNodes(importedNodes);
          setEdges(importedEdges);
          replaceContexts(importedContexts);
          if (viewport) void setViewport(viewport);
        } catch (error) {
          void dialog.alert({
            title: 'Import failed',
            message: error instanceof Error ? error.message : 'The file could not be parsed.',
          });
        }
      };
      reader.onerror = () =>
        void dialog.alert({ title: 'Import failed', message: 'The file could not be read.' });
      reader.readAsText(file);
    },
    [setNodes, setEdges, replaceContexts, setViewport, dialog],
  );

  const onClear = useCallback(async () => {
    const confirmed = await dialog.confirm({
      title: 'Clear the entire board?',
      message: 'Every element, slice, and connection will be removed. This cannot be undone.',
      confirmLabel: 'Clear Board',
      danger: true,
    });
    if (confirmed) {
      setNodes([]);
      setEdges([]);
      replaceContexts([DEFAULT_CONTEXT]);
    }
  }, [dialog, setNodes, setEdges, replaceContexts]);

  return (
    <HighlightDimProvider value={dimmedIds}>
      <TracedNodesProvider value={tracedIds}>
        <ReactFlow<BoardNode, BoardEdge>
          nodes={nodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={28}
          isValidConnection={(connection) => connection.source !== connection.target}
          deleteKeyCode={['Backspace', 'Delete']}
          // Figma/Miro-style canvas interaction: a left-drag starting on empty
          // canvas (never on a node) rubber-band selects everything it touches;
          // the selection can then be moved together or deleted. Panning moves
          // to the middle/right mouse button, scroll, or holding Space + drag.
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          panOnScroll
          panActivationKeyCode="Space"
          // Fixed layering: slices (-1) < edges (0) < element cards (0, painted
          // after edges). React Flow's automatic elevation would lift edges
          // touching selected or slice-contained nodes above other cards;
          // selection/hover elevation for cards is done in CSS instead.
          zIndexMode="manual"
          colorMode="dark"
          // Restore the saved viewport on a refresh; otherwise frame the board.
          fitView={!persisted?.viewport}
          defaultViewport={persisted?.viewport ?? undefined}
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15}
          maxZoom={2.5}
          className="bg-slate-950"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#293548" />
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            className="!bg-slate-900"
            maskColor="rgb(2 6 23 / 0.7)"
            nodeColor={(node) => MINIMAP_COLORS[node.type ?? ''] ?? SLICE_ACCENT}
            nodeStrokeColor={(node) => (isCqrsKind(node.type) ? 'transparent' : '#475569')}
          />
          <Panel position="top-left">
            <Palette onAdd={onPaletteAdd} />
          </Panel>
          <Panel position="top-center">
            <Toolbar onExport={onExport} onImport={onImportClick} onClear={onClear} />
          </Panel>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onImportFile}
          />
        </ReactFlow>
      </TracedNodesProvider>
    </HighlightDimProvider>
  );
}

function cellKeyOf(sliceId: string, cell: Cell): string {
  return `${sliceId}:${cell.col}:${cell.row}`;
}
