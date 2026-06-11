import { ReactFlowProvider } from '@xyflow/react';
import Board from './Board';
import { DialogProvider } from './components/Dialog';
import { DnDProvider } from './components/DnDContext';
import { DropHighlightProvider } from './components/DropHighlightContext';
import { WireframeEditorProvider } from './components/wireframe/WireframeEditorContext';

export default function App() {
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100">
      <DialogProvider>
        <ReactFlowProvider>
          <WireframeEditorProvider>
            <DnDProvider>
              <DropHighlightProvider>
                <Board />
              </DropHighlightProvider>
            </DnDProvider>
          </WireframeEditorProvider>
        </ReactFlowProvider>
      </DialogProvider>
    </div>
  );
}
