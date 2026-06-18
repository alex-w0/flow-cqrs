import { useCallback, useMemo } from 'react';
import { useStore, type ReactFlowState } from '@xyflow/react';
import type { GwtData, GwtItem } from '../types';
import { EDGE_NEUTRAL, ELEMENT_STYLES, GWT_SECTIONS, isCqrsKind } from '../types';

/** A GWT reference resolved against the live board: the target's label and kind. */
type ResolvedRef = { label: string; type: string };

/** Renders one GWT item — a colored chip for a reference, a red tag for an exception, mono text for a note. */
function GwtItemView({ item, refMap }: { item: GwtItem; refMap: Map<string, ResolvedRef | null> }) {
  if (item.kind === 'text') {
    return <span className="font-mono opacity-80">{item.text}</span>;
  }
  if (item.kind === 'exception') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1 py-px font-semibold text-white">
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-300" />
        {item.text}
      </span>
    );
  }
  // Prefer the live element; fall back to the cached snapshot so a deleted
  // reference still shows what it pointed at. An empty label (e.g. from a
  // malformed import) is treated as missing rather than rendered as a blank chip.
  const resolved = refMap.get(item.ref) ?? null;
  const label = (resolved?.label || item.label || '').trim();
  const type = resolved?.type ?? item.type;
  if (!label) {
    return resolved ? (
      <span className="italic opacity-50">unnamed element</span>
    ) : (
      <span className="italic line-through opacity-50">deleted element</span>
    );
  }
  const accent = isCqrsKind(type) ? ELEMENT_STYLES[type].accent : EDGE_NEUTRAL;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1 py-px font-medium ${
        resolved ? 'bg-black/10' : 'italic line-through opacity-50'
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
      {label}
      {resolved ? '' : ' (deleted)'}
    </span>
  );
}

/**
 * The Given/When/Then body of a GWT card. Mounted only for `gwt` nodes, so the
 * other element kinds never pay for the store subscription below.
 *
 * References resolve to the live label/kind of their target by subscribing to
 * the store (keeping chips current as elements are renamed or deleted). The
 * selector returns a string so React Flow's Object.is check re-renders only
 * when a referenced label or kind actually changes. Sections are plain <div>s
 * and only the item rows are <li>, so the card's overflow-line counter (which
 * counts <li>) measures item rows, not section headers.
 */
export default function GwtNodeBody({ gwt }: { gwt: GwtData }) {
  const refIds = useMemo(
    () => GWT_SECTIONS.flatMap(({ key }) => gwt[key]).flatMap((item) => (item.kind === 'ref' ? [item.ref] : [])),
    [gwt],
  );
  const refSignature = useStore(
    useCallback(
      (s: ReactFlowState) =>
        JSON.stringify(
          refIds.map((rid) => {
            const target = s.nodeLookup.get(rid);
            return [rid, target ? String(target.data.label ?? '') : null, target?.type ?? null];
          }),
        ),
      [refIds],
    ),
  );
  const refMap = useMemo(() => {
    const map = new Map<string, ResolvedRef | null>();
    for (const [rid, label, kind] of JSON.parse(refSignature) as [string, string | null, string | null][]) {
      map.set(rid, label === null || kind === null ? null : { label, type: kind });
    }
    return map;
  }, [refSignature]);

  if (GWT_SECTIONS.every(({ key }) => gwt[key].length === 0)) {
    return <p className="mt-1 text-[10px] leading-tight italic opacity-60">Double-click to add Given / When / Then…</p>;
  }
  return (
    <div className="mt-1.5 space-y-1.5 border-t border-black/15 pt-1.5">
      {GWT_SECTIONS.map(({ key, label }) => {
        const items = gwt[key];
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <span className="block text-[9px] font-bold tracking-wider uppercase opacity-60">{label}</span>
            <ul className="mt-0.5 space-y-0.5">
              {items.map((item, index) => (
                <li key={index} className="flex items-start gap-1 text-[10px] leading-tight break-words">
                  <GwtItemView item={item} refMap={refMap} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
