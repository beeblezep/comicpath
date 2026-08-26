export function ConstellationEdge({ edge, lit, dimmed }) {
  const dash = edge.type === 'branches-from' ? '6 3'
    : edge.type === 'crossover' ? '3 3'
    : 'none';

  return (
    <line
      x1={edge.x1} y1={edge.y1}
      x2={edge.x2} y2={edge.y2}
      stroke={lit ? '#e8a33d' : '#2a2b38'}
      strokeWidth={lit ? 2 : 1.4}
      strokeDasharray={dash}
      opacity={dimmed ? 0.12 : lit ? 0.9 : 0.45}
      style={{ transition: 'stroke .25s ease, stroke-width .25s ease, opacity .25s ease' }}
    />
  );
}
