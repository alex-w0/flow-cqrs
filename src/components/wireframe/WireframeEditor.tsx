import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Heading,
  Image as ImageIcon,
  MousePointer2,
  Pencil,
  RectangleHorizontal,
  Save,
  Square,
  SquareCheck,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { BoardEdge, BoardNode, WireframeElement, WireframeElementKind, WireframeStroke } from '../../types';
import { WIREFRAME_HEIGHT, WIREFRAME_WIDTH } from '../../types';
import { clamp } from '../../lib/grid';
import { nextId } from '../../lib/id';
import { useDialog } from '../Dialog';
import { ElementShape, StrokeShape } from './shapes';

type Tool = 'select' | 'draw';

type Interaction = { kind: 'draw' } | { kind: 'move'; id: string; dx: number; dy: number } | { kind: 'resize'; id: string };

interface MockupSpec {
  kind: WireframeElementKind;
  label: string;
  icon: LucideIcon;
  w: number;
  h: number;
  text?: string;
}

const MOCKUPS: MockupSpec[] = [
  { kind: 'button', label: 'Button', icon: RectangleHorizontal, w: 90, h: 28, text: 'Button' },
  { kind: 'text', label: 'Text', icon: Type, w: 100, h: 14, text: 'Text' },
  { kind: 'input', label: 'Input', icon: TextCursorInput, w: 130, h: 28, text: 'Input…' },
  { kind: 'image', label: 'Image', icon: ImageIcon, w: 100, h: 70 },
  { kind: 'checkbox', label: 'Checkbox', icon: SquareCheck, w: 90, h: 16, text: 'Option' },
  { kind: 'heading', label: 'Heading', icon: Heading, w: 140, h: 20, text: 'Heading' },
  { kind: 'rect', label: 'Card / Box', icon: Square, w: 140, h: 90 },
];

/** Kinds that can be resized via the corner handle (text-like kinds auto-size). */
const RESIZABLE = new Set<WireframeElementKind>(['button', 'input', 'image', 'rect']);
/** Kinds whose text can be edited (inline on double-click, or via the properties bar). */
const TEXT_EDITABLE = new Set<WireframeElementKind>(['button', 'input', 'checkbox', 'heading', 'text']);

/** Inline-edit input typography per kind, matching the rendered SVG text. */
const INLINE_FONT: Partial<Record<WireframeElementKind, CSSProperties>> = {
  button: { fontSize: 11, fontWeight: 600, textAlign: 'center' },
  input: { fontSize: 10 },
  checkbox: { fontSize: 10 },
  heading: { fontSize: 14, fontWeight: 700 },
  text: { fontSize: 10 },
};

const MIN_W = 24;
const MIN_H = 14;

interface WireframeEditorProps {
  nodeId: string;
  onClose: () => void;
}

/**
 * Modal editor for a Screen/UI node's wireframe. Three tools: select/move
 * (with corner resize for box shapes), freehand drawing, and click-to-place
 * text. Mockup primitives are added from the left palette. Saving writes the
 * wireframe into the node's data, where it serializes with the board JSON.
 */
