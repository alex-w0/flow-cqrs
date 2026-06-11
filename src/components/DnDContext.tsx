import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PaletteKind } from '../types';

type DnDState = [PaletteKind | null, (kind: PaletteKind | null) => void];

/**
 * Holds the element kind currently being dragged from the palette.
 * HTML5 dataTransfer payloads are unreadable during dragover, so the
 * canonical React Flow DnD pattern shares the type through context.
 */
const DnDContext = createContext<DnDState>([null, () => undefined]);

export function DnDProvider({ children }: { children: ReactNode }) {
  const state = useState<PaletteKind | null>(null);
  return <DnDContext.Provider value={state}>{children}</DnDContext.Provider>;
}

export function useDnD(): DnDState {
  return useContext(DnDContext);
}
