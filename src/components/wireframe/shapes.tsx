import type { WireframeElement, WireframeStroke } from '../../types';

const STROKE = '#475569';
const TEXT_DARK = '#1e293b';
const TEXT_DIM = '#94a3b8';

/**
 * Renders one wireframe mockup primitive as plain SVG. Shared between the
 * editor canvas (wrapped with interaction handlers) and the static preview
 * inside the Screen/UI node.
 */
export function ElementShape({ el }: { el: WireframeElement }) {
  switch (el.kind) {
    case 'button':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={5} fill="#e2e8f0" stroke={STROKE} strokeWidth={1.25} />
          <text
            x={el.x + el.w / 2}
            y={el.y + el.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            fill="#334155"
          >
            {el.text}
          </text>
        </g>
      );
    case 'input':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={4} fill="#ffffff" stroke={STROKE} strokeWidth={1.25} />
          <text x={el.x + 8} y={el.y + el.h / 2} dominantBaseline="central" fontSize={10} fill={TEXT_DIM}>
            {el.text}
          </text>
        </g>
      );
    case 'image':
      return (
        <g stroke={STROKE} strokeWidth={1.25}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#f8fafc" />
          <line x1={el.x} y1={el.y} x2={el.x + el.w} y2={el.y + el.h} />
          <line x1={el.x + el.w} y1={el.y} x2={el.x} y2={el.y + el.h} />
        </g>
      );
    case 'checkbox': {
      const boxY = el.y + (el.h - 12) / 2;
      return (
        <g>
          <rect x={el.x} y={boxY} width={12} height={12} rx={2} fill="#ffffff" stroke={STROKE} strokeWidth={1.25} />
          <polyline
            points={`${el.x + 2.5},${boxY + 6} ${el.x + 5},${boxY + 9} ${el.x + 9.5},${boxY + 3}`}
            fill="none"
            stroke={STROKE}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x={el.x + 18} y={el.y + el.h / 2} dominantBaseline="central" fontSize={10} fill={TEXT_DARK}>
            {el.text}
          </text>
        </g>
      );
    }
    case 'heading':
      return (
        <text x={el.x} y={el.y + el.h / 2} dominantBaseline="central" fontSize={14} fontWeight={700} fill={TEXT_DARK}>
          {el.text}
        </text>
      );
    case 'text':
      return (
        <text x={el.x} y={el.y + el.h / 2} dominantBaseline="central" fontSize={10} fill={STROKE}>
          {el.text}
        </text>
      );
    case 'rect':
      return (
        <rect
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          rx={6}
          fill="none"
          stroke={STROKE}
          strokeWidth={1.25}
          strokeDasharray="5 4"
        />
      );
  }
}

export function StrokeShape({ stroke }: { stroke: WireframeStroke }) {
  let d = '';
  for (let i = 0; i < stroke.points.length; i += 2) {
    d += `${i === 0 ? 'M' : 'L'}${stroke.points[i]} ${stroke.points[i + 1]}`;
  }
  return <path d={d} fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />;
}
