import { createContext, useContext, useState, type ReactNode } from 'react';
import WireframeEditor from './WireframeEditor';

const OpenEditorContext = createContext<(nodeId: string) => void>(() => undefined);

/** Returns a function that opens the wireframe editor for a screen node. */
export function useOpenWireframeEditor(): (nodeId: string) => void {
  return useContext(OpenEditorContext);
}

/**
 * Hosts the wireframe editor modal. Must live inside ReactFlowProvider (the
 * editor reads/writes node data) and DialogProvider (it uses prompts/confirms).
 */
export function WireframeEditorProvider({ children }: { children: ReactNode }) {
  const [nodeId, setNodeId] = useState<string | null>(null);

  return (
    <OpenEditorContext.Provider value={setNodeId}>
      {children}
      {nodeId && <WireframeEditor key={nodeId} nodeId={nodeId} onClose={() => setNodeId(null)} />}
    </OpenEditorContext.Provider>
  );
}
