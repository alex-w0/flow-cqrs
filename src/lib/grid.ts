import type { XYPosition } from '@xyflow/react';
import type { BoardNode } from '../types';
import {
  CELL_HEIGHT,
  CELL_VPAD,
  CELL_WIDTH,
  DEFAULT_COLUMNS,
  DEFAULT_LANES,
  LANE_GUTTER,
  NODE_WIDTH,
  SLICE_HEADER_HEIGHT,
} from '../types';

/** A grid coordinate inside a slice: col is the column index, row the swimlane index. */
export interface Cell {
  col: number;
  row: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sliceColumns(slice: BoardNode): number {
  return slice.data.columns ?? DEFAULT_COLUMNS;
}

export function sliceLanes(slice: BoardNode): string[] {
  return slice.data.lanes ?? DEFAULT_LANES;
}

export function sliceWidth(columns: number): number {
  return LANE_GUTTER + columns * CELL_WIDTH;
}

export function sliceHeight(laneCount: number): number {
  return SLICE_HEADER_HEIGHT + laneCount * CELL_HEIGHT;
}

/** Returns the slice whose rendered bounds contain the given flow-space point. */
export function findSliceAt(nodes: BoardNode[], x: number, y: number): BoardNode | undefined {
  // Slices are never nested, so their position is already absolute.
  return nodes.find((node) => {
    if (node.type !== 'slice') return false;
    const width = node.measured?.width ?? node.width ?? sliceWidth(sliceColumns(node));
    const height = node.measured?.height ?? node.height ?? sliceHeight(sliceLanes(node).length);
    return (
      x >= node.position.x && x <= node.position.x + width && y >= node.position.y && y <= node.position.y + height
    );
  });
}

/** Maps an absolute flow-space point to the nearest cell of the given slice. */
export function cellAt(slice: BoardNode, x: number, y: number): Cell {
  const relX = x - slice.position.x - LANE_GUTTER;
  const relY = y - slice.position.y - SLICE_HEADER_HEIGHT;
  return {
    col: clamp(Math.floor(relX / CELL_WIDTH), 0, sliceColumns(slice) - 1),
    row: clamp(Math.floor(relY / CELL_HEIGHT), 0, sliceLanes(slice).length - 1),
  };
}

/** Slice-relative position a card is snapped to when occupying a cell. */
export function cellSlotPosition(cell: Cell): XYPosition {
  return {
    x: LANE_GUTTER + cell.col * CELL_WIDTH + (CELL_WIDTH - NODE_WIDTH) / 2,
    y: SLICE_HEADER_HEIGHT + cell.row * CELL_HEIGHT + CELL_VPAD,
  };
}

/**
 * The cell a slice-relative card position belongs to.
 * Column uses the horizontal center (width is fixed); row uses the top edge
 * because card height varies with content.
 */
export function cellOfRelativePosition(position: XYPosition): Cell {
  return {
    col: Math.floor((position.x + NODE_WIDTH / 2 - LANE_GUTTER) / CELL_WIDTH),
    row: Math.floor((position.y - SLICE_HEADER_HEIGHT) / CELL_HEIGHT),
  };
}

/** The cell a child currently occupies, derived from its snapped position. */
export function cellOfChild(child: BoardNode): Cell {
  return cellOfRelativePosition(child.position);
}

export function isCellOccupied(nodes: BoardNode[], sliceId: string, cell: Cell, excludeIds: Set<string>): boolean {
  return nodes.some((node) => {
    if (node.parentId !== sliceId || excludeIds.has(node.id)) return false;
    const occupied = cellOfChild(node);
    return occupied.col === cell.col && occupied.row === cell.row;
  });
}

/** Nearest free cell to `preferred` (Manhattan distance), or null if the slice is full. */
export function findFreeCell(
  nodes: BoardNode[],
  slice: BoardNode,
  preferred: Cell,
  excludeIds: Set<string>,
): Cell | null {
  const cells: Cell[] = [];
  for (let row = 0; row < sliceLanes(slice).length; row++) {
    for (let col = 0; col < sliceColumns(slice); col++) {
      cells.push({ col, row });
    }
  }
  cells.sort(
    (a, b) =>
      Math.abs(a.col - preferred.col) +
      Math.abs(a.row - preferred.row) -
      (Math.abs(b.col - preferred.col) + Math.abs(b.row - preferred.row)),
  );
  return cells.find((cell) => !isCellOccupied(nodes, slice.id, cell, excludeIds)) ?? null;
}
