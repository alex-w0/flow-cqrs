import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { LayoutTemplate, Pencil, Play, Square, X } from 'lucide-react';
import type { BoardNode } from '../types';
import { ELEMENT_STYLES, SLOTTED_NODE_HEIGHT, emptyGwt, isCqrsKind } from '../types';
import GwtNodeBody from './GwtNodeBody';
import WireframePreview from '../components/wireframe/WireframePreview';
import { contextTagClass, contextsOf } from '../lib/contexts';
import { useBoardContexts } from '../components/ContextsContext';
import { useFlowTrace, useTracedNodes } from '../components/FlowTraceContext';
import { useDimmedNodes } from '../components/HighlightDimContext';
import { useOpenElementEditor } from '../components/ElementEditorContext';
import { useOpenWireframeEditor } from '../components/wireframe/WireframeEditorContext';

const HANDLES: { id: string; position: Position }[] = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
];

/**
 * Shared sticky-note card for all five CQRS element kinds. The kind is read
 * from `type`, so one component backs five registered node types.
 *
 * Connections: four handles (top/right/bottom/left). The board runs in
 * ConnectionMode.Loose, so every handle is registered as a source and can
 * both start and receive a connection.
 *
 * Sizing: free-floating cards grow with their content. Inside a slice the
 * node footprint is pinned to the cell height — handles, edges, and grid
 * logic always see the cell-sized box — while the visible card is an overlay
 * that clips its content and expands to full height on hover or selection.
 *
 * Double-click (or the pencil button) opens the element editor dialog for
 * the label and the optional content block (e.g. command/event attributes).
 */
