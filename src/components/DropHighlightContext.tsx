import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** The slice cell currently hovered by a drag, and whether dropping there is allowed. */
export interface CellHighlight {
  sliceId: string;
  col: number;
  row: number;
  valid: boolean;
}

type SetHighlight = (next: CellHighlight | null) => void;

/**
 * Split contexts: the board only writes (stable setter, never re-renders on
 * highlight changes), slice nodes only read. The setter deduplicates, so the
 * per-mousemove drag handlers only trigger a render when the cell changes.
 */
const HighlightValueContext = createContext<CellHighlight | null>(null);
const HighlightSetterContext = createContext<SetHighlight>(() => undefined);

export function DropHighlightProvider({ children }: { children: ReactNode }) {
  const [highlight, setHighlightState] = useState<CellHighlight | null>(null);
  const current = useRef<CellHighlight | null>(null);

  const setHighlight = useCallback<SetHighlight>((next) => {
    const prev = current.current;
    const unchanged =
      prev === next ||
      (prev !== null &&
        next !== null &&
        prev.sliceId === next.sliceId &&
        prev.col === next.col &&
        prev.row === next.row &&
        prev.valid === next.valid);
    if (unchanged) return;
    current.current = next;
    setHighlightState(next);
  }, []);

  return (
    <HighlightSetterContext.Provider value={setHighlight}>
      <HighlightValueContext.Provider value={highlight}>{children}</HighlightValueContext.Provider>
    </HighlightSetterContext.Provider>
  );
}

export function useDropHighlight(): CellHighlight | null {
  return useContext(HighlightValueContext);
}

export function useSetDropHighlight(): SetHighlight {
  return useContext(HighlightSetterContext);
}
