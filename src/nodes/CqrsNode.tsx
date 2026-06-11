import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Check, LayoutTemplate, X } from 'lucide-react';
import type { BoardNode } from '../types';
import { ELEMENT_STYLES, isCqrsKind } from '../types';
import WireframePreview from '../components/wireframe/WireframePreview';
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
 * Double-click opens an edit panel for the label and the optional content
 * block (e.g. command/event attributes, one per line).
 */
function CqrsNode({ id, type, data, selected }: NodeProps<BoardNode>) {
  const { updateNodeData, deleteElements } = useReactFlow();
  const openWireframeEditor = useOpenWireframeEditor();
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(data.label);
  const [draftContent, setDraftContent] = useState(data.content ?? '');
  const labelRef = useRef<HTMLInputElement>(null);

  const style = isCqrsKind(type) ? ELEMENT_STYLES[type] : ELEMENT_STYLES.command;
  const Icon = style.icon;
  const contentLines = (data.content ?? '').split('\n').filter((line) => line.trim().length > 0);

  useEffect(() => {
    if (editing) {
      labelRef.current?.focus();
      labelRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraftLabel(data.label);
    setDraftContent(data.content ?? '');
    setEditing(true);
  };

  const commit = () => {
    const label = draftLabel.trim();
    const content = draftContent.trim();
    updateNodeData(id, {
      label: label.length > 0 ? label : style.defaultLabel,
      content: content.length > 0 ? content : undefined,
    });
    setEditing(false);
  };

  return (
    <div
      className={`group relative w-44 rounded-lg border-2 shadow-lg shadow-black/40 transition-shadow ${style.card} ${
        selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950' : ''
      }`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!editing) startEditing();
      }}
    >
      {HANDLES.map(({ id: handleId, position }) => (
        <Handle
          key={handleId}
          id={handleId}
          type="source"
          position={position}
          style={{ background: style.accent }}
        />
      ))}

      <div className="flex items-center gap-1.5 px-2.5 pt-2 text-[10px] font-bold uppercase tracking-wider opacity-70">
        <Icon size={12} className="shrink-0" />
        <span>{style.title}</span>
        <span
          className={`ml-auto flex items-center gap-0.5 transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
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

      {editing ? (
        <div
          className="nodrag flex flex-col gap-1.5 px-2.5 pt-1 pb-2.5"
          onBlur={(event) => {
            // Commit when focus leaves the whole edit panel (e.g. click on canvas).
            if (!event.currentTarget.contains(event.relatedTarget as Element | null)) commit();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') setEditing(false);
          }}
        >
          <input
            ref={labelRef}
            value={draftLabel}
            placeholder={style.defaultLabel}
            className="w-full rounded bg-black/10 px-1.5 py-0.5 text-sm font-semibold outline-none placeholder:opacity-50"
            onChange={(event) => setDraftLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
            }}
          />
          <textarea
            value={draftContent}
            rows={3}
            placeholder={'Attributes — one per line\ne.g. productId: Uuid'}
            className="w-full resize-none rounded bg-black/10 px-1.5 py-1 font-mono text-[10px] leading-snug outline-none placeholder:opacity-50"
            onChange={(event) => setDraftContent(event.target.value)}
          />
          <button
            type="button"
            className="flex items-center justify-center gap-1 rounded bg-black/15 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-black/25"
            onClick={commit}
          >
            <Check size={11} />
            Done
          </button>
        </div>
      ) : (
        <div className="px-2.5 pt-1 pb-2.5" title="Double-click to edit">
          <span className="block min-h-5 text-sm leading-snug font-semibold break-words">{data.label}</span>
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
        </div>
      )}
    </div>
  );
}

export default memo(CqrsNode);
