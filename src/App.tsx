import { ReactFlowProvider } from '@xyflow/react';
import Board from './Board';
import { DialogProvider } from './components/Dialog';
import { DnDProvider } from './components/DnDContext';
import { DropHighlightProvider } from './components/DropHighlightContext';

export default function App() {
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100">
      <DialogProvider>
        <ReactFlowProvider>
          <DnDProvider>
            <DropHighlightProvider>
              <Board />
            </DropHighlightProvider>
          </DnDProvider>
        </ReactFlowProvider>
      </DialogProvider>
    </div>
  );
}
