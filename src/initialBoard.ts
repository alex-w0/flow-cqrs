import { MarkerType } from '@xyflow/react';
import type { BoardEdge, BoardNode } from './types';
import { DEFAULT_COLUMNS, DEFAULT_LANES, ELEMENT_STYLES } from './types';
import { DEFAULT_CONTEXT } from './lib/contexts';
import { cellSlotPosition, sliceHeight, sliceWidth } from './lib/grid';

/**
 * A small seed model demonstrating one vertical slice on the default grid
 * (Actor / Interaction / Events / Spec Lane × 3 columns):
 * Screen -> Command -> Event -> Read Model, plus a free processor node.
 * Slices must precede their children in the array.
 */
export const initialNodes: BoardNode[] = [
  {
    id: 'slice_demo',
    type: 'slice',
    position: { x: 0, y: 0 },
    width: sliceWidth(DEFAULT_COLUMNS),
    height: sliceHeight(DEFAULT_LANES.length),
    data: { label: 'Add Item to Cart', columns: DEFAULT_COLUMNS, lanes: [...DEFAULT_LANES] },
    dragHandle: '.slice-drag-handle',
  },
  {
    id: 'screen_demo',
    type: 'screen',
    position: cellSlotPosition({ col: 0, row: 1 }),
    parentId: 'slice_demo',
    data: {
      label: 'Cart Page',
      wireframe: {
        width: 320,
        height: 220,
        elements: [
          { id: 'wf_demo_1', kind: 'heading', x: 16, y: 12, w: 140, h: 20, text: 'Shopping Cart' },
          { id: 'wf_demo_2', kind: 'image', x: 16, y: 44, w: 64, h: 50 },
          { id: 'wf_demo_3', kind: 'text', x: 92, y: 48, w: 100, h: 14, text: 'Wireless Mouse' },
          { id: 'wf_demo_4', kind: 'text', x: 92, y: 66, w: 100, h: 14, text: '1 × €29.90' },
          { id: 'wf_demo_5', kind: 'input', x: 16, y: 130, w: 130, h: 26, text: 'Promo code' },
          { id: 'wf_demo_6', kind: 'button', x: 210, y: 176, w: 94, h: 28, text: 'Checkout' },
        ],
        strokes: [],
      },
    },
  },
  {
    id: 'command_demo',
    type: 'command',
    position: cellSlotPosition({ col: 1, row: 1 }),
    parentId: 'slice_demo',
    data: { label: 'Add Item', content: 'productId: Uuid\nquantity: Int' },
  },
  {
    id: 'event_demo',
    type: 'event',
    position: cellSlotPosition({ col: 1, row: 2 }),
    parentId: 'slice_demo',
    data: {
      label: 'Item Added',
      content: 'productId: Uuid\nquantity: Int\naddedAt: Instant',
      contexts: [DEFAULT_CONTEXT],
    },
  },
  {
    id: 'readmodel_demo',
    type: 'readmodel',
    position: cellSlotPosition({ col: 2, row: 1 }),
    parentId: 'slice_demo',
    data: { label: 'Cart Items', content: 'items: CartItem[]\ntotal: Money' },
  },
  {
    id: 'processor_demo',
    type: 'processor',
    position: { x: sliceWidth(DEFAULT_COLUMNS) + 120, y: 340 },
    data: { label: 'Sync Inventory' },
  },
];

function edge(
  id: string,
  source: string,
  target: string,
  accent: string,
  sourceHandle: string,
  targetHandle: string,
): BoardEdge {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    style: { stroke: accent },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: accent },
  };
}

export const initialEdges: BoardEdge[] = [
  edge('edge_demo_1', 'screen_demo', 'command_demo', ELEMENT_STYLES.screen.accent, 'right', 'left'),
  edge('edge_demo_2', 'command_demo', 'event_demo', ELEMENT_STYLES.command.accent, 'bottom', 'top'),
  edge('edge_demo_3', 'event_demo', 'readmodel_demo', ELEMENT_STYLES.event.accent, 'right', 'bottom'),
  edge('edge_demo_4', 'event_demo', 'processor_demo', ELEMENT_STYLES.event.accent, 'right', 'left'),
];