function CqrsNode({ id, type, data, selected, parentId, dragging }: NodeProps<BoardNode>) {
  const { deleteElements } = useReactFlow();
  const { contexts: boardContexts } = useBoardContexts();
  const openElementEditor = useOpenElementEditor();
  const openWireframeEditor = useOpenWireframeEditor();

  const style = isCqrsKind(type) ? ELEMENT_STYLES[type] : ELEMENT_STYLES.command;
  const Icon = style.icon;
  const contentLines = (data.content ?? '').split('\n').filter((line) => line.trim().length > 0);

  // DCB contexts: events show their context tags (only meaningful once a
  // second context exists). Dimming is decided board-wide in lib/highlight.ts
  // — inactive events plus every element only reachable through them.
  const isEvent = type === 'event';
  const eventContexts = isEvent ? contextsOf(data) : [];
  const showTags = isEvent && boardContexts.length >= 2;
  const dimmed = useDimmedNodes().has(id);

  // Flow trace: every kind except read models can play a trace from itself;
  // any card inside the active trace pulses.
  const { originId, toggleTrace } = useFlowTrace();
  const isTraceOrigin = originId === id;
  const pulsing = useTracedNodes().has(id);

  // Inside a slice the footprint is pinned to the cell height; the card overlay
  // expands over the grid while hovered or selected (but not mid-drag, so the
  // dragged box always matches the cell it will snap into).
  const slotted = parentId !== undefined;
  const expanded = slotted && selected && !dragging;
  const expandOnHover = slotted && !selected && !dragging;

  // "+N more" hint when the cell clips content at rest. N counts fully or
  // partially hidden attribute lines; anything else overflowing (a long
  // label, a wireframe preview) shows a bare ellipsis. Measured against the
  // fixed card height using scrollHeight/offset* (layout px), which are
  // unaffected by canvas zoom and by the hover/selection expansion — so the
  // at-rest clipping is known even while the card is currently expanded.
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflowHint, setOverflowHint] = useState<string | null>(null);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const body = bodyRef.current;
    if (!slotted || !header || !body) {
      setOverflowHint(null);
      return;
    }
    // Space for the body inside the fixed card: cell-pinned height minus the
    // vertical borders (border-2 ⇒ 4px) and the header row.
    const available = SLOTTED_NODE_HEIGHT - 4 - header.offsetHeight;
    if (body.scrollHeight <= available + 1) {
      setOverflowHint(null);
      return;
    }
    // offsetTop is relative to the card for both the body and the lines.
    const hiddenLines = [...body.querySelectorAll('li')].filter(
      (line) => line.offsetTop + line.offsetHeight - body.offsetTop > available + 1,
    ).length;
    setOverflowHint(hiddenLines > 0 ? `+${hiddenLines} more…` : '…');
  }, [slotted, data.label, data.content, data.wireframe, data.contexts, data.gwt, boardContexts.length]);

  let cardSize = '';
  let bodyClip = '';
  if (slotted) {
    cardSize = expanded
      ? 'h-auto min-h-full'
      : expandOnHover
        ? 'h-full group-hover:h-auto group-hover:min-h-full'
        : 'h-full';
    bodyClip = expanded
      ? 'min-h-0 flex-1'
      : expandOnHover
        ? 'min-h-0 flex-1 overflow-hidden group-hover:overflow-visible'
        : 'min-h-0 flex-1 overflow-hidden';
  }

  return (
    <div
      className={`group relative w-44 transition-opacity ${dimmed ? 'opacity-25' : ''}`}
      style={slotted ? { height: SLOTTED_NODE_HEIGHT } : undefined}
      onDoubleClick={(event) => {
        event.stopPropagation();
        openElementEditor(id);
      }}
    >
      <div
        className={`relative flex w-full flex-col rounded-lg border-2 shadow-lg shadow-black/40 transition-shadow ${style.card} ${
          selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950' : ''
        } ${slotted ? `absolute inset-x-0 top-0 ${cardSize}` : ''} ${pulsing ? 'flow-trace-pulse' : ''}`}
      >
        <div
          ref={headerRef}
          className="flex items-center gap-1.5 px-2.5 pt-2 text-[10px] font-bold uppercase tracking-wider opacity-70"
        >
          <Icon size={12} className="shrink-0" />
          <span>{style.title}</span>
          <span
            className={`ml-auto flex items-center gap-0.5 transition-opacity ${
              selected || isTraceOrigin ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {type !== 'readmodel' && type !== 'gwt' && (
              <button
                type="button"
                title={isTraceOrigin ? 'Stop data flow' : 'Play data flow'}
                aria-label={isTraceOrigin ? 'Stop data flow' : 'Play data flow'}
                className="nodrag rounded p-0.5 hover:bg-black/20"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleTrace(id);
                }}
              >
                {isTraceOrigin ? <Square size={12} /> : <Play size={12} />}
              </button>
            )}
            <button
              type="button"
              title="Edit element"
              aria-label="Edit element"
              className="nodrag rounded p-0.5 hover:bg-black/20"
              onClick={(event) => {
                event.stopPropagation();
                openElementEditor(id);
              }}
            >
              <Pencil size={12} />
            </button>
            {type === 'screen' && (
              <button
                type="button"
                title="Design screen UI"
                aria-label="Design screen UI"
                className="nodrag rounded p-0.5 hover:bg-black/20"
                onClick={(event) => {
                  event.stopPropagation();
                  openWireframeEditor(id);
                }}
              >
                <LayoutTemplate size={12} />
              </button>
            )}
            <button
              type="button"
              title="Delete element"
              aria-label="Delete element"
              className="nodrag rounded p-0.5 hover:bg-black/20"
              onClick={(event) => {
                event.stopPropagation();
                void deleteElements({ nodes: [{ id }] });
              }}
            >
              <X size={12} />
            </button>
          </span>
        </div>

        <div ref={bodyRef} className={`px-2.5 pt-1 pb-2.5 ${bodyClip}`} title="Double-click to edit">
          <span className="block min-h-5 text-sm leading-snug font-semibold break-words">{data.label}</span>
          {type === 'gwt' ? (
            <GwtNodeBody gwt={data.gwt ?? emptyGwt()} />
          ) : (
            <>
              {showTags && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {eventContexts.map((name) => (
                    <span
                      key={name}
                      className={`rounded-full border px-1.5 py-px text-[9px] leading-tight font-semibold ${contextTagClass(name)}`}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {type === 'screen' && data.wireframe && (
                <div className="mt-1.5 overflow-hidden rounded-md border border-zinc-300 bg-white shadow-sm">
                  <WireframePreview wireframe={data.wireframe} className="block h-16 w-full" />
                </div>
              )}
              {contentLines.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 border-t border-black/15 pt-1.5 font-mono text-[10px] leading-tight opacity-80">
                  {contentLines.map((line, index) => (
                    <li key={index} className="break-words">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {overflowHint && !expanded && (
          <span
            className={`absolute right-1.5 bottom-1 rounded bg-black/25 px-1.5 py-px text-[9px] font-semibold ${
              expandOnHover ? 'group-hover:hidden' : ''
            }`}
          >
            {overflowHint}
          </span>
        )}
      </div>

      {/* GWT scenarios document slices by referencing elements, not by data
          flow, so they carry no connection handles — that keeps them out of
          the edge graph and therefore out of flow traces and context dimming. */}
      {type !== 'gwt' &&
        HANDLES.map(({ id: handleId, position }) => (
          <Handle
            key={handleId}
            id={handleId}
            type="source"
            position={position}
            style={{ background: style.accent }}
          />
        ))}
    </div>
  );
}

export default memo(CqrsNode);