export default function WireframeEditor({ nodeId, onClose }: WireframeEditorProps) {
  const { getNode, updateNodeData } = useReactFlow<BoardNode, BoardEdge>();
  const dialog = useDialog();

  const [label] = useState(() => getNode(nodeId)?.data.label ?? 'Screen');
  const [elements, setElements] = useState<WireframeElement[]>(
    () => getNode(nodeId)?.data.wireframe?.elements.map((el) => ({ ...el })) ?? [],
  );
  const [strokes, setStrokes] = useState<WireframeStroke[]>(
    () => getNode(nodeId)?.data.wireframe?.strokes.map((s) => ({ ...s, points: [...s.points] })) ?? [],
  );
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [liveStroke, setLiveStroke] = useState<number[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const interaction = useRef<Interaction | null>(null);
  const addCount = useRef(0);
  /** Manual double-click detection: pointer capture retargets the native dblclick. */
  const lastClick = useRef<{ id: string; time: number } | null>(null);

  // Keep Backspace/Escape away from React Flow (which would delete the
  // selected board node behind the modal). Skip while a prompt/confirm dialog
  // is open on top (identified by its aria-labelledby, since this editor is
  // itself a role="dialog").
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-labelledby="dialog-title"]')) return;
      // Never hijack keys while typing (e.g. in the element-text field):
      // Backspace must edit text, not delete the element.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.stopPropagation();
        setSelectedId((current) => {
          if (current) setElements((els) => els.filter((el) => el.id !== current));
          return null;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose]);

  const toPoint = (event: ReactPointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * WIREFRAME_WIDTH, 0, WIREFRAME_WIDTH),
      y: clamp(((event.clientY - rect.top) / rect.height) * WIREFRAME_HEIGHT, 0, WIREFRAME_HEIGHT),
    };
  };

  /** Closes the inline editor; texts left empty are discarded. */
  const finishInlineEdit = () => {
    if (!editingId) return;
    setElements((els) =>
      els.filter((el) => !(el.id === editingId && el.kind === 'text' && (el.text ?? '').trim().length === 0)),
    );
    setEditingId(null);
  };

  // Focus and select the inline input whenever an edit session starts.
  useEffect(() => {
    if (editingId) {
      inlineInputRef.current?.focus();
      inlineInputRef.current?.select();
    }
  }, [editingId]);

  const addMockup = (spec: MockupSpec) => {
    const offset = (addCount.current++ % 5) * 14;
    const el: WireframeElement = {
      id: nextId('wf'),
      kind: spec.kind,
      x: clamp(24 + offset, 0, WIREFRAME_WIDTH - spec.w),
      y: clamp(24 + offset, 0, WIREFRAME_HEIGHT - spec.h),
      w: spec.w,
      h: spec.h,
      text: spec.text,
    };
    setElements((els) => [...els, el]);
    setSelectedId(el.id);
    setTool('select');
    // Plain text exists only for its content — start typing right away.
    if (spec.kind === 'text') setEditingId(el.id);
  };

  // --- Canvas interactions ----------------------------------------------------

  const onElementPointerDown = (event: ReactPointerEvent, el: WireframeElement) => {
    if (tool !== 'select') return;
    event.stopPropagation();

    const now = Date.now();
    if (lastClick.current && lastClick.current.id === el.id && now - lastClick.current.time < 350) {
      lastClick.current = null;
      interaction.current = null;
      if (TEXT_EDITABLE.has(el.kind)) {
        // The inline input is focused during this event's dispatch; prevent the
        // pointerdown's default focus action from stealing it back afterwards.
        event.preventDefault();
        setSelectedId(el.id);
        setEditingId(el.id);
      }
      return;
    }
    lastClick.current = { id: el.id, time: now };

    const point = toPoint(event);
    setSelectedId(el.id);
    interaction.current = { kind: 'move', id: el.id, dx: point.x - el.x, dy: point.y - el.y };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onResizePointerDown = (event: ReactPointerEvent, el: WireframeElement) => {
    event.stopPropagation();
    interaction.current = { kind: 'resize', id: el.id };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerDown = (event: ReactPointerEvent) => {
    const point = toPoint(event);
    if (tool === 'draw') {
      interaction.current = { kind: 'draw' };
      setLiveStroke([point.x, point.y]);
      svgRef.current?.setPointerCapture(event.pointerId);
    } else {
      setSelectedId(null);
    }
  };

  const onCanvasPointerMove = (event: ReactPointerEvent) => {
    const act = interaction.current;
    if (!act) return;
    const point = toPoint(event);

    if (act.kind === 'draw') {
      setLiveStroke((prev) => {
        if (!prev) return prev;
        const lastX = prev[prev.length - 2];
        const lastY = prev[prev.length - 1];
        if (Math.hypot(point.x - lastX, point.y - lastY) < 2) return prev;
        return [...prev, point.x, point.y];
      });
    } else if (act.kind === 'move') {
      setElements((els) =>
        els.map((el) =>
          el.id === act.id
            ? {
                ...el,
                x: clamp(point.x - act.dx, 0, WIREFRAME_WIDTH - el.w),
                y: clamp(point.y - act.dy, 0, WIREFRAME_HEIGHT - el.h),
              }
            : el,
        ),
      );
    } else {
      setElements((els) =>
        els.map((el) =>
          el.id === act.id
            ? {
                ...el,
                w: clamp(point.x - el.x, MIN_W, WIREFRAME_WIDTH - el.x),
                h: clamp(point.y - el.y, MIN_H, WIREFRAME_HEIGHT - el.y),
              }
            : el,
        ),
      );
    }
  };

  const onCanvasPointerUp = () => {
    const act = interaction.current;
    interaction.current = null;
    if (act?.kind === 'draw') {
      if (liveStroke && liveStroke.length >= 4) {
        setStrokes((all) => [...all, { id: nextId('stroke'), points: liveStroke }]);
      }
      setLiveStroke(null);
    }
  };

  // --- Save / clear -------------------------------------------------------------

  const onSave = () => {
    const empty = elements.length === 0 && strokes.length === 0;
    updateNodeData(nodeId, {
      wireframe: empty ? undefined : { width: WIREFRAME_WIDTH, height: WIREFRAME_HEIGHT, elements, strokes },
    });
    onClose();
  };

  const onClearCanvas = async () => {
    const confirmed = await dialog.confirm({
      title: 'Clear the wireframe?',
      message: 'All mockup elements, drawings, and texts on this canvas will be removed.',
      confirmLabel: 'Clear',
      danger: true,
    });
    if (confirmed) {
      setElements([]);
      setStrokes([]);
      setSelectedId(null);
    }
  };

  const selected = elements.find((el) => el.id === selectedId);
  const editing = elements.find((el) => el.id === editingId);
  const toolButton = (value: Tool, icon: LucideIcon, title: string) => {
    const Icon = icon;
    return (
      <button
        type="button"
        title={title}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
          tool === value ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
        onClick={() => setTool(value)}
      >
        <Icon size={14} />
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="dialog-backdrop absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Wireframe editor"
        className="dialog-panel relative flex max-h-full flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-700/70 px-4 py-3">
          <span className="text-sm font-semibold text-slate-100">Design screen</span>
          <span className="truncate text-sm text-slate-400">— {label}</span>
          <button
            type="button"
            title="Close without saving"
            aria-label="Close without saving"
            className="ml-auto rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 gap-3 p-4">
          {/* Left sidebar: tools + mockup palette */}
          <div className="flex w-40 shrink-0 flex-col gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Tools</p>
              <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-1">
                {toolButton('select', MousePointer2, 'Select / move')}
                {toolButton('draw', Pencil, 'Draw by hand')}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <p className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Mockups</p>
              <ul className="space-y-1">
                {MOCKUPS.map((spec) => {
                  const Icon = spec.icon;
                  return (
                    <li key={spec.kind}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-left text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700"
                        onClick={() => addMockup(spec)}
                      >
                        <Icon size={13} className="shrink-0 text-slate-400" />
                        {spec.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="space-y-1 border-t border-slate-700/70 pt-2">
              <button
                type="button"
                disabled={strokes.length === 0}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors enabled:hover:bg-slate-800 enabled:hover:text-white disabled:opacity-40"
                onClick={() => setStrokes((all) => all.slice(0, -1))}
              >
                <Undo2 size={13} />
                Undo last stroke
              </button>
              <button
                type="button"
                disabled={elements.length === 0 && strokes.length === 0}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors enabled:hover:bg-red-500/15 enabled:hover:text-red-300 disabled:opacity-40"
                onClick={() => void onClearCanvas()}
              >
                <Trash2 size={13} />
                Clear canvas
              </button>
            </div>
          </div>

          {/* Canvas + properties bar */}
          <div className="flex flex-col gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5">
              {selected && TEXT_EDITABLE.has(selected.kind) ? (
                <>
                  <Type size={13} className="shrink-0 text-slate-400" />
                  <input
                    value={selected.text ?? ''}
                    placeholder="Element text…"
                    aria-label="Element text"
                    className="w-full bg-transparent text-xs font-medium text-slate-100 outline-none placeholder:text-slate-500"
                    onChange={(event) =>
                      setElements((els) =>
                        els.map((el) => (el.id === selected.id ? { ...el, text: event.target.value } : el)),
                      )
                    }
                  />
                </>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {selected
                    ? 'This element has no text.'
                    : 'Select a button, input, checkbox, heading, or text to edit its label here.'}
                </p>
              )}
            </div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WIREFRAME_WIDTH} ${WIREFRAME_HEIGHT}`}
            className="touch-none rounded-lg border border-slate-600 bg-white select-none"
            style={{
              width: 640,
              cursor: tool === 'draw' ? 'crosshair' : 'default',
            }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
          >
            <rect width={WIREFRAME_WIDTH} height={WIREFRAME_HEIGHT} fill="#ffffff" />
            {elements.map((el) => (
              <g
                key={el.id}
                style={{ cursor: tool === 'select' ? 'move' : undefined }}
                onPointerDown={(event) => onElementPointerDown(event, el)}
              >
                <ElementShape el={el} />
                {/* transparent hit area so thin shapes are easy to grab */}
                <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" />
                {selectedId === el.id && (
                  <rect
                    x={el.x - 2.5}
                    y={el.y - 2.5}
                    width={el.w + 5}
                    height={el.h + 5}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                )}
              </g>
            ))}
            {strokes.map((stroke) => (
              <StrokeShape key={stroke.id} stroke={stroke} />
            ))}
            {liveStroke && liveStroke.length >= 4 && <StrokeShape stroke={{ id: 'live', points: liveStroke }} />}
            {selected && RESIZABLE.has(selected.kind) && (
              <rect
                x={selected.x + selected.w - 4}
                y={selected.y + selected.h - 4}
                width={8}
                height={8}
                fill="#6366f1"
                stroke="#ffffff"
                strokeWidth={1}
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(event) => onResizePointerDown(event, selected)}
              />
            )}
            {editing && (
              <foreignObject
                x={editing.x - 2}
                y={editing.y - 2}
                width={Math.max(editing.w + 4, 90)}
                height={Math.max(editing.h + 4, 18)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <input
                  ref={inlineInputRef}
                  value={editing.text ?? ''}
                  placeholder="Text…"
                  aria-label="Edit element text inline"
                  className="h-full w-full rounded-sm border border-indigo-500 bg-white px-1 text-slate-900 outline-none"
                  style={INLINE_FONT[editing.kind]}
                  onChange={(event) =>
                    setElements((els) =>
                      els.map((el) => (el.id === editing.id ? { ...el, text: event.target.value } : el)),
                    )
                  }
                  onBlur={finishInlineEdit}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter' || event.key === 'Escape') finishInlineEdit();
                  }}
                />
              </foreignObject>
            )}
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-slate-700/70 px-4 py-3">
          <p className="text-[11px] text-slate-500">
            Double-click an element to edit its text in place · Backspace deletes the selection
          </p>
          <button
            type="button"
            className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            onClick={onSave}
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
