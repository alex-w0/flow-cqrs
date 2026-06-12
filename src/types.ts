import type { Edge, Node } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import { Columns3, Database, Monitor, Send, Settings, Zap } from 'lucide-react';

/** The five CQRS / Event Modeling element kinds rendered as sticky-note nodes. */
export type CqrsKind = 'command' | 'event' | 'readmodel' | 'screen' | 'processor';

/** Everything that can be added from the palette (elements + slices). */
export type PaletteKind = CqrsKind | 'slice';

/** Mockup primitives available in the screen wireframe editor. */
export type WireframeElementKind = 'button' | 'input' | 'image' | 'checkbox' | 'heading' | 'text' | 'rect';

export interface WireframeElement {
  id: string;
  kind: WireframeElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
}

/** A freehand pen stroke as a flat list of x,y pairs in wireframe coordinates. */
export interface WireframeStroke {
  id: string;
  points: number[];
}

export interface Wireframe {
  width: number;
  height: number;
  elements: WireframeElement[];
  strokes: WireframeStroke[];
}

/** Logical canvas size of a screen wireframe (rendered scaled). */
export const WIREFRAME_WIDTH = 320;
export const WIREFRAME_HEIGHT = 220;

export interface BoardNodeData {
  label: string;
  /** Optional body text for CQRS elements — e.g. command/event attributes, one per line. */
  content?: string;
  /** Screen only: the wireframe mockup shown below the title. */
  wireframe?: Wireframe;
  /** Slice only: number of grid columns. */
  columns?: number;
  /** Slice only: swimlane names, top to bottom. */
  lanes?: string[];
  [key: string]: unknown;
}

export type BoardNode = Node<BoardNodeData>;
export type BoardEdge = Edge;

export interface ElementStyle {
  title: string;
  defaultLabel: string;
  icon: LucideIcon;
  /** Card surface — solid sticky-note colors per Event Modeling convention. */
  card: string;
  /** Hex used for connection handles, edges, and minimap. */
  accent: string;
}

export const ELEMENT_STYLES: Record<CqrsKind, ElementStyle> = {
  command: {
    title: 'Command',
    defaultLabel: 'New Command',
    icon: Send,
    card: 'bg-sky-400 border-sky-300 text-sky-950',
    accent: '#38bdf8',
  },
  event: {
    title: 'Event',
    defaultLabel: 'New Event',
    icon: Zap,
    card: 'bg-orange-400 border-orange-300 text-orange-950',
    accent: '#fb923c',
  },
  readmodel: {
    title: 'Read Model',
    defaultLabel: 'New Read Model',
    icon: Database,
    card: 'bg-emerald-400 border-emerald-300 text-emerald-950',
    accent: '#34d399',
  },
  screen: {
    title: 'Screen / UI',
    defaultLabel: 'New Screen',
    icon: Monitor,
    card: 'bg-zinc-100 border-zinc-300 text-zinc-900',
    accent: '#e4e4e7',
  },
  processor: {
    title: 'Processor',
    defaultLabel: 'New Processor',
    icon: Settings,
    card: 'bg-fuchsia-400 border-fuchsia-300 text-fuchsia-950',
    accent: '#e879f9',
  },
};

export const SLICE_ICON = Columns3;
export const SLICE_ACCENT = '#818cf8';
/** Stroke for edges whose source kind cannot be resolved. */
export const EDGE_NEUTRAL = '#94a3b8';

/** CQRS cards have a fixed width (w-44); height grows with content. */
export const NODE_WIDTH = 176;
/** Estimated card height before React Flow has measured it. */
export const NODE_HEIGHT = 76;

/** Slice grid geometry. */
export const CELL_WIDTH = 200;
export const CELL_HEIGHT = 148;
/** Vertical margin between a card and the edges of its cell. */
export const CELL_VPAD = 14;
/** Cards inside a slice are fixed to this height so they always fill — and never overflow — their cell. */
export const SLOTTED_NODE_HEIGHT = CELL_HEIGHT - 2 * CELL_VPAD;
/** Width of the swimlane-label gutter on the left edge of a slice. */
export const LANE_GUTTER = 32;
/** Vertical space taken by the slice title bar — the grid starts below it. */
export const SLICE_HEADER_HEIGHT = 44;

export const DEFAULT_LANES = ['Actor', 'Interaction', 'Events', 'Spec Lane'];
export const DEFAULT_COLUMNS = 3;

export function isCqrsKind(type: string | undefined): type is CqrsKind {
  return type !== undefined && type in ELEMENT_STYLES;
}
