import type { DragEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ELEMENT_STYLES, SLICE_ICON, type CqrsKind, type PaletteKind } from '../types';
import { useDnD } from './DnDContext';

interface PaletteItem {
  kind: PaletteKind;
  title: string;
  icon: LucideIcon;
  swatch: string;
}

const ELEMENT_ORDER: CqrsKind[] = ['screen', 'command', 'event', 'readmodel', 'processor'];

const ITEMS: PaletteItem[] = [
  ...ELEMENT_ORDER.map((kind) => ({
    kind: kind as PaletteKind,
    title: ELEMENT_STYLES[kind].title,
    icon: ELEMENT_STYLES[kind].icon,
    swatch: ELEMENT_STYLES[kind].card,
  })),
  {
    kind: 'slice',
    title: 'Slice',
    icon: SLICE_ICON,
    swatch: 'border-dashed border-indigo-400 bg-slate-700',
  },
];

interface PaletteProps {
  onAdd: (kind: PaletteKind) => void;
}

export default function Palette({ onAdd }: PaletteProps) {
  const [, setDragKind] = useDnD();

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: PaletteKind) => {
    setDragKind(kind);
    event.dataTransfer.setData('application/event-modeller', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-52 rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-xl shadow-black/40 backdrop-blur">
      <h2 className="text-xs font-bold tracking-wider text-slate-300 uppercase">Elements</h2>
      <p className="mt-1 mb-3 text-[11px] leading-snug text-slate-500">
        Drag onto the canvas, or click to add at the center of the view.
      </p>
      <ul className="space-y-1.5">
        {ITEMS.map(({ kind, title, icon: Icon, swatch }) => (
          <li key={kind}>
            <button
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, kind)}
              onDragEnd={() => setDragKind(null)}
              onClick={() => onAdd(kind)}
              className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 active:cursor-grabbing"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 ${swatch}`}>
                <Icon size={14} className={kind === 'slice' ? 'text-indigo-300' : 'text-black/60'} />
              </span>
              {title}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
