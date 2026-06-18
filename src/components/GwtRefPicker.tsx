import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import type { CqrsKind } from '../types';
import { ELEMENT_STYLES } from '../types';
import type { GwtRefOption } from './GwtEditor';

/** A pill showing an element's kind, colored with that kind's board sticky color. */
function TypeTag({ type }: { type: CqrsKind }) {
  return (
    <span
      className={`shrink-0 rounded border px-1 py-px text-[9px] font-bold tracking-wide uppercase ${ELEMENT_STYLES[type].card}`}
    >
      {ELEMENT_STYLES[type].title}
    </span>
  );
}

interface GwtRefPickerProps {
  value: string;
  options: GwtRefOption[];
  /** Cached label/type of the referenced element, shown when it no longer exists. */
  fallback?: { label?: string; type?: CqrsKind };
  onChange: (option: GwtRefOption) => void;
}

/**
 * Searchable reference picker. The trigger shows the current selection as a
 * colored type tag plus its label; opening it reveals a search field that
 * filters elements by name or kind, each row tagged and colored by type.
 */
export default function GwtRefPicker({ value, options, fallback, onChange }: GwtRefPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || ELEMENT_STYLES[option.type].title.toLowerCase().includes(q),
    );
  }, [query, options]);

  // Focus the search on open and close again on any click outside the picker.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (option: GwtRefOption) => {
    onChange(option);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-left text-sm text-slate-100 outline-none hover:border-slate-500 focus:border-indigo-400"
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <>
            <TypeTag type={selected.type} />
            <span className="min-w-0 flex-1 truncate">{selected.label}</span>
          </>
        ) : value ? (
          <>
            {fallback?.type && <TypeTag type={fallback.type} />}
            <span className="min-w-0 flex-1 truncate text-slate-400 line-through">
              {fallback?.label ?? 'deleted element'} (deleted)
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-slate-400">Select element…</span>
        )}
        <ChevronsUpDown size={14} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl shadow-black/50">
          <div className="flex items-center gap-1.5 border-b border-slate-700 px-2">
            <Search size={13} className="shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              placeholder="Search elements…"
              className="w-full bg-transparent py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter' && filtered.length > 0) choose(filtered[0]);
              }}
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-slate-500">No matching elements.</li>
            ) : (
              filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-sm hover:bg-slate-800 ${
                      option.id === value ? 'bg-slate-800/60' : ''
                    }`}
                    onClick={() => choose(option)}
                  >
                    <TypeTag type={option.type} />
                    <span className="min-w-0 flex-1 truncate text-slate-100">{option.label}</span>
                    {option.id === value && <Check size={14} className="shrink-0 text-indigo-400" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
