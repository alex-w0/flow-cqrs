import { useReactFlow } from '@xyflow/react';
import { Download, Maximize, Tags, Trash2, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { useBoardContexts } from './ContextsContext';

interface ToolbarProps {
  onExport: () => void;
  onImport: () => void;
  onClear: () => void;
}

const BUTTON =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white';

export default function Toolbar({ onExport, onImport, onClear }: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { activeContexts, openManager } = useBoardContexts();

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-slate-700 bg-slate-900/90 p-1.5 shadow-xl shadow-black/40 backdrop-blur">
      <button type="button" className={BUTTON} title="Zoom in" onClick={() => void zoomIn({ duration: 200 })}>
        <ZoomIn size={15} />
      </button>
      <button type="button" className={BUTTON} title="Zoom out" onClick={() => void zoomOut({ duration: 200 })}>
        <ZoomOut size={15} />
      </button>
      <button
        type="button"
        className={BUTTON}
        title="Fit view"
        onClick={() => void fitView({ padding: 0.2, duration: 300 })}
      >
        <Maximize size={15} />
        Fit View
      </button>
      <button type="button" className={BUTTON} title="Manage contexts" onClick={openManager}>
        <Tags size={15} />
        Contexts
        {activeContexts.map((name) => (
          <span key={name} className="rounded-full bg-indigo-500/20 px-1.5 py-px text-[10px] font-semibold text-indigo-300">
            {name}
          </span>
        ))}
      </button>

      <div className="mx-1 h-5 w-px bg-slate-700" />

      <button type="button" className={BUTTON} title="Export board as JSON" onClick={onExport}>
        <Download size={15} />
        Export
      </button>
      <button type="button" className={BUTTON} title="Import board from JSON" onClick={onImport}>
        <Upload size={15} />
        Import
      </button>

      <div className="mx-1 h-5 w-px bg-slate-700" />

      <button
        type="button"
        className={`${BUTTON} hover:bg-red-500/15 hover:text-red-300`}
        title="Clear the entire board"
        onClick={onClear}
      >
        <Trash2 size={15} />
        Clear Board
      </button>
    </div>
  );
}
