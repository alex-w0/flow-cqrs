import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { BoardEdge, BoardNode } from '../types';
import { DEFAULT_CONTEXT, sanitizeBoardContexts } from '../lib/contexts';
import { loadBoard } from '../lib/persistence';
import ContextsManager from './ContextsManager';

interface ContextsApi {
  /** All configured contexts; may be empty. */
  contexts: string[];
  /** Contexts being highlighted on the board; empty means highlighting is off. */
  activeContexts: string[];
  toggleActiveContext: (name: string) => void;
  clearActiveContexts: () => void;
  /** Returns an error message, or null on success. */
  addContext: (name: string) => string | null;
  /** Returns an error message, or null on success. Cascades to all referencing events. */
  renameContext: (oldName: string, newName: string) => string | null;
  /** Removes the context everywhere; events keep their remaining contexts (possibly none). */
  removeContext: (name: string) => void;
  /** Replaces the whole list (import / clear board) and turns highlighting off. */
  replaceContexts: (names: string[]) => void;
  openManager: () => void;
}

const ContextsApiContext = createContext<ContextsApi | null>(null);

export function useBoardContexts(): ContextsApi {
  const api = useContext(ContextsApiContext);
  if (!api) throw new Error('useBoardContexts must be used inside <ContextsProvider>');
  return api;
}

/**
 * Owns the board's DCB context list and the active highlight selection, and
 * hosts the management dialog. Must live inside ReactFlowProvider — renaming
 * or deleting a context rewrites the `contexts` of every referencing event.
 */
export function ContextsProvider({ children }: { children: ReactNode }) {
  // Restore the autosaved context list (Board restores nodes/edges from the
  // same storage entry); a fresh board starts with just the default context.
  const [contexts, setContexts] = useState<string[]>(() => loadBoard()?.contexts ?? [DEFAULT_CONTEXT]);
  const [activeContexts, setActiveContexts] = useState<string[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const { setNodes } = useReactFlow<BoardNode, BoardEdge>();

  const validate = useCallback(
    (name: string, ignore?: string): string | null => {
      if (name.length === 0) return 'Name cannot be empty.';
      const lower = name.toLowerCase();
      if (contexts.some((c) => c !== ignore && c.toLowerCase() === lower)) {
        return 'A context with this name already exists.';
      }
      return null;
    },
    [contexts],
  );

  const addContext = useCallback(
    (raw: string): string | null => {
      const name = raw.trim();
      const error = validate(name);
      if (error) return error;
      setContexts((list) => [...list, name]);
      return null;
    },
    [validate],
  );

  const renameContext = useCallback(
    (oldName: string, rawNewName: string): string | null => {
      const newName = rawNewName.trim();
      if (newName === oldName) return null;
      const error = validate(newName, oldName);
      if (error) return error;
      setContexts((list) => list.map((c) => (c === oldName ? newName : c)));
      setNodes((nds) =>
        nds.map((node) =>
          node.type === 'event' && node.data.contexts?.includes(oldName)
            ? { ...node, data: { ...node.data, contexts: node.data.contexts.map((c) => (c === oldName ? newName : c)) } }
            : node,
        ),
      );
      setActiveContexts((active) => active.map((c) => (c === oldName ? newName : c)));
      return null;
    },
    [validate, setNodes],
  );

  const removeContext = useCallback(
    (name: string) => {
      setContexts((list) => list.filter((c) => c !== name));
      setNodes((nds) =>
        nds.map((node) =>
          node.type === 'event' && node.data.contexts?.includes(name)
            ? { ...node, data: { ...node.data, contexts: node.data.contexts.filter((c) => c !== name) } }
            : node,
        ),
      );
      setActiveContexts((active) => active.filter((c) => c !== name));
    },
    [setNodes],
  );

  const toggleActiveContext = useCallback((name: string) => {
    setActiveContexts((active) =>
      active.includes(name) ? active.filter((c) => c !== name) : [...active, name],
    );
  }, []);

  const clearActiveContexts = useCallback(() => setActiveContexts([]), []);

  const replaceContexts = useCallback((names: string[]) => {
    setContexts(sanitizeBoardContexts(names));
    setActiveContexts([]);
  }, []);

  const openManager = useCallback(() => setManagerOpen(true), []);

  const api = useMemo<ContextsApi>(
    () => ({
      contexts,
      activeContexts,
      toggleActiveContext,
      clearActiveContexts,
      addContext,
      renameContext,
      removeContext,
      replaceContexts,
      openManager,
    }),
    [
      contexts,
      activeContexts,
      toggleActiveContext,
      clearActiveContexts,
      addContext,
      renameContext,
      removeContext,
      replaceContexts,
      openManager,
    ],
  );

  return (
    <ContextsApiContext.Provider value={api}>
      {children}
      {managerOpen && <ContextsManager onClose={() => setManagerOpen(false)} />}
    </ContextsApiContext.Provider>
  );
}
