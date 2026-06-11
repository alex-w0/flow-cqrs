import type { Wireframe } from '../../types';
import { ElementShape, StrokeShape } from './shapes';

/** Static, scaled-down rendering of a screen wireframe (used inside the node card). */
export default function WireframePreview({ wireframe, className }: { wireframe: Wireframe; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${wireframe.width} ${wireframe.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? 'block w-full'}
      role="img"
      aria-label="Screen wireframe preview"
    >
      <rect width={wireframe.width} height={wireframe.height} fill="#ffffff" />
      {wireframe.elements.map((el) => (
        <ElementShape key={el.id} el={el} />
      ))}
      {wireframe.strokes.map((stroke) => (
        <StrokeShape key={stroke.id} stroke={stroke} />
      ))}
    </svg>
  );
}
