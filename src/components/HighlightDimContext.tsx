import { createContext, useContext } from 'react';

/**
 * The set of node ids dimmed by context highlighting, computed in Board
 * (see lib/highlight.ts) and read per-node in CqrsNode.
 */
const HighlightDimContext = createContext<ReadonlySet<string>>(new Set());

export function useDimmedNodes(): ReadonlySet<string> {
  return useContext(HighlightDimContext);
}

export const HighlightDimProvider = HighlightDimContext.Provider;
