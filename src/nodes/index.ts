import type { NodeTypes } from '@xyflow/react';
import CqrsNode from './CqrsNode';
import SliceNode from './SliceNode';

export const nodeTypes: NodeTypes = {
  command: CqrsNode,
  event: CqrsNode,
  readmodel: CqrsNode,
  screen: CqrsNode,
  automation: CqrsNode,
  slice: SliceNode,
};
