import { memo, useEffect, useRef, useState } from 'react';
import { useReactFlow, type NodeProps } from '@xyflow/react';
import { GripHorizontal, Plus, X } from 'lucide-react';
import type { BoardNode } from '../types';
import { CELL_HEIGHT, CELL_WIDTH, DEFAULT_COLUMNS, DEFAULT_LANES, LANE_GUTTER } from '../types';
import { sliceHeight, sliceWidth } from '../lib/grid';
import { useDialog } from '../components/Dialog';
import { useDropHighlight } from '../components/DropHighlightContext';

/**
 * A "slice" rendered as a grid table: swimlane rows (Actor, Interaction,
 * Events, Spec Lane by default) crossed with N columns. Each cell holds at
 * most one CQRS element — snapping and occupancy are enforced by the board's
 * drag/drop handlers; this component renders the grid and the controls to
 * append columns and lanes.
 *
 * Only the header bar drags the slice (dragHandle: '.slice-drag-handle'),
 * and the node's width/height are always derived from the grid dimensions.
 */
function SliceNode({ id, data, selected }: NodeProps<BoardNode>) {
  const { updateNode, updateNodeData, deleteElements } = useReactFlow();
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const lanes = data.lanes ?? DEFAULT_LANES;
  const columns = data.columns ?? DEFAULT_COLUMNS;

  const highlight = useDropHighlight();
  const hoveredCell = highlight?.sliceId === id ? highlight : null;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const label = draft.trim();
    updateNodeData(id, { label: label.length > 0 ? label : 'Slice' });
    setEditing(false);
  };

  const addColumn = () => {
    updateNode(id, (node) => ({
      data: { ...node.data, columns: columns + 1 },
      width: sliceWidth(columns + 1),
    }));
  };

  const addLane = () => {
    updateNode(id, (node) => ({
      data: { ...node.data, lanes: [...lanes, `Lane ${lanes.length + 1}`] },
      height: sliceHeight(lanes.length + 1),
    }));
  };

  const renameLane = async (index: number) => {
    const name = await dialog.prompt({
      title: 'Rename swimlane',
      defaultValue: lanes[index],
      placeholder: 'Lane name',
      confirmLabel: 'Rename',
    });
    if (name && name.trim().length > 0) {
      updateNodeData(id, { lanes: lanes.map((lane, i) => (i === index ? name.trim() : lane)) });
    }
  };

  return (
    <div
      className={`group relative h-full w-full rounded-xl border-2 border-dashed bg-slate-800/40 transition-colors ${
        selected ? 'border-indigo-400' : 'border-slate-600 hover:border-slate-500'
      }`}
    >
      {/* Title bar — the only drag surface for the slice */}
      <div className="slice-drag-handle flex h-11 cursor-grab items-center gap-2 rounded-t-[10px] border-b border-slate-600/60 bg-slate-700/70 px-3 active:cursor-grabbing">
        <GripHorizontal size={14} className="shrink-0 text-slate-400" />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            className="nodrag w-full rounded bg-slate-900/70 px-1.5 py-0.5 text-sm font-semibold text-slate-100 outline-none"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className="truncate text-sm font-semibold text-slate-200"
            title="Double-click to rename"
            onDoubleClick={(event) => {
              event.stopPropagation();
              setDraft(data.label);
              setEditing(true);
            }}
          >
            {data.label}
          </span>
        )}
        <button
          type="button"
          title="Delete slice (and its contents)"
          aria-label="Delete slice"
          className={`nodrag ml-auto rounded p-1 text-slate-400 transition-opacity hover:bg-slate-600 hover:text-red-300 ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(event) => {
            event.stopPropagation();
            void deleteElements({ nodes: [{ id }] });
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Swimlane rows with the label gutter on the left */}
      <div className="relative" style={{ height: lanes.length * CELL_HEIGHT }}>
        {lanes.map((lane, index) => (
          <div
            key={index}
            className={`absolute inset-x-0 ${index > 0 ? 'border-t border-slate-600/40' : ''}`}
            style={{ top: index * CELL_HEIGHT, height: CELL_HEIGHT }}
          >
            <div
              className="flex h-full items-center justify-center border-r border-slate-600/50 bg-slate-800/60"
              style={{ width: LANE_GUTTER }}
              title="Double-click to rename lane"
              onDoubleClick={(event) => {
                event.stopPropagation();
                void renameLane(index);
              }}
            >
              <span
                className="max-h-full overflow-hidden rotate-180 text-[10px] font-semibold tracking-wider whitespace-nowrap text-slate-500 uppercase select-none"
                style={{ writingMode: 'vertical-rl' }}
              >
                {lane}
              </span>
            </div>
          </div>
        ))}

        {/* Drop-target highlight: shows where a dragged element will land */}
        {hoveredCell && (
          <div
            className={`pointer-events-none absolute z-10 rounded-md border-2 transition-colors ${
              hoveredCell.valid ? 'border-indigo-400 bg-indigo-400/15' : 'border-red-400/80 bg-red-400/10'
            }`}
            style={{
              left: LANE_GUTTER + hoveredCell.col * CELL_WIDTH + 3,
              top: hoveredCell.row * CELL_HEIGHT + 3,
              width: CELL_WIDTH - 6,
              height: CELL_HEIGHT - 6,
            }}
          />
        )}

        {/* Column separators */}
        {Array.from({ length: columns - 1 }, (_, index) => (
          <div
            key={index}
            className="pointer-events-none absolute inset-y-0 w-px bg-slate-600/30"
            style={{ left: LANE_GUTTER + (index + 1) * CELL_WIDTH }}
          />
        ))}
      </div>

      {/* Grid growth controls */}
      <button
        type="button"
        title="Add column"
        aria-label="Add column"
        className="nodrag absolute top-1/2 -right-3.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-300 shadow-md transition-colors hover:border-indigo-400 hover:bg-indigo-500 hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          addColumn();
        }}
      >
        <Plus size={15} />
      </button>
      <button
        type="button"
        title="Add swimlane"
        aria-label="Add swimlane"
        className="nodrag absolute -bottom-3.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-300 shadow-md transition-colors hover:border-indigo-400 hover:bg-indigo-500 hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          addLane();
        }}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export default memo(SliceNode);
