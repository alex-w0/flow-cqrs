import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Plus, Tags, X } from 'lucide-react';
import { contextTagClass } from '../lib/contexts';
import { useBoardContexts } from './ContextsContext';

interface ContextsManagerProps {
  onClose: () => void;
}

const ICON_BUTTON = 'rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white';

/**
 * Management dialog for DCB contexts: toggle the highlighted contexts, rename
 * or delete existing contexts (changes cascade to events immediately), and
 * add new ones.
 */
export default function ContextsManager({ onClose }: ContextsManagerProps) {
  const {
    contexts,
    activeContexts,
    toggleActiveContext,
    clearActiveContexts,
    addContext,
    renameContext,
    removeContext,
  } = useBoardContexts();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (renaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renaming]);

  const add = () => {
    const error = addContext(newName);
    setAddError(error);
    if (!error) setNewName('');
  };

  const startRename = (name: string) => {
    setRenaming(name);
    setRenameDraft(name);
    setRenameError(null);
  };

  const commitRename = () => {
    if (!renaming) return;
    const error = renameContext(renaming, renameDraft);
    setRenameError(error);
    if (!error) setRenaming(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="dialog-backdrop absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contexts-title"
        className="dialog-panel relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
            <Tags size={18} />
          </span>
          <div>
            <h2 id="contexts-title" className="text-sm font-semibold text-slate-100">
              Contexts
            </h2>
            <p className="text-xs text-slate-400">DCB bounded contexts events can be assigned to.</p>
          </div>
        </div>

        {contexts.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Highlight contexts</span>
              {activeContexts.length > 0 && (
                <button
                  type="button"
                  className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
                  onClick={clearActiveContexts}
                >
                  Clear highlighting
                </button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {contexts.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={`Toggle highlight for ${name}`}
                  aria-pressed={activeContexts.includes(name)}
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                    activeContexts.includes(name)
                      ? contextTagClass(name)
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                  onClick={() => toggleActiveContext(name)}
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

        {contexts.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {contexts.map((name) => (
              <li key={name} className="rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${contextTagClass(name)}`}>
                    {name}
                  </span>
                  {renaming === name ? (
                    <span className="ml-auto flex items-center gap-1">
                      <input
                        ref={renameRef}
                        value={renameDraft}
                        className="w-36 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100 outline-none focus:border-indigo-400"
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === 'Enter') commitRename();
                          if (event.key === 'Escape') setRenaming(null);
                        }}
                        onBlur={commitRename}
                      />
                      <button
                        type="button"
                        title="Apply rename"
                        aria-label="Apply rename"
                        className={ICON_BUTTON}
                        onMouseDown={commitRename}
                      >
                        <Check size={13} />
                      </button>
                    </span>
                  ) : (
                    <span className="ml-auto flex items-center gap-0.5">
                      <button
                        type="button"
                        title={`Rename ${name}`}
                        aria-label={`Rename ${name}`}
                        className={ICON_BUTTON}
                        onClick={() => startRename(name)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        title={`Delete ${name}`}
                        aria-label={`Delete ${name}`}
                        className={ICON_BUTTON}
                        onClick={() => removeContext(name)}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  )}
                </div>
                {renaming === name && renameError && <p className="mt-1 text-xs text-red-400">{renameError}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500">
            No contexts yet — add one below to start tagging events.
          </p>
        )}

        <div className="mt-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <input
              value={newName}
              placeholder="New context, e.g. Student"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
              onChange={(event) => {
                setNewName(event.target.value);
                setAddError(null);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') add();
              }}
            />
            {addError && <p className="mt-1 text-xs text-red-400">{addError}</p>}
          </div>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
            onClick={add}
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
