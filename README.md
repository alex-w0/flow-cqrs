# Event Modeller — CQRS Board

An interactive, fully client-side Event Modeling / CQRS board built with React Flow
(`@xyflow/react`), Tailwind CSS, and Lucide icons. State is saved and restored via
plain JSON files — no server involved.

## Run

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
```

## Usage

- **Add elements** — drag a card from the left palette onto the canvas, or click it
  to add it at the center of the current view.
- **Slices** — drop a Slice to create a grid table with predefined swimlanes
  (Actor, Interaction, Events, Spec Lane) crossed with columns. Use the "+" buttons
  on the right/bottom edges to append columns or swimlanes; double-click a lane
  label to rename it. Elements dragged onto a slice snap into the cell under the
  cursor and become children (moving the slice moves its contents). Each cell holds
  at most one element — dropping on an occupied cell snaps the drag back.
- **Connect** — every element has four handles (top/right/bottom/left); drag from
  any handle to any other node's handle. Edges take the color of their source
  element and end in a matching arrowhead.
- **Edit** — double-click an element to edit its label and its content block
  (attributes, one per line — e.g. `productId: Uuid`). Double-click a slice title
  to rename it (Enter commits, Escape cancels).
- **Delete** — hover/select an element and click the ×, or select nodes/edges and
  press Backspace/Delete. Deleting a slice deletes its contents.
- **Save / load** — Export downloads the full board (nodes, edges, parent-child
  relationships, viewport) as JSON via React Flow's `toObject()`; Import validates
  and restores a previously exported file.

## Structure

```
src/
  App.tsx                    providers + layout shell
  Board.tsx                  canvas, DnD drop logic, cell snapping/occupancy, import/export
  initialBoard.ts            seed example (one slice: Screen → Command → Event → Read Model)
  types.ts                   element kinds, color schema, grid geometry constants
  nodes/
    CqrsNode.tsx             shared sticky-note card with 4-way handles + attributes block
    SliceNode.tsx            swimlane grid table with add-column/add-lane controls
  components/
    Palette.tsx              floating drag-and-drop / click-to-add panel
    Toolbar.tsx              zoom, fit view, export/import, clear board
    DnDContext.tsx           shares the dragged palette kind during HTML5 DnD
  lib/
    grid.ts                  slice grid math (cells, occupancy, nearest free cell)
    serialization.ts         JSON export download + validated import parsing
    id.ts                    readable collision-safe node ids
```
