import { useRef, useState } from 'react';
import { Settings2, Tags } from 'lucide-react';
import { contextTagClass } from '../lib/contexts';
import { useBoardContexts } from './ContextsContext';

const BUTTON =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white';

/**
 * Toolbar entry for DCB contexts. Hovering reveals a dropdown to toggle which
 * contexts are highlighted on the board; configuring the context list itself
 * (add / rename / delete) still happens in the manager dialog opened from here.
 */
export default function ContextsMenu() {
  const { contexts, activeContexts, toggleActiveContext, clearActiveContexts, openManager } = useBoardContexts();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // Small grace period so moving the cursor from the button across the gap to
  // the panel doesn't dismiss the menu.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const manage = () => {
    cancelClose();
    setOpen(false);
    openManager();
  };

  return (
    <div className="relative" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <button type="button" className={BUTTON} title="Highlight contexts" aria-haspopup="menu" aria-expanded={open}>
        <Tags size={15} />
        Contexts
        {activeContexts.map((name) => (
          <span key={name} className="rounded-full bg-indigo-500/20 px-1.5 py-px text-[10px] font-semibold text-indigo-300">
            {name}
          </span>
        ))}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl shadow-black/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Highlight contexts</span>
            {activeContexts.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
                onClick={clearActiveContexts}
              >
                Clear
              </button>
            )}
          </div>

          {contexts.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">No contexts yet.</p>
          )}

          {contexts.length > 0 && (
            <p className="mt-2 text-[11px] text-slate-500">Events outside every highlighted context are dimmed.</p>
          )}

          <div className="my-2.5 h-px bg-slate-800" />

          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            onClick={manage}
          >
            <Settings2 size={14} />
            Manage contexts…
          </button>
        </div>
      )}
    </div>
  );
}
