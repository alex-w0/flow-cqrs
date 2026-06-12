import { createContext, useContext, useState, type ReactNode } from 'react';
import ElementEditor from './ElementEditor';

const OpenEditorContext = createContext<(nodeId: string) => void>(() => undefined);

/** Returns a function that opens the element editor dialog for a CQRS node. */
export function useOpenElementEditor(): (nodeId: string) => void {
  return useContext(OpenEditorContext);
}

/**
 * Hosts the element editor modal (label + attributes). Must live inside
 * ReactFlowProvider — the editor reads and writes node data.
 */
export function ElementEditorProvider({ children }: { children: ReactNode }) {
  const [nodeId, setNodeId] = useState<string | null>(null);

  return (
    <OpenEditorContext.Provider value={setNodeId}>
      {children}
      {nodeId && <ElementEditor key={nodeId} nodeId={nodeId} onClose={() => setNodeId(null)} />}
    </OpenEditorContext.Provider>
  );
}
