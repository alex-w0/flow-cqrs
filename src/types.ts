import type { Edge, Node } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import { Columns3, Database, ListChecks, Monitor, Send, Settings, Zap } from 'lucide-react';

/** The CQRS / Event Modeling element kinds rendered as sticky-note nodes. */
export type CqrsKind = 'command' | 'event' | 'readmodel' | 'screen' | 'processor' | 'gwt';

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

/**
 * One line of a Given/When/Then section:
 *  - `ref`: a reference to another element on the board (by node id). It also
 *    caches the target's `label`/`type` as a snapshot, refreshed when the
 *    element is picked and when it is deleted, so a dangling reference can
 *    still show what it pointed at instead of a blank.
 *  - `text`: a free-text note for things not (yet) modeled.
 *  - `exception`: a free-text expected error (THEN only), shown as a red tag;
 *    starts from a default text the user can override.
 */
export type GwtItem =
  | { kind: 'ref'; ref: string; label?: string; type?: CqrsKind }
  | { kind: 'text'; text: string }
  | { kind: 'exception'; text: string };

/** Default text for a newly added exception, overridable by the user. */
export const DEFAULT_EXCEPTION_TEXT = 'Exception';

/** The three sections of a Given-When-Then scenario. */
export type GwtSection = 'given' | 'when' | 'then';

/** GWT only: the ordered items of each scenario section. */
export type GwtData = Record<GwtSection, GwtItem[]>;

export interface BoardNodeData {
  label: string;
  /** Optional body text for CQRS elements — e.g. command/event attributes, one per line. */
  content?: string;
  /** Screen only: the wireframe mockup shown below the title. */
  wireframe?: Wireframe;
  /** Event only: DCB bounded contexts this event belongs to; undefined means ['default']. */
  contexts?: string[];
  /** Slice only: number of grid columns. */
  columns?: number;
  /** Slice only: swimlane names, top to bottom. */
  lanes?: string[];
  /** GWT only: the Given/When/Then scenario specification. */
  gwt?: GwtData;
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
  gwt: {
    title: 'GWT Scenario',
    defaultLabel: 'New Scenario',
    icon: ListChecks,
    card: 'bg-amber-300 border-amber-200 text-amber-950',
    accent: '#fbbf24',
  },
};

/** Section metadata for the GWT card and editor, in display order. */
export const GWT_SECTIONS: { key: GwtSection; label: string; hint: string }[] = [
  { key: 'given', label: 'Given', hint: 'Preconditions — usually past events' },
  { key: 'when', label: 'When', hint: 'The triggering command' },
  { key: 'then', label: 'Then', hint: 'Expected outcome — events or read models' },
];

/** Element kinds a GWT section may reference (screens and processors are excluded). */
export const GWT_REF_KINDS: CqrsKind[] = ['command', 'event', 'readmodel'];

/**
 * Builds a GwtData by producing each section's items from its key — the single
 * place the three sections are enumerated, so transforms stay in lockstep.
 */
export function buildGwtSections(make: (key: GwtSection) => GwtItem[]): GwtData {
  return { given: make('given'), when: make('when'), then: make('then') };
}

/** A scenario row is worth persisting when it names a reference or carries non-blank text. */
export function isMeaningfulGwtItem(item: GwtItem): boolean {
  return item.kind === 'ref' ? item.ref.length > 0 : item.text.trim().length > 0;
}

/** A fresh, empty scenario for newly added GWT elements. */
export function emptyGwt(): GwtData {
  return buildGwtSections(() => []);
}

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
