import { useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { BoardEdge, BoardNode } from '../types';
import { ELEMENT_STYLES, isCqrsKind } from '../types';
import { contextTagClass, contextsOf } from '../lib/contexts';
import { useBoardContexts } from './ContextsContext';

interface ElementEditorProps {
  nodeId: string;
  onClose: () => void;
}

/**
 * Modal editor for a CQRS element's label and attribute lines. Replaces the
 * old inline card form, which was too cramped inside cell-sized cards.
 * Enter in the name field or Cmd/Ctrl+Enter in the textarea saves; Escape,
 * backdrop click, or Cancel discards.
 */
export default function ElementEditor({ nodeId, onClose }: ElementEditorProps) {
  const { getNode, updateNodeData } = useReactFlow<BoardNode, BoardEdge>();
  const { contexts } = useBoardContexts();
  const node = getNode(nodeId);
  const [label, setLabel] = useState(node?.data.label ?? '');
  const [content, setContent] = useState(node?.data.content ?? '');
  const [assigned, setAssigned] = useState<Set<string>>(
    () => new Set(node ? contextsOf(node.data).filter((c) => contexts.includes(c)) : []),
  );
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    labelRef.current?.focus();
    labelRef.current?.select();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose]);

  if (!node || !isCqrsKind(node.type)) return null;
  const style = ELEMENT_STYLES[node.type];
  const Icon = style.icon;

  const save = () => {
    const trimmedLabel = label.trim();
    const trimmedContent = content.trim();
    updateNodeData(nodeId, {
      label: trimmedLabel.length > 0 ? trimmedLabel : style.defaultLabel,
      content: trimmedContent.length > 0 ? trimmedContent : undefined,
      ...(node.type === 'event' ? { contexts: contexts.filter((c) => assigned.has(c)) } : {}),
    });
    onClose();
  };

  const toggleContext = (name: string) => {
    setAssigned((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="dialog-backdrop absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="element-editor-title"
        className="dialog-panel relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 ${style.card}`}>
            <Icon size={18} />
          </span>
          <h2 id="element-editor-title" className="text-sm font-semibold text-slate-100">
            Edit {style.title}
          </h2>
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-400">
          Name
          <input
            ref={labelRef}
            value={label}
            placeholder={style.defaultLabel}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') save();
            }}
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-slate-400">
          Attributes — one per line
          <textarea
            value={content}
            rows={8}
            placeholder={'e.g.\nproductId: Uuid\nquantity: Int'}
            className="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono text-xs leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save();
            }}
          />
        </label>

        {node.type === 'event' && contexts.length >= 2 && (
          <div className="mt-3">
            <span className="block text-xs font-medium text-slate-400">Contexts</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {contexts.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={assigned.has(name)}
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                    assigned.has(name)
                      ? contextTagClass(name)
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                  onClick={() => toggleContext(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Events outside every highlighted context are dimmed on the board.
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
