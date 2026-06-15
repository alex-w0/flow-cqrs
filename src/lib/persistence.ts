import type { Viewport } from '@xyflow/react';
import type { BoardEdge, BoardNode } from '../types';
import { parseBoardFile, type ParsedBoard } from './serialization';

/**
 * localStorage-backed autosave so a browser refresh restores the user's work.
 * The stored shape mirrors the export file exactly, so loading reuses
 * `parseBoardFile` and shares its validation/normalization with file import.
 */
const STORAGE_KEY = 'event-modeller:board';

export interface PersistedBoard {
  nodes: BoardNode[];
  edges: BoardEdge[];
  viewport: Viewport | null;
  contexts: string[];
}

/** Writes the board to localStorage; silently ignores quota/unavailable storage. */
export function saveBoard(board: PersistedBoard): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch {
    // Storage may be full or disabled (private mode) — autosave is best-effort.
  }
}

/** Reads and validates the persisted board, or null if absent/unreadable. Drops corrupt data. */
export function loadBoard(): ParsedBoard | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return parseBoardFile(raw);
  } catch {
    clearBoard(); // corrupt payload — discard so it can't break every load
    return null;
  }
}

/** Removes the persisted board (used on file import so storage can't go stale). */
export function clearBoard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
