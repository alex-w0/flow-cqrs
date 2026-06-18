import { ArrowDown, ArrowUp, Link2, Trash2, TriangleAlert, Type } from 'lucide-react';
import type { CqrsKind, GwtData, GwtItem, GwtSection } from '../types';
import { DEFAULT_EXCEPTION_TEXT, GWT_SECTIONS } from '../types';
import GwtRefPicker from './GwtRefPicker';

/** A board element a GWT section may reference, in the editor's dropdown. */
export interface GwtRefOption {
  id: string;
  label: string;
  type: CqrsKind;
}

interface GwtEditorProps {
  value: GwtData;
  /** Referenceable elements currently on the board (commands, events, read models). */
  options: GwtRefOption[];
  onChange: (next: GwtData) => void;
}

/**
 * Section-by-section editor for a Given/When/Then scenario. Each section is an
 * ordered list of rows; a row is a reference to another board element (chosen
 * from a dropdown), a free-text note, or — in the Then section only — an
 * exception (a red-tagged expected error). Rows can be reordered and removed.
 * References stay in sync with the board because only ids are stored.
 */
export default function GwtEditor({ value, options, onChange }: GwtEditorProps) {
  const setSection = (key: GwtSection, items: GwtItem[]) => onChange({ ...value, [key]: items });
  // A reference caches the target's label/type so it survives the element's deletion.
  const refItem = (option: GwtRefOption): GwtItem => ({
    kind: 'ref',
    ref: option.id,
    label: option.label,
    type: option.type,
  });
  // New references start unselected (empty ref) so the picker shows "Select
  // element…"; a row left unselected is dropped on save by cleanGwt.
  const addRef = (key: GwtSection) => setSection(key, [...value[key], { kind: 'ref', ref: '' }]);
  const addText = (key: GwtSection) => setSection(key, [...value[key], { kind: 'text', text: '' }]);
  // Exceptions start from a default text the user can override.
  const addException = (key: GwtSection) =>
    setSection(key, [...value[key], { kind: 'exception', text: DEFAULT_EXCEPTION_TEXT }]);
  const setItem = (key: GwtSection, index: number, item: GwtItem) =>
    setSection(
      key,
      value[key].map((current, i) => (i === index ? item : current)),
    );
  const removeItem = (key: GwtSection, index: number) =>
    setSection(
      key,
      value[key].filter((_, i) => i !== index),
    );
  const move = (key: GwtSection, index: number, delta: number) => {
    const next = [...value[key]];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSection(key, next);
  };

  const noOptions = options.length === 0;

  return (
    <div className="mt-3 space-y-3">
      {GWT_SECTIONS.map(({ key, label, hint }) => {
        const items = value[key];
        return (
          <fieldset key={key} className="rounded-lg border border-slate-700 bg-slate-800/40 p-2.5">
            <legend className="px-1 text-xs font-semibold text-slate-200">{label}</legend>
            <p className="mb-2 text-[11px] text-slate-500">{hint}</p>

            {items.length > 0 && (
              <ul className="space-y-1.5">
                {items.map((item, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        title="Move up"
                        aria-label="Move up"
                        disabled={index === 0}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        onClick={() => move(key, index, -1)}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        aria-label="Move down"
                        disabled={index === items.length - 1}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        onClick={() => move(key, index, 1)}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>

                    {item.kind === 'ref' ? (
                      <GwtRefPicker
                        value={item.ref}
                        options={options}
                        fallback={{ label: item.label, type: item.type }}
                        onChange={(option) => setItem(key, index, refItem(option))}
                      />
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {item.kind === 'exception' && (
                          <TriangleAlert size={14} className="shrink-0 text-red-400" />
                        )}
                        <input
                          value={item.text}
                          placeholder={item.kind === 'exception' ? 'Exception' : 'Free-text note'}
                          className={`min-w-0 flex-1 rounded-md border bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 ${
                            item.kind === 'exception'
                              ? 'border-red-800 focus:border-red-400'
                              : 'border-slate-700 focus:border-indigo-400'
                          }`}
                          onChange={(event) => setItem(key, index, { ...item, text: event.target.value })}
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      title="Remove"
                      aria-label="Remove"
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-rose-300"
                      onClick={() => removeItem(key, index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={noOptions}
                title={noOptions ? 'Add a command, event, or read model to the board first' : undefined}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:text-slate-300"
                onClick={() => addRef(key)}
              >
                <Link2 size={12} /> Reference
              </button>
              {key === 'then' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-red-800 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:border-red-500 hover:text-red-200"
                  onClick={() => addException(key)}
                >
                  <TriangleAlert size={12} /> Exception
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                onClick={() => addText(key)}
              >
                <Type size={12} /> Text
              </button>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
