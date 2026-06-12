import type { BoardNodeData } from '../types';

/** Seeded on fresh/cleared boards; an ordinary context that can be renamed or removed anytime. */
export const DEFAULT_CONTEXT = 'default';

/** The contexts an event belongs to; absent or malformed means none. */
export function contextsOf(data: Pick<BoardNodeData, 'contexts'>): string[] {
  const { contexts } = data;
  return Array.isArray(contexts) ? contexts.filter((c): c is string => typeof c === 'string') : [];
}

/**
 * Sanitizes a board-level context list (e.g. from an imported file): strings
 * only, trimmed, deduped case-insensitively (first casing wins). May be empty.
 * A missing/malformed list (pre-feature exports) yields just the default.
 */
export function sanitizeBoardContexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [DEFAULT_CONTEXT];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const name = entry.trim();
    if (name.length === 0 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }
  return result;
}

/**
 * Tag pill palette: light backgrounds with dark text so tags stay readable on
 * every card color (most importantly the orange event card). Full literal
 * class strings keep Tailwind's JIT scanner happy.
 */
const TAG_CLASSES = [
  'bg-violet-100 text-violet-900 border-violet-400',
  'bg-emerald-100 text-emerald-900 border-emerald-400',
  'bg-sky-100 text-sky-900 border-sky-400',
  'bg-rose-100 text-rose-900 border-rose-400',
  'bg-amber-100 text-amber-900 border-amber-500',
  'bg-teal-100 text-teal-900 border-teal-400',
  'bg-indigo-100 text-indigo-900 border-indigo-400',
  'bg-lime-100 text-lime-900 border-lime-500',
];

const DEFAULT_TAG_CLASS = 'bg-slate-200 text-slate-700 border-slate-400';

/** Deterministic pill color per context name, so the same context looks alike on every card. */
export function contextTagClass(name: string): string {
  if (name === DEFAULT_CONTEXT) return DEFAULT_TAG_CLASS;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_CLASSES[hash % TAG_CLASSES.length];
}
