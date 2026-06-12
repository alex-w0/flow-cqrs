import type { BoardEdge, BoardNode } from '../types';
import { contextsOf } from './contexts';

/**
 * Node ids to dim while context highlighting is active.
 *
 * Events dim when they belong to none of the active contexts. Activeness then
 * flows from the active events along edges in both directions — the elements
 * leading to an active event and those consuming it — but never *through* an
 * inactive event. A non-event element dims when its flow contains events yet
 * none of them keep it active; elements with no event anywhere in their flow
 * are exempt. Slices are never dimmed (edges never touch them).
 */
export function computeDimmedIds(
  nodes: BoardNode[],
  edges: BoardEdge[],
  activeContexts: string[],
): Set<string> {
  const dimmed = new Set<string>();
  if (activeContexts.length === 0) return dimmed;

  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  const link = (map: Map<string, string[]>, from: string, to: string) => {
    const list = map.get(from);
    if (list) list.push(to);
    else map.set(from, [to]);
  };
  for (const edge of edges) {
    link(forward, edge.source, edge.target);
    link(reverse, edge.target, edge.source);
  }

  const activeEvents: string[] = [];
  const allEvents: string[] = [];
  const inactiveEvents = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'event') continue;
    allEvents.push(node.id);
    if (contextsOf(node.data).some((c) => activeContexts.includes(c))) activeEvents.push(node.id);
    else inactiveEvents.add(node.id);
  }

  /** Ancestors + descendants of `starts`; nodes in `blocked` are reached but not expanded. */
  const dualReach = (starts: string[], blocked: ReadonlySet<string>): Set<string> => {
    const reached = new Set(starts);
    for (const adjacency of [forward, reverse]) {
      const queue = [...starts];
      const visited = new Set(starts);
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (blocked.has(current)) continue;
        for (const next of adjacency.get(current) ?? []) {
          if (visited.has(next)) continue;
          visited.add(next);
          reached.add(next);
          queue.push(next);
        }
      }
    }
    return reached;
  };

  const reachActive = dualReach(activeEvents, inactiveEvents);
  const reachAnyEvent = dualReach(allEvents, new Set());

  for (const node of nodes) {
    if (node.type === 'slice') continue;
    if (node.type === 'event') {
      if (inactiveEvents.has(node.id)) dimmed.add(node.id);
    } else if (reachAnyEvent.has(node.id) && !reachActive.has(node.id)) {
      dimmed.add(node.id);
    }
  }
  return dimmed;
}
