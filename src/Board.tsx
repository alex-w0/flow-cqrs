import { useCallback, useRef, type ChangeEvent, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type DefaultEdgeOptions,
  type EdgeMarker,
  type OnNodeDrag,
  type XYPosition,
} from '@xyflow/react';
import Palette from './components/Palette';
import Toolbar from './components/Toolbar';
import { useBoardContexts } from './components/ContextsContext';
import { useDnD } from './components/DnDContext';
import { useDialog } from './components/Dialog';
import { useSetDropHighlight, type CellHighlight } from './components/DropHighlightContext';
import { nodeTypes } from './nodes';
import { downloadBoard, parseBoardFile } from './lib/serialization';
import { DEFAULT_CONTEXT } from './lib/contexts';
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
  SLICE_ACCENT,
  isCqrsKind,
  type BoardEdge,
  type BoardNode,
  type PaletteKind,
} from './types';
import { initialEdges, initialNodes } from './initialBoard';

function edgeMarker(color: string): EdgeMarker {
  return { type: MarkerType.ArrowClosed, width: 16, height: 16, color };
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
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>(initialEdges);
  const { screenToFlowPosition, getNodes, getInternalNode, setViewport, toObject } = useReactFlow<
    BoardNode,
    BoardEdge
  >();
  const [dragKind, setDragKind] = useDnD();
  const { contexts, replaceContexts } = useBoardContexts();
  const setDropHighlight = useSetDropHighlight();
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clickAddCount = useRef(0);
  /** Positions at drag start, so a drop on an occupied cell can revert. */
  const dragOrigins = useRef(new Map<string, XYPosition>());

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
    <ReactFlow<BoardNode, BoardEdge>
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onReconnect={onReconnect}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
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
      colorMode="dark"
      fitView
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
  );
}

function cellKeyOf(sliceId: string, cell: Cell): string {
  return `${sliceId}:${cell.col}:${cell.row}`;
}
