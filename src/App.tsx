import { ReactFlowProvider } from '@xyflow/react';
import Board from './Board';
import { ContextsProvider } from './components/ContextsContext';
import { DialogProvider } from './components/Dialog';
import { DnDProvider } from './components/DnDContext';
import { DropHighlightProvider } from './components/DropHighlightContext';
import { ElementEditorProvider } from './components/ElementEditorContext';
import { WireframeEditorProvider } from './components/wireframe/WireframeEditorContext';

export default function App() {
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100">
      <DialogProvider>
        <ReactFlowProvider>
          <ContextsProvider>
            <WireframeEditorProvider>
              <ElementEditorProvider>
                <DnDProvider>
                  <DropHighlightProvider>
                    <Board />
                  </DropHighlightProvider>
                </DnDProvider>
              </ElementEditorProvider>
            </WireframeEditorProvider>
          </ContextsProvider>
        </ReactFlowProvider>
      </DialogProvider>
    </div>
  );
}
